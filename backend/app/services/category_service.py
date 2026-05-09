"""
category_service.py
───────────────────
Intelligent category discovery engine.

Scans video hashtags, vets them for "meaningfulness", and manages
the DiscoveredCategory table. Supports semantic tag expansion so
that browsing a category shows related content, not just exact matches.
"""

import logging
import re
from collections import Counter
from typing import Dict, List, Optional, Set

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.models import DiscoveredCategory, Video

log = logging.getLogger("monteeq.categories")

# ─── Vetting rules ────────────────────────────────────────────────────────────

# Words that are too generic to be a meaningful category
STOP_WORDS: Set[str] = {
    "video", "clip", "post", "content", "edit", "edits", "new", "best",
    "top", "shorts", "short", "reel", "reels", "viral", "trending",
    "fyp", "foryou", "foryoupage", "fy", "fypシ", "for", "you", "page",
    "like", "follow", "share", "subscribe", "comment", "watch", "hot",
    "fire", "lit", "cap", "no", "yes", "lol", "omg", "wow", "the",
    "monteeq", "flash", "home", "challenge", "entry", "test", "demo",
}

# Minimum tag frequency to even be considered
MIN_FREQUENCY = 2

# Minimum tag length (characters)
MIN_LENGTH = 3


def _is_meaningful(tag: str) -> bool:
    """
    Vet a tag for meaningfulness.
    Rules:
      - Must be >= MIN_LENGTH characters
      - Must NOT contain any digit
      - Must NOT be a stop-word
      - Must be purely alphabetic (allows hyphens for compound words)
    """
    if len(tag) < MIN_LENGTH:
        return False

    # Reject any tag containing digits
    if any(c.isdigit() for c in tag):
        return False

    # Reject stop-words
    if tag in STOP_WORDS:
        return False

    # Must be alphabetic (allow hyphens for compound words like "hip-hop")
    if not re.match(r'^[a-z]+(-[a-z]+)*$', tag):
        return False

    return True


# ─── Semantic similarity map ─────────────────────────────────────────────────
# This maps a canonical category to related tags.
# When a user browses "football", the feed will include videos tagged with
# any of these related terms.

SEMANTIC_MAP: Dict[str, List[str]] = {
    "football":   ["soccer", "goal", "penalty", "freekick", "messi", "ronaldo", "neymar", "haaland", "premier", "laliga", "ucl", "worldcup", "striker", "goalkeeper"],
    "anime":      ["manga", "otaku", "naruto", "onepiece", "dragonball", "jujutsu", "demonslayer", "aot", "bleach", "goku", "luffy", "sasuke"],
    "gaming":     ["gamer", "gameplay", "esports", "valorant", "fortnite", "minecraft", "cod", "warzone", "apex", "league", "roblox", "pubg", "overwatch"],
    "amv":        ["animeedit", "amvedit", "animemv", "musicvideo"],
    "music":      ["song", "beat", "hiphop", "rap", "rnb", "afrobeats", "pop", "rock", "jazz", "drill", "trap", "producer"],
    "comedy":     ["funny", "humor", "meme", "memes", "joke", "jokes", "skit", "skits", "prank", "pranks"],
    "fitness":    ["gym", "workout", "exercise", "bodybuilding", "muscle", "gains", "cardio", "crossfit", "yoga"],
    "cooking":    ["food", "recipe", "chef", "kitchen", "baking", "meal", "cuisine"],
    "fashion":    ["style", "outfit", "streetwear", "drip", "clothes", "sneakers", "designer"],
    "art":        ["drawing", "painting", "illustration", "sketch", "digital", "artist", "creative"],
    "dance":      ["dancing", "choreography", "dancer", "hiphop", "breaking", "twerk"],
    "basketball": ["nba", "hoops", "dunk", "lebron", "curry", "jordan"],
    "boxing":     ["fighter", "knockout", "mma", "ufc", "sparring", "tyson"],
    "cars":       ["automotive", "drift", "racing", "supercar", "jdm", "tuning", "motorsport"],
    "nature":     ["wildlife", "landscape", "ocean", "mountain", "sunset", "travel"],
    "tech":       ["technology", "coding", "programming", "gadget", "software", "hardware", "ai"],
    "motivation": ["motivational", "grind", "hustle", "mindset", "success", "inspire", "discipline"],
    "education":  ["learning", "study", "tutorial", "howto", "science", "history", "math"],
}

# Build reverse lookup: tag -> canonical category
_REVERSE_MAP: Dict[str, str] = {}
for canonical, related in SEMANTIC_MAP.items():
    for tag in related:
        _REVERSE_MAP[tag] = canonical


def get_canonical_category(tag: str) -> Optional[str]:
    """If a tag is a known alias, return its canonical category name."""
    return _REVERSE_MAP.get(tag)


def get_expanded_tags(category_name: str) -> List[str]:
    """
    Given a category name, return all tags that should match
    (the category itself + its related tags from the semantic map
    + any related_tags stored in the DB entry).
    """
    tags = [category_name]
    if category_name in SEMANTIC_MAP:
        tags.extend(SEMANTIC_MAP[category_name])
    return list(set(tags))


# ─── Discovery engine ─────────────────────────────────────────────────────────

def discover_categories(db: Session) -> List[DiscoveredCategory]:
    """
    Scan all approved videos, aggregate tags, vet for meaningfulness,
    and upsert into the DiscoveredCategory table.

    Returns newly discovered (but not yet approved) categories.
    """
    # 1. Fetch all tags from approved videos
    videos = db.query(Video.tags).filter(
        Video.status == "approved",
        Video.tags.isnot(None),
        Video.tags != "",
    ).all()

    # 2. Aggregate tag frequencies
    tag_counter: Counter = Counter()
    for (tags_str,) in videos:
        for raw_tag in tags_str.split(","):
            tag = raw_tag.strip().lower()
            if tag:
                tag_counter[tag] += 1

    # 3. Vet and upsert
    new_categories = []
    for tag, count in tag_counter.items():
        if count < MIN_FREQUENCY:
            continue

        if not _is_meaningful(tag):
            continue

        # Check if a known alias → merge into canonical
        canonical = get_canonical_category(tag)
        effective_name = canonical if canonical else tag

        existing = db.query(DiscoveredCategory).filter(
            DiscoveredCategory.name == effective_name
        ).first()

        if existing:
            existing.count = count
            # If this tag is an alias, make sure the canonical entry
            # has it in related_tags
            if canonical and tag != canonical:
                current_related = set(
                    t.strip() for t in (existing.related_tags or "").split(",") if t.strip()
                )
                current_related.add(tag)
                existing.related_tags = ",".join(sorted(current_related))
        else:
            # Build related tags from semantic map
            related = SEMANTIC_MAP.get(effective_name, [])
            # Auto-approve if it's in our semantic map (known good category)
            is_known = effective_name in SEMANTIC_MAP
            
            cat = DiscoveredCategory(
                name=effective_name,
                display_name=effective_name.replace("-", " ").title(),
                count=count,
                is_approved=is_known,  # Auto-approve known categories
                related_tags=",".join(related),
            )
            db.add(cat)
            new_categories.append(cat)

    db.commit()

    log.info(
        "[categories] Discovery complete: %d total tags, %d meaningful, %d new",
        len(tag_counter), sum(1 for t in tag_counter if _is_meaningful(t)), len(new_categories),
    )
    return new_categories


def get_approved_categories(db: Session) -> List[DiscoveredCategory]:
    """Return all approved categories ordered by popularity."""
    return (
        db.query(DiscoveredCategory)
        .filter(DiscoveredCategory.is_approved == True)
        .order_by(DiscoveredCategory.count.desc())
        .all()
    )


def get_videos_for_category(
    db: Session,
    category_name: str,
    video_type: str = "flash",
    limit: int = 30,
) -> List[Video]:
    """
    Fetch videos matching a category using semantic tag expansion.
    This returns videos that have the exact tag OR any related tags,
    providing a rich and varied feed.
    """
    # Look up the category for its stored related_tags
    category = db.query(DiscoveredCategory).filter(
        DiscoveredCategory.name == category_name,
        DiscoveredCategory.is_approved == True,
    ).first()

    # Build the full set of tags to search for
    search_tags = get_expanded_tags(category_name)

    # Add any DB-stored related tags
    if category and category.related_tags:
        db_related = [t.strip() for t in category.related_tags.split(",") if t.strip()]
        search_tags.extend(db_related)
    search_tags = list(set(search_tags))

    # Build OR conditions for each tag using LIKE
    tag_conditions = [Video.tags.ilike(f"%{tag}%") for tag in search_tags]

    videos = (
        db.query(Video)
        .options(joinedload(Video.owner))
        .filter(
            Video.video_type == video_type,
            Video.status == "approved",
            or_(*tag_conditions),
        )
        .order_by(Video.discovery_score.desc())
        .limit(limit)
        .all()
    )

    return videos
