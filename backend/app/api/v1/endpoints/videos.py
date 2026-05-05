from typing import List, Optional
import os
import shutil
import tempfile
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
import logging
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.db.session import get_db, SessionLocal
from app.crud import video as crud_video
from app.schemas import schemas
from app.core.dependencies import get_current_user, get_current_user_optional
from app.core import config
from app.utils.push import notify_user_push
from app.core.storage import storage
from app.core.config import FLASH_QUOTA_LIMIT, HOME_QUOTA_LIMIT
from app.models.models import Video, User

router = APIRouter()

@router.get("/", response_model=List[schemas.Video])
def read_videos(
    video_type: str = None, 
    status: str = "approved", 
    skip: int = 0,
    limit: int = 20,
    mood: str = None,
    feed_mode: str = None,
    db: Session = Depends(get_db), 
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cache_key = f"feed_{video_type}_{status}_{skip}_{limit}_{user_id}_{mood}_{feed_mode}"
    
    # Try to get from cache
    r = None
    try:
        import redis
        r = redis.StrictRedis.from_url(redis_url, decode_responses=True)
        cached = r.get(cache_key)
        if cached:
            import json
            return json.loads(cached)
    except Exception:
        pass
        
    videos = crud_video.get_videos(db, video_type=video_type, filter_status=status, current_user_id=user_id, skip=skip, limit=limit, mood=mood, feed_mode=feed_mode)
    
    # Try to save to cache
    if r:
        try:
            import json
            serialized_videos = [schemas.Video.from_orm(v).dict() for v in videos]
            r.setex(cache_key, 30, json.dumps(serialized_videos)) # Shorter TTL for homepage
        except Exception:
            pass
            
    return videos

@router.get("/{video_id}/stream/{sub_path:path}")
@router.get("/{video_id}/stream")
async def stream_video(video_id: int, request: Request, db: Session = Depends(get_db), sub_path: str = None):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    base_url = video.video_url
    if not base_url:
        raise HTTPException(status_code=400, detail="Video has no URL")

    # Construct the proxy target URL
    target_url = base_url
    if sub_path:
        import os
        base_dir = os.path.dirname(base_url)
        target_url = f"{base_dir}/{sub_path}"

    async def get_stream():
        client = httpx.AsyncClient(timeout=None) 
        range_header = request.headers.get("Range")
        headers = {"Range": range_header} if range_header else {}
        
        req = client.build_request("GET", target_url, headers=headers)
        resp = await client.send(req, stream=True)
        
        return StreamingResponse(
            resp.aiter_bytes(),
            status_code=resp.status_code,
            headers={
                "Content-Type": resp.headers.get("Content-Type", "video/mp4"),
                "Content-Length": resp.headers.get("Content-Length"),
                "Content-Range": resp.headers.get("Content-Range"),
                "Accept-Ranges": "bytes",
            },
            background=BackgroundTasks([resp.aclose, client.aclose])
        )

    return await get_stream()

@router.get("/search", response_model=List[schemas.Video])
async def search_videos(
    q: Optional[str] = "", 
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    return crud_video.search_videos(db, query_str=q, current_user_id=user_id)

@router.get("/suggestions")
async def get_search_suggestions(q: Optional[str] = "", db: Session = Depends(get_db)):
    if not q or len(q) < 2: return []
    
    # 1. Search Videos (Home & Flash)
    videos = crud_video.search_videos(db, query_str=q)
    
    # 2. Search Users
    from app.models.models import User
    users = db.query(User).filter(User.username.ilike(f"%{q}%")).limit(5).all()
    
    seen = set()
    suggestions = []
    
    # Prioritize users in suggestions
    for u in users:
        val = f"@{u.username}"
        if val not in seen:
            suggestions.append(val)
            seen.add(val)
            
    for v in videos[:10]:
        if v.title not in seen:
            suggestions.append(v.title)
            seen.add(v.title)
            
    return suggestions[:10]

@router.get("/trending-suggestions")
async def get_trending_suggestions(db: Session = Depends(get_db)):
    import redis
    import json
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_client = redis.StrictRedis.from_url(redis_url, decode_responses=True)
        cached = redis_client.get("trending_suggestions")
        if cached:
            return json.loads(cached)
    except Exception:
        redis_client = None

    # 1. High views (Trending)
    trending_videos = db.query(Video).filter(Video.status == "approved").order_by(Video.views.desc()).limit(5).all()
    
    # 2. Recent uploads
    recent_videos = db.query(Video).filter(Video.status == "approved").order_by(Video.created_at.desc()).limit(5).all()
    
    # 3. Popular Creators
    from app.models.models import User
    users = db.query(User).limit(3).all()

    seen = set()
    suggestions = []
    
    for v in trending_videos:
        if v.title not in seen:
            suggestions.append(v.title)
            seen.add(v.title)
            
    for v in recent_videos:
        if v.title not in seen:
            suggestions.append(v.title)
            seen.add(v.title)
            
    for u in users:
        val = f"@{u.username}"
        if val not in seen:
            suggestions.append(val)
            seen.add(val)
            
    result = suggestions[:10]
    if redis_client:
        try:
            redis_client.setex("trending_suggestions", 300, json.dumps(result))
        except Exception:
            pass
            
    return result

@router.get("/{video_id}", response_model=schemas.Video)
def read_video(video_id: int, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_current_user_optional)):
    user_id = current_user.id if current_user else None
    db_video = crud_video.get_video(db, video_id=video_id, current_user_id=user_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return db_video


# Processing logic migrated to Celery workers in app/tasks/video_tasks.py

def delete_video_files(video: Video):
    """Utility to delete all files (local or GCS) associated with a video."""
    urls = [
        video.video_url,
        video.url_480p,
        video.url_720p,
        video.url_1080p,
        video.url_2k,
        video.url_4k,
        video.thumbnail_url
    ]
    
    current_mode = storage.mode
    
    for url in urls:
        if not url:
            continue
            
        s3_key = None
        if current_mode == "local" and url.startswith(f"{config.BASE_URL}/static/"):
            s3_key = url.replace(f"{config.BASE_URL}/static/", "")
        elif current_mode == "gcs" and "storage.googleapis.com" in url:
            # Format: https://storage.googleapis.com/[bucket]/[key]
            parts = url.split(f"/{config.GCS_BUCKET}/")
            if len(parts) > 1:
                s3_key = parts[1]
        
        if s3_key:
            storage.delete_file(s3_key)

@router.delete("/{video_id}")
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check ownership or admin status
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")
    
    # Delete physical files
    delete_video_files(video)
    
    # Delete from DB
    db.delete(video)
    db.commit()
    
    return {"status": "success", "message": "Video deleted successfully"}

@router.put("/{video_id}/status")
def update_video_status(
    video_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update video status")
        
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    if status not in ["approved", "rejected", "pending"]:
         raise HTTPException(status_code=400, detail="Invalid status")
         
    video.status = status
    db.commit()
    
    # Post-status update actions
    if status == "approved":
        from app.crud import achievement as crud_achievement
        # Check how many approved videos the owner has
        approved_count = db.query(func.count(Video.id)).filter(
            Video.owner_id == video.owner_id, 
            Video.status == "approved"
        ).scalar()
        
        if approved_count == 1:
            crud_achievement.create_achievement(db, user_id=video.owner_id, milestone_name="FIRST_UPLOAD")

        # Notify user of approval
        notify_user_push(
            db, 
            video.owner_id, 
            "Video Approved! 🚀", 
            f"Great news! Your video '{video.title}' has been approved and is now live.", 
            link=f"/watch/{video_id}",
            n_type="status_change"
        )
    elif status == "rejected":
        # Notify user of rejection
        notify_user_push(
            db, 
            video.owner_id, 
            "Video Status Update", 
            f"Your video '{video.title}' did not pass our community guidelines at this time.", 
            link="/manage-content",
            n_type="status_change"
        )

    return {"status": "success", "video_status": video.status}


@router.post("/upload", response_model=schemas.Video)
async def upload_video(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    video_type: str = Form(...),
    file: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"Upload initiated: title='{title}', type='{video_type}', user_id={current_user.id}")
    
    # current_user is now a User model instance, not dict
    if not current_user.is_premium:
        if video_type == "flash" and current_user.flash_uploads >= FLASH_QUOTA_LIMIT:
            raise HTTPException(status_code=403, detail=f"Flash quota exceeded ({FLASH_QUOTA_LIMIT} max)")
        if video_type == "home" and current_user.home_uploads >= HOME_QUOTA_LIMIT:
            raise HTTPException(status_code=403, detail=f"Home quota exceeded ({HOME_QUOTA_LIMIT} max)")

    import uuid
    import time
    task_id = str(uuid.uuid4())
    safe_filename = file.filename.replace(" ", "_")
    source_key = f"uploads/{task_id}/{safe_filename}"
    
    logger.info(f"Streaming uploaded file directly to GCS: {source_key}")
    try:
        storage.upload_file_obj(file.file, source_key)
    except Exception as e:
        logger.error(f"Failed to upload video file to GCS: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload video file to storage")

    # Initial DB record
    video_create_data = schemas.VideoCreate(
        title=title,
        description=description,
        tags=tags,
        video_type=video_type,
        video_url="", 
        thumbnail_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60",
        processing_key=task_id
    )
    
    if thumbnail:
        safe_thumb_name = thumbnail.filename.replace(" ", "_")
        timestamp = int(time.time())
        thumb_key = f"thumbs/custom_{timestamp}_{safe_thumb_name}"
        
        try:
            video_create_data.thumbnail_url = storage.upload_file_obj(thumbnail.file, thumb_key)
        except Exception as e:
            logger.error(f"Failed to upload thumbnail to GCS: {str(e)}")

    # Update quota
    if video_type == "flash":
        current_user.flash_uploads = (current_user.flash_uploads or 0) + 1
    else:
        current_user.home_uploads = (current_user.home_uploads or 0) + 1
    
    db.commit() # Save user updates
    
    db_video = crud_video.create_video(db, video_create_data, user_id=current_user.id)
    logger.info(f"Video record created in DB: id={db_video.id}")

    try:
        from app.tasks.video_tasks import process_video_task
        process_video_task.delay(
            source_key,
            video_type,
            title,
            db_video.id,
            thumbnail is not None,
            db_video.processing_key
        )
        logger.info(f"Celery task enqueued for video_id={db_video.id}")
    except Exception as e:
        logger.error(f"Failed to enqueue Celery task: {str(e)}")
        # We still return the video, but flag it as failed immediately or show a specific message
        db_video.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail="Video enqueued for processing but local queue is unreachable.")

    return db_video


@router.post("/{video_id}/reupload", response_model=schemas.Video)
async def reupload_video(
    video_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if video.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed videos can be reuploaded")

    # check quota
    if not current_user.is_premium:
        if video.video_type == "flash" and current_user.flash_uploads >= FLASH_QUOTA_LIMIT:
            raise HTTPException(status_code=403, detail=f"Flash quota exceeded ({FLASH_QUOTA_LIMIT} max)")
        if video.video_type == "home" and current_user.home_uploads >= HOME_QUOTA_LIMIT:
            raise HTTPException(status_code=403, detail=f"Home quota exceeded ({HOME_QUOTA_LIMIT} max)")
            
    import uuid
    task_id = str(uuid.uuid4())
    safe_filename = file.filename.replace(" ", "_")
    source_key = f"uploads/{task_id}/{safe_filename}"
    
    try:
        storage.upload_file_obj(file.file, source_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to reupload video file to storage")
        
    if video.video_type == "flash":
        current_user.flash_uploads = (current_user.flash_uploads or 0) + 1
    else:
        current_user.home_uploads = (current_user.home_uploads or 0) + 1
        
    video.processing_key = task_id
    video.status = "pending"
    video.failed_at = None
    db.commit()
    
    from app.tasks.video_tasks import process_video_task
    process_video_task.delay(
        source_key,
        video.video_type,
        video.title,
        video.id,
        False, # thumbnail_provided = False
        video.processing_key
    )
    
    return video

@router.get("/status/{key}")
async def get_processing_status(key: str, db: Session = Depends(get_db)):
    # 1. Try to get real-time status from Rust service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{config.RUST_SERVICE_URL}/status/{key}", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    # If Rust says completed, verify if DB Phase 2 is also done
                    if data.get("status") == "completed":
                        video = db.query(Video).filter(Video.processing_key == key).first()
                        if not video or not video.video_url:
                            # Still waiting for Phase 2 (metadata/DB update) in Celery
                            return {
                                "status": "processing",
                                "progress": 99,
                                "message": "Finalizing video details..."
                            }
                    return data
        except Exception as e:
            logger.warning(f"Failed to reach Rust service for status: {e}")

    # 2. Fallback: Get persistent status from Database
    video = db.query(Video).filter(Video.processing_key == key).first()
    if video:
        # If we have a video URL, transcoding is finished regardless of approval status
        if video.video_url:
            return {"status": "completed", "progress": 100, "message": "Success"}
            
        if video.status == "approved":
            return {"status": "completed", "progress": 100, "message": "Success"}
        if video.status == "failed":
            return {"status": "error", "progress": 0, "message": "Processing failed. Please check logs or try again."}
        
        # If pending, but Rust didn't have it, it's either in Celery queue or Rust queue or worker died
        return {
            "status": "processing" if video.status == "pending" else video.status,
            "progress": 50, # Rough estimate if we have no better data
            "message": video.processing_message or "Task is in queue..."
        }

    return {"status": "unknown"}


@router.post("/{video_id}/view")
def view_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.status != "approved":
        # Silently skip view increment for pending/failed videos
        # but return success to avoid frontend errors
        return {"status": "success", "views": video.views, "message": "View not counted for non-approved video"}

    user_id = current_user.id if current_user else None
    updated_video = crud_video.increment_view(db, user_id=user_id, video_id=video_id)
    return {"status": "success", "views": updated_video.views if updated_video else 0}

@router.post("/{video_id}/comments", response_model=schemas.Comment)
def create_comment(
    video_id: int,
    comment: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.status != "approved":
        raise HTTPException(status_code=403, detail="Comments are disabled for videos still in processing or failed state")
    
    return crud_video.create_comment(db, comment=comment, user_id=current_user.id, video_id=video_id)

@router.get("/{video_id}/comments", response_model=List[schemas.Comment])
def read_comments(video_id: int, db: Session = Depends(get_db)):
    return crud_video.get_comments(db, video_id=video_id)

@router.post("/{video_id}/like")
def like_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.status != "approved":
        raise HTTPException(status_code=403, detail="Likes are disabled for videos still in processing or failed state")
    
    is_liked = crud_video.toggle_like(db, user_id=current_user.id, video_id=video_id)
    
    from app.models.models import Like
    likes_count = db.query(func.count(Like.video_id)).filter(Like.video_id == video_id).scalar() or 0
    
    return {"status": "success", "liked": is_liked, "likes_count": likes_count}


@router.post("/{video_id}/share")
def share_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    crud_video.increment_share(db, video_id=video_id)
    return {"status": "success"}

@router.put("/{video_id}/comments/{comment_id}", response_model=schemas.Comment)
def update_comment(
    video_id: int,
    comment_id: int,
    comment_in: schemas.CommentBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify video exists
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    result = crud_video.update_comment(db, comment_id=comment_id, user_id=current_user.id, content=comment_in.content)
    if result is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if result is False:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    return result

@router.delete("/{video_id}/comments/{comment_id}")
def delete_comment(
    video_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify video exists
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    result = crud_video.delete_comment(db, comment_id=comment_id, user_id=current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if result is False:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    return {"status": "success", "message": "Comment deleted successfully"}
