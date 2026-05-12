import uuid
from sqlalchemy import Column, ForeignKey, DateTime, Integer, Boolean, String, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class WatchHistory(Base):
    __tablename__ = "watch_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    watched_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    progress_seconds = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)

    user = relationship("User")
    video = relationship("Video")

    __table_args__ = (
        Index("ix_history_user_id", "user_id"),
    )

class LibraryWatchLater(Base):
    __tablename__ = "library_watch_later" # Renamed to avoid clash with existing table
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    saved_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    video = relationship("Video")

    __table_args__ = (
        Index("ix_watchlater_user_id", "user_id"),
    )

class LikedVideo(Base):
    __tablename__ = "liked_videos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    liked_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    video = relationship("Video")

    __table_args__ = (
        Index("ix_liked_user_id", "user_id"),
    )
