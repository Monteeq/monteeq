from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import shutil
import os
import pyotp
import qrcode
import io
import base64
import secrets
import json
import hashlib
from fastapi import Body

from app.db.session import get_db, SessionLocal
from app.crud import user as crud_user
from app.schemas import schemas
from app.core.dependencies import get_current_user, get_current_user_optional
from app.core import config
from app.core.storage import storage
from app.models.models import User, Video, Like, Follow, UserSession
from app.core.redis import redis_client
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter()

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserUpdateResponse)
def update_user_me(
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    # Check if username is taken if changing
    if user_in.username and user_in.username != current_user.username:
        existing_user = crud_user.get_user_by_username(db, username=user_in.username)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username already registered"
            )
    
    updated_user = crud_user.update_user(db, user_id=current_user.id, user_update=user_in)
    
    # If username changed, generate new token
    access_token = None
    if user_in.username and user_in.username != current_user.username:
        from app.core.security import create_access_token
        from datetime import timedelta
        
        access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_in.username}, expires_delta=access_token_expires
        )
        
    return {"user": updated_user, "access_token": access_token}
    
@router.put("/me/password")
def update_user_password(
    passwords: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    success = crud_user.update_password(db, user_id=current_user.id, passwords=passwords)
    if success is None:
        raise HTTPException(status_code=404, detail="User not found")
    if success is False:
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    return {"message": "Password updated successfully"}

@router.get("/profile/{username}", response_model=schemas.UserProfile)
def get_profile(
    username: str, 
    db: Session = Depends(get_db),
    current_user: Optional[schemas.User] = Depends(get_current_user_optional)
):
    current_user_id = current_user.id if current_user else None
    profile = crud_user.get_user_profile(db, username=username, current_user_id=current_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

def handle_follow_background(follower_id: int, followed_id: int):
    """Background task for follow side effects."""
    db = SessionLocal()
    try:
        crud_user.handle_follow_side_effects(db, follower_id, followed_id)
    finally:
        db.close()

@router.post("/follow/{user_id}")
def follow_user(
    user_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    is_following = crud_user.toggle_follow(db, follower_id=current_user.id, followed_id=user_id)
    
    if is_following:
        # Background side effects (achievements, notifications)
        background_tasks.add_task(handle_follow_background, current_user.id, user_id)
        
    return {"is_following": is_following}

@router.get("/search", response_model=schemas.UnifiedSearchResponse)
def search_unified(
    q: str = "", 
    db: Session = Depends(get_db)
):
    if not q:
        return {"videos": [], "users": []}
    
    # Search for users
    users = db.query(User).filter(
        or_(
            User.username.ilike(f"%{q}%"),
            User.full_name.ilike(f"%{q}%")
        )
    ).limit(10).all()
    
    from app.crud import video as crud_video
    videos = crud_video.search_videos(db, query_str=q)
    posts = crud_video.search_posts(db, query_str=q)
    
    return {"videos": videos, "users": users, "posts": posts}

@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    from uuid import uuid4
    
    file_ext = file.filename.split(".")[-1]
    file_name = f"profiles/{uuid4()}.{file_ext}"
    
    avatar_url = None

    # Create a temporary local path to save the uploaded file before offloading to S3
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Storage Abstraction (Local or S3)
        s3_key = f"profiles/{uuid4()}.{file_ext}"
        avatar_url = storage.upload_file(tmp_path, s3_key)
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    if not avatar_url:
        raise HTTPException(status_code=500, detail="Failed to upload image")
    
    # Update user in DB
    current_user.profile_pic = avatar_url
    db.commit()
    db.refresh(current_user)
    
    return {"profile_pic": avatar_url}

@router.get("/me/insights", response_model=schemas.UserInsights)
def get_user_insights(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    user_id = current_user.id
    import json
    cache_key = f"user_insights_{user_id}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    from app.models.models import Achievement
    
    # Total Views
    total_views = db.query(func.sum(Video.views)).filter(Video.owner_id == user_id).scalar() or 0
    
    # Total Likes - Count likes on videos owned by user
    total_likes = db.query(func.count(Like.user_id)).join(Video).filter(Video.owner_id == user_id).scalar() or 0
    
    # Total Earnings (Disabled)
    total_earnings = 0.0
    
    # Total Shares
    total_shares = db.query(func.sum(Video.shares)).filter(Video.owner_id == user_id).scalar() or 0
    
    # Video counts
    home_count = db.query(func.count(Video.id)).filter(Video.owner_id == user_id, Video.video_type == "home").scalar() or 0
    flash_count = db.query(func.count(Video.id)).filter(Video.owner_id == user_id, Video.video_type == "flash").scalar() or 0
    
    # Post count
    from app.models.models import Post
    posts_count = db.query(func.count(Post.id)).filter(Post.owner_id == user_id, Post.is_active == True).scalar() or 0
    
    # Followers/Following
    followers_count = db.query(func.count(Follow.follower_id)).filter(Follow.followed_id == user_id).scalar() or 0
    following_count = db.query(func.count(Follow.followed_id)).filter(Follow.follower_id == user_id).scalar() or 0
    
    # Milestone Logic
    milestones = [100, 500, 1000, 5000, 10000, 50000, 100000]
    next_milestone = next((m for m in milestones if m > total_views), milestones[-1] * 2)
    
    # Check for newly reached milestones
    existing_achievements = db.query(Achievement).filter(Achievement.user_id == user_id).all()
    achieved_names = {a.milestone_name for a in existing_achievements}
    
    from app.crud import achievement as crud_achievement
    new_milestone_reached = None
    for m in milestones:
        m_name = f"{m}_VIEWS"
        if total_views >= m and m_name not in achieved_names:
            crud_achievement.create_achievement(db, user_id=user_id, milestone_name=m_name)
            new_milestone_reached = m_name
            achieved_names.add(m_name)
    
    # Reload achievements to include any newly created ones
    existing_achievements = db.query(Achievement).filter(Achievement.user_id == user_id).all()
    
    # Top Countries Breakdown
    from app.models.models import View
    top_countries_query = (
        db.query(User.country, func.count(View.id).label("count"))
        .join(View, View.user_id == User.id)
        .join(Video, Video.id == View.video_id)
        .filter(Video.owner_id == user_id, User.country != None)
        .group_by(User.country)
        .order_by(func.count(View.id).desc())
        .limit(3)
        .all()
    )
    top_countries = [{"country": c, "count": cnt} for c, cnt in top_countries_query]

    result = {
        "total_views": total_views,
        "total_likes": total_likes,
        "total_earnings": total_earnings,
        "total_shares": total_shares,
        "home_videos": home_count,
        "flash_videos": flash_count,
        "posts_count": posts_count,
        "followers": followers_count,
        "following": following_count,
        "next_milestone": next_milestone,
        "new_milestone_reached": new_milestone_reached,
        "achievements": [a.milestone_name for a in existing_achievements],
        "top_countries": top_countries
    }
    if redis_client:
        try:
            redis_client.setex(cache_key, 60, json.dumps(result))
        except Exception:
            pass
    return result

@router.get("/me/performance", response_model=schemas.UserPerformance)
def get_user_performance(
    metric: str = "views",
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    from datetime import datetime, timedelta
    from app.models.models import View, Like, Follow, Video
    
    user_id = current_user.id
    import json
    cache_key = f"user_perf_{user_id}_{metric}_{days}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days-1)
    
    # Initialize daily data
    daily_stats = {}
    for i in range(days):
        d = (start_date + timedelta(days=i)).isoformat()
        daily_stats[d] = {"views": 0, "likes": 0, "followers": 0}
    
    # Aggregate Views
    views_query = db.query(
        func.date(View.created_at).label("date"),
        func.count(View.id).label("count")
    ).join(Video).filter(
        Video.owner_id == user_id,
        View.created_at >= start_date
    ).group_by(func.date(View.created_at)).all()
    
    for v in views_query:
        d_str = v.date
        if d_str in daily_stats:
            daily_stats[d_str]["views"] = v.count

    # Aggregate Likes
    likes_query = db.query(
        func.date(Like.created_at).label("date"),
        func.count(Like.id).label("count")
    ).join(Video).filter(
        Video.owner_id == user_id,
        Like.created_at >= start_date
    ).group_by(func.date(Like.created_at)).all()
    
    for l in likes_query:
        d_str = l.date
        if d_str in daily_stats:
            daily_stats[d_str]["likes"] = l.count

    # Aggregate Followers
    follows_query = db.query(
        func.date(Follow.created_at).label("date"),
        func.count(Follow.follower_id).label("count")
    ).filter(
        Follow.followed_id == user_id,
        Follow.created_at >= start_date
    ).group_by(func.date(Follow.created_at)).all()
    
    for f in follows_query:
        d_str = f.date
        if d_str in daily_stats:
            daily_stats[d_str]["followers"] = f.count

    # Convert to list of PerformanceDataPoint
    performance_data = []
    for d_str in sorted(daily_stats.keys()):
        performance_data.append(schemas.PerformanceDataPoint(
            date=d_str,
            views=daily_stats[d_str]["views"],
            likes=daily_stats[d_str]["likes"],
            followers=daily_stats[d_str]["followers"]
        ))
    
    # Serialize Pydantic objects manually for cache
    serialized_data = [p.dict() if hasattr(p, "dict") else p for p in performance_data]
    result_for_cache = {"data": serialized_data, "metric": metric}
    if redis_client:
        try:
            redis_client.setex(cache_key, 60, json.dumps(result_for_cache))
        except Exception:
            pass
    return {"data": performance_data, "metric": metric}

@router.get("/me/content-analytics", response_model=list[schemas.ContentAnalyticsItem])
def get_content_analytics(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Returns top performing videos for the current creator, sorted by views desc."""
    videos = (
        db.query(Video)
        .filter(Video.owner_id == current_user.id, Video.status == "approved")
        .order_by(Video.views.desc())
        .limit(limit)
        .all()
    )
    result = []
    for v in videos:
        total_interactions = (v.likes_count or 0) + (v.shares or 0)
        engagement_rate = round((total_interactions / v.views * 100), 1) if v.views > 0 else 0.0
        result.append(schemas.ContentAnalyticsItem(
            id=v.id,
            title=v.title,
            video_type=v.video_type,
            views=v.views or 0,
            likes_count=v.likes_count or 0,
            shares=v.shares or 0,
            engagement_rate=engagement_rate,
        ))
    return result

@router.get("/me/audience-split", response_model=schemas.AudienceSplit)
def get_audience_split(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """
    Returning viewers: users who have watched the creator's videos more than once.
    New viewers: users who have watched exactly once in the period.
    """
    from datetime import datetime, timedelta
    from app.models.models import View
    from sqlalchemy import distinct

    cutoff = datetime.now() - timedelta(days=days)
    user_id = current_user.id

    # Count views per viewer on this creator's videos in the period
    viewer_counts = (
        db.query(View.user_id, func.count(View.id).label("view_count"))
        .join(Video, Video.id == View.video_id)
        .filter(Video.owner_id == user_id, View.created_at >= cutoff)
        .group_by(View.user_id)
        .all()
    )

    returning = sum(1 for vc in viewer_counts if vc.view_count > 1)
    new = sum(1 for vc in viewer_counts if vc.view_count == 1)
    total = sum(vc.view_count for vc in viewer_counts)

    return {"returning_viewers": returning, "new_viewers": new, "total_views": total}

@router.get("/me/growth-intelligence", response_model=schemas.GrowthIntelligence)
def get_growth_intelligence(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """
    Computes the Monteeq Growth Score (0–100) and generates real AI growth insights
    based on the creator's actual content, engagement, and audience data.
    """
    user_id = current_user.id
    import json
    cache_key = f"growth_intel_{user_id}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
        
    from datetime import datetime, timedelta
    from app.models.models import View, Like, Follow
    import math
    now = datetime.now()
    cutoff_30 = now - timedelta(days=30)
    cutoff_7  = now - timedelta(days=7)

    # ── Raw data ──────────────────────────────────────────────────────────────
    videos = db.query(Video).filter(
        Video.owner_id == user_id,
        Video.status == "approved"
    ).order_by(Video.created_at.desc()).all()

    total_videos = len(videos)
    total_views  = sum(v.views or 0 for v in videos)
    total_likes  = sum(v.likes_count or 0 for v in videos)
    total_shares = sum(v.shares or 0 for v in videos)

    flash_videos = [v for v in videos if v.video_type == "flash"]
    home_videos  = [v for v in videos if v.video_type == "home"]

    # Videos posted in last 30 days
    recent_uploads = [v for v in videos if v.created_at and v.created_at >= cutoff_30]

    # Followers gained last 7 / 30 days
    new_followers_7d = db.query(func.count(Follow.follower_id)).filter(
        Follow.followed_id == user_id,
        Follow.created_at >= cutoff_7
    ).scalar() or 0

    new_followers_30d = db.query(func.count(Follow.follower_id)).filter(
        Follow.followed_id == user_id,
        Follow.created_at >= cutoff_30
    ).scalar() or 0

    # Audience retention (returning vs new)
    viewer_counts = (
        db.query(View.user_id, func.count(View.id).label("vc"))
        .join(Video, Video.id == View.video_id)
        .filter(Video.owner_id == user_id, View.created_at >= cutoff_30)
        .group_by(View.user_id)
        .all()
    )
    returning_count = sum(1 for vc in viewer_counts if vc.vc > 1)
    new_count       = sum(1 for vc in viewer_counts if vc.vc == 1)
    total_unique    = returning_count + new_count

    from sqlalchemy import extract

    # Best day of week for views (0=Sun … 6=Sat for Postgres)
    day_view_rows = (
        db.query(
            extract('dow', View.created_at).label("dow"),
            func.count(View.id).label("cnt")
        )
        .join(Video, Video.id == View.video_id)
        .filter(Video.owner_id == user_id, View.created_at >= cutoff_30)
        .group_by(extract('dow', View.created_at))
        .all()
    )
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    best_day  = max(day_view_rows, key=lambda r: r.cnt, default=None)
    best_day_name = day_names[int(best_day.dow)] if best_day else None

    # Avg engagement: flash vs home
    def avg_views(lst): return sum(v.views or 0 for v in lst) / len(lst) if lst else 0
    def avg_engagement(lst):
        if not lst: return 0
        return sum((v.likes_count or 0) + (v.shares or 0) for v in lst) / len(lst)

    flash_avg_views  = avg_views(flash_videos)
    home_avg_views   = avg_views(home_videos)
    flash_avg_engage = avg_engagement(flash_videos)
    home_avg_engage  = avg_engagement(home_videos)

    # Days since last upload
    days_since_upload = None
    if videos and videos[0].created_at:
        days_since_upload = (now - videos[0].created_at).days

    # ── Score Breakdown (each dimension 0–100) ────────────────────────────────
    # 1. Consistency: uploads per week in last 30 days (4 weeks)
    uploads_per_week = len(recent_uploads) / 4
    consistency = min(100, int(uploads_per_week / 2 * 100))   # 2 uploads/wk = 100

    # 2. Engagement: (likes+shares) / views
    raw_eng = ((total_likes + total_shares) / total_views) if total_views > 0 else 0
    engagement = min(100, int(raw_eng * 1000))  # 10% ratio = 100 points

    # 3. Retention: returning / total unique
    retention = min(100, int((returning_count / total_unique * 100) if total_unique > 0 else 0))

    # 4. Frequency: total videos (20 = 100)
    frequency = min(100, int(total_videos / 20 * 100))

    # Composite (weighted average)
    score = int(0.25*consistency + 0.35*engagement + 0.25*retention + 0.15*frequency)
    score = max(0, min(100, score))

    # ── AI Insights (data-driven strings) ────────────────────────────────────
    insights = []

    # Insight 1: Flash vs Home performance
    if flash_videos and home_videos:
        if flash_avg_views > home_avg_views * 1.1:
            pct = int((flash_avg_views - home_avg_views) / home_avg_views * 100)
            insights.append(
                f"Your <span class='insight-highlight'>Flash videos</span> average "
                f"{pct}% more views than standard uploads — post more short clips!"
            )
        elif home_avg_views > flash_avg_views * 1.1:
            pct = int((home_avg_views - flash_avg_views) / flash_avg_views * 100)
            insights.append(
                f"Your <span class='insight-highlight'>long-form videos</span> outperform "
                f"Flash by {pct}% in views — your audience loves depth."
            )
    elif flash_videos and not home_videos:
        insights.append(
            "Try uploading a <span class='insight-highlight'>Home video</span> — "
            "mixing formats can grow your audience faster."
        )

    # Insight 2: Best day to post
    if best_day_name:
        insights.append(
            f"Your videos get the most views on "
            f"<span class='insight-highlight'>{best_day_name}s</span> — "
            f"schedule your next upload then for maximum reach."
        )

    # Insight 3: Follower growth
    if new_followers_7d > 0:
        insights.append(
            f"You gained <span class='insight-highlight'>{new_followers_7d} new "
            f"follower{'s' if new_followers_7d != 1 else ''}</span> this week. "
            f"Keep posting to maintain momentum."
        )
    elif new_followers_30d == 0 and total_videos == 0:
        insights.append(
            "Upload your <span class='insight-highlight'>first video</span> to start "
            "attracting followers and growing your audience."
        )

    # Insight 4: Upload consistency
    if days_since_upload is not None and days_since_upload > 7:
        insights.append(
            f"You haven't posted in <span class='insight-highlight'>{days_since_upload} days</span>. "
            f"Creators who post weekly grow followers 3× faster."
        )
    elif days_since_upload is not None and days_since_upload <= 3:
        insights.append(
            "Great upload cadence! <span class='insight-highlight'>Consistent posting</span> "
            "is the #1 driver of channel growth on Monteeq."
        )

    # Insight 5: Engagement rate
    eng_pct = round(raw_eng * 100, 1)
    if eng_pct > 5:
        insights.append(
            f"Your engagement rate is <span class='insight-highlight'>{eng_pct}%</span> — "
            f"well above average. High engagement signals quality content."
        )
    elif total_views > 0 and eng_pct < 2:
        insights.append(
            f"Your engagement rate is <span class='insight-highlight'>{eng_pct}%</span>. "
            f"Try adding a call-to-action in your videos to boost likes and shares."
        )

    # Ensure at least one insight
    if not insights:
        insights.append(
            "Upload more content and engage with your audience to unlock "
            "<span class='insight-highlight'>personalised growth insights</span>."
        )

    result = {
        "score": score,
        "breakdown": {
            "consistency": consistency,
            "engagement": engagement,
            "retention": retention,
            "frequency": frequency,
        },
        "insights": insights[:4],  # cap at 4
    }
    if redis_client:
        try:
            redis_client.setex(cache_key, 60, json.dumps(result))
        except Exception:
            pass
    return result

@router.put("/me/onboarding", response_model=schemas.User)
def update_onboarding(
    onboarding_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure it only updates relevant fields and sets is_onboarded
    onboarding_data.is_onboarded = True
    updated_user = crud_user.update_user(db, user_id=current_user.id, user_update=onboarding_data)
    return updated_user

@router.post("/me/2fa/setup")
def setup_totp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a new TOTP secret and return the provisioning URI (QR code)."""
    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.commit()
    
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="Monteeq"
    )
    
    img = qrcode.make(uri)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return {"qr_code": f"data:image/png;base64,{img_str}", "uri": uri, "secret": secret}

@router.post("/me/2fa/verify")
def verify_and_enable_totp(
    code: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify the first TOTP code and enable 2FA for the account."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initialized")
    
    totp = pyotp.TOTP(current_user.totp_secret)
    if totp.verify(code):
        current_user.two_factor_enabled = True
        db.commit()
        return {"message": "2FA enabled successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid verification code")

@router.post("/me/2fa/disable")
def disable_totp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disable TOTP 2FA."""
    current_user.two_factor_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"message": "2FA disabled successfully"}

@router.get("/me/sessions", response_model=List[schemas.SessionOut])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List active sessions for the current user."""
    sessions = db.query(UserSession).filter(UserSession.user_id == current_user.id).order_by(UserSession.last_active.desc()).all()
    
    return [
        schemas.SessionOut(
            id=s.id,
            device_info=s.device_info or "Unknown Device",
            ip_address=s.ip_address or "Unknown IP",
            last_active=s.last_active,
            is_current=False
        ) for s in sessions
    ]

@router.delete("/me/sessions/{session_id}")
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke a specific session."""
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    return {"message": "Session revoked"}

@router.post("/me/deactivate")
def deactivate_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate the current user's account."""
    current_user.is_active = False
    db.commit()
    return {"message": "Account deactivated"}

@router.post("/me/2fa/recovery-codes", response_model=List[str])
def generate_recovery_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate 10 new recovery codes and replace old ones."""
    codes = []
    hashed_codes = []
    for _ in range(10):
        code = secrets.token_hex(6).upper()
        formatted_code = f"{code[:4]}-{code[4:8]}-{code[8:]}"
        codes.append(formatted_code)
        clean_code = code.upper()
        hashed_codes.append(hashlib.sha256(clean_code.encode()).hexdigest())

    current_user.recovery_codes = json.dumps(hashed_codes)
    db.commit()
    return codes

@router.get("/me/2fa/recovery-codes-status")
def check_recovery_codes(
    current_user: User = Depends(get_current_user)
):
    """Check how many recovery codes are left."""
    if not current_user.recovery_codes:
        return {"count": 0}
    codes = json.loads(current_user.recovery_codes)
    return {"count": len(codes)}

@router.delete("/me/delete")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete the current user's account and all associated data."""
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted forever"}


@router.post("/me/link-google", response_model=schemas.User)
def link_google_account(
    link_data: schemas.GoogleLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Link a Google account to the current user."""
    try:
        # 1. Verify Google Token (Access Token or ID Token)
        # We call userinfo endpoint which accepts both and returns the 'sub' (Google ID)
        import requests
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {link_data.id_token}"}
        )
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google token or expired session")
            
        idinfo = resp.json()
        google_id = idinfo['sub']
        
        # 2. Check for conflicts
        existing_user = db.query(User).filter(User.google_id == google_id).first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400, 
                detail="This Google account is already linked to another Monteeq profile."
            )
            
        # 3. Update user
        current_user.google_id = google_id
        db.commit()
        db.refresh(current_user)
        return current_user
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{username}/followers", response_model=List[schemas.User])
def get_user_followers(
    username: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    user = crud_user.get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud_user.get_followers(db, user_id=user.id, skip=skip, limit=limit)

@router.get("/{username}/following", response_model=List[schemas.User])
def get_user_following(
    username: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    user = crud_user.get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud_user.get_following(db, user_id=user.id, skip=skip, limit=limit)


