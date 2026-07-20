#!/bin/bash
set -e

echo "Starting Celery worker in background..."
celery -A app.worker.celery_app worker \
    --loglevel=info \
    --concurrency=1 \
    --pool=solo &

echo "Starting Celery beat scheduler in background..."
celery -A app.worker.celery_app beat \
    --loglevel=info &

echo "Starting FastAPI server on port 7860..."
exec uvicorn main:app --host 0.0.0.0 --port 7860 --workers 1
