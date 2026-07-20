import requests
from datetime import datetime, timezone
from celery import shared_task
from sqlalchemy import func

from uuid import UUID

from app.db.session import SessionLocal
from app.models.models import Video, User, UploadJob, UploadJobStatus
from app.core import config
from app.core.storage import storage
from app.utils.push import notify_user_push
from app.core.redis import redis_client
import logging
import json

logger = logging.getLogger(__name__)


def _resolve_user_tier(db, video_id: int) -> str:
    """Map video owner premium status to Rust queue tier ('pro' | 'free')."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return "free"
    owner = db.query(User).filter(User.id == video.owner_id).first()
    if not owner or not owner.is_premium:
        return "free"
    if owner.premium_expires_at and owner.premium_expires_at < datetime.now(timezone.utc):
        owner.is_premium = False
        db.commit()
        return "free"
    return "pro"


def _update_upload_job(db, upload_job_id, status: str, *, video_id: int = None, error_message: str = None):
    if not upload_job_id:
        return
    try:
        job_uuid = UUID(str(upload_job_id))
    except (TypeError, ValueError):
        logger.warning(f"Invalid upload_job_id: {upload_job_id}")
        return
    job = db.query(UploadJob).filter(UploadJob.id == job_uuid).first()
    if not job:
        return
    job.status = status
    if video_id is not None:
        job.video_id = video_id
    if error_message is not None:
        job.error_message = error_message
    db.commit()


def _mark_video_failed(db, video_id: int, title: str, task_id: str, upload_job_id, error_message: str):
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        video.status = "failed"
        video.failed_at = func.now()
        video.processing_message = error_message[:500] if error_message else "Failed"
        owner = db.query(User).filter(User.id == video.owner_id).first()
        if owner:
            if video.video_type == "flash":
                owner.flash_uploads = max(0, (owner.flash_uploads or 1) - 1)
            else:
                owner.home_uploads = max(0, (owner.home_uploads or 1) - 1)
        db.commit()
        try:
            notify_user_push(
                db,
                user_id=video.owner_id,
                title="Video Processing Failed",
                body=f"Something went wrong while processing '{title}'. Please try uploading again.",
                link="/upload",
                n_type="status_change",
            )
        except Exception:
            pass
    _update_upload_job(
        db, upload_job_id, UploadJobStatus.FAILED, error_message=error_message
    )
    try:
        storage.delete_prefix(f"uploads/{task_id}/")
        storage.delete_prefix(f"videos/{task_id}/")
    except Exception as cleanup_err:
        logger.warning(f"Storage cleanup failed: {cleanup_err}")


def _finalize_transcode_success(
    db, *, video_id: int, video_type: str, title: str, task_id: str,
    thumbnail_provided: bool, upload_job_id,
):
    """After Rust finishes: wire up CDN URLs, mark upload_job completed, notify."""
    logger.info(f"Finalizing transcode for video_id={video_id} task_id={task_id}")
    video_url = storage.get_url(f"videos/{task_id}/master.m3u8")

    if video_type == "flash":
        url_480p = url_720p = url_1080p = url_2k = url_4k = None
    else:
        url_480p = storage.get_url(f"videos/{task_id}/480p.m3u8")
        url_720p = storage.get_url(f"videos/{task_id}/720p.m3u8")
        url_1080p = storage.get_url(f"videos/{task_id}/1080p.m3u8")
        url_2k = storage.get_url(f"videos/{task_id}/2k.m3u8")
        url_4k = storage.get_url(f"videos/{task_id}/4k.m3u8")

    thumbnail_url = storage.get_url(f"thumbnails/{task_id}.jpg")
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        _update_upload_job(
            db, upload_job_id, UploadJobStatus.FAILED,
            error_message="Video record missing after transcode",
        )
        return {"status": "error", "message": "video missing"}

    video.video_url = video_url
    video.url_480p = url_480p
    video.url_720p = url_720p
    video.url_1080p = url_1080p
    video.url_2k = url_2k
    video.url_4k = url_4k
    video.duration = 0
    video.failed_at = None
    video.status = "approved"
    video.processing_message = "Live"
    if not thumbnail_provided and thumbnail_url:
        video.thumbnail_url = thumbnail_url
    db.commit()

    # 2) completed + fill video_id on the upload_jobs row
    _update_upload_job(
        db, upload_job_id, UploadJobStatus.COMPLETED, video_id=video_id
    )

    try:
        notify_user_push(
            db,
            user_id=video.owner_id,
            title="Video Live! 🚀",
            body=f"Your video '{title}' has been processed and is now live!",
            link="/profile",
            n_type="status_change",
        )
    except Exception:
        pass

    try:
        storage.delete_prefix(f"uploads/{task_id}/")
    except Exception as e:
        logger.warning(f"Failed to delete source directory uploads/{task_id}/: {e}")

    return {"status": "success", "video_id": video_id}


# Max poll attempts × countdown ≈ 10 minutes
_POLL_MAX_ATTEMPTS = 200
_POLL_COUNTDOWN_SEC = 3


@shared_task(bind=True, name="video_tasks.process_video", max_retries=3)
def process_video_task(
    self,
    source_key: str,
    video_type: str,
    title: str,
    video_id: int,
    thumbnail_provided: bool,
    task_id: str,
    upload_job_id: str = None,
):
    """
    Dispatch to Rust only — does not wait for transcode.
    Status polling runs in poll_video_transcode so multiple uploads can
    sit on the Rust queue / worker pool at the same time.
    """
    logger.info(
        f"Dispatching video_id={video_id} task_id={task_id} upload_job_id={upload_job_id}"
    )
    db = SessionLocal()
    try:
        # 1) Before calling Rust → processing
        _update_upload_job(db, upload_job_id, UploadJobStatus.PROCESSING)
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.status = "processing"
            video.processing_message = "Queued for transcode"
            db.commit()

        tier = _resolve_user_tier(db, video_id)
        logger.info(
            f"POST {config.RUST_SERVICE_URL}/process source={source_key} tier={tier}"
        )
        try:
            rust_response = requests.post(
                f"{config.RUST_SERVICE_URL}/process",
                json={
                    "video_id": source_key,
                    "target_format": video_type,
                    "skip_thumbnail": thumbnail_provided,
                    "task_id": task_id,
                    "tier": tier,
                },
                timeout=30.0,
            )
            logger.info(f"Rust responded {rust_response.status_code}")
            rust_response.raise_for_status()
        except requests.exceptions.RequestException as re:
            err = f"Rust service unreachable or returned error: {re}"
            logger.error(err)
            if self.request.retries < self.max_retries:
                raise self.retry(exc=Exception(err), countdown=60)
            _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
            raise Exception(err)

        # Hand off to non-blocking poller so this worker is free for the next upload
        poll_video_transcode.delay(
            video_type,
            title,
            video_id,
            thumbnail_provided,
            task_id,
            upload_job_id,
            0,
        )
        return {"status": "dispatched", "task_id": task_id, "upload_job_id": upload_job_id}
    finally:
        db.close()


@shared_task(name="video_tasks.poll_video_transcode")
def poll_video_transcode(
    video_type: str,
    title: str,
    video_id: int,
    thumbnail_provided: bool,
    task_id: str,
    upload_job_id: str = None,
    attempt: int = 0,
):
    """Poll Rust/Redis once; reschedule until done. Keeps Celery free for parallel uploads."""
    db = SessionLocal()
    try:
        status_data = None
        try:
            status_data_raw = redis_client.get(f"task:status:{task_id}")
            if status_data_raw:
                status_data = json.loads(status_data_raw)
            else:
                status_resp = requests.get(
                    f"{config.RUST_SERVICE_URL}/status/{task_id}", timeout=2.0
                )
                if status_resp.status_code == 200:
                    status_data = status_resp.json()
        except Exception as e:
            logger.warning(f"Poll error for {task_id} (attempt {attempt}): {e}")

        if status_data:
            current_status = (status_data.get("status") or "").lower()
            progress = status_data.get("progress", 0)
            msg = status_data.get("message", "")

            video = db.query(Video).filter(Video.id == video_id).first()
            if video:
                video.processing_message = f"{msg} ({progress}%)"
                db.commit()

            if current_status in ("completed", "uploaded", "success"):
                # 2) After Rust finishes → completed + video_id
                return _finalize_transcode_success(
                    db,
                    video_id=video_id,
                    video_type=video_type,
                    title=title,
                    task_id=task_id,
                    thumbnail_provided=thumbnail_provided,
                    upload_job_id=upload_job_id,
                )

            if current_status == "error":
                # 3) Failed → failed + error_message
                err = msg or "Rust processing error"
                _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
                return {"status": "failed", "error": err}

        if attempt >= _POLL_MAX_ATTEMPTS:
            err = f"Background processing timed out for task {task_id}"
            _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
            return {"status": "failed", "error": err}

        # Still running — check again soon without holding a worker
        poll_video_transcode.apply_async(
            args=[
                video_type,
                title,
                video_id,
                thumbnail_provided,
                task_id,
                upload_job_id,
                attempt + 1,
            ],
            countdown=_POLL_COUNTDOWN_SEC,
        )
        return {"status": "polling", "attempt": attempt}
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
