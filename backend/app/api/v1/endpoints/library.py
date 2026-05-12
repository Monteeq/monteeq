from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.db.async_session import get_async_db
from app.schemas import library as schemas
from app.models.library import WatchHistory, LibraryWatchLater, LikedVideo
from app.core.async_dependencies import get_async_current_user

router = APIRouter()

@router.get("/stats", response_model=schemas.LibraryStats)
async def get_library_stats(
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    history_count = await db.scalar(select(func.count()).filter(WatchHistory.user_id == current_user.id))
    watch_later_count = await db.scalar(select(func.count()).filter(LibraryWatchLater.user_id == current_user.id))

    liked_count = await db.scalar(select(func.count()).filter(LikedVideo.user_id == current_user.id))
    
    return {
        "history_count": history_count or 0,
        "watch_later_count": watch_later_count or 0,
        "liked_count": liked_count or 0
    }
