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
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &
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

# Trap SIGINT/SIGTERM to kill all processes and free up ports
cleanup() {
    echo ""
    echo "Stopping all services..."
    # Terminate background job processes gracefully
    kill $RUST_PID $BACKEND_PID $CELERY_PID $FRONTEND_PID 2>/dev/null
    sleep 1
    # Force kill if still active
    kill -9 $RUST_PID $BACKEND_PID $CELERY_PID $FRONTEND_PID 2>/dev/null
    
    # Explicitly kill any orphaned processes on our ports to free them up
    for port in 8000 8081 5173; do
        if command -v lsof >/dev/null 2>&1; then
            pids=$(lsof -t -i:$port 2>/dev/null)
            if [ ! -z "$pids" ]; then
                kill -9 $pids 2>/dev/null
            fi
        elif command -v fuser >/dev/null 2>&1; then
            fuser -k $port/tcp >/dev/null 2>&1
        fi
    done
    
    # Kill any dangling celery workers
    pkill -f "celery -A app.worker.celery_app" 2>/dev/null
    
    echo "Stopped all services."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for all processes
wait
