from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Text, DateTime, func, Numeric, Index
import uuid

from sqlalchemy.orm import relationship, backref
from app.db.base import Base
import enum
from app.core.config import BASE_URL, FLASH_QUOTA_LIMIT, HOME_QUOTA_LIMIT

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class VideoType(str, enum.Enum):
    HOME = "home"
    FLASH = "flash"

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FAILED = "failed"

from app.models.library import WatchHistory, LibraryWatchLater, LikedVideo

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True)
    role = Column(String, default=UserRole.USER)
    is_premium = Column(Boolean, default=False)
    premium_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, default=False)
    is_onboarded = Column(Boolean, default=False)
    profile_pic = Column(String, nullable=True) # Will use dynamic UI-Avatars if null
    country = Column(String, nullable=True, index=True) # Automated tracking (ISO code or Name)
    
    # Personalization data
    interests = Column(Text, nullable=True) # Comma-separated tags or JSON
    referral_source = Column(String, nullable=True)
    goals = Column(Text, nullable=True)
    
    # Quotas for free users
    flash_uploads = Column(Integer, default=0)
    home_uploads = Column(Integer, default=0)
    bio = Column(String, nullable=True)
    show_wins = Column(Boolean, default=True)     # Show challenge wins on public profile
    show_trophies = Column(Boolean, default=True) # Show Trophy Room tab on public profile
    public_key = Column(Text, nullable=True) # PEM encoded public key for E2EE
    
    # Notification Preferences
    notif_new_follower = Column(Boolean, default=True)
    notif_challenge_win = Column(Boolean, default=True)
    notif_comments = Column(Boolean, default=True)
    notif_likes = Column(Boolean, default=False)
    
    email_weekly = Column(Boolean, default=True)
    email_challenges = Column(Boolean, default=True)
    email_payouts = Column(Boolean, default=True)
    email_marketing = Column(Boolean, default=False)
    
    # Showcase content
    pinned_video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    
    # Account & Security
    payout_method = Column(String, default='stripe')
    two_factor_enabled = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True) # For app-based 2FA
    recovery_codes = Column(Text, nullable=True) # JSON list of hashed codes
    is_active = Column(Boolean, default=True) # For deactivation
    created_at = Column(DateTime, default=func.now(), index=True)

    # Stripe Subscriptions
    stripe_customer_id = Column(String, nullable=True, index=True)
    subscription_tier = Column(String, default="free")
    subscription_status = Column(String, default="inactive")
    subscription_id = Column(String, nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)

    @property
    def flash_quota_limit(self):
        return FLASH_QUOTA_LIMIT

    @property
    def home_quota_limit(self):
        return HOME_QUOTA_LIMIT

    videos = relationship("Video", back_populates="owner", foreign_keys="[Video.owner_id]")
    pinned_video = relationship("Video", foreign_keys=[pinned_video_id])
    posts = relationship("Post", back_populates="owner")
    reposts = relationship("Repost", back_populates="user")
    comments = relationship("Comment", back_populates="owner")
    # History, Likes, Watch Later
    likes = relationship("Like", back_populates="user")
    views = relationship("View", back_populates="user")
    watch_later = relationship("WatchLater", back_populates="user")

    # Followers
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following",
        cascade="all, delete-orphan",
    )
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    code = Column(String)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token_hash = Column(String, index=True) # Identifying the session by token hash
    device_info = Column(String, nullable=True) # Browser/OS
    ip_address = Column(String, nullable=True)
    last_active = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())

    user = relationship("User")

def generate_public_id():
    return f"vid_{uuid.uuid4().hex[:16]}"

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, index=True, nullable=True, default=generate_public_id)
    title = Column(String)
    description = Column(Text, nullable=True)
    video_url = Column(String) # This will now be the fallback (likely 720p or original)
    url_480p = Column(String, nullable=True)
    url_720p = Column(String, nullable=True)
    url_1080p = Column(String, nullable=True)
    url_2k = Column(String, nullable=True)
    url_4k = Column(String, nullable=True)
    thumbnail_url = Column(String)
    video_type = Column(String, index=True) # home or flash
    status = Column(String, default=ApprovalStatus.PENDING, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    views = Column(Integer, default=0)
    earnings = Column(Float, default=0.0)
    shares = Column(Integer, default=0)
    duration = Column(Integer, default=0)
    processing_key = Column(String, nullable=True)
    tags = Column(Text, nullable=True) # Comma-separated tags
    discovery_score = Column(Float, default=0.0, index=True)
    last_owner_interaction_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    processing_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    is_exclusive = Column(Boolean, default=False)

    owner = relationship("User", back_populates="videos", foreign_keys=[owner_id])
    comments = relationship("Comment", back_populates="video", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="video", cascade="all, delete-orphan")
    challenge_entries = relationship("ChallengeEntry", back_populates="video", cascade="all, delete-orphan")

    @property
    def owner_username(self):
        return self.owner.username if self.owner else "Unknown"

    def _resolve_url(self, url: str) -> str:
        """Helper to convert stored S3 URLs to current CDN/CloudFront URLs."""
        if not url:
            return url
        # If it's already a full URL that doesn't match our current domain, we extract the path
        if "amazonaws.com" in url or "monteeq.s3" in url or "cdn.monteeq.com" in url:
            from app.core.storage import storage
            # Extract the key part (everything after the domain)
            # Both S3 and CDN URLs follow the pattern [domain]/[key]
            if ".com/" in url:
                parts = url.split(".com/")
                if len(parts) > 1:
                    return storage.get_url(parts[1])
        return url

    @property
    def dynamic_video_url(self):
        return self._resolve_url(self.video_url)

    @property
    def dynamic_thumbnail_url(self):
        return self._resolve_url(self.thumbnail_url)

    @property
    def dynamic_url_720p(self):
        return self._resolve_url(self.url_720p)

    @property
    def dynamic_url_1080p(self):
        return self._resolve_url(self.url_1080p)

class View(Base):
    __tablename__ = "views"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="views")
    video = relationship("Video")
    post = relationship("Post")


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="likes")
    video = relationship("Video", back_populates="likes")
    post = relationship("Post", back_populates="likes")

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    image_url = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    original_post_id = Column(Integer, ForeignKey("posts.id"), nullable=True, index=True)
    views_count = Column(Integer, default=0)
    tags = Column(Text, nullable=True) # Comma-separated tags

    owner = relationship("User", back_populates="posts")
    original_post = relationship("Post", remote_side=[id])
    is_active = Column(Boolean, default=True)
    discovery_score = Column(Float, default=0.0, index=True)
    last_owner_interaction_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    is_exclusive = Column(Boolean, default=False)
    
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True, index=True)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True, index=True) # Threaded replies
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=func.now())

    owner = relationship("User", back_populates="comments")
    video = relationship("Video", back_populates="comments")
    post = relationship("Post", back_populates="comments")
    replies = relationship("Comment", backref=backref("parent", remote_side=[id]), cascade="all, delete-orphan")

class Follow(Base):
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), index=True)
    following_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=func.now(), index=True)

    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")

class WatchLater(Base):
    __tablename__ = "watch_later"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), index=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="watch_later")
    video = relationship("Video")


class Repost(Base):
    __tablename__ = "reposts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    video_id = Column(Integer, ForeignKey("videos.id"))
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="reposts")
    video = relationship("Video")

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    milestone_name = Column(String) # e.g., "100_VIEWS", "1000_VIEWS"
    reached_at = Column(DateTime, default=func.now())
    
    user = relationship("User")

class SponsoredAd(Base):
    __tablename__ = "sponsored_ads"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    image_url = Column(String)
    is_active = Column(Boolean, default=True)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    link = Column(String, nullable=True)
    type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String, unique=True, index=True)
    p256dh = Column(String)
    auth = Column(String)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"))
    user2_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    encrypted_content = Column(Text) # AES-GCM encrypted blob
    iv = Column(String) # Initialization Vector
    recipient_key = Column(Text) # AES key wrapped with recipient's public key
    sender_key = Column(Text) # AES key wrapped with sender's public key
    message_type = Column(String, default="text") # text, voice, file
    attachment_url = Column(String, nullable=True)
    file_metadata = Column(Text, nullable=True) # JSON blob for filename, size, etc.
    created_at = Column(DateTime, default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")

class UserDevicePrekeyBundle(Base):
    __tablename__ = "user_device_prekey_bundles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    device_id = Column(String, primary_key=True, index=True)
    identity_key = Column(Text, nullable=False)
    signed_prekey = Column(Text, nullable=False)
    signed_prekey_signature = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", backref=backref("prekey_bundles", cascade="all, delete-orphan"))

class UserOneTimePrekey(Base):
    __tablename__ = "user_one_time_prekeys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device_id = Column(String, index=True)
    key_value = Column(Text, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", backref=backref("one_time_prekeys", cascade="all, delete-orphan"))

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    brand = Column(String, nullable=True)
    prize = Column(String)
    is_open = Column(Boolean, default=True)
    is_paid = Column(Boolean, default=False)
    is_gold = Column(Boolean, default=False)
    entry_fee = Column(Numeric(12, 2), default=0.00)
    start_date = Column(DateTime, default=func.now())
    end_date = Column(DateTime, nullable=True)
    entry_count = Column(Integer, default=0)
    winner_picked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    entries = relationship("ChallengeEntry", back_populates="challenge", cascade="all, delete-orphan")

class ChallengeEntry(Base):
    __tablename__ = "challenge_entries"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    video_id = Column(Integer, ForeignKey("videos.id")) # Requirement: Users enter with their video
    is_winner = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    challenge = relationship("Challenge", back_populates="entries")
    user = relationship("User")
    video = relationship("Video", back_populates="challenge_entries")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    balance = Column(Numeric(12, 2), default=0.00) # Precise NGN to 2 decimal places
    currency = Column(String, default="NGN")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", backref=backref("wallet", uselist=False))
    transactions = relationship("Transaction", back_populates="wallet", cascade="all, delete-orphan", order_by="desc(Transaction.created_at)")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), index=True)
    amount = Column(Numeric(12, 2)) 
    transaction_type = Column(String, index=True) # 'view_milestone', 'tip', 'subscription', 'payout'
    status = Column(String, default="success", index=True) # 'pending', 'success', 'failed'
    reference_id = Column(String, nullable=True, index=True) # Stores 'video_34', 'user_1', etc.
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)

    wallet = relationship("Wallet", back_populates="transactions")





class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), index=True)
    amount = Column(Numeric(12, 2))
    status = Column(String, default="pending", index=True) # 'pending', 'processing', 'completed', 'rejected'
    bank_details = Column(Text, nullable=True) # JSON string: { bank, account_number, account_name }
    admin_note = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=func.now(), index=True)
    processed_at = Column(DateTime, nullable=True)

    user = relationship("User")
    wallet = relationship("Wallet")


# ─── Recommendation Engine Models ─────────────────────────────────────────────

class VideoInteraction(Base):
    """
    Stores one record per user-video interaction event.
    Used by the recommendation engine to compute personalized scores.
    """
    __tablename__ = "video_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)

    # Raw watch data
    watch_time = Column(Float, default=0.0)      # seconds actually watched
    duration = Column(Float, default=0.0)         # total video length in seconds
    liked = Column(Boolean, default=False)
    skipped = Column(Boolean, default=False)
    replayed = Column(Boolean, default=False)     # true if user rewound / re-watched

    # Computed at write-time for fast reads
    completion_rate = Column(Float, default=0.0)  # watch_time / duration
    skipped_fast = Column(Boolean, default=False) # watch_time < 2 s
    interaction_score = Column(Float, default=0.0)  # final weighted score

    timestamp = Column(DateTime, default=func.now(), index=True)

    user = relationship("User")
    video = relationship("Video")


class UserRecommendationProfile(Base):
    """
    One row per user — stores a JSON-encoded tag→affinity mapping
    so the feed can be assembled quickly without re-scanning all interactions.
    Updated in background after each interaction.
    """
    __tablename__ = "user_recommendation_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)

    # JSON: {"footballedit": 0.85, "anime": 0.6, ...}
    tag_affinity = Column(Text, default="{}")
    
    # JSON: [video_id, ...] — LEGACY: used for strict exclusion
    seen_video_ids = Column(Text, default="[]")
    
    # JSON: {"video_id": {"c": count, "t": timestamp, "wt": total_watch_time, "mc": max_completion}}
    watch_history = Column(Text, default="{}")
    
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User")

class PartnerLead(Base):
    __tablename__ = "partner_leads"

    id = Column(Integer, primary_key=True, index=True)
    brand_name = Column(String, index=True)
    contact_email = Column(String, index=True)
    campaign_type = Column(String)
    details = Column(Text)
    status = Column(String, default="new") # "new", "contacted", "closed"
    created_at = Column(DateTime, default=func.now(), index=True)


class DiscoveredCategory(Base):
    """
    Auto-discovered categories from video hashtags.
    Only tags that pass the "meaningful" vetting filter and are approved
    will be surfaced to users.
    """
    __tablename__ = "discovered_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)          # Lowercase canonical tag (e.g. "football")
    display_name = Column(String)                            # Human-readable (e.g. "Football")
    count = Column(Integer, default=0)                       # Number of approved videos using this tag
    is_approved = Column(Boolean, default=False, index=True) # Only approved categories are shown
    related_tags = Column(Text, default="")                  # Comma-separated similar tags for semantic matching
    icon_hint = Column(String, nullable=True)                # Optional icon name hint (e.g. "trophy", "gamepad")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class EmailLog(Base):
    """
    One row per sent email. Used for:
      - Cooldown enforcement  (can_send checks last sent_at per template)
      - Deduplication         (prevent double-sends on retry)
      - Analytics             (open/click rates per template via ESP webhooks)
      - Anti-spam             (daily/weekly send caps per user)
    """
    __tablename__ = "email_log"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    template        = Column(String(100), nullable=False, index=True)
    subject         = Column(String(300), nullable=True)
    # ESP tracking — populated by webhook
    sent_at         = Column(DateTime, default=func.now(), nullable=False, index=True)
    opened_at       = Column(DateTime, nullable=True)
    clicked_at      = Column(DateTime, nullable=True)
    bounced         = Column(Boolean, default=False, index=True)
    unsubscribed    = Column(Boolean, default=False)
    esp_message_id  = Column(String(200), nullable=True, index=True)  # Resend/Zoho message ID

    user = relationship("User", backref=backref("email_logs", cascade="all, delete-orphan"))

    __table_args__ = (
        Index("ix_email_log_user_template_sent", "user_id", "template", "sent_at"),
    )
