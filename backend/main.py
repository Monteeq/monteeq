from fastapi import FastAPI, Depends, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.api import api_router
from app.api.v1.endpoints import seo
from app.core import dependencies
from app.core.config import CORS_ALLOW_ORIGIN_REGEX, CORS_ALLOWED_ORIGINS
from app.core.error_handlers import register_exception_handlers
from fastapi.middleware.gzip import GZipMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis


# Database initialized via Supabase schema
import app.worker

from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import uuid
import logging
import os

logger = logging.getLogger("monteeq")
ALLOWED_ORIGINS = set(CORS_ALLOWED_ORIGINS)

app = FastAPI(
    title="Monteeq Video Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


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
    """Identify and block malicious bots globally with CORS support."""

    async def dispatch(self, request: Request, call_next):
        from app.core import security

        # Short-circuit CORS preflight — return 200 with CORS headers immediately.
        # This prevents BaseHTTPMiddleware body-buffering from interfering with
        # CORSMiddleware and stops the form-body parser from running on OPTIONS.
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin", "")
            response = JSONResponse(status_code=200, content={})
            if origin in ALLOWED_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Max-Age"] = "600"
            return response

        # Skip bot check for static files, health, and SEO endpoints
        if (request.url.path.startswith("/static") or
                request.url.path == "/health" or
                "/seo/" in request.url.path or
                "sitemap" in request.url.path):
            return await call_next(request)

        # Heuristic bot check
        if security.is_bot(request):
            ua = request.headers.get("User-Agent", "Unknown")
            logger.warning(f"Bot detected and blocked: {ua} from {request.client.host if request.client else 'unknown'}")
            origin = request.headers.get("Origin", "")
            response = JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Automated traffic detected.", "ua": ua}
            )
            if origin in ALLOWED_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

        return await call_next(request)


app.add_middleware(AntiBotMiddleware)

# CORS middleware - MUST be added before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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


# ── WebSocket Chat Endpoint ───────────────────────────────────────────────────
from app.core.ws_manager import manager as ws_manager

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket, token: str = Query(...)):
    """Authenticated WebSocket for real-time chat message push."""
    from jose import jwt, JWTError
    from app.core.config import SECRET_KEY, ALGORITHM
    from app.db.session import SessionLocal
    from app.models.models import User

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=4001)
            return
    finally:
        db.close()

    await ws_manager.connect(user.id, websocket)
    try:
        while True:
            # Keep-alive: client sends periodic pings, we just read and discard
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user.id, websocket)
    except Exception:
        ws_manager.disconnect(user.id, websocket)


# ── Initialization ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Auto-run pending Alembic migrations so missing columns never crash the app.
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied successfully")
    except Exception as e:
        logger.warning(f"Alembic auto-migration skipped/failed: {e}")

    from app.core.config import REDIS_URL
    redis = aioredis.from_url(
        REDIS_URL,
        encoding="utf8",
        decode_responses=True,
        max_connections=5,
    )
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")

@app.get("/", tags=["System"])
async def root_health():
    """Default root endpoint for simple load balancer health checks."""
    return {"status": "ok", "message": "Monteeq Backend API is running"}

@app.get("/health", tags=["System"])
async def health_check():
    """Simple liveness probe used by load balancers and uptime monitors."""
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "service": "monteeq-backend"},
    )
