"""
Media analysis pipeline — extracts frames, scene cuts, beat timestamps,
and caption embeddings from a transcoded video.

Called by the Celery task after transcoding completes.
"""
import os
import tempfile
import shutil
import logging
import subprocess
import json
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)


def extract_frames(video_path: str, video_id: str) -> List[str]:
    """Sample 1 frame per second from the video, upload each to S3, return S3 keys."""
    from app.core.storage import storage

    frames_dir = tempfile.mkdtemp(prefix="frames_")
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", video_path,
                "-vf", "fps=1",
                "-q:v", "3",
                os.path.join(frames_dir, "frame_%04d.jpg"),
            ],
            check=True,
            capture_output=True,
            timeout=600,
        )

        s3_keys = []
        for fname in sorted(os.listdir(frames_dir)):
            local_path = os.path.join(frames_dir, fname)
            s3_key = f"analysis/{video_id}/frames/{fname}"
            storage.upload_file(local_path, s3_key)
            s3_keys.append(s3_key)

        logger.info("Uploaded %d frames for video %s", len(s3_keys), video_id)
        return s3_keys
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)


def detect_scene_cuts(video_path: str) -> List[float]:
    """Detect scene cuts using pyscenedetect ContentDetector. Returns timestamps in seconds."""
    from scenedetect import open_video, SceneManager
    from scenedetect.detectors import ContentDetector

    video = open_video(video_path)
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=27.0))
    scene_manager.detect_scenes(video, show_progress=False)

    scene_list = scene_manager.get_scene_list()
    # Return the start time of each scene as seconds
    timestamps = [round(scene[0].get_seconds(), 3) for scene in scene_list]
    logger.info("Detected %d scene cuts", len(timestamps))
    return timestamps


def detect_beats(video_path: str) -> List[float]:
    """Extract audio and detect beat timestamps using librosa. Returns timestamps in seconds."""
    import librosa

    # Extract audio to a temp WAV file
    audio_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    audio_tmp.close()
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1",
                "-y", audio_tmp.name,
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )

        y, sr = librosa.load(audio_tmp.name, sr=22050)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        beat_times = [round(t, 3) for t in beat_times]
        logger.info("Detected %d beat timestamps", len(beat_times))
        return beat_times
    finally:
        os.unlink(audio_tmp.name)


def generate_caption_embedding(title: str, tags: Optional[str]) -> Optional[List[float]]:
    """Generate a 384-dim embedding from title+tags using all-MiniLM-L6-v2."""
    from sentence_transformers import SentenceTransformer

    text = title or ""
    if tags:
        tag_str = " ".join(t.strip() for t in tags.split(",") if t.strip())
        text = f"{text} {tag_str}"

    text = text.strip()
    if not text:
        return None

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def download_video_from_s3(video_s3_key: str) -> str:
    """Download a video from S3 to a temp path. Returns the local file path."""
    from app.core.storage import storage
    from app.core import config

    suffix = os.path.splitext(video_s3_key)[-1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.close()

    try:
        storage.s3_client.download_file(
            config.AWS_STORAGE_BUCKET_NAME,
            video_s3_key,
            tmp.name,
        )
        return tmp.name
    except Exception:
        os.unlink(tmp.name)
        raise
