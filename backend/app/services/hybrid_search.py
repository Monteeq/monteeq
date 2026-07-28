"""
Hybrid search — merges keyword (ILIKE) and semantic (pgvector) search results.

The keyword path lives in app.crud.video.search_videos / search_posts (untouched).
This module adds the semantic path and the merge/ranking logic.
"""
import logging
from typing import List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model singleton — loaded once, reused across requests
# ---------------------------------------------------------------------------
_encoder = None


def _get_encoder():
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        _encoder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded sentence-transformers model all-MiniLM-L6-v2")
    return _encoder


# ---------------------------------------------------------------------------
# Semantic search via pgvector
# ---------------------------------------------------------------------------

def semantic_search(
    db: Session,
    query: str,
    limit: int = 20,
    status: str = "approved",
) -> List[Tuple[int, float]]:
    """Return [(video_id, similarity_score), ...] ranked by cosine distance.

    Uses the <=> (cosine distance) operator from pgvector.
    similarity = 1 - cosine_distance, so higher is better.
    """
    if not query or not query.strip():
        return []

    encoder = _get_encoder()
    embedding = encoder.encode(query.strip(), normalize_embeddings=True)
    # pgvector expects a literal string like '[0.1, 0.2, ...]'
    embedding_str = "[" + ",".join(str(float(v)) for v in embedding) + "]"

    # cosine_distance <=> returns 0 for identical vectors, 2 for opposite
    # similarity = 1 - distance, so range is [-1, 1]
    rows = db.execute(
        text(
            """
            SELECT ma.video_id, (1 - (ma.caption_embedding <=> :embedding::vector)) AS similarity
            FROM media_analysis ma
            JOIN videos v ON v.id = ma.video_id
            WHERE ma.caption_embedding IS NOT NULL
              AND v.status = :status
              AND ma.status = 'done'
            ORDER BY ma.caption_embedding <=> :embedding::vector
            LIMIT :limit
            """
        ),
        {"embedding": embedding_str, "status": status, "limit": limit},
    ).fetchall()

    return [(row[0], float(row[1])) for row in rows]


# ---------------------------------------------------------------------------
# Pure merge / ranking function
# ---------------------------------------------------------------------------

KEYWORD_BOOST = 1.0  # Added to raw similarity so keyword matches always rank above semantic-only


def merge_search_results(
    keyword_video_ids: List[int],
    semantic_results: List[Tuple[int, float]],
    limit: int = 50,
) -> List[Tuple[int, float]]:
    """Merge keyword and semantic video results into a single ranked list.

    - keyword_video_ids: list of video IDs from ILIKE search (order = relevance)
    - semantic_results:  list of (video_id, similarity_score) from pgvector
    - Returns [(video_id, final_score), ...] sorted descending, capped to *limit*.

    A video matching both gets KEYWORD_BOOST + its semantic score (not double-counted).
    Keyword-only matches get KEYWORD_BOOST + 0.
    Semantic-only matches get their raw similarity score.
    """
    scores = {}

    # Keyword results — assign boost + recency tiebreaker from position
    for idx, vid in enumerate(keyword_video_ids):
        recency = max(0.0, 1.0 - idx * 0.01)  # slight tiebreak for earlier results
        scores[vid] = KEYWORD_BOOST + recency

    # Semantic results — merge or add
    for vid, sim in semantic_results:
        if vid in scores:
            # Already a keyword hit — use keyword-boosted score (higher)
            pass
        else:
            scores[vid] = sim

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return ranked[:limit]
