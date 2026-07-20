import socket
import sys

# Refuse execution on the specific Google Cloud instance
if socket.gethostname() == "instance-20260427-114320":
    sys.exit("Error: Celery is not allowed to run on instance-20260427-114320.")

from celery import Celery
from celery.schedules import crontab
from app.core.config import REDIS_URL

celery_app = Celery(
    "monteeq_worker",
    broker=REDIS_URL,
    # result_backend removed to save connections
    include=[
        "app.tasks.video_tasks",
        "app.tasks.email_tasks",
        "app.tasks.morning_notifications",
    ]
)

# Ensure @shared_task.delay() from FastAPI/scripts always uses this Redis broker
# (otherwise Celery falls back to amqp://localhost and enqueue silently fails).
celery_app.set_default()
celery_app.set_current()

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    # Stay well under Redis Cloud free-tier ~30 concurrent clients
    broker_pool_limit=2,
    redis_max_connections=5,
    # solo keeps Redis client count low (also required on Windows)
    worker_pool="solo",
    worker_concurrency=1,
    broker_transport_options={
        'visibility_timeout': 3600,
        'max_connections': 2,
    },
    beat_schedule={
        # Morning push notifications — daily 08:00 UTC
        "morning-notifications-daily": {
            "task": "tasks.morning.send_morning_notifications",
            "schedule": crontab(hour=8, minute=0),
        },
        # Onboarding nudge check — every hour (catches D+3 and D+7 windows)
        "check-onboarding-nudges": {
            "task": "tasks.email.check_onboarding_nudges",
            "schedule": crontab(minute=0),
        },
        # Inactivity ladder — hourly check (sends during local morning)
        "check-inactivity": {
            "task": "tasks.email.check_inactivity",
            "schedule": crontab(minute=0),
        },
        # Weekly digest — hourly on Monday (sends during local morning)
        "weekly-digest": {
            "task": "tasks.email.send_weekly_digest_batch",
            "schedule": crontab(minute=0, day_of_week=1),
        },
        # Monthly stats — 1st of every month, 10:00 UTC
        "monthly-stats": {
            "task": "tasks.email.send_monthly_stats_batch",
            "schedule": crontab(hour=10, minute=0, day_of_month=1),
        },
        # Creator growth drip — hourly on Tuesday (sends during local morning)
        "creator-growth-tips": {
            "task": "tasks.email.send_growth_drip",
            "schedule": crontab(minute=0, day_of_week=2),
        },
        # Social activity batch digest — daily 18:00 UTC
        "flush-social-activity-batch": {
            "task": "tasks.email.flush_social_batch",
            "schedule": crontab(hour=18, minute=0),
        },
    },
)


