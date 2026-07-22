#!/bin/bash
set -e

# Size HTTP workers for the Space CPU tier (clamp 2–4).
# Override with WEB_CONCURRENCY if needed.
CORES=$(nproc 2>/dev/null || echo 2)
if [ -n "${WEB_CONCURRENCY:-}" ]; then
  WORKERS="$WEB_CONCURRENCY"
elif [ "$CORES" -le 1 ]; then
  WORKERS=2
elif [ "$CORES" -ge 4 ]; then
  WORKERS=4
else
  WORKERS="$CORES"
fi

echo "Starting Celery worker in background..."
celery -A app.worker.celery_app worker \
    --loglevel=info \
    --concurrency=1 \
    --pool=solo &

echo "Starting Celery beat scheduler in background..."
celery -A app.worker.celery_app beat \
    --loglevel=info &

echo "Starting FastAPI via gunicorn (${WORKERS} uvicorn workers, $(nproc 2>/dev/null || echo '?') CPU cores)..."
exec gunicorn main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers "$WORKERS" \
    --bind "0.0.0.0:${PORT:-7860}" \
    --timeout 120 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
