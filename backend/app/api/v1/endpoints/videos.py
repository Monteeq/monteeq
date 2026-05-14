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
from app.services.email_service import send_challenge_exit_email
from app.core.redis import redis_client

from enum import Enum

class VideoStatus(str, Enum):
    UPLOADING   = "uploading"
    QUEUED      = "queued"
    PROCESSING  = "processing"
    READY       = "ready"
    FAILED      = "failed"

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    health = {
        "status": "ok",
        "redis": "disconnected",
        "database": "disconnected",
        "celery": "unknown",
        "rust_service": "unknown"
    }
    
    # Check DB
    try:
        db.execute("SELECT 1")
        health["database"] = "connected"
    except Exception:
        health["status"] = "error"
        
    # Check Redis
    try:
        if redis_client.ping():
            health["redis"] = "connected"
    except Exception:
        health["status"] = "error"
        
    # Check Rust Service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{config.RUST_SERVICE_URL}/health", timeout=1.0)
            if resp.status_code == 200:
                health["rust_service"] = "reachable"
        except Exception:
            health["rust_service"] = "unreachable"
            
    return health

from fastapi_cache.decorator import cache

@router.get("/", response_model=List[schemas.Video])
@cache(expire=30)
async def read_videos(
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
    videos = crud_video.get_videos(db, video_type=video_type, filter_status=status, current_user_id=user_id, skip=skip, limit=limit, mood=mood, feed_mode=feed_mode)
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

    # Resolve to CDN URL if applicable to avoid S3 DNS timeouts
    if "amazonaws.com" in base_url or "monteeq.s3" in base_url or "cdn.monteeq.com" in base_url:
        try:
            from app.core.storage import storage
            if ".com/" in base_url:
                parts = base_url.split(".com/")
                if len(parts) > 1:
                    base_url = storage.get_url(parts[1])
        except Exception as e:
            logger.warning(f"Failed to resolve CDN URL for streaming: {e}")

    # Construct the proxy target URL
    target_url = base_url
    if sub_path:
        import os
        base_dir = os.path.dirname(base_url)
        target_url = f"{base_dir}/{sub_path}"

    async def get_stream():
        client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
        range_header = request.headers.get("Range")
        headers = {
            "User-Agent": "Monteeq-Backend-Proxy/1.0",
        }
        if range_header:
            headers["Range"] = range_header
        
        try:
            req = client.build_request("GET", target_url, headers=headers)
            resp = await client.send(req, stream=True)
        except httpx.TimeoutException:
            await client.aclose()
            raise HTTPException(status_code=504, detail="Upstream stream timed out")
        except Exception as e:
            await client.aclose()
            logger.error(f"Stream proxy failed for video {video_id}: {e}")
            raise HTTPException(status_code=502, detail="Failed to connect to video source")

        # Check for upstream errors before proxying
        if resp.status_code >= 400:
            error_status = resp.status_code
            await resp.aclose()
            await client.aclose()
            raise HTTPException(status_code=error_status, detail=f"Video source returned {error_status}")
        
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
    import json
    
    try:
        cached = redis_client.get("trending_suggestions")
        if cached:
            return json.loads(cached)
    except Exception:
        pass

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
        elif current_mode == "s3" and ("amazonaws.com" in url or "cdn.monteeq.com" in url):
            # Extract key after .com/
            if ".com/" in url:
                s3_key = url.split(".com/")[1]
        
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
    
    # Handle challenge entry counts and notifications
    for entry in video.challenge_entries:
        if entry.challenge:
            entry.challenge.entry_count = max(0, entry.challenge.entry_count - 1)
            # Notify the user
            if entry.user and entry.user.email:
                send_challenge_exit_email(entry.user.email, entry.user.username, entry.challenge.title)
    
    # Delete from DB
    db.delete(video)
    db.commit()
    
    return {"status": "success", "message": "Video deleted successfully"}

@router.patch("/{video_id}", response_model=schemas.Video)
def update_video_metadata(
    video_id: int,
    video_in: schemas.VideoBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    video.title = video_in.title
    video.description = video_in.description
    video.tags = video_in.tags
    video.video_type = video_in.video_type
    
    db.commit()
    db.refresh(video)
    return video




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
    import re
    import unicodedata
    task_id = str(uuid.uuid4())
    
    # Aggressively slugify filename
    filename_base, filename_ext = os.path.splitext(file.filename)
    safe_name = unicodedata.normalize('NFKD', filename_base).encode('ascii', 'ignore').decode('ascii')
    safe_name = re.sub(r'[^\w\s-]', '', safe_name).strip().lower()
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    safe_filename = f"{safe_name}{filename_ext}"
    
    source_key = f"uploads/{task_id}/{safe_filename}"
    
    logger.info(f"Streaming uploaded file directly to storage: {source_key}")
    try:
        storage.upload_file_obj(file.file, source_key)
    except Exception as e:
        logger.error(f"Failed to upload video file to storage: {str(e)}")
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
            logger.error(f"Failed to upload thumbnail to storage: {str(e)}")

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


    import uuid
    task_id = str(uuid.uuid4())
    safe_filename = file.filename.replace(" ", "_")
    source_key = f"uploads/{task_id}/{safe_filename}"
    
    try:
        storage.upload_file_obj(file.file, source_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to reupload video file to storage")
        

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
    logger.info(f"[STATUS] Checking status for key: {key}")
    
    # 1. Try to get status from Redis directly (Shared with Rust service)
    try:
        import json
        status_data_raw = redis_client.get(f"task:status:{key}")
        if status_data_raw:
            status_data = json.loads(status_data_raw)
            logger.info(f"[STATUS] Redis found: {status_data}")
            
            # Map Rust status to Frontend expectations if needed
            # Rust statuses: "queued", "processing", "completed", "error"
            rust_status = status_data.get("status")
            if rust_status == "completed":
                # Verify Phase 2 in DB
                video = db.query(Video).filter(Video.processing_key == key).first()
                if video and video.status == "approved":
                    return {"status": "completed", "progress": 100, "message": "Ready"}
                return {"status": "processing", "progress": 99, "message": "Finalizing..."}
            
            return {
                "status": "processing" if rust_status in ["queued", "processing"] else rust_status,
                "progress": status_data.get("progress", 0),
                "message": status_data.get("message", "")
            }
    except Exception as e:
        logger.warning(f"[STATUS] Redis error: {e}")

    # 2. Fallback: Get persistent status from Database
    video = db.query(Video).filter(Video.processing_key == key).first()
    if video:
        if video.status == "approved":
            return {"status": "completed", "progress": 100, "message": "Ready"}
        if video.status == "failed":
            return {"status": "error", "progress": 0, "message": "Failed"}
        
        return {
            "status": "processing",
            "progress": 50,
            "message": video.processing_message or "Processing..."
        }

    return {"status": "unknown"}


@router.post("/{video_id}/view")
def view_video(
    video_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    # Bot detection
    user_agent = request.headers.get("User-Agent", "").lower()
    bot_keywords = ["bot", "crawler", "spider", "google", "bing", "yahoo", "slurp", "headless", "phantom"]
    if any(keyword in user_agent for keyword in bot_keywords):
        return {"status": "success", "message": "Bot detected, view not counted"}

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
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Rate Limit: 5 comments per minute per IP
    from app.core import security
    if not security.check_rate_limit(f"ratelimit:comment:{request.client.host}", 5, 60):
        raise HTTPException(status_code=429, detail="You are commenting too fast. Please wait.")

    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.status != "approved":
        raise HTTPException(status_code=403, detail="Comments are disabled for videos still in processing or failed state")
    
    db_comment = crud_video.create_comment(db, comment=comment, user_id=current_user.id, video_id=video_id)
    
    # Background side effects
    background_tasks.add_task(handle_comment_background, current_user.id, video_id=video_id)
    
    return db_comment

@router.get("/{video_id}/comments", response_model=List[schemas.Comment])
def read_comments(video_id: int, db: Session = Depends(get_db)):
    return crud_video.get_comments(db, video_id=video_id)

def handle_like_background(user_id: int, video_id: int):
    """Background task to handle side effects of a video like."""
    db = SessionLocal()
    try:
        crud_video.handle_like_side_effects(db, user_id, video_id=video_id)
    finally:
        db.close()

def handle_comment_background(user_id: int, video_id: Optional[int] = None, post_id: Optional[int] = None):
    """Background task to handle side effects of a comment."""
    db = SessionLocal()
    try:
        crud_video.handle_comment_side_effects(db, user_id, video_id=video_id, post_id=post_id)
    finally:
        db.close()

@router.post("/{video_id}/like")
def like_video(
    video_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.status != "approved":
        raise HTTPException(status_code=403, detail="Likes are disabled for videos still in processing or failed state")
    
    is_liked = crud_video.toggle_like(db, user_id=current_user.id, video_id=video_id)
    
    if is_liked:
        # Perform notifications and score updates in background
        background_tasks.add_task(handle_like_background, current_user.id, video_id)
    
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
