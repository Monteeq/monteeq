from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_
from typing import List, Optional, Any
from datetime import datetime

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.models import Follow, Video, Post, User
from app.schemas import schemas

router = APIRouter()

@router.get("/feed", response_model=List[schemas.FollowingFeedItem])
async def get_following_feed(
    skip: int = 0,
    limit: int = 20,
    content_type: Optional[str] = Query(None, pattern="^(all|videos|flash|posts)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a mixed personalized feed containing videos, flash videos, and community posts
    ONLY from creators the current user follows.
    """
    # 1. Get followed user IDs
    followed_ids = db.query(Follow.following_id).filter(Follow.follower_id == current_user.id).all()
    followed_ids = [r[0] for r in followed_ids]
    
    if not followed_ids:
        return []

    # 2. Fetch content with specific ratio: ~8 videos, ~2 flash, ~1 post per page (if limit is 20)
    # We'll adjust based on the limit provided.
    
    items = []
    
    # Calculate sub-limits
    if content_type == "videos":
        v_limit, f_limit, p_limit = limit, 0, 0
    elif content_type == "flash":
        v_limit, f_limit, p_limit = 0, limit, 0
    elif content_type == "posts":
        v_limit, f_limit, p_limit = 0, 0, limit
    else:
        # Default mix (all)
        v_limit = int(limit * 0.7) # ~14
        f_limit = int(limit * 0.2) # ~4
        p_limit = limit - v_limit - f_limit # ~2
    
    # Fetch Videos
    if v_limit > 0:
        videos = db.query(Video).options(joinedload(Video.owner)).filter(
            Video.owner_id.in_(followed_ids),
            Video.status == "approved",
            Video.video_type == "home"
        ).order_by(desc(Video.created_at)).offset(skip).limit(v_limit).all()
        for v in videos:
            items.append({"type": "video", "data": v, "created_at": v.created_at})

    # Fetch Flash
    if f_limit > 0:
        flash = db.query(Video).options(joinedload(Video.owner)).filter(
            Video.owner_id.in_(followed_ids),
            Video.status == "approved",
            Video.video_type == "flash"
        ).order_by(desc(Video.created_at)).offset(skip).limit(f_limit).all()
        for f in flash:
            items.append({"type": "flash", "data": f, "created_at": f.created_at})

    # Fetch Posts
    if p_limit > 0:
        posts = db.query(Post).options(joinedload(Post.owner)).filter(
            Post.owner_id.in_(followed_ids),
            Post.is_active == True
        ).order_by(desc(Post.created_at)).offset(skip).limit(p_limit).all()
        for p in posts:
            items.append({"type": "post", "data": p, "created_at": p.created_at})

    # 3. Interleave/Sort
    # Sort by created_at desc to mix them naturally
    items.sort(key=lambda x: x["created_at"], reverse=True)
    
    return items[:limit]

@router.get("/recommendations", response_model=List[schemas.UserPublic])
async def get_recommended_creators(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Recommend creators based on follower count and activity.
    Excludes creators the user is already following.
    """
    # Exclude self and already followed
    excluded_ids = [current_user.id] if current_user else []
    if current_user:
        followed = db.query(Follow.following_id).filter(Follow.follower_id == current_user.id).all()
        excluded_ids.extend([r[0] for r in followed])

    # Recommended: Top 10 creators by follower count
    # Since we don't have a followers_count column in User yet, we join with Follow
    recommendations = (
        db.query(User, func.count(Follow.id).label("f_count"))
        .outerjoin(Follow, Follow.following_id == User.id)
        .filter(~User.id.in_(excluded_ids))
        .group_by(User.id)
        .order_by(desc("f_count"))
        .limit(10)
        .all()
    )
    
    return [r[0] for r in recommendations]
