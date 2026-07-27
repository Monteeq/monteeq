import json
import logging
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import text

# Bind @shared_task to the Redis-backed worker app
import app.worker  # noqa: F401
from app.db.session import SessionLocal
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

PENDING_KEY = "video_events:pending"
FAILED_KEY = "video_events:failed"
BATCH_SIZE = 500


@shared_task(name="tasks.events.flush_video_events")
def flush_video_events():
    """LPOP up to 500 pending events from Redis and bulk-insert into video_events."""
    events = []
    for _ in range(BATCH_SIZE):
        raw = redis_client.lpop(PENDING_KEY)
        if raw is None:
            break
        try:
            events.append(json.loads(raw))
        except (json.JSONDecodeError, TypeError):
            logger.warning("Skipping malformed event: %s", raw)

    if not events:
        return

    db = SessionLocal()
    try:
        db.execute(
            text(
                "INSERT INTO video_events (user_id, video_id, event_type, watch_seconds, session_id, created_at) "
                "VALUES (:user_id, :video_id, :event_type, :watch_seconds, :session_id, now())"
            ),
            events,
        )
        db.commit()
        logger.info("Flushed %d video events to database", len(events))
    except Exception as e:
        db.rollback()
        logger.error("Failed to flush %d video events: %s", len(events), e)
        pipe = redis_client.pipeline()
        for ev in events:
            pipe.rpush(FAILED_KEY, json.dumps(ev))
        pipe.execute()
    finally:
        db.close()
