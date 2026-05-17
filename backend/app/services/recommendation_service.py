"""
recommendation_service.py
─────────────────────────
Monteeq – Universal Recommendation Engine

Works for both video_type="flash" and video_type="home".

Feed composition (per type):
  70% personalised  – ranked by tag-affinity × discovery score
  20% trending      – highest avg completion rate last 7 days globally
  10% exploration   – new / low-view / unseen videos

Scoring formula per interaction:
  score = (completion_rate × 0.4) + (liked × 0.3)
        + (replayed × 0.2) – (skipped_fast × 0.5)

Tag affinity update (background):
  affinity[tag] = affinity[tag] × 0.85 + score × 0.15  (EMA)
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from app.db.session import SessionLocal
from app.models.models import (
    Follow,
    UserRecommendationProfile,
    Video,
    VideoInteraction,
    Like
)

log = logging.getLogger("monteeq.recommend")

# ─── In-memory caches ────────────────────────────────────────────────────────
# Key: (user_id, video_type)
_feed_cache: Dict[Tuple[int, str], Dict] = {}
CACHE_TTL_SECONDS = 45

# Skip-streak tracker — keyed by user_id (type-agnostic: rapid skipping on
# any feed indicates the same UX state)
_skip_streaks: Dict[int, int] = {}

# ─── Scoring weights ─────────────────────────────────────────────────────────
WEIGHTS = {
    "completion": 0.4,
    "liked":      0.3,
    "replayed":   0.2,
    "skipped_fast": -0.5,
}

FEED_SPLIT = {"personal": 0.70, "trending": 0.20, "explore": 0.10}

# Exploration view-count thresholds (home videos naturally get more views)
EXPLORE_VIEW_THRESHOLD = {
    "flash": 1_000,
    "home":  5_000,
}


# ─── Scoring ──────────────────────────────────────────────────────────────────

def compute_interaction_score(
    watch_time: float,
    duration: float,
    liked: bool,
    skipped: bool,       # noqa: ARG001 – in payload for completeness, not used in formula
    replayed: bool,
) -> Tuple[float, float, bool]:
    """
    Returns (completion_rate, interaction_score, skipped_fast).
    """
    safe_duration = max(duration, 0.001)
    completion_rate = min(watch_time / safe_duration, 1.0)
    skipped_fast = watch_time < 2.0

    score = (
        completion_rate    * WEIGHTS["completion"]
        + int(liked)       * WEIGHTS["liked"]
        + int(replayed)    * WEIGHTS["replayed"]
        + int(skipped_fast) * WEIGHTS["skipped_fast"]
    )
    return completion_rate, score, skipped_fast


# ─── Skip-streak helpers ──────────────────────────────────────────────────────

def record_skip_event(user_id: int, watch_time: float) -> None:
    if watch_time < 2.0:
        _skip_streaks[user_id] = _skip_streaks.get(user_id, 0) + 1
    else:
        _skip_streaks[user_id] = 0


def get_skip_streak(user_id: int) -> int:
    return _skip_streaks.get(user_id, 0)


# ─── Profile helpers ──────────────────────────────────────────────────────────

def _get_or_create_profile(db: Session, user_id: int) -> UserRecommendationProfile:
    profile = (
        db.query(UserRecommendationProfile)
        .filter(UserRecommendationProfile.user_id == user_id)
        .first()
    )
    if not profile:
        profile = UserRecommendationProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _read_affinity(profile: UserRecommendationProfile) -> Dict[str, float]:
    try:
        return json.loads(profile.tag_affinity or "{}")
    except (ValueError, TypeError):
        return {}


def _read_seen_ids(profile: UserRecommendationProfile) -> List[int]:
    try:
        return json.loads(profile.seen_video_ids or "[]")
    except (ValueError, TypeError):
        return {}


def _read_history(profile: UserRecommendationProfile) -> Dict[str, dict]:
    try:
        return json.loads(profile.watch_history or "{}")
    except (ValueError, TypeError):
        return {}


def update_user_profile_background(
    user_id: int, 
    video_id: int, 
    score: float,
    watch_time: float = 0.0,
    completion_rate: float = 0.0
) -> None:
    """
    EMA update of the user's tag-affinity profile AND intelligent watch history tracking.
    """
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return

        profile = _get_or_create_profile(db, user_id)
        
        # 1. Update Tag Affinity
        if video.tags:
            tags = [t.strip().lower() for t in video.tags.split(",") if t.strip()]
            affinity = _read_affinity(profile)
            alpha = 0.15
            for tag in tags:
                current = affinity.get(tag, 0.0)
                affinity[tag] = round(current * (1 - alpha) + score * alpha, 6)
            profile.tag_affinity = json.dumps(affinity)

        # 2. Update Watch History (Intelligent)
        # Structure: {"v_id": {"c": count, "t": last_timestamp, "wt": total_wt, "mc": max_completion}}
        history = _read_history(profile)
        vid_str = str(video_id)
        
        record = history.get(vid_str, {"c": 0, "t": 0, "wt": 0.0, "mc": 0.0})
        record["c"] += 1
        record["t"] = int(time.time())
        record["wt"] += watch_time
        record["mc"] = max(record["mc"], completion_rate)
        
        history[vid_str] = record
        
        # Pruning: Keep only last 1000 interactions for performance
        if len(history) > 1000:
            # Drop the oldest timestamped entry
            oldest_vid = min(history.keys(), key=lambda k: history[k]["t"])
            history.pop(oldest_vid)
            
        profile.watch_history = json.dumps(history)

        # 3. Legacy Compatibility (Append to seen_video_ids)
        seen = _read_seen_ids(profile)
        if video_id not in seen:
            seen.append(video_id)
        if len(seen) > 500:
            seen = seen[-500:]
        profile.seen_video_ids = json.dumps(seen)

        db.commit()
        log.info("[recommend] Profile updated user=%d video=%d score=%.3f", user_id, video_id, score)
    except Exception as exc:
        db.rollback()
        log.error("[recommend] Profile update failed: %s", exc)
    finally:
        db.close()


# ─── Query helpers ────────────────────────────────────────────────────────────

def _base_query(db: Session, video_type: str):
    """Return a base query filtered to the given video_type, excluding failed or empty/corrupted videos."""
    return db.query(Video).options(joinedload(Video.owner)).filter(
        Video.video_type == video_type,
        Video.status == "approved",
        Video.video_url != "",
        Video.video_url.isnot(None),
    )


def _apply_exclude(query, exclude_ids: List[int]):
    """Apply NOT IN filter only when the list is non-empty (guards bad SQL)."""
    if exclude_ids:
        return query.filter(Video.id.notin_(exclude_ids))
    return query


# ─── Feed segment builders ────────────────────────────────────────────────────

def _personalised_videos(
    db: Session,
    video_type: str,
    affinity: Dict[str, float],
    history: Dict[str, dict],
    limit: int,
    prefer_short: bool,
) -> List[Video]:
    """
    Pull up to 200 candidates and score them with personalized affinity
    MULTIPLIED by dynamic history weights (cooldown, repeat penalty, skip-boost).
    """
    # We fetch more candidates than limit to allow room for scoring diversity
    query = _base_query(db, video_type)
    if prefer_short and video_type == "flash":
        query = query.filter(Video.duration <= 20)

    candidates: List[Video] = query.order_by(desc(Video.discovery_score)).limit(300).all()
    if not candidates:
        return []

    now = int(time.time())

    def _calculate_multiplier(v: Video) -> float:
        vid_str = str(v.id)
        if vid_str not in history:
            return 1.0
        
        h = history[vid_str]
        count = h.get("c", 0)
        last_at = h.get("t", 0)
        max_c = h.get("mc", 0.0)
        total_wt = h.get("wt", 0.0)
        
        mult = 1.0
        
        # 1. Cooldown (Strict)
        if (now - last_at) < 7200: # 2 hours
            mult *= 0.05
        
        # 2. Diminishing Returns (Penalty per view)
        mult *= (1.0 / (count + 1))
        
        # 3. Skip-Retry (Boost for videos skipped instantly but seen once long ago)
        if count == 1 and total_wt < 2.0 and (now - last_at) > 14400: # 4 hours
            mult *= 2.0
            
        # 4. Replay Allowance (Boost for high-engagement loops)
        if max_c > 1.2:
            mult *= 1.5
            
        return mult

    scored_candidates = []
    for v in candidates:
        tags = [t.strip().lower() for t in (v.tags or "").split(",") if t.strip()]
        tag_score = sum(affinity.get(t, 0.0) for t in tags)
        
        base_score = (v.discovery_score or 0.0) * 0.5 + tag_score * 0.5
        multiplier = _calculate_multiplier(v)
        
        scored_candidates.append((v, base_score * multiplier))

    scored_candidates.sort(key=lambda x: x[1], reverse=True)
    return [x[0] for x in scored_candidates[:limit]]


def _trending_videos(
    db: Session,
    video_type: str,
    history: Dict[str, dict],
    limit: int,
) -> List[Video]:
    """
    Trending videos, but filtered for history cooldowns.
    """
    if limit <= 0:
        return []

    week_ago = datetime.utcnow() - timedelta(days=7)
    now = int(time.time())

    trending_sub = (
        db.query(
            VideoInteraction.video_id.label("video_id"),
            func.avg(VideoInteraction.completion_rate).label("avg_completion"),
        )
        .filter(VideoInteraction.timestamp >= week_ago)
        .group_by(VideoInteraction.video_id)
        .having(func.count(VideoInteraction.id) >= 3)
        .subquery()
    )

    base_query = (
        db.query(Video)
        .options(joinedload(Video.owner))
        .join(trending_sub, Video.id == trending_sub.c.video_id)
        .filter(Video.video_type == video_type, Video.status == "approved")
        .order_by(desc(trending_sub.c.avg_completion))
    )
    
    # We fetch more and manually filter cooldowns to ensure we return `limit`
    candidates = base_query.limit(limit + 50).all()
    
    filtered = []
    for v in candidates:
        h = history.get(str(v.id), {})
        # Penalty for very recent views in trending (variety)
        if h and (now - h.get("t", 0)) < 3600: # 1 hour
            continue
        filtered.append(v)
        if len(filtered) >= limit:
            break
            
    return filtered or candidates[:limit]


def _exploration_videos(
    db: Session,
    video_type: str,
    history: Dict[str, dict],
    already_returned_ids: List[int],
    limit: int,
    prefer_short: bool,
) -> List[Video]:
    """
    Exploration = low-view videos that haven't been seen much.
    """
    if limit <= 0:
        return []

    view_threshold = EXPLORE_VIEW_THRESHOLD.get(video_type, 1_000)
    seen_ids = [int(k) for k in history.keys()]
    exclude = list(set(seen_ids + already_returned_ids))

    query = (
        _apply_exclude(_base_query(db, video_type), exclude)
        .filter(Video.views < view_threshold)
        .order_by(func.random())
    )
    if prefer_short and video_type == "flash":
        query = query.filter(Video.duration <= 20)
    return query.limit(limit).all()


def _following_videos(
    db: Session,
    user_id: int,
    video_type: str,
    seen_ids: List[int],
    limit: int,
) -> List[Video]:
    """
    Following = videos from users that the current user follows.
    """
    if limit <= 0:
        return []

    # Get IDs of followed users
    followed_user_ids = [
        f.followed_id for f in db.query(Follow.followed_id).filter(Follow.follower_id == user_id).all()
    ]
    if not followed_user_ids:
        return []

    query = (
        _apply_exclude(_base_query(db, video_type), seen_ids)
        .filter(Video.owner_id.in_(followed_user_ids))
        .order_by(desc(Video.created_at))
    )
    return query.limit(limit).all()


# ─── Cache helpers ────────────────────────────────────────────────────────────

def invalidate_cache(user_id: int, video_type: Optional[str] = None) -> None:
    """
    Invalidate cached feed(s) for a user.
    Pass video_type to clear only that feed; omit to clear all.
    """
    if video_type:
        _feed_cache.pop((user_id, video_type), None)
    else:
        for key in list(_feed_cache.keys()):
            if key[0] == user_id:
                _feed_cache.pop(key, None)


# ─── Public API ───────────────────────────────────────────────────────────────

def build_feed(
    db: Session,
    user_id: int,
    video_type: str = "flash",
    feed_type: str = "foryou",
    limit: int = 20,
    mood: Optional[str] = None,
) -> List[Video]:
    """
    Assemble and return a ranked feed for `user_id` and `video_type`.

    video_type: "flash" | "home"
    feed_type: "foryou" | "trending" | "following"
    Cached per (user_id, video_type, feed_type) for CACHE_TTL_SECONDS seconds.
    """
    cache_key = (user_id, video_type, feed_type)
    cached = _feed_cache.get(cache_key)
    if cached and (datetime.utcnow() - cached["ts"]).total_seconds() < CACHE_TTL_SECONDS:
        log.debug("[recommend] Cache hit user=%d type=%s", user_id, video_type)
        return cached["feed"]

    profile = _get_or_create_profile(db, user_id)
    affinity = _read_affinity(profile)
    history = _read_history(profile)
    prefer_short = get_skip_streak(user_id) >= 3

    personal, trending, explore = [], [], []

    if feed_type == "trending":
        trending = _trending_videos(db, video_type, history, limit)
        feed = trending
    elif feed_type == "following":
        # For Following, we still use strict 'seen' list for now as variety is secondary to content
        seen_ids = [int(k) for k in history.keys()]
        personal = _following_videos(db, user_id, video_type, seen_ids, limit)
        if not personal:
            trending = _trending_videos(db, video_type, history, limit)
            feed = trending
        else:
            feed = personal
    else:  # foryou
        n_personal = max(1, round(limit * FEED_SPLIT["personal"]))
        n_trending = max(1, round(limit * FEED_SPLIT["trending"]))
        n_explore = max(1, limit - n_personal - n_trending)

        personal = _personalised_videos(db, video_type, affinity, history, n_personal, prefer_short)
        personal_ids = [v.id for v in personal]

        trending = _trending_videos(db, video_type, history, n_trending)
        trending_ids = [v.id for v in trending]

        explore = _exploration_videos(
            db, video_type, history, personal_ids + trending_ids, n_explore, prefer_short
        )
        feed = personal + trending + explore

    # Optional tag/mood filter
    if mood:
        mood_lc = mood.lower()
        feed = [v for v in feed if mood_lc in (v.tags or "").lower()]

    # Deduplicate preserving order
    seen_set: set = set()
    deduped: List[Video] = []
    for v in feed:
        if v.id not in seen_set:
            deduped.append(v)
            seen_set.add(v.id)

    # Single batch query to annotate liked_by_user
    if deduped:
        video_ids = [v.id for v in deduped]
        liked_ids = {
            r[0]
            for r in db.query(Like.video_id)
            .filter(Like.user_id == user_id, Like.video_id.in_(video_ids))
            .all()
        }
        for v in deduped:
            v.liked_by_user = v.id in liked_ids

    _feed_cache[cache_key] = {"ts": datetime.utcnow(), "feed": deduped}
    log.info(
        "[recommend] Feed built user=%d type=%s personal=%d trending=%d explore=%d",
        user_id, video_type, len(personal), len(trending), len(explore),
    )
    return deduped
