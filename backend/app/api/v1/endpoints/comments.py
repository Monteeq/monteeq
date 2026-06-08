from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.crud import video as crud_video
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models import models

from sqlalchemy import func
from app.models.models import Like

router = APIRouter()

@router.post("/{comment_id}/like")
def like_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    liked = crud_video.toggle_like(db, user_id=current_user.id, comment_id=comment_id)
    if liked:
        crud_video.handle_like_side_effects(db, user_id=current_user.id, comment_id=comment_id)
    
    # Get updated like count
    likes_count = db.query(func.count(Like.id)).filter(Like.comment_id == comment_id).scalar() or 0
    
    return {"liked": liked, "likes_count": likes_count}
