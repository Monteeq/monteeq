from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

# ── Base Video Schema for Library ───────────────────────────────────────────
class LibraryVideo(BaseModel):
    id: int # Using existing int ID for compatibility
    title: str
    thumbnail_url: str
    duration: int # Mapping duration_seconds to duration
    views: int
    owner_id: int
    created_at: datetime
    tags: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# ── History ──────────────────────────────────────────────────────────────────
class HistoryItem(BaseModel):
    id: UUID
    video: LibraryVideo
    watched_at: datetime
    progress_seconds: int
    duration_seconds: int
    is_completed: bool
    
    model_config = ConfigDict(from_attributes=True)

class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    page: int
    limit: int
    total: int
    has_more: bool

class HistoryProgressUpdate(BaseModel):
    progress_seconds: int
    duration_seconds: int
    is_completed: bool

class HistoryTrackRequest(BaseModel):
    video_id: int
    progress_seconds: int
    duration_seconds: int
    is_completed: bool

# ── Watch Later ─────────────────────────────────────────────────────────────
class WatchLaterItem(BaseModel):
    id: UUID
    video: LibraryVideo
    saved_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class WatchLaterStats(BaseModel):
    total_videos: int
    total_runtime_seconds: int
    new_this_week: int

class WatchLaterResponse(BaseModel):
    items: List[WatchLaterItem]
    stats: WatchLaterStats

# ── Liked Videos ─────────────────────────────────────────────────────────────
class LikedItem(BaseModel):
    id: UUID
    video: LibraryVideo
    liked_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class LikedResponse(BaseModel):
    items: List[LikedItem]
    page: int
    limit: int
    total: int
    has_more: bool

# ── Shared ───────────────────────────────────────────────────────────────────
class LibraryStats(BaseModel):
    history_count: int
    watch_later_count: int
    liked_count: int
