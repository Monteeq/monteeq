from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models.models import Video, Like, View, WatchLater

router = APIRouter()

@router.get("/history", response_model=List[schemas.Video])
def get_history(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Fetch user's watch history."""
    # We join View with Video and order by View.created_at
    videos = (
        db.query(Video)
        .join(View, Video.id == View.video_id)
        .filter(View.user_id == current_user.id)
        .order_by(View.created_at.desc())
        .limit(50)
        .all()
    )
    return videos

@router.get("/liked", response_model=List[schemas.Video])
def get_liked_videos(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Fetch user's liked videos."""
    videos = (
        db.query(Video)
        .join(Like, Video.id == Like.video_id)
        .filter(Like.user_id == current_user.id)
        .order_by(Like.created_at.desc())
        .limit(50)
        .all()
    )
    return videos

@router.get("/watch-later", response_model=List[schemas.Video])
def get_watch_later(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Fetch user's watch later list."""
    videos = (
        db.query(Video)
        .join(WatchLater, Video.id == WatchLater.video_id)
        .filter(WatchLater.user_id == current_user.id)
        .order_by(WatchLater.created_at.desc())
        .limit(50)
        .all()
    )
    return videos

@router.post("/watch-later/{video_id}")
def toggle_watch_later(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Add or remove a video from watch later."""
    existing = db.query(WatchLater).filter(
        WatchLater.user_id == current_user.id,
        WatchLater.video_id == video_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Removed from Watch Later", "added": False}
    else:
        new_entry = WatchLater(user_id=current_user.id, video_id=video_id)
        db.add(new_entry)
        db.commit()
        return {"message": "Added to Watch Later", "added": True}
