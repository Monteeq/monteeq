import json
import logging
from typing import List, Union

from fastapi import APIRouter, Response
from app.schemas.video_events import VideoEventIn, VideoEventBatch
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

router = APIRouter()

PENDING_KEY = "video_events:pending"


@router.post("/video", status_code=202)
def ingest_video_events(payload: Union[VideoEventBatch, List[VideoEventIn]]):
    """Accept one or a batch of video engagement events and push to Redis for async processing."""
    events = payload.events if isinstance(payload, VideoEventBatch) else payload

    if not events:
        return Response(status_code=202)

    pipe = redis_client.pipeline()
    for ev in events:
        pipe.rpush(
            PENDING_KEY,
            json.dumps({
                "user_id": ev.user_id,
                "video_id": ev.video_id,
                "event_type": ev.event_type.value,
                "watch_seconds": ev.watch_seconds,
                "session_id": ev.session_id,
            }),
        )
    pipe.execute()

    logger.debug("Enqueued %d video events to Redis", len(events))
    return Response(status_code=202)
