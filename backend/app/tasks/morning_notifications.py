"""
Morning notification task — runs daily at 8 AM UTC via Celery Beat.

For each active user who has opted into marketing/weekly emails, we pick
the top recommended home video from their personalised feed and send:
  - An in-app notification (always stored in DB)
  - A web push (if subscribed)
  - An email (if email_marketing == True)
"""
import logging
from celery import shared_task
from app.db.session import SessionLocal
from app.models.models import User
from app.utils.push import notify_user_push
from app.services import recommendation_service as rs

logger = logging.getLogger(__name__)

# Greetings rotate so it feels fresh
_GREETINGS = [
    "Good morning! 🌅",
    "Rise and edit! ✂️",
    "Morning! Your feed is ready 🎬",
    "Start your day with a great edit 🌄",
    "Good morning — new content awaits! 🎥",
]

import hashlib
from datetime import date


def _greeting_for_user(user_id: int) -> str:
    """Deterministically pick a greeting based on user_id + today's date."""
    seed = hashlib.md5(f"{user_id}-{date.today().isoformat()}".encode()).hexdigest()
    idx = int(seed, 16) % len(_GREETINGS)
    return _GREETINGS[idx]


@shared_task(name="tasks.morning.send_morning_notifications")
def send_morning_notifications():
    """
    Celery Beat task: send a personalised good-morning notification to
    every active user who has opted in (email_marketing OR notif_new_follower
    acts as the general notification opt-in gate).

    We use email_marketing as the explicit opt-in for promotional/morning
    messages so users who disabled it are not disturbed.
    """
    db = SessionLocal()
    sent = 0
    skipped = 0
    errors = 0

    try:
        # Fetch users who are active and haven't explicitly opted out of marketing
        users = (
            db.query(User)
            .filter(
                User.is_active == True,
                User.email_marketing == True,
                User.email.isnot(None),
            )
            .all()
        )

        logger.info(f"[morning_notif] Starting for {len(users)} opted-in users")

        for user in users:
            try:
                # Get 1 personalised home video recommendation
                feed = rs.build_feed(
                    db,
                    user_id=user.id,
                    video_type="home",
                    feed_type="foryou",
                    limit=1,
                )

                if not feed:
                    # Fall back to a trending video
                    feed = rs._trending_videos(db, video_type="home", history={}, limit=1)

                if not feed:
                    skipped += 1
                    continue

                video = feed[0]
                greeting = _greeting_for_user(user.id)
                title = greeting
                body = f'Watch "{video.title}" — recommended just for you.'
                link = f"/watch/{video.id}"

                notify_user_push(
                    db,
                    user_id=user.id,
                    title=title,
                    body=body,
                    link=link,
                    n_type="morning",
                )
                
                if user.email_marketing and user.email:
                    try:
                        from app.services.email_service import send_email
                        send_email(
                            to_email=user.email,
                            subject=f"{greeting} — Your Monteeq pick today",
                            title=greeting,
                            message=body,
                            action_text="Watch Now",
                            action_url=f"https://monteeq.com{link}",
                        )
                    except Exception as e:
                        logger.error(f"[morning_notif] Email failed for user {user.id}: {e}")

                sent += 1

            except Exception as e:
                errors += 1
                logger.error(f"[morning_notif] Failed for user {user.id}: {e}")

        logger.info(
            f"[morning_notif] Done — sent={sent}, skipped={skipped}, errors={errors}"
        )

    except Exception as e:
        logger.error(f"[morning_notif] Fatal error: {e}")
    finally:
        db.close()
