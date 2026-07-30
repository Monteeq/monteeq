"""
Hybrid search — merges keyword (ILIKE) and semantic (pgvector) search results.

The keyword path lives in app.crud.video.search_videos / search_posts (untouched).
This module adds the semantic path and the merge/ranking logic.

Semantic search now blends two embedding types:
  - **caption_embedding** (384-dim, sentence-transformers all-MiniLM-L6-v2)
  - **visual_embedding** (512-dim, CLIP ViT-B/32)
"""
import logging
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.services.pgvector_utils import (
    blended_cosine_similarity_query,
    cosine_similarity_query,
    vector_to_str,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tuning constants — adjust these to shift ranking between text and visual
# ---------------------------------------------------------------------------
CAPTION_WEIGHT = 0.5  # weight for sentence-transformers text similarity
VISUAL_WEIGHT = 0.5   # weight for CLIP visual similarity

# ---------------------------------------------------------------------------
# Model singletons — loaded once, reused across requests
# ---------------------------------------------------------------------------
_caption_encoder = None
_visual_encoder_loaded = False


def _get_caption_encoder():
    global _caption_encoder
    if _caption_encoder is None:
        from sentence_transformers import SentenceTransformer
        _caption_encoder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded sentence-transformers model all-MiniLM-L6-v2")
    return _caption_encoder


def _ensure_visual_encoder():
    """Eagerly load the CLIP text encoder (module-level singleton via clip_utils)."""
    global _visual_encoder_loaded
    if not _visual_encoder_loaded:
        from app.services.clip_utils import _load
        _load()
        _visual_encoder_loaded = True


# ---------------------------------------------------------------------------
# Semantic search via pgvector (blended caption + visual)
# ---------------------------------------------------------------------------

def semantic_search(
    db: Session,
    query: str,
    limit: int = 20,
    status: str = "approved",
) -> List[Tuple[int, float]]:
    """Return [(video_id, blended_score), ...] ranked by combined similarity.

    Encodes the query with both sentence-transformers (caption) and CLIP
    (visual), then runs a single blended pgvector query.  If CLIP is
    unavailable or the visual column is NULL for a video, that side
    contributes 0 via COALESCE — no errors, no zeroing of the whole score.
    """
    if not query or not query.strip():
        return []

    # Caption embedding (sentence-transformers)
    caption_encoder = _get_caption_encoder()
    caption_emb = caption_encoder.encode(query.strip(), normalize_embeddings=True)
    caption_str = vector_to_str(caption_emb)

    # Visual embedding (CLIP text encoder)
    visual_str = None
    try:
        _ensure_visual_encoder()
        from app.services.clip_utils import encode_text
        visual_emb = encode_text(query.strip())
        visual_str = vector_to_str(visual_emb)
    except Exception as exc:
        logger.warning("CLIP text encoding failed — falling back to caption-only: %s", exc)

    if visual_str is not None:
        return blended_cosine_similarity_query(
            db,
            caption_str,
            visual_str,
            caption_weight=CAPTION_WEIGHT,
            visual_weight=VISUAL_WEIGHT,
            limit=limit,
            status=status,
        )

    # Fallback: caption-only (CLIP unavailable)
    return cosine_similarity_query(
        db, caption_str, limit=limit, status=status,
    )


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
