from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete, update
from typing import Optional
from datetime import datetime, timedelta

from app.db.async_session import get_async_db
from app.schemas import library as schemas
from app.models.library import WatchHistory
from app.models.models import Video
from app.core.async_dependencies import get_async_current_user

router = APIRouter()

@router.get("/", response_model=schemas.HistoryResponse)
async def get_history(
    page: int = 1,
    limit: int = 20,
    filter: Optional[str] = Query(None, pattern="^(today|this_week|this_month|all)$"),
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    offset = (page - 1) * limit
    query = select(WatchHistory).filter(WatchHistory.user_id == current_user.id)
    
    if filter == "today":
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(WatchHistory.watched_at >= today)
    elif filter == "this_week":
        week_ago = datetime.utcnow() - timedelta(days=7)
        query = query.filter(WatchHistory.watched_at >= week_ago)
    elif filter == "this_month":
        month_ago = datetime.utcnow() - timedelta(days=30)
        query = query.filter(WatchHistory.watched_at >= month_ago)
    
    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Items
    query = query.order_by(WatchHistory.watched_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": offset + limit < total
    }

@router.delete("/")
async def clear_history(
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    await db.execute(delete(WatchHistory).filter(WatchHistory.user_id == current_user.id))
    await db.commit()
    return {"status": "success"}

@router.delete("/{video_id}")
async def remove_from_history(
    video_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    await db.execute(delete(WatchHistory).filter(
        WatchHistory.user_id == current_user.id,
        WatchHistory.video_id == video_id
    ))
    await db.commit()
    return {"status": "success"}

@router.patch("/{video_id}/progress")
async def update_progress(
    video_id: int,
    progress: schemas.HistoryProgressUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    result = await db.execute(select(WatchHistory).filter(
        WatchHistory.user_id == current_user.id,
        WatchHistory.video_id == video_id
    ))
    history = result.scalar_one_or_none()
    
    if not history:
        video = await db.get(Video, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        history = WatchHistory(
            user_id=current_user.id,
            video_id=video_id,
            progress_seconds=progress.progress_seconds,
            duration_seconds=video.duration,
            is_completed=progress.progress_seconds >= video.duration * 0.9 if video.duration > 0 else False
        )
        db.add(history)
    else:
        history.progress_seconds = progress.progress_seconds
        if history.duration_seconds > 0:
            history.is_completed = progress.progress_seconds >= history.duration_seconds * 0.9
        history.watched_at = func.now()
        
    await db.commit()
    return {"status": "success"}
