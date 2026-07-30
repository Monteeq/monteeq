"""
Shared pgvector query helpers.

Both hybrid_search.py and recommendations.py call into these utilities
so the raw cosine-similarity SQL is written exactly once.
"""
import logging
from typing import List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def vector_to_str(embedding) -> str:
    """Convert a numpy / list embedding to the literal string pgvector expects."""
    return "[" + ",".join(str(float(v)) for v in embedding) + "]"


# ---------------------------------------------------------------------------
# Single-column similarity (used by legacy callers / fallback)
# ---------------------------------------------------------------------------

def cosine_similarity_query(
    db: Session,
    embedding_str: str,
    *,
    vector_column: str = "caption_embedding",
    limit: int = 20,
    offset: int = 0,
    status: str = "approved",
    exclude_video_ids: Optional[List[int]] = None,
) -> List[Tuple[int, float]]:
    """Run a pgvector cosine-similarity search against media_analysis + videos.

    Returns [(video_id, similarity_score), ...] ordered by similarity DESC.

    Parameters
    ----------
    embedding_str : str
        Pre-formatted vector string, e.g. ``"[0.1,0.2,...]"``.
    vector_column : str
        Which pgvector column to compare against (default ``caption_embedding``).
    exclude_video_ids : list[int], optional
        Video IDs to exclude from results (e.g. already-liked videos).
    """
    exclude_clause = ""
    params: dict = {
        "embedding": embedding_str,
        "status": status,
        "limit": limit,
        "offset": offset,
    }

    if exclude_video_ids:
        exclude_clause = "AND v.id NOT IN :exclude_ids"
        params["exclude_ids"] = tuple(exclude_video_ids)

    sql = text(f"""
        SELECT ma.video_id,
               (1 - (ma.{vector_column} <=> CAST(:embedding AS vector))) AS similarity
        FROM media_analysis ma
        JOIN videos v ON v.id = ma.video_id
        WHERE ma.{vector_column} IS NOT NULL
          AND v.status = :status
          AND v.video_url IS NOT NULL
          AND v.video_url != ''
          AND ma.status = 'done'
          {exclude_clause}
        ORDER BY ma.{vector_column} <=> CAST(:embedding AS vector)
        LIMIT :limit OFFSET :offset
    """)

    rows = db.execute(sql, params).fetchall()
    return [(row[0], float(row[1])) for row in rows]


# ---------------------------------------------------------------------------
# Blended dual-column similarity (caption + visual)
# ---------------------------------------------------------------------------

def blended_cosine_similarity_query(
    db: Session,
    caption_embedding_str: Optional[str],
    visual_embedding_str: Optional[str],
    *,
    caption_weight: float = 0.5,
    visual_weight: float = 0.5,
    limit: int = 20,
    offset: int = 0,
    status: str = "approved",
    exclude_video_ids: Optional[List[int]] = None,
) -> List[Tuple[int, float]]:
    """Cosine similarity against both caption and visual embeddings, blended.

    Returns [(video_id, blended_score), ...] ordered by blended_score DESC.

    If a video has only one embedding type (the other is NULL), the NULL side
    contributes 0 via COALESCE so the score degrades gracefully rather than
    producing NULL.

    Either embedding string can be ``None`` (e.g. no visual taste vector
    computed).  When one is None, the query falls back to single-column mode
    for that side.
    """
    exclude_clause = ""
    params: dict = {
        "caption_weight": caption_weight,
        "visual_weight": visual_weight,
        "status": status,
        "limit": limit,
        "offset": offset,
    }

    if exclude_video_ids:
        exclude_clause = "AND v.id NOT IN :exclude_ids"
        params["exclude_ids"] = tuple(exclude_video_ids)

    # Build per-side COALESCE expressions
    if caption_embedding_str is not None:
        params["caption_vec"] = caption_embedding_str
        caption_expr = "COALESCE(1 - (ma.caption_embedding <=> CAST(:caption_vec AS vector)), 0)"
    else:
        caption_expr = "0"

    if visual_embedding_str is not None:
        params["visual_vec"] = visual_embedding_str
        visual_expr = "COALESCE(1 - (ma.visual_embedding <=> CAST(:visual_vec AS vector)), 0)"
    else:
        visual_expr = "0"

    # At least one side must be active, otherwise there's nothing to score
    if caption_embedding_str is None and visual_embedding_str is None:
        return []

    # We need at least one non-null embedding column to filter on
    if caption_embedding_str is not None and visual_embedding_str is not None:
        non_null_filter = "(ma.caption_embedding IS NOT NULL OR ma.visual_embedding IS NOT NULL)"
    elif caption_embedding_str is not None:
        non_null_filter = "ma.caption_embedding IS NOT NULL"
    else:
        non_null_filter = "ma.visual_embedding IS NOT NULL"

    sql = text(f"""
        SELECT ma.video_id,
               :caption_weight * {caption_expr}
             + :visual_weight * {visual_expr} AS blended_sim
        FROM media_analysis ma
        JOIN videos v ON v.id = ma.video_id
        WHERE {non_null_filter}
          AND v.status = :status
          AND v.video_url IS NOT NULL
          AND v.video_url != ''
          AND ma.status = 'done'
          {exclude_clause}
        ORDER BY blended_sim DESC
        LIMIT :limit OFFSET :offset
    """)

    rows = db.execute(sql, params).fetchall()
    return [(row[0], float(row[1])) for row in rows]


# ---------------------------------------------------------------------------
# Trending fallback (no embeddings required)
# ---------------------------------------------------------------------------

def trending_query(
    db: Session,
    *,
    limit: int = 20,
    offset: int = 0,
    days: int = 7,
) -> List[Tuple[int, float]]:
    """Fallback query: most-liked videos from the last *days* days.

    Returns [(video_id, score), ...] where score is normalised likes_count.

    Used when a user has no embedding history (new user or no embeddings yet).
    """
    sql = text("""
        SELECT v.id, LEAST(v.likes_count, 1000)::float AS score
        FROM videos v
        WHERE v.status = 'approved'
          AND v.video_url IS NOT NULL
          AND v.video_url != ''
          AND v.created_at >= NOW() - (:days || ' days')::interval
        ORDER BY v.likes_count DESC, v.views DESC
        LIMIT :limit OFFSET :offset
    """)

    rows = db.execute(sql, {"days": days, "limit": limit, "offset": offset}).fetchall()
    return [(row[0], float(row[1])) for row in rows]
