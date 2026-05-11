import time
import json
import uuid
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import redis

from app.db.session import get_db
from app.core import dependencies
from app.crud import video as crud_video
from app.models.models import Video

router = APIRouter()

from app.core.redis import redis_client

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key")
ALGORITHM = "HS256"
TICKET_EXPIRE_MINUTES = 60

def create_view_ticket(video_id: int, user_id: Optional[int], ip: str):
    payload = {
        "video_id": video_id,
        "user_id": user_id,
        "ip": ip,
        "session_id": str(uuid.uuid4()),
        "iat": int(time.time())
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/{video_id}/init-view")
async def init_view(
    video_id: int, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(dependencies.get_current_user_optional)
):
    # Bot detection
    user_agent = request.headers.get("User-Agent", "").lower()
    bot_keywords = ["bot", "crawler", "spider", "google", "bing", "yahoo", "slurp", "headless", "phantom"]
    if any(keyword in user_agent for keyword in bot_keywords):
        return {"status": "success", "message": "Bot detected, view session not initialized"}

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    user_id = current_user.id if current_user else None
    ip = request.client.host
    
    # Rate limiting: Max 10 view attempts per minute per IP
    rate_limit_key = f"view_rate_limit:{ip}"
    count = redis_client.incr(rate_limit_key)
    if count == 1:
        redis_client.expire(rate_limit_key, 60)
    if count > 10:
        raise HTTPException(status_code=429, detail="Too many view attempts. Please wait.")

    ticket = create_view_ticket(video_id, user_id, ip)
    
    # Store session in Redis
    session_id = str(uuid.uuid4())
    redis_key = f"view_session:{session_id}"
    session_data = {
        "video_id": video_id,
        "accumulated_time": 0,
        "last_heartbeat": int(time.time()),
        "is_validated": False,
        "duration": video.duration or 0 # Fallback if duration not set
    }
    redis_client.setex(redis_key, 3600, json.dumps(session_data))
    
    return {"ticket": ticket, "session_id": session_id}

@router.post("/{video_id}/heartbeat")
async def view_heartbeat(
    video_id: int,
    session_id: str,
    ticket: str,
    db: Session = Depends(get_db)
):
    # 1. Validate Ticket
    try:
        payload = jwt.decode(ticket, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("video_id") != video_id:
            raise HTTPException(status_code=400, detail="Invalid ticket for this video")
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid view ticket")

    # 2. Get Redis Session
    redis_key = f"view_session:{session_id}"
    raw_session = redis_client.get(redis_key)
    if not raw_session:
        raise HTTPException(status_code=404, detail="Session expired or invalid")
    
    session = json.loads(raw_session)
    now = int(time.time())
    
    # 3. Anti-Spoofing: Check time since last heartbeat
    last_hb = session["last_heartbeat"]
    delta = now - last_hb
    
    # Heartbeat expected every 10s. Allow 8s-15s range for network jitter.
    if delta < 8:
        raise HTTPException(status_code=400, detail="Heartbeat sent too frequently")
    
    # 4. Update accumulated time
    # We only increment by the actual delta (capped at 11s to prevent spoofing)
    increment = min(delta, 11)
    session["accumulated_time"] += increment
    session["last_heartbeat"] = now
    
    # 5. Validation Check (30s or 80% of video)
    threshold = 30
    video_duration = session.get("duration", 0)
    if video_duration > 0:
        threshold = min(30, int(video_duration * 0.8))
    
    if not session["is_validated"] and session["accumulated_time"] >= threshold:
        # Commit to DB
        crud_video.increment_view(db, video_id=video_id, user_id=payload.get("user_id"))
        session["is_validated"] = True
        print(f"Video {video_id} view VALIDATED after {session['accumulated_time']}s")
    
    # Update Redis
    redis_client.setex(redis_key, 3600, json.dumps(session))
    
    return {
        "status": "success", 
        "accumulated": session["accumulated_time"],
        "is_validated": session["is_validated"]
    }
