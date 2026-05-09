from celery import Celery
from app.core.config import REDIS_URL

celery_app = Celery(
    "monteeq_worker",
    broker=REDIS_URL,
    # result_backend removed to save connections
    include=["app.tasks.video_tasks", "app.tasks.email_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    broker_pool_limit=3,
    redis_max_connections=5,
    broker_transport_options={
        'visibility_timeout': 3600,
        'max_connections': 5
    }
)
