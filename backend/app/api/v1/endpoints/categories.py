from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models.models import DiscoveredCategory, User
from app.services import category_service as cs

router = APIRouter()


@router.get("/", response_model=List[schemas.DiscoveredCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return cs.get_approved_categories(db)


@router.post("/discover")
def trigger_discovery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    new_cats = cs.discover_categories(db)
    return {
        "message": f"Discovery complete. {len(new_cats)} new categories found.",
        "new_categories": [c.name for c in new_cats],
    }


@router.get("/{category_name}/videos", response_model=List[schemas.Video])
def get_category_videos(
    category_name: str,
    video_type: str = "flash",
    limit: int = 30,
    db: Session = Depends(get_db),
):
    videos = cs.get_videos_for_category(db, category_name, video_type, limit)
    return videos
