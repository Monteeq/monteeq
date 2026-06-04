"""
email_trigger.py — Monteeq Email Automation Engine

Central service that all API routes and Celery tasks call to send emails.
Enforces:
  - Per-template cooldowns
  - Daily / weekly send caps
  - User preference checks
  - Deduplication logging (EmailLog)

Usage:
    from app.services.email_trigger import EmailTrigger
    EmailTrigger(db).welcome(user)
    EmailTrigger(db).first_like(user, liker, video)
"""

import logging
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager

from sqlalchemy.orm import Session

from app.models.models import User, EmailLog
from app.services import email_service as es

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Max emails a user can receive per rolling period (excludes P0 transactional)
MAX_PER_DAY   = 3
MAX_PER_WEEK  = 7
MAX_PER_MONTH = 20

# Templates exempt from all caps and preference checks
P0_EXEMPT = {
    "verification", "password_reset", "email_changed",
    "password_changed", "new_device_login", "suspicious_login",
    "account_locked", "payment_failed",
}

# Per-template cooldown periods
COOLDOWNS: dict[str, timedelta] = {
    "welcome":              timedelta(days=9999),  # once ever
    "onboarding_nudge_3":  timedelta(days=4),
    "onboarding_nudge_7":  timedelta(days=4),
    "first_video":         timedelta(days=9999),
    "first_follower":      timedelta(days=9999),
    "first_like":          timedelta(days=9999),
    "first_comment":       timedelta(days=9999),
    "weekly_digest":       timedelta(days=6),
    "monthly_stats":       timedelta(days=28),
    "reengagement_3":      timedelta(days=4),
    "reengagement_7":      timedelta(days=7),
    "reengagement_14":     timedelta(days=14),
    "reengagement_30":     timedelta(days=30),
    "reengagement_60":     timedelta(days=60),
    "reengagement_90":     timedelta(days=90),
    "pro_upgrade":         timedelta(days=9999),
    "growth_tip":          timedelta(days=7),
    "milestone_followers": timedelta(days=1),
    "milestone_views":     timedelta(days=1),
    "challenge_exit":      timedelta(days=1),
    "social_batch":        timedelta(hours=24),
    "security_new_device": timedelta(hours=1),
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _last_sent(db: Session, user_id: int, template: str) -> datetime | None:
    row = (
        db.query(EmailLog)
        .filter_by(user_id=user_id, template=template)
        .filter(EmailLog.bounced == False, EmailLog.unsubscribed == False)
        .order_by(EmailLog.sent_at.desc())
        .first()
    )
    return row.sent_at.replace(tzinfo=timezone.utc) if row else None


def _daily_count(db: Session, user_id: int) -> int:
    since = _now() - timedelta(days=1)
    return (
        db.query(EmailLog)
        .filter(EmailLog.user_id == user_id, EmailLog.sent_at >= since)
        .filter(~EmailLog.template.in_(P0_EXEMPT))
        .count()
    )


def _weekly_count(db: Session, user_id: int) -> int:
    since = _now() - timedelta(days=7)
    return (
        db.query(EmailLog)
        .filter(EmailLog.user_id == user_id, EmailLog.sent_at >= since)
        .filter(~EmailLog.template.in_(P0_EXEMPT))
        .count()
    )


def _log(db: Session, user_id: int, template: str, subject: str):
    db.add(EmailLog(user_id=user_id, template=template, subject=subject))
    db.commit()


def _check_prefs(user: User, template: str) -> bool:
    """Return True if user's email preferences allow this template."""
    if template in P0_EXEMPT:
        return True
    # Digest / tips / marketing
    if template in ("weekly_digest", "monthly_stats", "growth_tip"):
        return bool(user.email_weekly)
    # Challenge-related
    if template.startswith("challenge"):
        return bool(user.email_challenges)
    # Social (follower, like, comment)
    if template in ("first_follower", "first_like", "first_comment", "social_batch"):
        return True  # user-level pref via notif_* columns
    return True  # default allow


def _can_send(db: Session, user: User, template: str) -> bool:
    """Full gate check: prefs → caps → cooldown."""
    if not _check_prefs(user, template):
        logger.debug("email blocked by prefs: user=%s template=%s", user.id, template)
        return False

    if template not in P0_EXEMPT:
        if _daily_count(db, user.id) >= MAX_PER_DAY:
            logger.debug("email blocked by daily cap: user=%s", user.id)
            return False
        if _weekly_count(db, user.id) >= MAX_PER_WEEK:
            logger.debug("email blocked by weekly cap: user=%s", user.id)
            return False

    cooldown = COOLDOWNS.get(template)
    if cooldown:
        last = _last_sent(db, user.id, template)
        if last and (_now() - last) < cooldown:
            logger.debug("email blocked by cooldown: user=%s template=%s", user.id, template)
            return False

    return True


# ── Main Service Class ────────────────────────────────────────────────────────

class EmailTrigger:
    """
    Usage:
        t = EmailTrigger(db)
        t.welcome(user)
        t.first_like(owner, liker, video)
    """

    def __init__(self, db: Session):
        self.db = db

    def _fire(self, user: User, template: str, subject: str, fn, *args, **kwargs) -> bool:
        if not _can_send(self.db, user, template):
            return False
        try:
            ok = fn(*args, **kwargs)
            if ok:
                _log(self.db, user.id, template, subject)
            return ok
        except Exception as e:
            logger.error("Email send error — template=%s user=%s: %s", template, user.id, e)
            return False

    # ── Acquisition ───────────────────────────────────────────────────────────

    def verification(self, user: User, code: str) -> bool:
        return self._fire(
            user, "verification", f"{code} is your Monteeq code",
            es.send_verification_email, user.email, code,
        )

    def welcome(self, user: User) -> bool:
        return self._fire(
            user, "welcome", f"Welcome to Monteeq, {user.username}",
            es.send_welcome_email, user.email, user.username,
        )

    def password_reset(self, user: User, token: str) -> bool:
        return self._fire(
            user, "password_reset", "Reset your Monteeq password",
            es.send_password_reset_email, user.email, token,
        )

    # ── Activation ────────────────────────────────────────────────────────────

    def onboarding_nudge(self, user: User, days: int) -> bool:
        template = f"onboarding_nudge_{days}"
        return self._fire(
            user, template, "Your profile is ready — add your first video",
            es.send_day3_nudge_email, user.email, user.username,
        )

    def first_video(self, user: User, video_title: str, video_url: str) -> bool:
        return self._fire(
            user, "first_video", f"Your video is live — {video_title}",
            es.send_first_video_email, user.email, user.username, video_title, video_url,
        )

    def first_follower(self, user: User, follower_name: str) -> bool:
        return self._fire(
            user, "first_follower", f"{follower_name} followed you",
            es.send_first_follower_email, user.email, user.username, follower_name,
        )

    def first_like(self, user: User, liker_name: str, video_title: str, video_url: str) -> bool:
        return self._fire(
            user, "first_like", "Your video got its first like",
            es.send_first_like_email, user.email, user.username, video_title, liker_name, video_url,
        )

    def first_comment(self, user: User, video_title: str, commenter_name: str, comment_content: str, video_url: str) -> bool:
        return self._fire(
            user, "first_comment", f"New comment from {commenter_name}",
            es.send_first_comment_email, user.email, user.username, video_title, commenter_name, comment_content, video_url,
        )

    def mention(self, user: User, mentioner_name: str, context_text: str, action_url: str) -> bool:
        return self._fire(
            user, "mention", f"{mentioner_name} mentioned you",
            es.send_mention_email, user.email, user.username, mentioner_name, context_text, action_url,
        )


    # ── Engagement ────────────────────────────────────────────────────────────

    def weekly_digest(self, user: User, videos: list) -> bool:
        return self._fire(
            user, "weekly_digest", "This week on Monteeq",
            es.send_weekly_digest_email, [user.email], videos,
        )

    def monthly_stats(self, user: User, month: str, stats: dict) -> bool:
        return self._fire(
            user, "monthly_stats", f"Your {month} stats on Monteeq",
            es.send_monthly_stats_email, user.email, user.username, month, stats,
        )

    # ── Retention ────────────────────────────────────────────────────────────

    def reengagement(self, user: User, inactive_days: int) -> bool:
        template = f"reengagement_{inactive_days}"
        return self._fire(
            user, template, "Good time to post something new",
            es.send_reengagement_email, user.email, user.username, inactive_days,
        )

    # ── Transactional ─────────────────────────────────────────────────────────

    def pro_upgrade(self, user: User) -> bool:
        return self._fire(
            user, "pro_upgrade", "You're now on Monteeq Pro",
            es.send_pro_upgrade_email, user.email, user.username,
        )

    def challenge_exit(self, user: User, challenge_title: str) -> bool:
        return self._fire(
            user, "challenge_exit", f"Update on Challenge: {challenge_title}",
            es.send_challenge_exit_email, user.email, user.username, challenge_title,
        )

    # ── Security & Subscription (Sprint 2 additions) ──────────────────────────

    def security(self, user: User, template_type: str, **kwargs) -> bool:
        template = f"security_{template_type}"
        return self._fire(
            user, template, "Security notification",
            es.send_security_email, user.email, template_type, user.username, **kwargs,
        )

    def subscription(self, user: User, template_type: str, **kwargs) -> bool:
        template = f"subscription_{template_type}"
        return self._fire(
            user, template, "Subscription notification",
            es.send_subscription_email, user.email, template_type, user.username, **kwargs,
        )

    # ── Growth, Celebration & Batching (Sprint 3 additions) ───────────────────

    def growth_drip(self, user: User, week: int) -> bool:
        template = f"growth_drip_{week}"
        return self._fire(
            user, template, "Creator growth tips",
            es.send_growth_drip_email, user.email, user.username, week,
        )

    def celebration(self, user: User, template_type: str, **kwargs) -> bool:
        template = f"celebration_{template_type}"
        return self._fire(
            user, template, "Congratulations!",
            es.send_celebration_email, user.email, user.username, template_type, **kwargs,
        )

    def social_batch(self, user: User, summary_text: str) -> bool:
        return self._fire(
            user, "social_batch", "New activity on your profile",
            es.send_social_batch_email, user.email, user.username, summary_text,
        )

