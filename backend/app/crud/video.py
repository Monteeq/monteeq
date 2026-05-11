from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, text, or_
from app.models.models import Video, Like, Comment, View, User, Post, SponsoredAd
from app.schemas import schemas
from datetime import datetime, timedelta
from typing import Optional

def get_videos(db: Session, video_type: Optional[str] = None, filter_status: str = "approved", current_user_id: Optional[int] = None, skip: int = 0, limit: int = 100, mood: Optional[str] = None, feed_mode: Optional[str] = None):
    from app.models.models import Follow
    query = db.query(Video).options(joinedload(Video.owner))
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    
    # Filtering Logic based on status
    if filter_status == "approved":
        # Public feed: show only approved videos EXCEPT for the owner who should also see:
        # 1. Recently failed videos (for retry/viewing failure)
        # 2. Pending videos (currently being processed)
        if current_user_id:
            query = query.filter(
                or_(
                    Video.status == "approved",
                    (Video.status == "pending") & (Video.owner_id == current_user_id),
                    (Video.status == "failed") & (Video.failed_at >= twenty_four_hours_ago) & (Video.owner_id == current_user_id)
                )
            )
        else:
            query = query.filter(Video.status == "approved")
    elif filter_status:
        query = query.filter(Video.status == filter_status)
    else:
        # Default behavior (no status filter): exclude old failures
        query = query.filter(
            ~((Video.status == "failed") & (Video.failed_at < twenty_four_hours_ago))
        )
    
    if video_type:
        query = query.filter(Video.video_type == video_type)
        
    if mood:
        query = query.filter(Video.tags.ilike(f"%{mood}%"))

    # Following feed: restrict to videos from accounts the user follows
    if feed_mode == 'following' and current_user_id:
        followed_ids = db.query(Follow.followed_id).filter(Follow.follower_id == current_user_id).subquery()
        query = query.filter(Video.owner_id.in_(followed_ids))

    # Personalization: Get user interests for boosting
    user_interests = []
    if current_user_id:
        # Optimized: only select interests column
        user_data = db.query(User.interests).filter(User.id == current_user_id).first()
        if user_data and user_data.interests:
            user_interests = [t.strip().lower() for t in user_data.interests.split(",") if t.strip()]

    # Ordering: trending sorts by recent engagement, default is discovery score
    if feed_mode == 'trending':
        from datetime import timedelta
        week_ago = datetime.now() - timedelta(days=7)
        query = query.filter(Video.created_at >= week_ago)
        query = query.order_by(desc(Video.likes_count + Video.views))
    else:
        # Order by discovery score by default
        query = query.order_by(desc(Video.discovery_score))
    
    videos = query.offset(skip).limit(limit).all()
    
    # Re-sort in memory for complex interest matching & discovery score balance
    if user_interests:
        for video in videos:
            video_tags = [t.strip().lower() for t in (video.tags or "").split(",") if t.strip()]
            # Count matches
            match_count = sum(1 for t in user_interests if t in video_tags)
            # Combine discovery score with interest boost (20% boost per matching tag)
            video.personalized_score = video.discovery_score * (1 + (0.2 * match_count))
            video.interest_match_score = match_count
            
        videos.sort(key=lambda x: x.personalized_score, reverse=True)
    
    if current_user_id and videos:
        video_ids = [v.id for v in videos]
        liked_result = db.query(Like.video_id).filter(Like.user_id == current_user_id, Like.video_id.in_(video_ids)).all()
        liked_video_ids = {r[0] for r in liked_result}
        for video in videos:
            video.liked_by_user = video.id in liked_video_ids
    else:
        for video in videos:
            video.liked_by_user = False
            
    return videos

def search_videos(db: Session, query_str: str, status: str = "approved", current_user_id: int = None):
    query = db.query(Video).options(joinedload(Video.owner))
    if status == "approved" and current_user_id:
        from datetime import timedelta
        twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
        query = query.filter(
            or_(
                Video.status == "approved",
                (Video.status == "pending") & (Video.owner_id == current_user_id),
                (Video.status == "failed") & (Video.failed_at >= twenty_four_hours_ago) & (Video.owner_id == current_user_id)
            )
        )
    elif status:
        query = query.filter(Video.status == status)
    
    if query_str:
        # Check if it's a tag search (starts with #)
        if query_str and query_str.startswith("#"):
            tag = query_str[1:].strip()
            query = query.filter(Video.tags.ilike(f"%{tag}%"))
        else:
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    Video.title.ilike(f"%{query_str}%"),
                    Video.description.ilike(f"%{query_str}%"),
                    Video.tags.ilike(f"%{query_str}%")
                )
            )
        
    videos = query.all()
    
    if current_user_id and videos:
        video_ids = [v.id for v in videos]
        liked_result = db.query(Like.video_id).filter(Like.user_id == current_user_id, Like.video_id.in_(video_ids)).all()
        liked_video_ids = {r[0] for r in liked_result}
        for video in videos:
            video.liked_by_user = video.id in liked_video_ids
    else:
        for video in videos:
            video.liked_by_user = False
            
    return videos

def search_posts(db: Session, query_str: str, current_user_id: int = None):
    query = db.query(Post)
    
    if query_str:
        # Check if it's a tag search (starts with #)
        if query_str and query_str.startswith("#"):
            tag = query_str[1:].strip()
            query = query.filter(Post.tags.ilike(f"%{tag}%"))
        else:
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    Post.content.ilike(f"%{query_str}%"),
                    Post.tags.ilike(f"%{query_str}%")
                )
            )
            
    posts = query.order_by(desc(Post.discovery_score), Post.created_at.desc()).all()
    
    if current_user_id and posts:
        post_ids = [p.id for p in posts]
        liked_result = db.query(Like.post_id).filter(Like.user_id == current_user_id, Like.post_id.in_(post_ids)).all()
        liked_post_ids = {r[0] for r in liked_result}
        for post in posts:
            post.liked_by_user = post.id in liked_post_ids
    else:
        for post in posts:
            post.liked_by_user = False
            
    return posts

def get_video(db: Session, video_id: int, current_user_id: int = None):
    video = db.query(Video).options(joinedload(Video.owner)).filter(Video.id == video_id).first()
    if not video:
        return None
    
    if current_user_id:
        video.liked_by_user = db.query(Like).filter(Like.video_id == video_id, Like.user_id == current_user_id).first() is not None
    else:
        video.liked_by_user = False
        
    return video

from app.crud import achievement as crud_achievement
from app.crud import notification as crud_notification
from app.utils.push import notify_user_push
from app.schemas.notification import NotificationCreate

def create_video(db: Session, video: schemas.VideoCreate, user_id: int):
    # Separate additional fields from model_dump if necessary or assume model matches
    # schemas.VideoCreate has fields that match Video model except processing_key might be handled
    video_data = video.model_dump()
    db_video = Video(**video_data, owner_id=user_id)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video

def create_post(db: Session, post: schemas.PostCreate, user_id: int):
    post_data = post.model_dump()
    db_post = Post(**post_data, owner_id=user_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

def toggle_like(db: Session, user_id: int, video_id: Optional[int] = None, post_id: Optional[int] = None):
    query = db.query(Like).filter(Like.user_id == user_id)
    if video_id:
        query = query.filter(Like.video_id == video_id)
    elif post_id:
        query = query.filter(Like.post_id == post_id)
    else:
        return False



    existing = query.first()
    if existing:
        db.delete(existing)
        if video_id:
            db.query(Video).filter(Video.id == video_id).update({"likes_count": Video.likes_count - 1})
        elif post_id:
            db.query(Post).filter(Post.id == post_id).update({"likes_count": Post.likes_count - 1})
        db.commit()
        return False
    else:
        new_like = Like(user_id=user_id, video_id=video_id, post_id=post_id)
        db.add(new_like)
        if video_id:
            db.query(Video).filter(Video.id == video_id).update({"likes_count": Video.likes_count + 1})
        elif post_id:
            db.query(Post).filter(Post.id == post_id).update({"likes_count": Post.likes_count + 1})
        db.commit()

        return True

def handle_like_side_effects(db: Session, user_id: int, video_id: Optional[int] = None, post_id: Optional[int] = None):
    """
    Perform secondary tasks after a like is created:
    - Update discovery score
    - Update user interests
    - Send push notifications
    """
    # 1. Update Discovery Score
    update_discovery_score(db, video_id=video_id, post_id=post_id)

    # 2. Personalization: Update user interests
    if video_id:
         update_user_interests_from_video(db, user_id, video_id)

    # 3. Notify owner
    try:
        target = None
        msg = ""
        link = ""
        liker = db.query(User).filter(User.id == user_id).first()
        
        if video_id:
            target = db.query(Video).filter(Video.id == video_id).first()
            if target:
                msg = f"{liker.username} liked your video: {target.title}"
                link = f"/watch/{video_id}"
        elif post_id:
            target = db.query(Post).filter(Post.id == post_id).first()
            if target:
                msg = f"{liker.username} liked your post"
                link = "/posts"

        if target and target.owner_id != user_id:
            notify_user_push(db, target.owner_id, "New Like!", msg, link=link, n_type="like")
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to handle like side effects: {e}")

def increment_share(db: Session, video_id: int):
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        video.shares = (video.shares or 0) + 1
        db.commit()
        db.refresh(video)
        return video
    return None

def increment_view(db: Session, user_id: Optional[int] = None, video_id: Optional[int] = None, post_id: Optional[int] = None):
    # Fetch target objects
    video = None
    if video_id:
        video = db.query(Video).filter(Video.id == video_id).first()
    
    post = None
    if post_id:
        post = db.query(Post).filter(Post.id == post_id).first()

    # 1. Uploader Check: If uploader, only count 1 view ever
    if user_id and video and video.owner_id == user_id:
        exists = db.query(View).filter(View.video_id == video_id, View.user_id == user_id).first()
        if exists:
            return video

    # 2. 10-Hour Window Check (Max 5 views per 10 hours for authenticated users)
    if user_id and video_id:
        ten_hours_ago = datetime.now() - timedelta(hours=10)
        view_count = db.query(func.count(View.id)).filter(
            View.video_id == video_id,
            View.user_id == user_id,
            View.created_at >= ten_hours_ago
        ).scalar() or 0
        
        if view_count >= 5:
            return video

    # Record the view
    new_view = View(video_id=video_id, post_id=post_id, user_id=user_id)
    db.add(new_view)
    
    if user_id and video_id:
        update_user_interests_from_video(db, user_id, video_id)
        
    db.commit()

    # Increment the public counter
    if video:
        video.views = (video.views or 0) + 1
        db.commit()
        db.refresh(video)
        update_discovery_score(db, video_id=video_id)
        return video
    
    if post:
        post.views_count = (post.views_count or 0) + 1
        db.commit()
        db.refresh(post)
        update_discovery_score(db, post_id=post_id)
        return post
        
    return None

def update_discovery_score(db: Session, video_id: Optional[int] = None, post_id: Optional[int] = None):
    try:
        from app.tasks.video_tasks import update_discovery_score_task
        update_discovery_score_task.delay(video_id=video_id, post_id=post_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Celery task failed to enqueue (broker down?): {e}")

def get_posts(db: Session):
    return db.query(Post).all()

def get_ads(db: Session):
    return db.query(SponsoredAd).filter(SponsoredAd.is_active == True).all()

def create_comment(db: Session, comment: schemas.CommentBase, user_id: int, video_id: Optional[int] = None, post_id: Optional[int] = None):


    comment_data = comment.model_dump()
    db_comment = Comment(**comment_data, video_id=video_id, post_id=post_id, owner_id=user_id)
    # The parent_id is now handled automatically because it's in comment_data (schemas.CommentCreate)
    db.add(db_comment)
    
    if video_id:
        db.query(Video).filter(Video.id == video_id).update({"comments_count": Video.comments_count + 1})
    elif post_id:
        db.query(Post).filter(Post.id == post_id).update({"comments_count": Post.comments_count + 1})
        
    db.commit()
    db.refresh(db_comment)

    # Update Discovery Score
    update_discovery_score(db, video_id=video_id, post_id=post_id)

    # Check for Creator Boost
    target = None
    if video_id:
        target = db.query(Video).filter(Video.id == video_id).first()
    elif post_id:
        target = db.query(Post).filter(Post.id == post_id).first()
    
    if target and target.owner_id == user_id:
        target.last_owner_interaction_at = func.now()
        db.commit()

    return db_comment

def handle_comment_side_effects(db: Session, user_id: int, video_id: Optional[int] = None, post_id: Optional[int] = None):
    """Secondary tasks after a comment is created."""
    try:
        target = None
        msg = ""
        link = ""
        commenter = db.query(User).filter(User.id == user_id).first()
        
        if video_id:
            target = db.query(Video).filter(Video.id == video_id).first()
            if target:
                msg = f"{commenter.username} commented on your video!"
                link = f"/watch/{video_id}"
        elif post_id:
            target = db.query(Post).filter(Post.id == post_id).first()
            if target:
                msg = f"{commenter.username} commented on your post!"
                link = "/posts"

        if target and target.owner_id != user_id:
            notify_user_push(db, target.owner_id, "New Comment!", msg, link=link, n_type="comment")
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to handle comment side effects: {e}")

def get_comments(db: Session, video_id: Optional[int] = None, post_id: Optional[int] = None):
    query = db.query(Comment).filter(Comment.parent_id == None) # Only get root comments
    if video_id:
        query = query.filter(Comment.video_id == video_id)
    elif post_id:
        query = query.filter(Comment.post_id == post_id)
    return query.order_by(Comment.created_at.desc()).all()

def delete_video(db: Session, video_id: int):
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        db.delete(video)
        db.commit()
        return True
    return False

def update_user_interests_from_video(db: Session, user_id: int, video_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    video = db.query(Video).filter(Video.id == video_id).first()
    if not user or not video or not video.tags:
        return
    
    # Get first 3 tags from video
    new_tags = [t.strip().lower() for t in video.tags.split(",") if t.strip()][:3]
    if not new_tags:
        return
        
    current_interests = [t.strip().lower() for t in (user.interests or "").split(",") if t.strip()]
    
    # Add new tags if not present, keeping it as a set to avoid duplicates
    updated_interests = list(dict.fromkeys(current_interests + new_tags))
    
    # Keep interests list at a reasonable size (e.g., top 20 latest)
    user.interests = ",".join(updated_interests[-20:])
    db.commit()

def update_comment(db: Session, comment_id: int, user_id: int, content: str):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        return None
    
    # Only owner or admin can edit
    user = db.query(User).filter(User.id == user_id).first()
    if comment.owner_id != user_id and (not user or user.role != "admin"):
        return False
        
    comment.content = content
    db.commit()
    db.refresh(comment)
    return comment

def delete_comment(db: Session, comment_id: int, user_id: int):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        return None
        
    user = db.query(User).filter(User.id == user_id).first()
    
    # Permission check for deletion:
    # 1. Comment owner
    # 2. Content owner (video/post owner) can delete any comment on their content
    # 3. Admin
    
    can_delete = False
    if comment.owner_id == user_id or (user and user.role == "admin"):
        can_delete = True
    else:
        # Check content ownership
        if comment.video_id:
            video = db.query(Video).filter(Video.id == comment.video_id).first()
            if video and video.owner_id == user_id:
                can_delete = True
        elif comment.post_id:
            post = db.query(Post).filter(Post.id == comment.post_id).first()
            if post and post.owner_id == user_id:
                can_delete = True
                
    if not can_delete:
        return False
    # Store these before deleting
    video_id = comment.video_id
    post_id = comment.post_id

    db.delete(comment)
    
    if video_id:
        db.query(Video).filter(Video.id == video_id).update({"comments_count": Video.comments_count - 1})
    elif post_id:
        db.query(Post).filter(Post.id == post_id).update({"comments_count": Post.comments_count - 1})
        
    db.commit()
    return True
