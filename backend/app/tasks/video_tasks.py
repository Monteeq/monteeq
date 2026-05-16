import os
import time
import requests
from celery import shared_task
from sqlalchemy import func

from app.db.session import SessionLocal
from app.models.models import Video, User
from app.core import config
from app.core.storage import storage
from app.utils.push import notify_user_push
from app.core.redis import redis_client
import logging
import json

logger = logging.getLogger(__name__)

@shared_task(bind=True, name="video_tasks.process_video", max_retries=3)
def process_video_task(self, source_key: str, video_type: str, title: str, video_id: int, thumbnail_provided: bool, task_id: str):
    logger.info(f"Starting Celery task: video_id={video_id}, task_id={task_id}")
    db = SessionLocal()
    try:
        # Phase 1: Communication with Rust Service
        try:
            logger.info(f"Phase 1: POST to Rust service at {config.RUST_SERVICE_URL}/process with source {source_key}")
            try:
                rust_response = requests.post(
                    f"{config.RUST_SERVICE_URL}/process",
                    json={
                        "video_id": source_key,
                        "target_format": video_type,
                        "skip_thumbnail": thumbnail_provided,
                        "task_id": task_id
                    },
                    timeout=30.0 # Increased timeout to 30s to allow for Render cold starts
                )
                logger.info(f"Rust service responded with status {rust_response.status_code}")
                rust_response.raise_for_status()
            except requests.exceptions.RequestException as re:
                logger.error(f"Failed to communicate with Rust service: {str(re)}")
                if hasattr(re, 'response') and re.response is not None:
                    logger.error(f"Rust error response: {re.response.text}")
                raise Exception(f"Rust service unreachable or returned error: {re}")
            logger.info(f"Rust service accepted task. Starting polling for task_id={task_id}")
            max_retries = 300 # 10 minutes with 2s sleep
            retries = 0
            while retries < max_retries:
                try:
                    # Priority 1: Check Redis (Shared with Rust)
                    status_data_raw = redis_client.get(f"task:status:{task_id}")
                    status_data = None
                    
                    if status_data_raw:
                        status_data = json.loads(status_data_raw)
                    else:
                        # Priority 2: Fallback to HTTP (If Redis is inconsistent or Rust is updating differently)
                        status_resp = requests.get(f"{config.RUST_SERVICE_URL}/status/{task_id}", timeout=2.0)
                        if status_resp.status_code == 200:
                            status_data = status_resp.json()

                    if status_data:
                        current_status = status_data.get("status")
                        progress = status_data.get("progress", 0)
                        msg = status_data.get("message", "")
                        
                        logger.debug(f"Task {task_id} status: {current_status} ({progress}%)")
                        
                        # Provide progress update to DB
                        db_video = db.query(Video).filter(Video.id == video_id).first()
                        if db_video:
                            db_video.processing_message = f"{msg} ({progress}%)"
                            db.commit()

                        if current_status and current_status.lower() in ["completed", "uploaded", "success"]:
                            logger.info(f"Transcoding completed for task_id={task_id}")
                            break
                        if current_status == "error":
                            logger.error(f"Rust processing error for task {task_id}: {msg}")
                            raise Exception(f"Rust processing error: {msg}")
                    else:
                        logger.warning(f"Task {task_id} status not found in Redis or Rust API.")

                except Exception as e:
                    if "Rust processing error" in str(e): raise e
                    logger.warning(f"Polling error (try {retries}): {e}")
                
                time.sleep(3)
                retries += 1
            
            if retries >= max_retries:
                logger.error(f"Background processing timed out for task {task_id}")
                raise Exception(f"Background processing timed out for task {task_id}")

        except Exception as e:
            print(f"Error in background processing phase: {e}")
            
            # Only fail permanently if we've exhausted retries
            if self.request.retries >= self.max_retries:
                video = db.query(Video).filter(Video.id == video_id).first()
                if video:
                    video.status = "failed"
                    video.failed_at = func.now()
                    owner = db.query(User).filter(User.id == video.owner_id).first()
                    if owner:
                        if video.video_type == "flash":
                            owner.flash_uploads = max(0, (owner.flash_uploads or 1) - 1)
                        else:
                            owner.home_uploads = max(0, (owner.home_uploads or 1) - 1)
                    db.commit()
                
                # Cleanup cloud storage on final failure
                try:
                    logger.info(f"Cleaning up storage after final failure for task {task_id}")
                    storage.delete_prefix(f"uploads/{task_id}/")
                    storage.delete_prefix(f"videos/{task_id}/")
                except Exception as cleanup_err:
                    logger.warning(f"Storage cleanup failed: {cleanup_err}")
                
                raise e
            else:
                logger.warning(f"Task {task_id} failed, retrying... ({self.request.retries}/{self.max_retries})")
                raise self.retry(exc=e, countdown=60)

        # Phase 2: Post-processing (Updating DB URLs)
        # Note: Rust service now handles the upload of HLS files to GCS.
        logger.info(f"Phase 2: Updating DB with S3 URLs for video_id={video_id}")
        
        # Use storage abstraction to generate correct URLs (S3 or Local)
        video_url = storage.get_url(f"videos/{task_id}/master.m3u8")
        
        if video_type == "flash":
            url_480p = None
            url_720p = None
            url_1080p = None
            url_2k = None
            url_4k = None
        else:
            url_480p = storage.get_url(f"videos/{task_id}/480p.m3u8")
            url_720p = storage.get_url(f"videos/{task_id}/720p.m3u8")
            url_1080p = storage.get_url(f"videos/{task_id}/1080p.m3u8")
            url_2k = storage.get_url(f"videos/{task_id}/2k.m3u8")
            url_4k = storage.get_url(f"videos/{task_id}/4k.m3u8")
            
        thumbnail_url = storage.get_url(f"thumbnails/{task_id}.jpg")

        # Duration is not available from the Rust service response yet;
        # keep as 0 — can be backfilled later via a separate metadata job.
        duration = 0

        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.video_url = video_url
            video.url_480p = url_480p
            video.url_720p = url_720p
            video.url_1080p = url_1080p
            video.url_2k = url_2k
            video.url_4k = url_4k
            video.duration = duration
            video.failed_at = None
            # Auto-approve: no admin review needed
            video.status = "approved"
            video.processing_message = "Live"

            # Only set thumbnail if a custom one wasn't provided during upload
            if not thumbnail_provided and thumbnail_url:
                video.thumbnail_url = thumbnail_url

            db.commit()
            
            # Notify user of success
            try:
                notify_user_push(
                    db,
                    user_id=video.owner_id,
                    title="Video Live! 🚀",
                    body=f"Your video '{title}' has been processed and is now live!",
                    link=f"/profile",
                    n_type="status_change"
                )
            except: pass
            

            
            # Phase 3: Cleanup
            try:
                logger.info(f"Phase 3: Deleting raw source directory uploads/{task_id}/")
                storage.delete_prefix(f"uploads/{task_id}/")
            except Exception as e:
                logger.warning(f"Failed to delete source directory uploads/{task_id}/: {e}")
                
            return {"status": "success", "video_id": video_id}

    except Exception as e:
        # Notify user of failure and set status
        try:
             video = db.query(Video).filter(Video.id == video_id).first()
             if video:
                 video.status = "failed"
                 video.failed_at = func.now()
                 owner = db.query(User).filter(User.id == video.owner_id).first()
                 if owner:
                     if video.video_type == "flash":
                         owner.flash_uploads = max(0, (owner.flash_uploads or 1) - 1)
                     else:
                         owner.home_uploads = max(0, (owner.home_uploads or 1) - 1)
                 db.commit()

                 notify_user_push(
                     db, 
                     user_id=video.owner_id, 
                     title="Video Processing Failed", 
                     body=f"Something went wrong while processing '{title}'. Please try uploading again.", 
                     link="/upload",
                     n_type="status_change"
                 )
                 
                 # Cleanup cloud storage on failure
                 logger.info(f"Cleaning up storage after phase 2 failure for task {task_id}")
                 storage.delete_prefix(f"uploads/{task_id}/")
                 storage.delete_prefix(f"videos/{task_id}/")
        except: pass

        print(f"Error in post-processing: {e}")
        raise e
    finally:
        db.close()

@shared_task(name="video_tasks.update_discovery_score")
def update_discovery_score_task(video_id: int = None, post_id: int = None):
    from datetime import datetime
    from app.models.models import Post
    db = SessionLocal()
    try:
        target = None
        if video_id:
            target = db.query(Video).filter(Video.id == video_id).first()
        elif post_id:
            target = db.query(Post).filter(Post.id == post_id).first()
        
        if not target:
            return
            
        likes_count = target.likes_count or 0
        comments_count = target.comments_count or 0
        shares_count = target.shares if video_id else 0
        views_count = target.views if video_id else target.views_count
        
        score = (likes_count * 10) + (comments_count * 20) + (shares_count * 30) + ((views_count or 0) * 1)
        
        if target.last_owner_interaction_at:
            score += 50
            
        age_seconds = (datetime.now() - target.created_at).total_seconds()
        age_hours = max(age_seconds / 3600, 0)
        
        gravity = 1.8
        final_score = score / pow((age_hours + 2), gravity)
        
        target.discovery_score = final_score
        db.commit()
    finally:
        db.close()
