#!/bin/bash

# Monteeq Platform Native Service Launcher

# Ensure we are in the project root
PROJECT_ROOT=$(pwd)
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting Monteeq Platform Services..."

# 1. Start Rust Video Service
echo "📦 Starting Rust Video Service (Port 8081)..."
cd "$PROJECT_ROOT/video-service"
./target/debug/monteeq-video-service > "$LOG_DIR/video-service.log" 2>&1 &
RUST_PID=$!

# 2. Start FastAPI Backend
echo "🐍 Starting FastAPI Backend (Port 8000)..."
cd "$PROJECT_ROOT/backend"
source .venv/bin/activate 2>/dev/null || echo "Warning: Virtualenv not found"
uvicorn main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# 3. Start Celery Worker
echo "👷 Starting Celery Worker (Concurrency 1)..."
celery -A app.worker.celery_app worker --loglevel=info --concurrency=1 > "$LOG_DIR/celery.log" 2>&1 &
CELERY_PID=$!

# 4. Start Frontend
echo "💻 Starting React Frontend..."
cd "$PROJECT_ROOT/frontend"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "------------------------------------------------"
echo "✅ All services initiated!"
echo "------------------------------------------------"
echo "API:      http://localhost:8000"
echo "Frontend: http://localhost:5173 (check logs for exact port)"
echo "Logs:     $LOG_DIR"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Trap SIGINT to kill all background processes
trap "kill $RUST_PID $BACKEND_PID $CELERY_PID $FRONTEND_PID; echo 'Stopped all services.'; exit" SIGINT

# Wait for all processes
wait
