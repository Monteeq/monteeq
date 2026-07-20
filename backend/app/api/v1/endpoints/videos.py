from typing import List, Optional
import os
import shutil
import tempfile
import uuid
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
from app.models.models import (
    Video, User, View, WatchLater, Repost, VideoInteraction, UploadJob, UploadJobStatus,
)
from app.models.library import WatchHistory, LibraryWatchLater, LikedVideo
from app.services.email_service import send_challenge_exit_email
from app.core.redis import redis_client

from enum import Enum

class VideoStatus(str, Enum):
    UPLOADING   = "uploading"
    QUEUED      = "queued"
    PROCESSING  = "processing"
    READY       = "ready"
    FAILED      = "failed"

def get_video_db(db: Session, video_id: str) -> Optional[Video]:
    if isinstance(video_id, str) and not video_id.isdigit():
        return db.query(Video).filter(Video.public_id == video_id).first()
    return db.query(Video).filter(Video.id == int(video_id)).first()

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
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        health["database"] = "connected"
    except Exception as e:
        health["database"] = f"disconnected: {type(e).__name__}: {str(e)}"
        health["status"] = "error"
        
    # Check Redis
    try:
        if redis_client is None:
            health["redis"] = "disconnected: client is None"
            health["status"] = "error"
        else:
            redis_client.ping()
            health["redis"] = "connected"
    except Exception as e:
        health["redis"] = f"disconnected: {type(e).__name__}: {str(e)}"
        health["status"] = "error"
        
    # Check Celery
    try:
        from app.worker import celery_app
        insp = celery_app.control.inspect(timeout=1.0)
        ping_res = insp.ping()
        if ping_res:
            workers = list(ping_res.keys())
            health["celery"] = f"connected ({len(ping_res)} worker(s) active: {', '.join(workers)})"
        else:
            health["celery"] = "disconnected: no active workers found"
            health["status"] = "error"
    except Exception as e:
        health["celery"] = f"error: {type(e).__name__}: {str(e)}"
        health["status"] = "error"

    # Check Rust Service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{config.RUST_SERVICE_URL}/health", timeout=1.0)
            if resp.status_code == 200:
                health["rust_service"] = "reachable"
        except Exception as e:
            health["rust_service"] = f"unreachable: {type(e).__name__}: {str(e)}"
            
    # Check S3
    try:
        from app.core.storage import storage
        if storage.s3_client is not None:
            health["s3"] = "initialized"
        else:
            health["s3"] = f"not initialized (AWS_ACCESS_KEY_ID = '{config.AWS_ACCESS_KEY_ID[:4]}...' if config.AWS_ACCESS_KEY_ID else 'empty')"
    except Exception as e:
        health["s3"] = f"error: {type(e).__name__}: {str(e)}"

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
    limit = min(limit, 50)
    user_id = current_user.id if current_user else None
    videos = crud_video.get_videos(db, video_type=video_type, filter_status=status, current_user_id=user_id, skip=skip, limit=limit, mood=mood, feed_mode=feed_mode)
    return videos


def check_premium_access(db: Session, request: Request):
    token = request.query_params.get("token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=403, detail="1080p and above quality levels are restricted to Premium members")
        
    try:
        from jose import jwt
        from app.core.config import SECRET_KEY, ALGORITHM
        from datetime import datetime, timezone
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=403, detail="1080p and above quality levels are restricted to Premium members")
            
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="1080p and above quality levels are restricted to Premium members")
            
        # Check premium expiration
        if user.is_premium and user.premium_expires_at:
            if user.premium_expires_at < datetime.now(timezone.utc):
                user.is_premium = False
                db.commit()
                
        if not user.is_premium:
            raise HTTPException(status_code=403, detail="1080p and above quality levels are restricted to Premium members")
            
    except Exception:
        raise HTTPException(status_code=403, detail="1080p and above quality levels are restricted to Premium members")


@router.get("/{video_id}/stream/{sub_path:path}")
@router.get("/{video_id}/stream")
async def stream_video(video_id: str, request: Request, db: Session = Depends(get_db), sub_path: str = None):
    # Check premium if quality is high-res (1080p, 2k, 4k)
    if sub_path:
        sub_path_lower = sub_path.lower()
        if "1080p" in sub_path_lower or "2k" in sub_path_lower or "4k" in sub_path_lower:
            check_premium_access(db, request)

    video = get_video_db(db, video_id)
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
        # read_timeout=None: video files can be large; no upper bound on read time.
        # connect_timeout=10s: fail fast if CDN is unreachable.
        client = httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0))
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
        
        # Build headers — Content-Encoding: identity tells GZip middleware to skip
        # buffering this response (critical for large video streams).
        response_headers = {
            "Accept-Ranges": "bytes",
            "Content-Encoding": "identity",
        }
        content_type = resp.headers.get("Content-Type")
        if content_type:
            response_headers["Content-Type"] = content_type
            
        content_length = resp.headers.get("Content-Length")
        if content_length:
            response_headers["Content-Length"] = content_length
            
        content_range = resp.headers.get("Content-Range")
        if content_range:
            response_headers["Content-Range"] = content_range
        
        return StreamingResponse(
            resp.aiter_bytes(chunk_size=65536),
            status_code=resp.status_code,
            headers=response_headers,
            background=BackgroundTasks([resp.aclose, client.aclose])
        )

    return await get_stream()


@router.get("/{video_id}/stream-res")
async def stream_video_resolution(
    video_id: str,
    quality: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Proxy a specific resolution stream (480p, 720p, 1080p, 2k, 4k) for a video."""
    if quality.lower() in ["1080p", "2k", "4k"]:
        check_premium_access(db, request)

    video = get_video_db(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    quality_map = {
        "480p":  video.url_480p,
        "720p":  video.url_720p,
        "1080p": video.url_1080p,
        "2k":    video.url_2k,
        "4k":    video.url_4k,
    }

    target_url = quality_map.get(quality.lower())
    if not target_url:
        raise HTTPException(status_code=404, detail=f"No {quality} stream available for this video")

    # Resolve CDN URL if needed
    if "amazonaws.com" in target_url or "monteeq.s3" in target_url or "cdn.monteeq.com" in target_url:
        try:
            from app.core.storage import storage
            if ".com/" in target_url:
                parts = target_url.split(".com/")
                if len(parts) > 1:
                    target_url = storage.get_url(parts[1])
        except Exception as e:
            logger.warning(f"Failed to resolve CDN URL for resolution stream: {e}")

    async def get_res_stream():
        # read_timeout=None: no upper bound on read — video files can be large.
        client = httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0))
        range_header = request.headers.get("Range")
        headers = {"User-Agent": "Monteeq-Backend-Proxy/1.0"}
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
            logger.error(f"Resolution stream proxy failed for video {video_id} @ {quality}: {e}")
            raise HTTPException(status_code=502, detail="Failed to connect to video source")

        if resp.status_code >= 400:
            error_status = resp.status_code
            await resp.aclose()
            await client.aclose()
            raise HTTPException(status_code=error_status, detail=f"Video source returned {error_status}")

        # Content-Encoding: identity prevents GZip middleware from buffering the stream.
        response_headers = {
            "Accept-Ranges": "bytes",
            "Content-Encoding": "identity",
        }
        content_type = resp.headers.get("Content-Type")
        if content_type:
            response_headers["Content-Type"] = content_type
        content_length = resp.headers.get("Content-Length")
        if content_length:
            response_headers["Content-Length"] = content_length
        content_range = resp.headers.get("Content-Range")
        if content_range:
            response_headers["Content-Range"] = content_range

        return StreamingResponse(
            resp.aiter_bytes(chunk_size=65536),
            status_code=resp.status_code,
            headers=response_headers,
            background=BackgroundTasks([resp.aclose, client.aclose])
        )

    return await get_res_stream()


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
def read_video(video_id: str, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_current_user_optional)):
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
        elif current_mode in ("s3", "gcs") and ("amazonaws.com" in url or "cdn.monteeq.com" in url):
            # Extract key after .com/
            if ".com/" in url:
                s3_key = url.split(".com/")[1]
        
        if s3_key:
            storage.delete_file(s3_key)

@router.delete("/{video_id}")
def delete_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = get_video_db(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check ownership or admin status
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")
    
    # Delete physical files
    delete_video_files(video)
    
    # Handle challenge entry counts and notifications
    for entry in list(video.challenge_entries):
        if entry.challenge:
            entry.challenge.entry_count = max(0, entry.challenge.entry_count - 1)
            # Notify the user
            if entry.user and entry.user.email:
                try:
                    send_challenge_exit_email(entry.user.email, entry.user.username, entry.challenge.title)
                except Exception as e:
                    logger.warning(f"Challenge exit email failed for video {video.id}: {e}")
    
    # Clear FK rows that lack ON DELETE CASCADE (blocks delete on watched/saved videos)
    vid = video.id
    db.query(User).filter(User.pinned_video_id == vid).update(
        {User.pinned_video_id: None}, synchronize_session=False
    )
    db.query(View).filter(View.video_id == vid).delete(synchronize_session=False)
    db.query(WatchLater).filter(WatchLater.video_id == vid).delete(synchronize_session=False)
    db.query(Repost).filter(Repost.video_id == vid).delete(synchronize_session=False)
    db.query(VideoInteraction).filter(VideoInteraction.video_id == vid).delete(synchronize_session=False)
    db.query(WatchHistory).filter(WatchHistory.video_id == vid).delete(synchronize_session=False)
    db.query(LibraryWatchLater).filter(LibraryWatchLater.video_id == vid).delete(synchronize_session=False)
    db.query(LikedVideo).filter(LikedVideo.video_id == vid).delete(synchronize_session=False)

    # Delete from DB
    db.delete(video)
    db.commit()
    
    return {"status": "success", "message": "Video deleted successfully"}

@router.patch("/{video_id}", response_model=schemas.Video)
def update_video_metadata(
    video_id: str,
    video_in: schemas.VideoBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = get_video_db(db, video_id)
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


@router.post("/upload/initiate")
async def initiate_upload(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    video_type: str = Form(...),
    filename: str = Form(...),
    thumbnail: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Chunked Upload initiated: title='{title}', type='{video_type}', filename='{filename}', user_id={current_user.id}")
    
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
    filename_base, filename_ext = os.path.splitext(filename)
    safe_name = unicodedata.normalize('NFKD', filename_base).encode('ascii', 'ignore').decode('ascii')
    safe_name = re.sub(r'[^\w\s-]', '', safe_name).strip().lower()
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    safe_filename = f"{safe_name}{filename_ext}"
    
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
    
    # Create the Video database record
    db_video = crud_video.create_video(db, video_create_data, user_id=current_user.id)
    # Set status as uploading initially
    db_video.status = "uploading"
    db.commit()
    db.refresh(db_video)
    
    logger.info(f"Video record created in DB: id={db_video.id}, public_id={db_video.public_id}")
    
    # Create temp directory
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
    temp_dir = os.path.join(backend_dir, "static", "temp_uploads", task_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    return {
        "upload_id": task_id,
        "video_id": db_video.public_id,
        "filename": safe_filename
    }


@router.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
    temp_dir = os.path.join(backend_dir, "static", "temp_uploads", upload_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    chunk_path = os.path.join(temp_dir, f"chunk_{chunk_index}")
    
    logger.info(f"Saving chunk {chunk_index} for upload {upload_id}")
    try:
        with open(chunk_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        logger.error(f"Failed to save chunk {chunk_index} for upload {upload_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save chunk")
        
    return {"status": "success", "chunk_index": chunk_index}


@router.get("/upload/status/{upload_id}")
async def upload_status(
    upload_id: str,
    current_user: User = Depends(get_current_user)
):
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
    temp_dir = os.path.join(backend_dir, "static", "temp_uploads", upload_id)
    
    if not os.path.exists(temp_dir):
        return {"completed_chunks": []}
        
    completed_chunks = []
    for f in os.listdir(temp_dir):
        if f.startswith("chunk_"):
            try:
                index = int(f.split("_")[1])
                completed_chunks.append(index)
            except ValueError:
                pass
                
    completed_chunks.sort()
    return {"completed_chunks": completed_chunks}


@router.post("/upload/finalize")
async def finalize_upload(
    upload_id: str = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    cover_source: str = Form("auto"),
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Merge chunks → S3 (threadpool) → optional cover → queue Celery → return job id."""
    logger.info(f"Finalizing chunked upload {upload_id} with {total_chunks} chunks")

    source = (cover_source or "auto").strip().lower()
    if source not in ("auto", "custom"):
        raise HTTPException(status_code=400, detail="cover_source must be 'auto' or 'custom'")
    
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
    temp_dir = os.path.join(backend_dir, "static", "temp_uploads", upload_id)
    
    if not os.path.exists(temp_dir):
        raise HTTPException(status_code=400, detail="Upload directory not found or session expired")
        
    # Check if all chunks are present
    missing_chunks = []
    for i in range(total_chunks):
        chunk_file = os.path.join(temp_dir, f"chunk_{i}")
        if not os.path.exists(chunk_file):
            missing_chunks.append(i)
            
    if missing_chunks:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing chunks: {missing_chunks}. Please upload them first."
        )
        
    # Merge chunks (CPU/IO — keep off the event loop)
    merged_path = os.path.join(temp_dir, filename)

    def _merge_chunks():
        with open(merged_path, "wb") as outfile:
            for i in range(total_chunks):
                chunk_file = os.path.join(temp_dir, f"chunk_{i}")
                with open(chunk_file, "rb") as infile:
                    shutil.copyfileobj(infile, outfile)

    try:
        import asyncio
        await asyncio.to_thread(_merge_chunks)
    except Exception as e:
        logger.error(f"Failed to merge chunks for upload {upload_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to merge chunks on server")
        
    # Upload to storage (sync boto3 via threadpool)
    source_key = f"uploads/{upload_id}/{filename}"
    logger.info(f"Uploading merged video to storage: {source_key}")
    
    try:
        await storage.async_upload_file(merged_path, source_key)
    except Exception as e:
        logger.error(f"Failed to upload merged video to storage: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload video to storage")
        
    # Clean up temp folder
    try:
        shutil.rmtree(temp_dir)
    except Exception as e:
        logger.warning(f"Failed to clean up temp directory {temp_dir}: {str(e)}")
        
    # Find the Video in database and set its status to pending
    video = db.query(Video).filter(Video.processing_key == upload_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found")
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    video.status = "pending"

    job = UploadJob(
        id=uuid.uuid4(),
        user_id=current_user.id,
        status=UploadJobStatus.QUEUED,
        video_id=video.id,  # link immediately for progress lookups while processing
        cover_source=source,
        cover_s3_key=None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    cover_s3_key = None
    if source == "custom":
        if cover is None or not getattr(cover, "filename", None):
            job.status = UploadJobStatus.FAILED
            job.error_message = "cover_source is custom but no cover file was provided"
            video.status = "failed"
            db.commit()
            raise HTTPException(status_code=400, detail="Cover file required when cover_source is custom")
        cover_s3_key = f"covers/{job.id}.jpg"
        try:
            cover_url = await storage.async_upload_file_obj(cover.file, cover_s3_key)
            job.cover_s3_key = cover_s3_key
            video.thumbnail_url = cover_url
            db.commit()
            logger.info(f"Custom cover uploaded for job_id={job.id} key={cover_s3_key}")
        except Exception as e:
            logger.error(f"Failed to upload custom cover for job_id={job.id}: {e}")
            job.status = UploadJobStatus.FAILED
            job.error_message = f"Cover upload failed: {e}"
            video.status = "failed"
            db.commit()
            raise HTTPException(status_code=500, detail="Failed to upload cover image to storage")
    
    # Trigger Celery — do not wait for Rust/transcode
    # thumbnail_provided / skip_thumbnail when custom cover already on S3
    thumbnail_provided = source == "custom" and bool(cover_s3_key)
    try:
        import app.worker  # noqa: F401 — set Redis Celery app as default before delay()
        from app.tasks.video_tasks import process_video_task
        async_result = process_video_task.delay(
            source_key,
            video.video_type,
            video.title,
            video.id,
            thumbnail_provided,
            video.processing_key,
            str(job.id),
        )
        logger.info(
            f"Transcoding celery task enqueued for video_id={video.id} "
            f"job_id={job.id} cover_source={source} cover_s3_key={cover_s3_key} "
            f"celery_id={async_result.id}"
        )
    except Exception as e:
        logger.error(f"Failed to enqueue Celery transcoding task: {str(e)}")
        video.status = "failed"
        job.status = UploadJobStatus.FAILED
        job.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to enqueue transcoding job")
        
    return {
        "job_id": str(job.id),
        "status": UploadJobStatus.QUEUED.value,
        "video_id": video.public_id,
        "processing_key": video.processing_key,
        "cover_source": source,
        "cover_s3_key": cover_s3_key,
    }


@router.get("/upload/jobs/{job_id}")
async def get_upload_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poll async upload/transcode job status.
    Returns status, video_id (when completed), live progress, and error_message (when failed).
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job id")

    job = db.query(UploadJob).filter(UploadJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Upload job not found")
    if job.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    status = job.status.value if hasattr(job.status, "value") else str(job.status)

    video = None
    if job.video_id:
        video = db.query(Video).filter(Video.id == job.video_id).first()

    # Only expose watchable public id once the job is done
    video_public_id = None
    if status == UploadJobStatus.COMPLETED.value or status == "completed":
        video_public_id = video.public_id if video else None

    progress = None
    processing_key = video.processing_key if video else None
    if processing_key:
        try:
            raw = redis_client.get(f"job:progress:{processing_key}")
            if raw is not None:
                progress = int(float(raw))
            else:
                status_raw = redis_client.get(f"task:status:{processing_key}")
                if status_raw:
                    import json
                    payload = json.loads(status_raw)
                    if isinstance(payload.get("progress"), (int, float)):
                        progress = int(payload["progress"])
        except Exception as e:
            logger.debug(f"Progress lookup failed for job {job_id}: {e}")

    if status == "completed":
        progress = 100
    elif status == "queued" and progress is None:
        progress = 5
    elif status == "processing" and progress is None:
        progress = 15

    return {
        "job_id": str(job.id),
        "status": status,
        "video_id": video_public_id,
        "processing_key": processing_key,
        "progress": progress,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


async def _direct_upload_one(
    *,
    db: Session,
    current_user: User,
    file: UploadFile,
    title: str,
    description: Optional[str],
    tags: Optional[str],
    video_type: str,
    thumbnail: Optional[UploadFile] = None,
    cover_source: str = "auto",
    raise_http: bool = False,
) -> dict:
    """
    Save one file to storage, create upload_jobs + Video, enqueue Celery.
    When raise_http=False (batch), returns a per-file result dict and never raises
    for storage/enqueue failures. When raise_http=True (single /upload), raises HTTPException.
    """
    import re
    import unicodedata
    import traceback

    filename = file.filename or "video"
    source = (cover_source or "auto").strip().lower()
    if source not in ("auto", "custom"):
        source = "auto"
    # Legacy: a thumbnail file implies custom cover
    if source == "auto" and thumbnail is not None and getattr(thumbnail, "filename", None):
        source = "custom"

    def _fail(error: str, status_code: int = 500) -> dict:
        logger.error(f"Direct upload failed for '{filename}': {error}")
        if raise_http:
            raise HTTPException(status_code=status_code, detail=error)
        return {
            "filename": filename,
            "job_id": None,
            "status": "failed",
            "video_id": None,
            "error": error,
            "cover_source": source,
            "cover_s3_key": None,
        }

    if not current_user.is_premium:
        if video_type == "flash" and (current_user.flash_uploads or 0) >= FLASH_QUOTA_LIMIT:
            return _fail(f"Flash quota exceeded ({FLASH_QUOTA_LIMIT} max)", status_code=403)
        if video_type == "home" and (current_user.home_uploads or 0) >= HOME_QUOTA_LIMIT:
            return _fail(f"Home quota exceeded ({HOME_QUOTA_LIMIT} max)", status_code=403)

    task_id = str(uuid.uuid4())

    filename_base, filename_ext = os.path.splitext(filename)
    safe_name = unicodedata.normalize("NFKD", filename_base).encode("ascii", "ignore").decode("ascii")
    safe_name = re.sub(r"[^\w\s-]", "", safe_name).strip().lower()
    safe_name = re.sub(r"[-\s]+", "_", safe_name) or "video"
    safe_filename = f"{safe_name}{filename_ext}"

    source_key = f"uploads/{task_id}/{safe_filename}"

    logger.info(f"Streaming uploaded file to storage (threadpool): {source_key}")
    try:
        await storage.async_upload_file_obj(file.file, source_key)
    except Exception as e:
        error_detail = f"Storage upload failed: {str(e)}"
        logger.error(f"{error_detail}\n{traceback.format_exc()}")
        return _fail(error_detail)

    video_create_data = schemas.VideoCreate(
        title=title,
        description=description,
        tags=tags,
        video_type=video_type,
        video_url="",
        thumbnail_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60",
        processing_key=task_id,
    )

    if video_type == "flash":
        current_user.flash_uploads = (current_user.flash_uploads or 0) + 1
    else:
        current_user.home_uploads = (current_user.home_uploads or 0) + 1

    db.commit()

    db_video = crud_video.create_video(db, video_create_data, user_id=current_user.id)
    db_video.status = "pending"
    logger.info(f"Video record created in DB: id={db_video.id}")

    job = UploadJob(
        id=uuid.uuid4(),
        user_id=current_user.id,
        status=UploadJobStatus.QUEUED,
        video_id=db_video.id,
        cover_source=source,
        cover_s3_key=None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    cover_s3_key = None
    if source == "custom":
        if thumbnail is None or not getattr(thumbnail, "filename", None):
            db_video.status = "failed"
            job.status = UploadJobStatus.FAILED
            job.error_message = "cover_source is custom but no cover file was provided"
            db.commit()
            return _fail("Cover file required when cover_source is custom", status_code=400)
        cover_s3_key = f"covers/{job.id}.jpg"
        try:
            cover_url = await storage.async_upload_file_obj(thumbnail.file, cover_s3_key)
            job.cover_s3_key = cover_s3_key
            db_video.thumbnail_url = cover_url
            db.commit()
        except Exception as e:
            logger.error(f"Failed to upload cover to storage: {e}")
            db_video.status = "failed"
            job.status = UploadJobStatus.FAILED
            job.error_message = f"Cover upload failed: {e}"
            db.commit()
            return _fail(f"Cover upload failed: {e}")

    thumbnail_provided = source == "custom" and bool(cover_s3_key)

    try:
        import app.worker  # noqa: F401 — bind Redis Celery app before delay()
        from app.tasks.video_tasks import process_video_task

        process_video_task.delay(
            source_key,
            video_type,
            title,
            db_video.id,
            thumbnail_provided,
            db_video.processing_key,
            str(job.id),
        )
        logger.info(
            f"Celery task enqueued for video_id={db_video.id} job_id={job.id} "
            f"cover_source={source} cover_s3_key={cover_s3_key}"
        )
    except Exception as e:
        logger.error(f"Failed to enqueue Celery task: {str(e)}")
        db_video.status = "failed"
        job.status = UploadJobStatus.FAILED
        job.error_message = str(e)
        db.commit()
        return _fail("Failed to enqueue transcoding job")

    return {
        "filename": filename,
        "job_id": str(job.id),
        "status": UploadJobStatus.QUEUED.value,
        "video_id": db_video.public_id,
        "error": None,
        "cover_source": source,
        "cover_s3_key": cover_s3_key,
    }


@router.post("/upload")
async def upload_video(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    video_type: str = Form(...),
    file: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),
    cover_source: str = Form("auto"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save file to storage, create an upload_jobs row, enqueue Celery, return immediately.
    Transcoding happens in the worker — this handler never waits on Rust.
    """
    logger.info(f"Upload initiated: title='{title}', type='{video_type}', user_id={current_user.id}")
    result = await _direct_upload_one(
        db=db,
        current_user=current_user,
        file=file,
        title=title,
        description=description,
        tags=tags,
        video_type=video_type,
        thumbnail=thumbnail,
        cover_source=cover_source,
        raise_http=True,
    )
    return {
        "job_id": result["job_id"],
        "status": result["status"],
        "video_id": result["video_id"],
        "cover_source": result.get("cover_source"),
        "cover_s3_key": result.get("cover_s3_key"),
    }


@router.post("/upload/batch")
async def upload_videos_batch(
    files: List[UploadFile] = File(..., description="One or more video files"),
    titles: List[str] = Form(..., description="Caption/title per file (same order as files)"),
    video_type: str = Form(...),
    descriptions: Optional[List[str]] = Form(None),
    tags: Optional[List[str]] = Form(None),
    cover_sources: Optional[List[str]] = Form(None),
    thumbnails: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Multipart batch upload: each file gets its own S3 object, upload_jobs row, and Celery task.

    Returns HTTP 200 with a per-file results array. Individual storage/enqueue failures are
    reported in that array; remaining files are still processed.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    if len(titles) != len(files):
        raise HTTPException(
            status_code=400,
            detail=f"titles count ({len(titles)}) must match files count ({len(files)})",
        )

    desc_list = list(descriptions or [])
    tags_list = list(tags or [])
    thumb_list = list(thumbnails or [])
    cover_list = list(cover_sources or [])

    # Pad optional parallel fields so zip never IndexErrors
    while len(desc_list) < len(files):
        desc_list.append(None)
    while len(tags_list) < len(files):
        tags_list.append(None)
    while len(thumb_list) < len(files):
        thumb_list.append(None)
    while len(cover_list) < len(files):
        cover_list.append("auto")

    logger.info(
        f"Batch upload initiated: count={len(files)}, type='{video_type}', "
        f"user_id={current_user.id}"
    )

    results = []
    for index, (file, title, description, file_tags, thumbnail, cov) in enumerate(
        zip(files, titles, desc_list, tags_list, thumb_list, cover_list)
    ):
        # Skip empty thumbnail slots (some clients send blank file parts)
        thumb = thumbnail
        if thumb is not None and not getattr(thumb, "filename", None):
            thumb = None

        caption = (title or "").strip() or (file.filename or f"video-{index + 1}")
        result = await _direct_upload_one(
            db=db,
            current_user=current_user,
            file=file,
            title=caption,
            description=description,
            tags=file_tags,
            video_type=video_type,
            thumbnail=thumb,
            cover_source=cov or "auto",
            raise_http=False,
        )
        result["index"] = index
        results.append(result)

        # Keep quota counters accurate for subsequent files in this request
        db.refresh(current_user)

    succeeded = sum(1 for r in results if r.get("status") != "failed")
    failed = len(results) - succeeded

    return {
        "results": results,
        "succeeded": succeeded,
        "failed": failed,
    }


@router.post("/{video_id}/reupload")
async def reupload_video(
    video_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = get_video_db(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if video.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed videos can be reuploaded")


    task_id = str(uuid.uuid4())
    safe_filename = file.filename.replace(" ", "_")
    source_key = f"uploads/{task_id}/{safe_filename}"
    
    try:
        await storage.async_upload_file_obj(file.file, source_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to reupload video file to storage")

    video.processing_key = task_id
    video.status = "pending"
    video.failed_at = None

    job = UploadJob(
        id=uuid.uuid4(),
        user_id=current_user.id,
        status=UploadJobStatus.QUEUED,
        video_id=video.id,
    )
    db.add(job)
    db.commit()
    
    from app.tasks.video_tasks import process_video_task
    process_video_task.delay(
        source_key,
        video.video_type,
        video.title,
        video.id,
        False, # thumbnail_provided = False
        video.processing_key,
        str(job.id),
    )
    
    return {
        "job_id": str(job.id),
        "status": UploadJobStatus.QUEUED.value,
        "video_id": video.public_id,
    }

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
    video_id: str,
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
    updated_video = crud_video.increment_view(db, user_id=user_id, video_id=video.id)
    return {"status": "success", "views": updated_video.views if updated_video else 0}

@router.post("/{video_id}/comments", response_model=schemas.Comment)
def create_comment(
    video_id: str,
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
    
    db_comment = crud_video.create_comment(db, comment=comment, user_id=current_user.id, video_id=video.id)
    
    # Background side effects
    background_tasks.add_task(handle_comment_background, current_user.id, video_id=video.id)
    
    return db_comment

@router.get("/{video_id}/comments", response_model=List[schemas.Comment])
def read_comments(video_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return crud_video.get_comments(db, video_id=video.id, current_user_id=current_user.id if current_user else None)

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
    video_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.status != "approved":
        raise HTTPException(status_code=403, detail="Likes are disabled for videos still in processing or failed state")
    
    is_liked = crud_video.toggle_like(db, user_id=current_user.id, video_id=video.id)
    
    if is_liked:
        # Perform notifications and score updates in background
        background_tasks.add_task(handle_like_background, current_user.id, video.id)
    
    from app.models.models import Like
    likes_count = db.query(func.count(Like.video_id)).filter(Like.video_id == video.id).scalar() or 0
    
    return {"status": "success", "liked": is_liked, "likes_count": likes_count}


@router.post("/{video_id}/share")
def share_video(
    video_id: str,
    db: Session = Depends(get_db)
):
    video = crud_video.get_video(db, video_id=video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    crud_video.increment_share(db, video_id=video.id)
    return {"status": "success"}

@router.put("/{video_id}/comments/{comment_id}", response_model=schemas.Comment)
def update_comment(
    video_id: str,
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
    video_id: str,
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
