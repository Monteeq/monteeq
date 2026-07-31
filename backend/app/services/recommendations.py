"""
Content-based video recommendations using pgvector embeddings.

Workflow
--------
1. Fetch the user's most-recently-liked videos (up to 50).
2. Look up each video's ``media_analysis.caption_embedding`` (vector(384))
   AND ``media_analysis.visual_embedding`` (vector(512)).
3. Average each set of non-null embeddings into separate query vectors.
4. Run a **blended** pgvector cosine-similarity scan against every published
   video, weighting caption and visual similarity equally (tune via
   ``CAPTION_WEIGHT`` / ``VISUAL_WEIGHT``).
5. Exclude videos the user already liked or watched.

Trending fallback
-----------------
If the user is new (no likes) **or** none of their liked videos have a
completed embedding yet, the endpoint silently falls back to a trending
query: most-liked videos from the past 7 days, same response shape. This
ensures new users always get results rather than an empty list.
"""
import logging
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import Like
from app.models.library import WatchHistory
from app.services.pgvector_utils import (
    blended_cosine_similarity_query,
    cosine_similarity_query,
    trending_query,
    vector_to_str,
)

logger = logging.getLogger(__name__)

# How many of the user's recent likes to consider for the taste vector
_MAX_HISTORY = 50

# Blending weights — adjust to shift ranking between text and visual
CAPTION_WEIGHT = 0.5
VISUAL_WEIGHT = 0.5


def _get_liked_video_ids(db: Session, user_id: int) -> List[int]:
    """Return the user's most-recent video like IDs (likes table, video_id IS NOT NULL)."""
    rows = (
        db.query(Like.video_id)
        .filter(Like.user_id == user_id, Like.video_id.isnot(None))
        .order_by(Like.created_at.desc())
        .limit(_MAX_HISTORY)
        .all()
    )
    return [r[0] for r in rows]


def _get_watched_video_ids(db: Session, user_id: int) -> List[int]:
    """Return video IDs the user has liked or watched (exclude set)."""
    liked = set(_get_liked_video_ids(db, user_id))

    watched_rows = (
        db.query(WatchHistory.video_id)
        .filter(WatchHistory.user_id == user_id)
        .order_by(WatchHistory.watched_at.desc())
        .limit(_MAX_HISTORY)
        .all()
    )
    for row in watched_rows:
        liked.add(row[0])

    return list(liked)


def _get_user_taste_vectors(
    db: Session, video_ids: List[int]
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """Average caption and visual embeddings for *video_ids* into query vectors.

    Returns ``(caption_vector, visual_vector)``.  Either can be ``None``
    when none of the videos have that embedding type.
    """
    if not video_ids:
        return None, None

    rows = db.execute(
        text(
            """
            SELECT ma.caption_embedding, ma.visual_embedding
            FROM media_analysis ma
            WHERE ma.video_id = ANY(:ids)
              AND ma.status = 'done'
              AND (ma.caption_embedding IS NOT NULL OR ma.visual_embedding IS NOT NULL)
            """
        ),
        {"ids": video_ids},
    ).fetchall()

    if not rows:
        return None, None

    caption_vecs = []
    visual_vecs = []
    for caption_emb, visual_emb in rows:
        if caption_emb is not None:
            caption_vecs.append(np.array(caption_emb, dtype=np.float32))
        if visual_emb is not None:
            visual_vecs.append(np.array(visual_emb, dtype=np.float32))

    def _avg_normalise(vecs):
        if not vecs:
            return None
        avg = np.mean(vecs, axis=0)
        norm = np.linalg.norm(avg)
        if norm > 0:
            avg = avg / norm
        return avg

    return _avg_normalise(caption_vecs), _avg_normalise(visual_vecs)


def _enrich_results(
    db: Session,
    raw: List[Tuple[int, float]],
) -> List[Dict]:
    """Hydrate raw (video_id, score) pairs into dicts with video metadata."""
    if not raw:
        return []

    video_ids = [vid for vid, _ in raw]
    score_map = {vid: score for vid, score in raw}

    from app.models.models import Video

    videos = (
        db.query(Video)
        .filter(Video.id.in_(video_ids))
        .all()
    )
    video_map = {v.id: v for v in videos}

    results = []
    for vid in video_ids:
        v = video_map.get(vid)
        if v is None:
            continue
        results.append({
            "video_id": v.id,
            "title": v.title,
            "thumbnail_url": v.thumbnail_url,
            "cover_url": v.cover_url or v.thumbnail_url,
            "video_type": v.video_type,
            "creator_username": v.owner.username if v.owner else "Unknown",
            "creator_profile_pic": v.owner.profile_pic if v.owner else None,
            "views": v.views,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "similarity_score": round(score_map[vid], 6),
        })

    return results


def get_user_recommendations(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> List[Dict]:
    """Return personalised video recommendations for *user_id*.

    Uses both caption and visual embeddings for blended scoring (50/50 by
    default).  Falls back to a trending query (most-liked videos from the
    past 7 days) when the user has no like history or none of their liked
    videos have any completed embeddings.
    """
    liked_ids = _get_liked_video_ids(db, user_id)
    caption_vec, visual_vec = _get_user_taste_vectors(db, liked_ids)

    exclude_ids = _get_watched_video_ids(db, user_id)

    if caption_vec is not None or visual_vec is not None:
        caption_str = vector_to_str(caption_vec) if caption_vec is not None else None
        visual_str = vector_to_str(visual_vec) if visual_vec is not None else None

        if caption_str is not None and visual_str is not None:
            raw = blended_cosine_similarity_query(
                db,
                caption_str,
                visual_str,
                caption_weight=CAPTION_WEIGHT,
                visual_weight=VISUAL_WEIGHT,
                limit=limit,
                offset=offset,
                exclude_video_ids=exclude_ids or None,
            )
        else:
            # Only one embedding type available — single-column query
            col = "caption_embedding" if caption_str is not None else "visual_embedding"
            vec = caption_str if caption_str is not None else visual_str
            raw = cosine_similarity_query(
                db,
                vec,
                vector_column=col,
                limit=limit,
                offset=offset,
                exclude_video_ids=exclude_ids or None,
            )
    else:
        logger.info(
            "No taste vectors for user %d — falling back to trending", user_id
        )
        raw = trending_query(db, limit=limit, offset=offset)

    return _enrich_results(db, raw)
