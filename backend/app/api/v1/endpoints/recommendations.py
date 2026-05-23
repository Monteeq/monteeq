import logging
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Video, VideoInteraction
from app.schemas import schemas
from app.core.dependencies import get_current_user, get_current_user_optional
from app.services import recommendation_service as rs

log = logging.getLogger("monteeq.recommend")
router = APIRouter()

# Valid video types this engine supports
VALID_TYPES = {"flash", "home"}


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class TrackEventIn(BaseModel):
    """Payload for a single user-video interaction event."""
    video_id: int
    watch_time: float           # seconds watched
    duration: float = 0.0      # 0 → use stored video duration
    liked: bool = False
    skipped: bool = False
    replayed: bool = False
    timestamp: Optional[datetime] = None

    @field_validator("watch_time", "duration")
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("watch_time and duration must be >= 0")
        return v


class TrackEventOut(BaseModel):
    interaction_id: int
    interaction_score: float
    completion_rate: float
    skipped_fast: bool
    message: str


# ─── POST /track ──────────────────────────────────────────────────────────────

@router.post("/track", response_model=TrackEventOut)
def track_event(
    event: TrackEventIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
   
    user_id: int = current_user.id

    # Fetch only the columns we need for a fast existence check
    video_row = (
        db.query(Video.id, Video.duration, Video.video_type)
        .filter(Video.id == event.video_id)
        .first()
    )
    if not video_row:
        raise HTTPException(status_code=404, detail="Video not found")

    duration = event.duration if event.duration > 0 else (video_row.duration or 1.0)

    completion_rate, score, skipped_fast = rs.compute_interaction_score(
        watch_time=event.watch_time,
        duration=duration,
        liked=event.liked,
        skipped=event.skipped,
        replayed=event.replayed,
    )

    interaction = VideoInteraction(
        user_id=user_id,
        video_id=event.video_id,
        watch_time=event.watch_time,
        duration=duration,
        liked=event.liked,
        skipped=event.skipped,
        replayed=event.replayed,
        completion_rate=completion_rate,
        skipped_fast=skipped_fast,
        interaction_score=score,
        timestamp=event.timestamp or datetime.utcnow(),
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    rs.record_skip_event(user_id, event.watch_time)

    # Invalidate ALL feed types for this user so both home and flash refresh
    rs.invalidate_cache(user_id)

    # Background: update tag-affinity AND watch-history (owns its own DB session)
    background_tasks.add_task(
        rs.update_user_profile_background,
        user_id,
        event.video_id,
        score,
        event.watch_time,
        completion_rate,
    )

    log.info(
        "[track] user=%d video=%d type=%s score=%.3f completion=%.2f fast_skip=%s",
        user_id, event.video_id, video_row.video_type,
        score, completion_rate, skipped_fast,
    )

    return TrackEventOut(
        interaction_id=interaction.id,
        interaction_score=round(score, 4),
        completion_rate=round(completion_rate, 4),
        skipped_fast=skipped_fast,
        message="Event tracked successfully",
    )


# ─── GET /feed ────────────────────────────────────────────────────────────────

@router.get("/feed", response_model=List[schemas.Video])
def get_recommended_feed(
    video_type: str = "flash",
    feed_type: str = "foryou",
    limit: int = 20,
    mood: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
   
    if video_type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"video_type must be one of: {', '.join(sorted(VALID_TYPES))}",
        )
    if not (1 <= limit <= 50):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 50")

    limit = min(limit, 3)

    if current_user:
        feed = rs.build_feed(
            db,
            user_id=current_user.id,
            video_type=video_type,
            feed_type=feed_type,
            limit=limit,
            mood=mood,
        )
    else:
        # Guest: trending-heavy + exploration, no personalization
        n_trending = round(limit * 0.7)
        trending = rs._trending_videos(db, video_type=video_type, history={}, limit=n_trending)
        explore = rs._exploration_videos(
            db,
            video_type=video_type,
            history={},
            already_returned_ids=[v.id for v in trending],
            limit=limit - len(trending),
            prefer_short=False,
        )
        feed = trending + explore
        for v in feed:
            v.liked_by_user = False

    return feed
