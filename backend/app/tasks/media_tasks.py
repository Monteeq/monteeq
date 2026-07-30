import logging
import os
import tempfile

from celery import shared_task

# Bind @shared_task to the Redis-backed worker app
import app.worker  # noqa: F401
from app.db.session import SessionLocal
from app.models.models import Video
from app.services.media_analysis import (
    extract_frames,
    detect_scene_cuts,
    detect_beats,
    generate_caption_embedding,
    generate_visual_embedding,
    download_video_from_s3,
)

logger = logging.getLogger(__name__)


@shared_task(name="tasks.media.analyze_media", max_retries=2, default_retry_delay=120)
def analyze_media(video_id: int):
    """Download transcoded video, run frame extraction, scene detection,
    beat tracking, and caption embedding, then write results to media_analysis.

    After completion, fires ``generate_visual_embedding`` as a follow-up task
    so the heavier CLIP work is retryable independently.
    """

    db = SessionLocal()
    video = None
    local_video_path = None
    status = "processing"

    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error("analyze_media: video %s not found", video_id)
            return

        # Ensure a media_analysis row exists
        from app.models.models import Base
        # Lazy import to avoid circular
        from sqlalchemy import text
        db.execute(
            text(
                "INSERT INTO media_analysis (video_id, status, created_at, updated_at) "
                "VALUES (:vid, 'processing', now(), now()) "
                "ON CONFLICT (video_id) DO UPDATE SET status='processing', updated_at=now()"
            ),
            {"vid": video_id},
        )
        db.commit()

        # Resolve the S3 key for the master HLS manifest or fallback mp4
        # The transcoded video lives under videos/{task_id}/master.m3u8
        # For analysis we want the MP4 source — but after finalization source is deleted.
        # Use the cover/thumbnail as a proxy is not useful.
        # Instead, we re-download from the first quality variant's segments.
        # Actually: the original upload is deleted. We need the HLS stream.
        # For frame extraction, we can use the HLS URL directly via ffmpeg.
        video_s3_key = f"videos/{video.processing_key}/master.m3u8" if video.processing_key else None

        # Download the video — try HLS master first, fall back to direct mp4
        hls_url = video.video_url
        if hls_url:
            # ffmpeg can read HLS directly — download to a local mp4 for analysis
            local_video_path = tempfile.mktemp(suffix=".mp4")
            import subprocess
            subprocess.run(
                [
                    "ffmpeg", "-i", hls_url,
                    "-c", "copy",
                    "-bsf:a", "aac_adtstoasc",
                    "-y", local_video_path,
                ],
                check=True,
                capture_output=True,
                timeout=900,
            )
            logger.info("Downloaded HLS stream to %s for video %s", local_video_path, video_id)
        else:
            logger.error("analyze_media: no video_url for video %s", video_id)
            status = "failed"
            return

        # 1) Frame extraction
        frame_paths = extract_frames(local_video_path, str(video_id))

        # 2) Scene cuts
        scene_cuts = detect_scene_cuts(local_video_path)

        # 3) Beat detection
        beat_timestamps = detect_beats(local_video_path)

        # 4) Caption embedding
        caption_embedding = generate_caption_embedding(video.title, video.tags)

        # Write results
        from sqlalchemy import text as sa_text
        db.execute(
            sa_text(
                "UPDATE media_analysis SET "
                "  status = 'done',"
                "  frame_sample_paths = :frames,"
                "  scene_cuts = :scenes,"
                "  beat_timestamps = :beats,"
                "  caption_embedding = :embedding,"
                "  updated_at = now() "
                "WHERE video_id = :vid"
            ),
            {
                "frames": frame_paths,
                "scenes": scene_cuts,
                "beats": beat_timestamps,
                "embedding": str(caption_embedding) if caption_embedding else None,
                "vid": video_id,
            },
        )
        db.commit()
        logger.info("Media analysis completed for video %s", video_id)

        # Fire follow-up CLIP visual embedding task (independent retry)
        generate_visual_embedding.delay(video_id)

    except Exception as e:
        logger.exception("Media analysis failed for video %s: %s", video_id, e)
        status = "failed"
        try:
            if video:
                from sqlalchemy import text as sa_text
                db.execute(
                    sa_text(
                        "UPDATE media_analysis SET status='failed', updated_at=now() WHERE video_id = :vid"
                    ),
                    {"vid": video_id},
                )
                db.commit()
        except Exception:
            db.rollback()
    finally:
        if local_video_path and os.path.exists(local_video_path):
            try:
                os.unlink(local_video_path)
            except OSError:
                pass
        db.close()


@shared_task(
    name="tasks.media.generate_visual_embedding",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def generate_visual_embedding(video_id: int):
    """Download representative frames from S3, encode with CLIP ViT-B/32,
    and write the averaged L2-normalized vector to visual_embedding.

    This task is decoupled from ``analyze_media`` so transient S3 or model
    failures can retry without re-running the full analysis pipeline.
    """
    db = SessionLocal()
    try:
        from sqlalchemy import text as sa_text

        row = db.execute(
            sa_text(
                "SELECT frame_sample_paths FROM media_analysis "
                "WHERE video_id = :vid AND status = 'done'"
            ),
            {"vid": video_id},
        ).fetchone()

        if not row or not row[0]:
            logger.warning(
                "generate_visual_embedding: no frame_sample_paths for video %s", video_id
            )
            return

        frame_s3_keys = row[0]
        from app.services.media_analysis import generate_visual_embedding as _gen
        visual_vec = _gen(frame_s3_keys)

        if visual_vec is None:
            logger.warning(
                "generate_visual_embedding: could not produce embedding for video %s",
                video_id,
            )
            return

        from app.services.pgvector_utils import vector_to_str

        db.execute(
            sa_text(
                "UPDATE media_analysis SET visual_embedding = :vec, updated_at = now() "
                "WHERE video_id = :vid"
            ),
            {"vec": vector_to_str(visual_vec), "vid": video_id},
        )
        db.commit()
        logger.info("Visual embedding written for video %s", video_id)

    except Exception as e:
        logger.exception("generate_visual_embedding failed for video %s: %s", video_id, e)
        raise  # let autoretry handle it
    finally:
        db.close()
