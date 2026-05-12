from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from sqlalchemy.orm import selectinload
from typing import Optional

from app.db.async_session import get_async_db
from app.schemas import library as schemas
from app.models.library import LikedVideo
from app.models.models import Video
from app.core.async_dependencies import get_async_current_user

router = APIRouter()

@router.get("/", response_model=schemas.LikedResponse)
async def get_liked_videos(
    page: int = 1,
    limit: int = 20,
    category: Optional[str] = Query("all"),
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    offset = (page - 1) * limit
    query = select(LikedVideo).options(selectinload(LikedVideo.video)).filter(LikedVideo.user_id == current_user.id)
    
    # Category filter (if Video model supports it)
    if category != "all":
        # This assumes existing Video model has a 'video_type' or similar field that matches category
        # Or we could filter by tags. For now we follow the 'category' requirement.
        query = query.join(Video).filter(Video.video_type == category)
    
    # Total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Items
    query = query.order_by(LikedVideo.liked_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": offset + limit < total
    }

@router.post("/{video_id}")
async def like_video(
    video_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    result = await db.execute(select(LikedVideo).filter(
        LikedVideo.user_id == current_user.id,
        LikedVideo.video_id == video_id
    ))
    if result.scalar_one_or_none():
        return {"status": "already_liked"}
        
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    new_like = LikedVideo(user_id=current_user.id, video_id=video_id)
    db.add(new_like)
    
    # Increment like count on video (requires existing field)
    # await db.execute(update(Video).where(Video.id == video_id).values(likes_count=Video.likes_count + 1))
    
    await db.commit()
    return {"status": "success"}

@router.delete("/{video_id}")
async def unlike_video(
    video_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    await db.execute(delete(LikedVideo).filter(
        LikedVideo.user_id == current_user.id,
        LikedVideo.video_id == video_id
    ))
    await db.commit()
    return {"status": "success"}
