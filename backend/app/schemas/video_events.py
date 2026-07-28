from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
import enum


class VideoEventType(str, enum.Enum):
    VIEW = "view"
    WATCH_25 = "watch_25"
    WATCH_50 = "watch_50"
    WATCH_75 = "watch_75"
    COMPLETE = "complete"
    LIKE = "like"
    SHARE = "share"
    SKIP = "skip"


class VideoEventIn(BaseModel):
    user_id: int
    video_id: int
    event_type: VideoEventType
    watch_seconds: Optional[int] = None
    session_id: Optional[str] = None

    @field_validator("event_type", mode="before")
    @classmethod
    def coerce_event_type(cls, v):
        if isinstance(v, VideoEventType):
            return v
        try:
            return VideoEventType(v)
        except ValueError:
            raise ValueError(f"Invalid event_type: {v}. Must be one of: {[e.value for e in VideoEventType]}")


class VideoEventBatch(BaseModel):
    events: List[VideoEventIn]
