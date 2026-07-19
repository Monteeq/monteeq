from fastapi import APIRouter, Request, BackgroundTasks, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

from app.db.session import get_db
from app.models.models import User, Video, Like, Comment, Challenge

router = APIRouter()
logger = logging.getLogger(__name__)

class MetricEvent(BaseModel):
    type: str
    video_id: Any
    timestamp: int
    duration_ms: float = None

class MetricsBatchRequest(BaseModel):
    events: List[MetricEvent]

@router.get("/public")
def public_platform_stats(db: Session = Depends(get_db)):
    """
    Lightweight public counters for the marketing landing page.
    No auth. Safe aggregates only.
    """
    creators = (
        db.query(func.count(User.id))
        .filter(User.role != "admin")
        .filter((User.is_active.is_(True)) | (User.is_active.is_(None)))
        .scalar()
        or 0
    )
    approved = Video.status == "approved"
    videos = db.query(func.count(Video.id)).filter(approved).scalar() or 0
    views = (
        db.query(func.coalesce(func.sum(Video.views), 0)).filter(approved).scalar() or 0
    )
    likes = db.query(func.count(Like.id)).scalar() or 0
    comments = db.query(func.count(Comment.id)).scalar() or 0
    open_challenges = (
        db.query(func.count(Challenge.id)).filter(Challenge.is_open.is_(True)).scalar() or 0
    )
    featured_challenge: Optional[Challenge] = (
        db.query(Challenge)
        .filter(Challenge.is_open.is_(True))
        .order_by(Challenge.created_at.desc())
        .first()
    )
    countries = (
        db.query(func.count(func.distinct(User.country)))
        .filter(
            User.country.isnot(None),
            User.country != "",
            User.country != "Unknown",
            User.role != "admin",
        )
        .scalar()
        or 0
    )

    return {
        "creators": int(creators),
        "videos": int(videos),
        "views": int(views),
        "likes": int(likes),
        "comments": int(comments),
        "open_challenges": int(open_challenges),
        "countries": int(countries),
        "featured_challenge": (
            {
                "title": featured_challenge.title,
                "prize": featured_challenge.prize,
                "entry_count": featured_challenge.entry_count or 0,
            }
            if featured_challenge
            else None
        ),
    }

@router.post("/batch")
async def batch_metrics(request: MetricsBatchRequest, background_tasks: BackgroundTasks):
    """
    Receive a batch of metrics from the frontend.
    For now, we just log them. In production, these should be flushed to 
    a specialized metrics store (e.g. ClickHouse, Prometheus, or Mixpanel).
    """
    # background_tasks.add_task(process_metrics, request.events)
    logger.info(f"Received {len(request.events)} metric events from client")
    return {"status": "ok", "received": len(request.events)}

async def process_metrics(events: List[MetricEvent]):
    # Future implementation: sync to analytics DB
    pass
