import requests
from datetime import datetime, timezone
from celery import shared_task
from sqlalchemy import func

from uuid import UUID

# Bind @shared_task to the Redis-backed worker app (not Celery's default AMQP).
import app.worker  # noqa: F401
from app.db.session import SessionLocal
from app.models.models import Video, User, UploadJob, UploadJobStatus
from app.core import config
from app.core.storage import storage
from app.utils.push import notify_user_push
from app.core.redis import redis_client
import logging
import json
import time

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


def _resolve_cover_url(raw: str | None) -> str | None:
    """Accept a full URL or storage key from Rust / job row."""
    if not raw:
        return None
    if str(raw).startswith("http://") or str(raw).startswith("https://"):
        return str(raw)
    return storage.get_url(str(raw))


def _finalize_transcode_success(
    db, *, video_id: int, video_type: str, title: str, task_id: str,
    thumbnail_provided: bool, upload_job_id,
    status_data: dict | None = None,
):
    """After Rust finishes: wire up CDN URLs, cover fields, mark upload_job completed, notify."""
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

    generated_thumb_url = storage.get_url(f"thumbnails/{task_id}.jpg")
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        _update_upload_job(
            db, upload_job_id, UploadJobStatus.FAILED,
            error_message="Video record missing after transcode",
        )
        return {"status": "error", "message": "video missing"}

    # Cover metadata: prefer Rust completion payload, then upload_jobs row
    status_data = status_data or {}
    rust_cover_url = status_data.get("cover_url") or status_data.get("coverUrl")
    rust_cover_source = status_data.get("cover_source") or status_data.get("coverSource")

    job_cover_source = None
    job_cover_s3_key = None
    if upload_job_id:
        try:
            from uuid import UUID as _UUID
            job_row = db.query(UploadJob).filter(UploadJob.id == _UUID(str(upload_job_id))).first()
            if job_row:
                job_cover_source = getattr(job_row, "cover_source", None)
                job_cover_s3_key = getattr(job_row, "cover_s3_key", None)
        except Exception as e:
            logger.debug(f"upload_job cover lookup in finalize skipped: {e}")

    cover_source = (
        rust_cover_source
        or job_cover_source
        or ("custom" if thumbnail_provided else "auto")
    )
    cover_source = str(cover_source).strip().lower()
    if cover_source not in ("auto", "custom"):
        cover_source = "custom" if thumbnail_provided else "auto"

    cover_url = _resolve_cover_url(rust_cover_url)
    if not cover_url and cover_source == "custom" and job_cover_s3_key:
        cover_url = _resolve_cover_url(job_cover_s3_key)
    if not cover_url:
        cover_url = generated_thumb_url

    video.video_url = video_url
    video.url_480p = url_480p
    video.url_720p = url_720p
    video.url_1080p = url_1080p
    video.url_2k = url_2k
    video.url_4k = url_4k
    video.duration = 0

    # Preview clip — may not exist for old videos or if generation failed
    preview_key = f"previews/{task_id}.mp4"
    try:
        preview_url = storage.get_url(preview_key)
        video.preview_url = preview_url
    except Exception:
        video.preview_url = None
    video.failed_at = None
    video.status = "approved"
    video.processing_message = "Live"
    video.cover_source = cover_source
    video.cover_url = cover_url
    # Keep thumbnail_url aligned for existing clients / feeds
    if cover_url:
        video.thumbnail_url = cover_url
    elif not thumbnail_provided and generated_thumb_url:
        video.thumbnail_url = generated_thumb_url
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


_POLL_COUNTDOWN_SEC = 3
# Fail only if live progress has not increased for this long.
_POLL_STALL_SEC = 90
# Absolute safety net (~45 minutes) regardless of progress movement.
_POLL_ABSOLUTE_CEILING_SEC = 45 * 60
_POLL_META_TTL_SEC = 60 * 60


def _progress_meta_key(task_id: str) -> str:
    return f"job:progress:last_change:{task_id}"


def _read_live_progress(task_id: str, status_data: dict | None = None):
    """Prefer Rust job:progress:{task_id}; fall back to coarse task:status progress."""
    try:
        raw = redis_client.get(f"job:progress:{task_id}")
        if raw is not None and str(raw).strip() != "":
            return float(raw)
    except Exception as e:
        logger.debug(f"job:progress read failed for {task_id}: {e}")

    if status_data and isinstance(status_data.get("progress"), (int, float)):
        return float(status_data["progress"])
    return None


def _touch_progress_meta(task_id: str, current_progress: float | None) -> dict:
    """
    Track last-seen progress + when it last increased in Redis.
    Key: job:progress:last_change:{task_id}
    Value: {"progress": N, "changed_at": unix, "started_at": unix}
    """
    now = time.time()
    key = _progress_meta_key(task_id)
    meta = None
    try:
        raw = redis_client.get(key)
        if raw:
            meta = json.loads(raw)
    except Exception:
        meta = None

    if not meta:
        meta = {
            "progress": current_progress if current_progress is not None else -1.0,
            "changed_at": now,
            "started_at": now,
        }
        try:
            redis_client.set(key, json.dumps(meta), ex=_POLL_META_TTL_SEC)
        except Exception as e:
            logger.warning(f"Failed to init progress meta for {task_id}: {e}")
        return meta

    last_progress = float(meta.get("progress", -1.0))
    if current_progress is not None and current_progress > last_progress:
        meta["progress"] = current_progress
        meta["changed_at"] = now
        try:
            redis_client.set(key, json.dumps(meta), ex=_POLL_META_TTL_SEC)
        except Exception as e:
            logger.warning(f"Failed to update progress meta for {task_id}: {e}")

    return meta


def _clear_progress_meta(task_id: str) -> None:
    try:
        redis_client.delete(_progress_meta_key(task_id))
    except Exception:
        pass


def _final_rust_status_check(
    db, *, video_type, title, video_id, thumbnail_provided, task_id, upload_job_id, reason: str
):
    """
    Before failing on stall/ceiling: one synchronous GET to Rust.
    Finalize if completed; otherwise mark failed.
    """
    logger.warning(
        f"{reason} for task_id={task_id}; "
        f"final GET {config.RUST_SERVICE_URL}/status/{task_id}"
    )
    try:
        final_resp = requests.get(
            f"{config.RUST_SERVICE_URL}/status/{task_id}", timeout=10.0
        )
        if final_resp.status_code == 200:
            final_data = final_resp.json() or {}
            final_status = (final_data.get("status") or "").lower()
            if final_status in ("completed", "uploaded", "success"):
                logger.info(
                    f"Final status check: task_id={task_id} completed — finalizing"
                )
                _clear_progress_meta(task_id)
                return _finalize_transcode_success(
                    db,
                    video_id=video_id,
                    video_type=video_type,
                    title=title,
                    task_id=task_id,
                    thumbnail_provided=thumbnail_provided,
                    upload_job_id=upload_job_id,
                    status_data=final_data,
                )
            if final_status == "error":
                err = final_data.get("message") or "Rust processing error"
                _clear_progress_meta(task_id)
                _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
                return {"status": "failed", "error": err}
            err = (
                f"Background processing timed out for task {task_id} "
                f"({reason}; final status={final_status or 'unknown'})"
            )
        elif final_resp.status_code == 404:
            err = (
                f"Background processing timed out for task {task_id} "
                f"({reason}; status endpoint returned 404)"
            )
        else:
            err = (
                f"Background processing timed out for task {task_id} "
                f"({reason}; status endpoint returned {final_resp.status_code})"
            )
    except Exception as e:
        err = (
            f"Background processing timed out for task {task_id} "
            f"({reason}; final status check unreachable: {e})"
        )

    _clear_progress_meta(task_id)
    _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
    return {"status": "failed", "error": err}


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
        # Prefer cover metadata from the upload_jobs row when present
        cover_source = "custom" if thumbnail_provided else "auto"
        cover_s3_key = None
        if upload_job_id:
            try:
                from uuid import UUID as _UUID
                job_row = db.query(UploadJob).filter(UploadJob.id == _UUID(str(upload_job_id))).first()
                if job_row:
                    cover_source = getattr(job_row, "cover_source", None) or cover_source
                    cover_s3_key = getattr(job_row, "cover_s3_key", None)
                    if cover_source == "custom":
                        thumbnail_provided = True
            except Exception as e:
                logger.debug(f"upload_job cover lookup skipped: {e}")

        # Resolve tier best-effort — never block the Rust handoff on a flaky DB
        try:
            tier = _resolve_user_tier(db, video_id)
        except Exception as e:
            logger.warning(f"Tier lookup failed for video_id={video_id}, defaulting free: {e}")
            tier = "free"
            try:
                db.rollback()
            except Exception:
                pass

        # Call Rust FIRST so DB blips cannot prevent transcode from starting
        skip_thumbnail = bool(thumbnail_provided) or cover_source == "custom"
        rust_payload = {
            "video_id": source_key,
            "target_format": video_type,
            "skip_thumbnail": skip_thumbnail,
            "task_id": task_id,
            "tier": tier,
            "coverSource": cover_source,
        }
        if cover_source == "custom" and cover_s3_key:
            rust_payload["coverS3Key"] = cover_s3_key
            rust_payload["cover_s3_key"] = cover_s3_key  # snake_case alias

        logger.info(
            f"POST {config.RUST_SERVICE_URL}/process source={source_key} tier={tier} "
            f"coverSource={cover_source} coverS3Key={cover_s3_key}"
        )
        try:
            rust_response = requests.post(
                f"{config.RUST_SERVICE_URL}/process",
                json=rust_payload,
                timeout=30.0,
            )
            logger.info(f"Rust responded {rust_response.status_code}")
            rust_response.raise_for_status()
        except requests.exceptions.RequestException as re:
            err = f"Rust service unreachable or returned error: {re}"
            logger.error(err)
            if self.request.retries < self.max_retries:
                raise self.retry(exc=Exception(err), countdown=60)
            try:
                _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
            except Exception:
                logger.exception("Failed to mark video failed after Rust error")
            raise Exception(err)

        # Best-effort DB status updates after Rust has accepted the job
        try:
            _update_upload_job(db, upload_job_id, UploadJobStatus.PROCESSING)
            video = db.query(Video).filter(Video.id == video_id).first()
            if video:
                video.status = "processing"
                video.processing_message = "Queued for transcode"
                db.commit()
        except Exception as e:
            logger.warning(
                f"Post-dispatch DB update failed for video_id={video_id} "
                f"(Rust already accepted task_id={task_id}): {e}"
            )
            try:
                db.rollback()
            except Exception:
                pass

        # Seed stall-detection meta so the absolute ceiling starts now
        _touch_progress_meta(task_id, 0.0)

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
    """
    Poll Rust/Redis once; reschedule until done.

    Timeout model (stall detection):
    - Read live percent from job:progress:{task_id} (fallback: task:status progress)
    - Track last increase in job:progress:last_change:{task_id}
    - Fail only after _POLL_STALL_SEC with no progress increase
    - Absolute ceiling _POLL_ABSOLUTE_CEILING_SEC as a safety net
    - Before failing, one final GET /status/{task_id} (finalize if completed)
    """
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

        live_progress = _read_live_progress(task_id, status_data)
        meta = _touch_progress_meta(task_id, live_progress)
        now = time.time()
        started_at = float(meta.get("started_at") or now)
        changed_at = float(meta.get("changed_at") or now)
        stall_secs = now - changed_at
        elapsed_secs = now - started_at

        if status_data:
            current_status = (status_data.get("status") or "").lower()
            # Prefer live encode %, else coarse status progress for UI message
            progress = (
                int(live_progress)
                if live_progress is not None
                else int(status_data.get("progress") or 0)
            )
            msg = status_data.get("message", "")

            video = db.query(Video).filter(Video.id == video_id).first()
            if video:
                video.processing_message = f"{msg} ({progress}%)"
                db.commit()

            if current_status in ("completed", "uploaded", "success"):
                _clear_progress_meta(task_id)
                return _finalize_transcode_success(
                    db,
                    video_id=video_id,
                    video_type=video_type,
                    title=title,
                    task_id=task_id,
                    thumbnail_provided=thumbnail_provided,
                    upload_job_id=upload_job_id,
                    status_data=status_data,
                )

            if current_status == "error":
                err = msg or "Rust processing error"
                _clear_progress_meta(task_id)
                _mark_video_failed(db, video_id, title, task_id, upload_job_id, err)
                return {"status": "failed", "error": err}

        # Absolute ceiling (safety net for pathological cases)
        if elapsed_secs >= _POLL_ABSOLUTE_CEILING_SEC:
            return _final_rust_status_check(
                db,
                video_type=video_type,
                title=title,
                video_id=video_id,
                thumbnail_provided=thumbnail_provided,
                task_id=task_id,
                upload_job_id=upload_job_id,
                reason=f"absolute ceiling {_POLL_ABSOLUTE_CEILING_SEC}s exceeded",
            )

        # Stall: no progress increase for the stall window
        if stall_secs >= _POLL_STALL_SEC:
            return _final_rust_status_check(
                db,
                video_type=video_type,
                title=title,
                video_id=video_id,
                thumbnail_provided=thumbnail_provided,
                task_id=task_id,
                upload_job_id=upload_job_id,
                reason=(
                    f"progress stalled for {int(stall_secs)}s "
                    f"(last={meta.get('progress')}%)"
                ),
            )

        # Still progressing (or within stall grace) — check again soon
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
        return {
            "status": "polling",
            "attempt": attempt,
            "progress": live_progress,
            "stall_secs": round(stall_secs, 1),
            "elapsed_secs": round(elapsed_secs, 1),
        }
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


@shared_task(name="video_tasks.backfill_previews")
def backfill_previews_task(limit: int = 10):
    """
    Generate preview clips for existing videos that lack them.
    Calls the Rust /preview endpoint for each video's source prefix.
    Processes `limit` videos per invocation.
    Returns a summary dict.
    """
    import requests as _requests

    db = SessionLocal()
    results = {"processed": 0, "succeeded": 0, "failed": 0, "skipped": 0, "errors": []}

    try:
        videos = (
            db.query(Video)
            .filter(Video.preview_url.is_(None))
            .filter(Video.status == "approved")
            .filter(Video.processing_key.isnot(None))
            .order_by(Video.id.desc())
            .limit(limit)
            .all()
        )

        for video in videos:
            task_id = video.processing_key
            source_prefix = f"uploads/{task_id}"
            results["processed"] += 1

            try:
                resp = _requests.post(
                    f"{config.RUST_SERVICE_URL}/preview",
                    json={"source_prefix": source_prefix, "task_id": task_id},
                    timeout=120.0,
                )
                data = resp.json()
                if data.get("status") == "ok" and data.get("preview_key"):
                    preview_key = data["preview_key"]
                    video.preview_url = storage.get_url(preview_key)
                    db.commit()
                    results["succeeded"] += 1
                    logger.info(f"Preview backfilled for video {video.id} (task={task_id})")
                else:
                    msg = data.get("message", "unknown error")
                    results["failed"] += 1
                    results["errors"].append({"video_id": video.id, "error": msg})
                    logger.warning(f"Preview backfill failed for video {video.id}: {msg}")
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"video_id": video.id, "error": str(e)})
                logger.error(f"Preview backfill exception for video {video.id}: {e}")
                db.rollback()

    finally:
        db.close()

    logger.info(
        f"Preview backfill complete: {results['succeeded']} succeeded, "
        f"{results['failed']} failed out of {results['processed']} processed"
    )
    return results
