from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Union
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    profile_pic: Optional[str] = None
    interests: Optional[str] = None
    referral_source: Optional[str] = None
    goals: Optional[str] = None
    country: Optional[str] = None
    
    @field_validator('profile_pic', mode='before')
    @classmethod
    def resolve_user_cdn_url(cls, v):
        if not v or not isinstance(v, str):
            return v
        if "amazonaws.com" in v or "monteeq.s3" in v or "cdn.monteeq.com" in v:
            try:
                from app.core.storage import storage
                if ".com/" in v:
                    parts = v.split(".com/")
                    if len(parts) > 1:
                        return storage.get_url(parts[1])
            except Exception:
                return v
        return v

    model_config = ConfigDict(from_attributes=True)

class UserPublic(UserBase):
    id: int

class UserCreate(UserBase):
    password: Optional[str] = None

    @field_validator('password')
    @classmethod
    def password_complexity(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~" for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic: Optional[str] = None
    bio: Optional[str] = None
    is_onboarded: Optional[bool] = None
    interests: Optional[str] = None
    referral_source: Optional[str] = None
    goals: Optional[str] = None
    show_wins: Optional[bool] = None
    show_trophies: Optional[bool] = None
    notif_new_follower: Optional[bool] = None
    notif_challenge_win: Optional[bool] = None
    notif_comments: Optional[bool] = None
    notif_likes: Optional[bool] = None
    email_weekly: Optional[bool] = None
    email_challenges: Optional[bool] = None
    email_payouts: Optional[bool] = None
    email_marketing: Optional[bool] = None
    payout_method: Optional[str] = None
    two_factor_enabled: Optional[bool] = None

class User(UserBase):
    id: int
    is_premium: bool
    is_verified: bool
    is_onboarded: bool
    flash_uploads: int
    home_uploads: int
    flash_quota_limit: int
    home_quota_limit: int
    google_id: Optional[str] = None
    bio: Optional[str] = None
    role: str
    public_key: Optional[str] = None
    show_wins: Optional[bool] = True
    show_trophies: Optional[bool] = True
    notif_new_follower: Optional[bool] = True
    notif_challenge_win: Optional[bool] = True
    notif_comments: Optional[bool] = True
    notif_likes: Optional[bool] = False
    email_weekly: Optional[bool] = True
    email_challenges: Optional[bool] = True
    email_payouts: Optional[bool] = True
    email_marketing: Optional[bool] = False
    payout_method: Optional[str] = "stripe"
    two_factor_enabled: Optional[bool] = False

class EmailVerification(BaseModel):
    email: str
    code: str

class ResendVerification(BaseModel):
    email: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class VerificationResponse(BaseModel):
    message: str
    username: Optional[str] = None
    email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class SessionOut(BaseModel):
    id: int
    device_info: str
    ip_address: str
    last_active: datetime
    is_current: bool = False
    
    model_config = ConfigDict(from_attributes=True)

class UserProfile(User):
    followers_count: int
    following_count: int
    total_views: int
    total_likes: int = 0
    featured_video: Optional["Video"] = None
    most_popular_video: Optional["Video"] = None
    videos_count: int
    flash_videos_count: int
    posts_count: int
    videos: List["Video"]
    flash_videos: List["Video"]
    posts: List["Post"]
    liked_videos: List["Video"] = []
    trophies: List["ChallengeEntry"] = []
    is_following: bool = False

class UserUpdateResponse(BaseModel):
    user: User
    access_token: Optional[str] = None

class UserGoogleAuth(BaseModel):
    credential: str

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    two_factor_required: bool = False
    username: Optional[str] = None
    methods: Optional[List[str]] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    code: Optional[str] = None

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    video_type: str
    tags: Optional[str] = None

class VideoCreate(VideoBase):
    video_url: str
    url_480p: Optional[str] = None
    url_720p: Optional[str] = None
    url_1080p: Optional[str] = None
    url_2k: Optional[str] = None
    url_4k: Optional[str] = None
    thumbnail_url: str
    duration: Optional[int] = 0
    processing_key: Optional[str] = None
    processing_message: Optional[str] = None
    description: Optional[str] = None

class Video(VideoBase):
    id: int
    video_url: str
    url_480p: Optional[str] = None
    url_720p: Optional[str] = None
    url_1080p: Optional[str] = None
    url_2k: Optional[str] = None
    url_4k: Optional[str] = None
    thumbnail_url: str
    status: str
    owner_id: int
    owner: Optional[UserPublic] = None
    views: int
    earnings: float
    shares: int = 0
    likes_count: int = 0
    comments_count: int = 0
    liked_by_user: bool = False
    owner_followed: bool = False
    duration: int = 0
    processing_key: Optional[str] = None
    processing_message: Optional[str] = None
    failed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_validator('likes_count', 'comments_count', 'shares', mode='before')
    @classmethod
    def ensure_int(cls, v):
        return v if v is not None else 0

    @field_validator('video_url', 'thumbnail_url', 'url_480p', 'url_720p', 'url_1080p', 'url_2k', 'url_4k', mode='before')
    @classmethod
    def resolve_cdn_url(cls, v):
        if not v or not isinstance(v, str):
            return v
        if "amazonaws.com" in v or "monteeq.s3" in v or "cdn.monteeq.com" in v:
            try:
                from app.core.storage import storage
                if ".com/" in v:
                    parts = v.split(".com/")
                    if len(parts) > 1:
                        return storage.get_url(parts[1])
            except Exception:
                return v
        return v

    model_config = ConfigDict(from_attributes=True)

class PostBase(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[str] = None

class PostCreate(PostBase):
    original_post_id: Optional[int] = None

class Post(PostBase):
    id: int
    owner_id: int
    owner: Optional[UserPublic] = None
    created_at: Optional[datetime] = None
    likes_count: int = 0
    comments_count: int = 0
    liked_by_user: bool = False
    original_post_id: Optional[int] = None
    original_post: Optional["Post"] = None
    views_count: int = 0
    reposted_by: Optional[UserPublic] = None

    @field_validator('likes_count', 'comments_count', 'views_count', mode='before')
    @classmethod
    def ensure_int_post(cls, v):
        return v if v is not None else 0

    @field_validator('image_url', mode='before')
    @classmethod
    def resolve_post_cdn_url(cls, v):
        if not v or not isinstance(v, str):
            return v
        if "amazonaws.com" in v or "monteeq.s3" in v or "cdn.monteeq.com" in v:
            try:
                from app.core.storage import storage
                if ".com/" in v:
                    parts = v.split(".com/")
                    if len(parts) > 1:
                        return storage.get_url(parts[1])
            except Exception:
                return v
        return v

    model_config = ConfigDict(from_attributes=True)

class AdBase(BaseModel):
    title: str
    image_url: str
    is_active: bool

class Ad(AdBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    parent_id: Optional[int] = None

class Comment(CommentBase):
    id: int
    video_id: Optional[int] = None
    post_id: Optional[int] = None
    parent_id: Optional[int] = None
    owner_id: int
    owner: Optional[UserPublic] = None
    created_at: Optional[datetime] = None
    replies: List["Comment"] = []

    model_config = ConfigDict(from_attributes=True)

class Achievement(BaseModel):
    id: int
    milestone_name: str
    reached_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class UnifiedSearchResponse(BaseModel):
    videos: List[Video]
    users: List[User]
    posts: List[Post]

class UserInsights(BaseModel):
    total_views: int = 0
    total_likes: int = 0
    total_earnings: float = 0.0
    total_shares: int = 0
    home_videos: int = 0
    flash_videos: int = 0
    posts_count: int = 0
    followers: int = 0
    following: int = 0
    next_milestone: int = 0
    new_milestone_reached: Optional[str] = None
    achievements: List[str] = []
    top_countries: List[dict] = [] # [{"country": "USA", "count": 100}, ...]

    @field_validator('total_views', 'total_likes', 'total_shares', 'home_videos', 'flash_videos', 'posts_count', 'followers', 'following', 'next_milestone', mode='before')
    @classmethod
    def ensure_int_insights(cls, v):
        return v if v is not None else 0

    @field_validator('total_earnings', mode='before')
    @classmethod
    def ensure_float_insights(cls, v):
        return v if v is not None else 0.0

    model_config = ConfigDict(from_attributes=True)

class PerformanceDataPoint(BaseModel):
    date: str
    views: int
    likes: int
    followers: int
    earnings: float
    uploads: int

class UserPerformance(BaseModel):
    data: List[PerformanceDataPoint]
    metric: str # views, likes, followers, earnings

class ChatMessageBase(BaseModel):
    encrypted_content: str
    iv: str
    recipient_key: str
    sender_key: str
    message_type: Optional[str] = "text"
    attachment_url: Optional[str] = None
    file_metadata: Optional[str] = None

class ChatMessageCreate(ChatMessageBase):
    recipient_username: str

class ChatMessage(ChatMessageBase):
    id: int
    conversation_id: int
    sender_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Conversation(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    user1: UserPublic
    user2: UserPublic
    created_at: datetime
    messages: List[ChatMessage] = []

    model_config = ConfigDict(from_attributes=True)

class KeyUpload(BaseModel):
    public_key: str

class ChallengeBase(BaseModel):
    title: str
    description: str
    brand: Optional[str] = None
    prize: str
    is_open: bool = True
    is_paid: bool = False
    is_gold: bool = False
    entry_fee: float = 0.0
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ChallengeCreate(ChallengeBase):
    pass

class ChallengeEntryCreate(BaseModel):
    video_id: int

class ChallengeEntry(BaseModel):
    id: int
    challenge_id: int
    user_id: int
    video_id: int
    is_winner: bool = False
    created_at: datetime
    user: Optional[UserPublic] = None
    video: Optional[Video] = None
    challenge: Optional["Challenge"] = None

    model_config = ConfigDict(from_attributes=True)

class Challenge(ChallengeBase):
    id: int
    entry_count: int
    winner_picked: bool = False
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ChallengeLeaderboardEntry(BaseModel):
    username: str
    profile_pic: Optional[str] = None
    video_count: int = 0 # In case we want to show multiple entries, but requirement says "one video"
    # For now, let's just return the ChallengeEntry details in the leaderboard
    entry: ChallengeEntry
    score: int # e.g., views or likes

class TransactionBase(BaseModel):
    amount: float
    transaction_type: str
    reference_id: Optional[str] = None
    description: Optional[str] = None

class Transaction(TransactionBase):
    id: int
    wallet_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WalletBase(BaseModel):
    balance: float
    currency: str = "NGN"

class Wallet(WalletBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    transactions: List[Transaction] = []
    model_config = ConfigDict(from_attributes=True)
    


class PayoutRequestCreate(BaseModel):
    amount: float
    bank_details: Optional[str] = None  # JSON: { bank, account_number, account_name }

class PayoutRequestSchema(BaseModel):
    id: int
    user_id: int
    wallet_id: int
    amount: float
    status: str
    bank_details: Optional[str] = None
    admin_note: Optional[str] = None
    requested_at: datetime
    processed_at: Optional[datetime] = None
    user: Optional[UserPublic] = None
    model_config = ConfigDict(from_attributes=True)

class PaymentVerify(BaseModel):
    reference: str

class PaymentInitialize(BaseModel):
    is_yearly: bool = False

class PaymentInitializeResponse(BaseModel):
    status: str
    reference: str

class ProPricingResponse(BaseModel):
    monthly_price: float
    yearly_price: float

class ProUpgradeResponse(BaseModel):
    status: str
    message: str
    is_premium: bool

class ContentAnalyticsItem(BaseModel):
    id: int
    title: str
    video_type: str
    views: int
    likes_count: int
    shares: int
    engagement_rate: float  # (likes + shares) / views * 100

    model_config = ConfigDict(from_attributes=True)

class AudienceSplit(BaseModel):
    returning_viewers: int
    new_viewers: int
    total_views: int

class ScoreBreakdown(BaseModel):
    consistency: int   # 0-100: how regularly they post
    engagement: int    # 0-100: (likes+shares) / views
    retention: int     # 0-100: returning viewers %
    frequency: int     # 0-100: total approved video count

class GrowthIntelligence(BaseModel):
    score: int  # 0-100 composite
    breakdown: ScoreBreakdown
    insights: List[str]  # plain text, HTML-safe

class AttachmentResponse(BaseModel):
    url: str
    filename: Optional[str] = None

class PasswordReset(BaseModel):
    email: str
    code: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def password_complexity_reset(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~" for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class GoogleLinkRequest(BaseModel):
    id_token: str

class PartnerLeadBase(BaseModel):
    brand_name: str
    contact_email: str
    campaign_type: str
    details: str

class PartnerLeadCreate(PartnerLeadBase):
    pass

class PartnerLead(PartnerLeadBase):
    id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiscoveredCategoryOut(BaseModel):
    id: int
    name: str
    display_name: str
    count: int
    is_approved: bool
    related_tags: Optional[str] = ""
    icon_hint: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
class Follow(BaseModel):
    id: int
    follower_id: int
    following_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FollowingFeedItem(BaseModel):
    type: str # 'video', 'flash', 'post'
    data: Union[Video, Post]
    created_at: datetime
