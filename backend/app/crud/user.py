from sqlalchemy.orm import Session
from sqlalchemy import func
from app.schemas import schemas
from app.core import security
from app.models.models import User, Follow, Video, Like, Post, VerificationCode, ChallengeEntry, Challenge
from datetime import datetime, timedelta
import random
import string
import httpx

def get_country_from_ip(ip: str):
    """
    Automated country detection from IP address.
    Uses ipapi.co (free tier) for silent collection.
    """
    if not ip or ip in ["127.0.0.1", "localhost"]:
        return "Unknown"
    try:
        response = httpx.get(f"https://ipapi.co/{ip}/country_name/", timeout=2.0)
        if response.status_code == 200:
            return response.text.strip()
    except Exception as e:
        print(f"Geo-location error for {ip}: {e}")
    return "Unknown"

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username.ilike(username)).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email.ilike(email)).first()

def create_user(db: Session, user: schemas.UserCreate, google_id: str = None, is_onboarded: bool = False, ip_address: str = None):
    hashed_password = security.get_password_hash(user.password) if user.password else None
    
    # Get user count for admin assignment
    user_count = db.query(func.count(User.id)).scalar() or 0
    is_first_user = user_count == 0
    is_requested_admin = user.username.lower() == "smasduq"
    
    role = "admin" if (is_first_user or is_requested_admin) else "user"

    # Automated country collection
    detected_country = user.country
    if not detected_country and ip_address:
        detected_country = get_country_from_ip(ip_address)

    db_user = User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        profile_pic=user.profile_pic,
        hashed_password=hashed_password,
        google_id=google_id,
        is_onboarded=is_onboarded,
        role=role,
        country=detected_country
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_role(db: Session, user_id: int, role: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.role = role
        db.commit()
        db.refresh(user)
    return user

def update_password(db: Session, user_id: int, passwords: schemas.PasswordChange):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    if not security.verify_password(passwords.current_password, user.hashed_password):
        return False
    
    user.hashed_password = security.get_password_hash(passwords.new_password)
    db.commit()
    db.refresh(user)
    return True

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    if user_update.username:
        user.username = user_update.username
    if user_update.full_name:
        user.full_name = user_update.full_name
    if user_update.profile_pic:
        user.profile_pic = user_update.profile_pic
    if user_update.bio is not None:
        user.bio = user_update.bio
    if user_update.is_onboarded is not None:
        user.is_onboarded = user_update.is_onboarded
    if user_update.interests is not None:
        user.interests = user_update.interests
    if user_update.referral_source is not None:
        user.referral_source = user_update.referral_source
    if user_update.goals is not None:
        user.goals = user_update.goals
    if user_update.show_wins is not None:
        user.show_wins = user_update.show_wins
    if user_update.show_trophies is not None:
        user.show_trophies = user_update.show_trophies
    
    # Notification Preferences
    if user_update.notif_new_follower is not None:
        user.notif_new_follower = user_update.notif_new_follower
    if user_update.notif_challenge_win is not None:
        user.notif_challenge_win = user_update.notif_challenge_win
    if user_update.notif_comments is not None:
        user.notif_comments = user_update.notif_comments
    if user_update.notif_likes is not None:
        user.notif_likes = user_update.notif_likes
    
    if user_update.email_weekly is not None:
        user.email_weekly = user_update.email_weekly
    if user_update.email_challenges is not None:
        user.email_challenges = user_update.email_challenges
    if user_update.email_payouts is not None:
        user.email_payouts = user_update.email_payouts
    if user_update.email_marketing is not None:
        user.email_marketing = user_update.email_marketing
    
    # Account & Security
    if user_update.payout_method is not None:
        user.payout_method = user_update.payout_method
    if user_update.two_factor_enabled is not None:
        user.two_factor_enabled = user_update.two_factor_enabled

    db.commit()
    db.refresh(user)
    return user

def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_profile(db: Session, username: str, current_user_id: int = None):
    db_user = get_user_by_username(db, username)
    if not db_user:
        return None
    
    user_id = db_user.id
    
    # Counts
    followers_count = db.query(func.count(Follow.follower_id)).filter(Follow.followed_id == user_id).scalar() or 0
    following_count = db.query(func.count(Follow.followed_id)).filter(Follow.follower_id == user_id).scalar() or 0
    
    # Total Views & Likes
    total_views = db.query(func.sum(Video.views)).filter(Video.owner_id == user_id).scalar() or 0
    total_likes = db.query(func.count(Like.id)).join(Video).filter(Video.owner_id == user_id).scalar() or 0
    
    is_following = False
    if current_user_id:
        is_following = db.query(Follow).filter(Follow.follower_id == current_user_id, Follow.followed_id == user_id).first() is not None

    # Videos - Fetch only live (approved) videos for public, but all statuses for the owner
    if current_user_id == user_id:
        all_videos = db.query(Video).filter(Video.owner_id == user_id).all()
    else:
        all_videos = db.query(Video).filter(Video.owner_id == user_id, Video.status == "approved").all()
    videos = [v for v in all_videos if v.video_type == "home"]
    flash_videos = [v for v in all_videos if v.video_type == "flash"]

    # Sort videos to find most popular
    sorted_videos = sorted(all_videos, key=lambda x: x.views or 0, reverse=True)
    most_popular = sorted_videos[0] if sorted_videos else None
    
    # Identify Featured Video (Pinned or Popular)
    featured_video = db_user.pinned_video
    
    if not featured_video and most_popular:
        featured_video = most_popular
    
    # Posts
    posts = db.query(Post).filter(Post.owner_id == user_id).all()
    
    # Liked Videos
    liked_videos = db.query(Video).join(Like).filter(Like.user_id == user_id).all()
    
    # Trophies (Won Challenges)
    trophies = db.query(ChallengeEntry).filter(
        ChallengeEntry.user_id == user_id,
        ChallengeEntry.is_winner == True
    ).all()

    profile_data = {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "full_name": db_user.full_name,
        "profile_pic": db_user.profile_pic,
        "is_premium": db_user.is_premium,
        "is_verified": db_user.is_verified,
        "is_onboarded": db_user.is_onboarded,
        "flash_uploads": db_user.flash_uploads,
        "home_uploads": db_user.home_uploads,
        "bio": db_user.bio,
        "role": db_user.role,
        "google_id": db_user.google_id,
        "flash_quota_limit": db_user.flash_quota_limit,
        "home_quota_limit": db_user.home_quota_limit,
        "show_wins": db_user.show_wins,
        "show_trophies": db_user.show_trophies,

        "followers_count": followers_count,
        "following_count": following_count,
        "total_views": total_views,
        "total_likes": total_likes,
        "featured_video": featured_video,
        "most_popular_video": most_popular,
        "videos_count": len(videos),
        "flash_videos_count": len(flash_videos),
        "posts_count": len(posts),
        "videos": videos,
        "flash_videos": flash_videos,
        "posts": posts,
        "liked_videos": liked_videos,
        "trophies": trophies,
        "is_following": is_following
    }
    return profile_data

from app.crud import achievement as crud_achievement
from app.crud import notification as crud_notification
from app.utils.push import notify_user_push
from app.schemas.notification import NotificationCreate

def toggle_follow(db: Session, follower_id: int, followed_id: int):
    if follower_id == followed_id:
        return False
    
    existing = db.query(Follow).filter(Follow.follower_id == follower_id, Follow.followed_id == followed_id).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return False
    else:
        new_follow = Follow(follower_id=follower_id, followed_id=followed_id)
        db.add(new_follow)
        db.commit()
        
        # Check for achievements
        follower_count = db.query(func.count(Follow.follower_id)).filter(Follow.followed_id == followed_id).scalar()
        
        if follower_count == 1:
            crud_achievement.create_achievement(db, user_id=followed_id, milestone_name="FIRST_FOLLOWER")
        elif follower_count == 100:
            crud_achievement.create_achievement(db, user_id=followed_id, milestone_name="100_FOLLOWERS")
        elif follower_count == 1000:
            crud_achievement.create_achievement(db, user_id=followed_id, milestone_name="1K_FOLLOWERS")
            
        # Notify user
        try:
            follower = get_user_by_id(db, follower_id)
            msg = f"{follower.username} started following you!"
            notify_user_push(db, followed_id, "New Follower!", msg, link=f"/profile/{follower.username}", n_type="follower")
        except Exception:
            pass

        return True

def create_verification_code(db: Session, email: str):
    # Delete existing codes
    db.query(VerificationCode).filter(VerificationCode.email == email).delete()
    
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.now() + timedelta(minutes=10)
    
    ver_code = VerificationCode(
        email=email,
        code=code,
        expires_at=expires_at
    )
    db.add(ver_code)
    db.commit()
    return code

def verify_code(db: Session, email: str, code: str):
    db_code = db.query(VerificationCode).filter(VerificationCode.email.ilike(email), VerificationCode.code == code).first()
    if not db_code:
        return False
    
    if db_code.expires_at < datetime.now():
        db.delete(db_code)
        db.commit()
        return False
    
    # Success
    db.delete(db_code)
    db.commit()
    return True

def get_followers(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(User).join(Follow, User.id == Follow.follower_id).filter(Follow.followed_id == user_id).offset(skip).limit(limit).all()

def get_following(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(User).join(Follow, User.id == Follow.followed_id).filter(Follow.follower_id == user_id).offset(skip).limit(limit).all()
