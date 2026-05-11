from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.api import api_router
from app.api.v1.endpoints import seo
from app.core import dependencies
from app.core.error_handlers import register_exception_handlers
# Database initialized via Supabase schema
import app.worker

from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import uuid
import logging
import os

logger = logging.getLogger("monteeq")

app = FastAPI(
    title="Monteeq Video Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Request-ID Middleware ──────────────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-ID to every request/response for tracing."""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)

# ── Anti-Bot Middleware ───────────────────────────────────────────────────────
class AntiBotMiddleware(BaseHTTPMiddleware):
    """Identify and block malicious bots globally."""
    async def dispatch(self, request: Request, call_next):
        from app.core import security
        
        # 1. Skip check for static files and health
        if request.url.path.startswith("/static") or request.url.path == "/health":
            return await call_next(request)
            
        # 2. Heuristic check
        if security.is_bot(request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Automated traffic detected."}
            )
            
        return await call_next(request)

app.add_middleware(AntiBotMiddleware)

# CORS middleware - MUST be added before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.monteeq.com", "https://monteeq.com", "https://admin.monteeq.com", "https://www.admin.monteeq.com", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_path = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_path), name="static")

# ── Global Exception Handlers ────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")
app.include_router(seo.router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Simple liveness probe used by load balancers and uptime monitors."""
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "service": "monteeq-backend"},
    )
