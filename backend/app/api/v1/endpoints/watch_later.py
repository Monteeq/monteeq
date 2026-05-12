from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta

from app.db.async_session import get_async_db
from app.schemas import library as schemas
from app.models.library import LibraryWatchLater
from app.models.models import Video
from app.core.async_dependencies import get_async_current_user

router = APIRouter()

@router.get("/", response_model=schemas.WatchLaterResponse)
async def get_watch_later(
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    query = select(LibraryWatchLater).options(selectinload(LibraryWatchLater.video)).filter(LibraryWatchLater.user_id == current_user.id).order_by(LibraryWatchLater.saved_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    
    # Stats
    total_videos = len(items)
    total_runtime = sum([item.video.duration for item in items if item.video.duration])
    
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_this_week = sum([1 for item in items if item.saved_at >= week_ago])
    
    return {
        "items": items,
        "stats": {
            "total_videos": total_videos,
            "total_runtime_seconds": total_runtime,
            "new_this_week": new_this_week
        }
    }

@router.post("/{video_id}")
async def add_to_watch_later(
    video_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    # Check if exists
    result = await db.execute(select(LibraryWatchLater).filter(
        LibraryWatchLater.user_id == current_user.id,
        LibraryWatchLater.video_id == video_id
    ))

    if result.scalar_one_or_none():
        return {"status": "already_exists"}
        
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    new_item = LibraryWatchLater(user_id=current_user.id, video_id=video_id)

    db.add(new_item)
    await db.commit()
    return {"status": "success"}

@router.delete("/{video_id}")
async def remove_from_watch_later(
    video_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    await db.execute(delete(LibraryWatchLater).filter(
        LibraryWatchLater.user_id == current_user.id,
        LibraryWatchLater.video_id == video_id
    ))

    await db.commit()
    return {"status": "success"}

@router.delete("/")
async def clear_watch_later(
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    await db.execute(delete(LibraryWatchLater).filter(LibraryWatchLater.user_id == current_user.id))

    await db.commit()
    return {"status": "success"}
