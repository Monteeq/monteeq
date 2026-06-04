"""
Lifecycle email Celery tasks for Monteeq.
Registered in worker.py beat_schedule.
"""
import logging
from datetime import datetime, timedelta, timezone
from celery import shared_task

from app.db.session import SessionLocal
from app.models.models import User, Challenge, Video
from app.services.email_service import (
    send_challenge_announcement_batch,
    send_weekly_digest_email,
    send_monthly_stats_email,
)
from app.services.email_trigger import EmailTrigger

logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc)


def is_local_morning(user: User) -> bool:
    """
    Check if the current time is local morning (09:00 to 11:00) for the user.
    Estimates offset using user.country, falls back to UTC.
    """
    offsets = {
        "NG": 1, "NGR": 1, "NIGERIA": 1,
        "GB": 1, "UK": 1, "UNITED KINGDOM": 1,
        "US": -5, "USA": -5, "UNITED STATES": -5,
        "CA": -5, "CANADA": -5,
        "ZA": 2, "SOUTH AFRICA": 2,
        "IN": 5.5, "INDIA": 5.5,
    }
    country = (user.country or "").upper().strip()
    offset = offsets.get(country, 0)
    # Convert timezone offset float/int to hours
    local_hour = (datetime.now(timezone.utc) + timedelta(hours=offset)).hour
    return 9 <= local_hour <= 11



# ── Challenge announcement (existing, kept for compat) ──────────────────────

@shared_task(name="tasks.email.queue_new_challenge_announcement")
def queue_new_challenge_announcement(challenge_id: int):
    """Fetch opted-in users and BCC them a challenge announcement."""
    db = SessionLocal()
    try:
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not challenge:
            logger.error("Challenge %s not found.", challenge_id)
            return

        subscribers = db.query(User).filter(
            User.email_challenges == True,
            User.email.isnot(None),
        ).all()

        if not subscribers:
            logger.info("No opted-in users. Skipping challenge announcement.")
            return

        emails = [u.email for u in subscribers]
        end_date_str = challenge.end_date.strftime("%B %d, %Y") if challenge.end_date else "TBD"

        for i in range(0, len(emails), 50):
            batch = emails[i:i + 50]
            send_challenge_announcement_batch(
                bcc_emails=batch,
                title=challenge.title,
                prize=challenge.prize,
                end_date=end_date_str,
            )
        logger.info("Challenge '%s' announced to %d users.", challenge.title, len(emails))
    except Exception as e:
        logger.error("queue_new_challenge_announcement failed: %s", e)
    finally:
        db.close()


# ── Inactivity ladder (runs daily at 09:00 UTC) ──────────────────────────────

@shared_task(name="tasks.email.check_inactivity")
def check_inactivity():
    """
    Checks users at each inactivity threshold and queues re-engagement emails.
    Only one tier fires per user per run (the most urgent matching threshold).
    """
    db = SessionLocal()
    try:
        thresholds = [3, 7, 14, 30, 60, 90]
        trigger = EmailTrigger(db)

        for days in thresholds:
            window_end   = _now() - timedelta(days=days)
            window_start = window_end - timedelta(hours=23, minutes=59)

            users = (
                db.query(User)
                .filter(
                    User.is_active == True,
                    User.email_marketing == True,
                )
                .all()
            )

            sent = 0
            for user in users:
                if not is_local_morning(user):
                    continue
                last_active = getattr(user, "last_active", None) or user.created_at
                if last_active and hasattr(last_active, "replace"):
                    last_active = last_active.replace(tzinfo=timezone.utc)
                if last_active and window_start <= last_active <= window_end:
                    if trigger.reengagement(user, days):
                        sent += 1

            if sent:
                logger.info("Inactivity D%d: sent %d re-engagement emails.", days, sent)
    except Exception as e:
        logger.error("check_inactivity failed: %s", e)
    finally:
        db.close()


# ── Onboarding nudge check (runs hourly) ─────────────────────────────────────

@shared_task(name="tasks.email.check_onboarding_nudges")
def check_onboarding_nudges():
    """
    Fire D+3 and D+7 nudges for users who signed up exactly N days ago
    and still have no uploads.
    """
    db = SessionLocal()
    try:
        trigger = EmailTrigger(db)

        for days in [3, 7]:
            window_end   = _now() - timedelta(days=days)
            window_start = window_end - timedelta(hours=1)

            candidates = (
                db.query(User)
                .filter(
                    User.is_active == True,
                    User.created_at >= window_start,
                    User.created_at < window_end,
                    User.home_uploads == 0,
                    User.flash_uploads == 0,
                )
                .all()
            )

            sent = 0
            for user in candidates:
                if trigger.onboarding_nudge(user, days):
                    sent += 1

            if sent:
                logger.info("Onboarding D%d: sent %d nudge emails.", days, sent)
    except Exception as e:
        logger.error("check_onboarding_nudges failed: %s", e)
    finally:
        db.close()


# ── Weekly digest (runs Monday 09:00 UTC) ────────────────────────────────────

@shared_task(name="tasks.email.send_weekly_digest_batch")
def send_weekly_digest_batch():
    """
    Pull top 5 approved videos from last 7 days and email all opted-in users.
    Personalisation per user can be added in a later sprint.
    """
    db = SessionLocal()
    try:
        week_ago = _now() - timedelta(days=7)
        top_videos = (
            db.query(Video)
            .filter(
                Video.status == "approved",
                Video.created_at >= week_ago,
            )
            .order_by(Video.views.desc())
            .limit(5)
            .all()
        )

        if not top_videos:
            logger.info("No videos for weekly digest. Skipping.")
            return

        video_dicts = [
            {
                "title":   v.title,
                "creator": f"@{v.owner.username}" if v.owner else "",
                "url":     f"https://monteeq.com/watch/{v.public_id}",
            }
            for v in top_videos
        ]

        trigger = EmailTrigger(db)
        users = db.query(User).filter(
            User.is_active == True,
            User.email_weekly == True,
            User.email.isnot(None),
        ).all()

        sent = 0
        for user in users:
            if not is_local_morning(user):
                continue
            if trigger.weekly_digest(user, video_dicts):
                sent += 1

        logger.info("Weekly digest sent to %d users.", sent)
    except Exception as e:
        logger.error("send_weekly_digest_batch failed: %s", e)
    finally:
        db.close()


# ── Monthly stats (runs 1st of month, 10:00 UTC) ─────────────────────────────

@shared_task(name="tasks.email.send_monthly_stats_batch")
def send_monthly_stats_batch():
    """
    Compute last month's stats per creator and send individual recap emails.
    """
    from calendar import month_name
    from sqlalchemy import func as sqlfunc

    db = SessionLocal()
    try:
        now = _now()
        last_month_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1, tzinfo=timezone.utc)
        last_month_end   = now.replace(day=1, tzinfo=timezone.utc)
        month_label      = month_name[last_month_start.month]

        creators = db.query(User).filter(
            User.is_active == True,
            User.email_weekly == True,
            User.home_uploads + User.flash_uploads > 0,
        ).all()

        trigger = EmailTrigger(db)
        sent = 0
        for user in creators:
            # Aggregate stats for this user's videos in last month
            from app.models.models import View, Like
            views = db.query(sqlfunc.count(View.id)).filter(
                View.user_id == user.id,
                View.created_at >= last_month_start,
                View.created_at < last_month_end,
            ).scalar() or 0

            likes = db.query(sqlfunc.count(Like.id)).join(Video).filter(
                Video.owner_id == user.id,
                Like.created_at >= last_month_start,
                Like.created_at < last_month_end,
            ).scalar() or 0

            from app.models.models import Follow
            new_followers = db.query(sqlfunc.count(Follow.id)).filter(
                Follow.following_id == user.id,
                Follow.created_at >= last_month_start,
                Follow.created_at < last_month_end,
            ).scalar() or 0

            new_uploads = db.query(sqlfunc.count(Video.id)).filter(
                Video.owner_id == user.id,
                Video.created_at >= last_month_start,
                Video.created_at < last_month_end,
            ).scalar() or 0

            stats = {
                "views":     views,
                "likes":     likes,
                "followers": new_followers,
                "uploads":   new_uploads,
            }

            if trigger.monthly_stats(user, month_label, stats):
                sent += 1

        logger.info("Monthly stats sent to %d creators.", sent)
    except Exception as e:
        logger.error("send_monthly_stats_batch failed: %s", e)
    finally:
        db.close()


# ── Creator growth drip (runs Tuesday 10:00 UTC) ──────────────────────────────

@shared_task(name="tasks.email.send_growth_drip")
def send_growth_drip():
    """
    Send weekly creator tips to users who uploaded at least one video,
    calculated based on the week number of their account age (Week 1 to 5).
    """
    db = SessionLocal()
    try:
        trigger = EmailTrigger(db)
        # Find active users with at least 1 upload
        users = db.query(User).filter(
            User.is_active == True,
            User.email_marketing == True,
            User.home_uploads + User.flash_uploads > 0,
        ).all()

        sent = 0
        for user in users:
            if not is_local_morning(user):
                continue
            age_days = (_now() - user.created_at.replace(tzinfo=timezone.utc)).days
            week = (age_days // 7) + 1
            if 1 <= week <= 5:
                if trigger.growth_drip(user, week):
                    sent += 1
        logger.info("Growth drip sent to %d users.", sent)
    except Exception as e:
        logger.error("send_growth_drip failed: %s", e)
    finally:
        db.close()


# ── Social notifications batching (runs every 4 hours or daily) ───────────────

@shared_task(name="tasks.email.flush_social_batch")
def flush_social_batch():
    """
    Gather likes, follows, and comments from the last 24 hours,
    and send a summarized social activity batch email.
    """
    from sqlalchemy import func as sqlfunc
    from app.models.models import Like, Follow, Comment

    db = SessionLocal()
    try:
        trigger = EmailTrigger(db)
        since = _now() - timedelta(hours=24)

        # Find users who have received actions
        users = db.query(User).filter(User.is_active == True).all()
        sent = 0

        for user in users:
            # Likes received on user's videos
            likes_count = db.query(sqlfunc.count(Like.id)).join(Video).filter(
                Video.owner_id == user.id,
                Like.created_at >= since,
            ).scalar() or 0

            # Follows received
            follows_count = db.query(sqlfunc.count(Follow.id)).filter(
                Follow.following_id == user.id,
                Follow.created_at >= since,
            ).scalar() or 0

            # Comments received
            comments_count = db.query(sqlfunc.count(Comment.id)).join(Video).filter(
                Video.owner_id == user.id,
                Comment.created_at >= since,
            ).scalar() or 0

            if likes_count == 0 and follows_count == 0 and comments_count == 0:
                continue

            # Construct simple recap summary
            parts = []
            if follows_count > 0:
                parts.append(f"- {follows_count} new follower{'s' if follows_count > 1 else ''}")
            if likes_count > 0:
                parts.append(f"- {likes_count} new like{'s' if likes_count > 1 else ''} on your edits")
            if comments_count > 0:
                parts.append(f"- {comments_count} new comment{'s' if comments_count > 1 else ''} on your videos")

            summary_text = "\n".join(parts)

            if trigger.social_batch(user, summary_text):
                sent += 1

        logger.info("Social notification recap batch flushed to %d users.", sent)
    except Exception as e:
        logger.error("flush_social_batch failed: %s", e)
    finally:
        db.close()

