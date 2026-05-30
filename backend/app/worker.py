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

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    broker_pool_limit=5,
    redis_max_connections=5,
    worker_concurrency=4,
    broker_transport_options={
        'visibility_timeout': 3600,
        'max_connections': 5
    },
    beat_schedule={
        # Send personalised good-morning notification to opted-in users daily at 08:00 UTC
        "morning-notifications-daily": {
            "task": "tasks.morning.send_morning_notifications",
            "schedule": crontab(hour=8, minute=0),
        },
    },
)

