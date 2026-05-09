import os
import shutil
import tempfile
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models.models import Challenge, ChallengeEntry, Video, User
from app.core.storage import storage
from app.crud import video as crud_video
from app.tasks.video_tasks import process_video_task
from app.services.challenge_service import resolve_expired_challenges

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[schemas.Challenge])
def list_challenges(db: Session = Depends(get_db)):
    """List all challenges and automatically pick winners for expired once."""
    resolve_expired_challenges(db)
    return db.query(Challenge).order_by(Challenge.created_at.desc()).all()

@router.get("/{challenge_id}", response_model=schemas.Challenge)
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Get details for a specific challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge

@router.post("/{challenge_id}/enter", response_model=schemas.ChallengeEntry)
async def enter_challenge(
    challenge_id: int,
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Participate in a challenge by uploading a new video."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if not challenge.is_open:
        raise HTTPException(status_code=400, detail="This challenge is closed for entries")

    if (challenge.is_paid or challenge.is_gold) and not current_user.is_premium:
        raise HTTPException(
            status_code=403, 
            detail=f"This is a { 'Gold' if challenge.is_gold else 'Paid' } Challenge. Upgrade to Monteeq Pro to enter!"
        )

    # Constraint: Free user can only enter ONE challenge total
    if not current_user.is_premium:
        total_entries = db.query(ChallengeEntry).filter(ChallengeEntry.user_id == current_user.id).count()
        if total_entries >= 1:
            raise HTTPException(
                status_code=403, 
                detail="Free users are limited to 1 challenge entry total. Upgrade to Premium for unlimited entries!"
            )

    # Check if already entered THIS specific challenge (paranoid check, though above covers it for free users)
    existing_entry = db.query(ChallengeEntry).filter(
        ChallengeEntry.challenge_id == challenge_id,
        ChallengeEntry.user_id == current_user.id
    ).first()
    
    if existing_entry:
        raise HTTPException(status_code=400, detail="You have already entered this challenge")

    # Handle Video Upload
    import uuid
    task_id = str(uuid.uuid4())
    source_key = f"raw/{task_id}_{file.filename}"
    
    try:
        # Upload to storage (S3/GCS/Local)
        storage.upload_file_obj(file.file, source_key)
    except Exception as e:
        logger.error(f"Failed to upload challenge video to storage: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload video to storage")

    # Initial DB record for Video
    video_create_data = schemas.VideoCreate(
        title=title,
        description=description,
        tags=f"challenge,challenge_{challenge_id}",
        video_type="home", # Challenges use home-style videos
        video_url="", 
        thumbnail_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60",
        processing_key=task_id
    )
    
    # Update quota if applicable
    if current_user.home_uploads is not None:
        current_user.home_uploads += 1
    
    db_video = crud_video.create_video(db, video_create_data, user_id=current_user.id)

    # Create Challenge Entry
    db_entry = ChallengeEntry(
        challenge_id=challenge_id,
        user_id=current_user.id,
        video_id=db_video.id
    )
    db.add(db_entry)
    
    # Increment challenge entry count
    challenge.entry_count += 1
    
    db.commit()
    db.refresh(db_entry)

    # Start background processing
    process_video_task.delay(
        source_key,
        "home",
        title,
        db_video.id,
        False, # No custom thumbnail provided
        task_id
    )

    return db_entry

@router.get("/{challenge_id}/entry", response_model=Optional[schemas.ChallengeEntry])
def check_entry(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if the current user has entered a specific challenge."""
    return db.query(ChallengeEntry).filter(
        ChallengeEntry.challenge_id == challenge_id,
        ChallengeEntry.user_id == current_user.id
    ).first()

@router.get("/{challenge_id}/leaderboard", response_model=List[schemas.ChallengeLeaderboardEntry])
def get_leaderboard(challenge_id: int, db: Session = Depends(get_db)):
    """Fetch top performers for a challenge based on video views."""
    entries = db.query(ChallengeEntry).filter(ChallengeEntry.challenge_id == challenge_id).all()
    
    leaderboard = []
    for entry in entries:
        video = entry.video
        user = entry.user
        leaderboard.append({
            "username": user.username,
            "profile_pic": user.profile_pic,
            "entry": entry,
            "score": video.views # Requirement: Rank by performance (views)
        })
    
    # Sort by score descending
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    return leaderboard[:20] # Top 20
