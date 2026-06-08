from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4

from app.db.session import get_db, SessionLocal
from app.core.dependencies import get_current_user, get_current_user_optional
from app.schemas import schemas
from app.core import config
from app.models.models import Post, Follow, Like, Comment, User
from app.crud import video as crud_video
from sqlalchemy import case, func

router = APIRouter()

@router.get("/", response_model=List[schemas.Post])
def get_posts(
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    limit = min(limit, 3)
    query = db.query(Post)
    
    if current_user:
        # Get IDs of people user follows
        following_ids = db.query(Follow.following_id).filter(Follow.follower_id == current_user.id).all()
        following_ids = [f[0] for f in following_ids]
        
        if following_ids:
            is_followed = case(
                (Post.owner_id.in_(following_ids), 1),
                else_=0
            ).label('is_followed')
            query = query.order_by(is_followed.desc(), Post.id.desc())
        else:
            query = query.order_by(Post.id.desc())
    else:
        query = query.order_by(Post.id.desc())
        
    posts = query.offset(skip).limit(limit).all()

    # Advanced Viral Expansion & Discovery
    if len(posts) < limit:
        remaining = limit - len(posts)
        seen_ids = [p.id for p in posts]
        
        # Pull high engagement posts as fallback
        exp_query = db.query(Post).filter(Post.id.notin_(seen_ids), Post.views_count > 5)
        remaining_posts = exp_query.order_by(Post.views_count.desc()).limit(remaining).all()
        posts.extend(remaining_posts)

    # Populate metadata & handle engagement attribution
    for post in posts:
        # Determine the target for engagement attribution
        target = post
        if post.original_post_id and post.original_post:
            target = post.original_post
            
        # Metadata counts always reflect the ORIGINAL post
        target.likes_count = db.query(func.count(Like.id)).filter(Like.post_id == target.id).scalar() or 0
        target.comments_count = db.query(func.count(Comment.id)).filter(Comment.post_id == target.id).scalar() or 0
        
        if current_user:
            target.liked_by_user = db.query(Like).filter(Like.post_id == target.id, Like.user_id == current_user.id).first() is not None
        else:
            target.liked_by_user = False
        
        # Increment View on Original
        crud_video.increment_view(db, user_id=current_user.id if current_user else None, post_id=target.id)
        
    db.commit()
    return posts

@router.post("/create", response_model=schemas.Post)
async def create_post(
    content: str = Form(...),
    tags: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    image_url = None
    if image:
        from app.core.storage import storage
        import time
        
        file_ext = image.filename.split(".")[-1]
        timestamp = int(time.time())
        s3_key = f"posts/{current_user.id}_{timestamp}.{file_ext}"
        
        try:
            image_url = storage.upload_file_obj(image.file, s3_key)
        except Exception as e:
            print(f"Failed to upload post image to S3: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload image to cloud storage")
    
    post_in = schemas.PostCreate(content=content, image_url=image_url, tags=tags)
    return crud_video.create_post(db, post=post_in, user_id=current_user.id)

@router.post("/{post_id}/repost", response_model=schemas.Post)
def repost_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    original_post = db.query(Post).filter(Post.id == post_id).first()
    if not original_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already reposted by this user to avoid spam
    existing = db.query(Post).filter(Post.original_post_id == post_id, Post.owner_id == current_user.id).first()
    if existing:
        return existing

    new_repost = Post(
        owner_id=current_user.id,
        original_post_id=original_post.id,
        is_active=True
    )
    db.add(new_repost)
    db.commit()
    db.refresh(new_repost)
    return new_repost

def handle_post_like_background(user_id: int, post_id: int):
    """Background task to handle side effects of a post like."""
    db = SessionLocal()
    try:
        crud_video.handle_like_side_effects(db, user_id, post_id=post_id)
    finally:
        db.close()

@router.post("/{post_id}/like")
def like_post(
    post_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    is_liked = crud_video.toggle_like(db, user_id=current_user.id, post_id=post_id)
    
    if is_liked:
        # Background side effects
        background_tasks.add_task(handle_post_like_background, current_user.id, post_id)
        
    likes_count = db.query(func.count(Like.id)).filter(Like.post_id == post_id).scalar() or 0
    
    return {"status": "success", "liked": is_liked, "likes_count": likes_count}

def handle_post_comment_background(user_id: int, post_id: int):
    """Background task for post comment side effects."""
    db = SessionLocal()
    try:
        crud_video.handle_comment_side_effects(db, user_id, post_id=post_id)
    finally:
        db.close()

@router.post("/{post_id}/comment", response_model=schemas.Comment)
def comment_post(
    post_id: int,
    comment: schemas.CommentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db_comment = crud_video.create_comment(db, comment=comment, user_id=current_user.id, post_id=post_id)
    
    # Background side effects
    background_tasks.add_task(handle_post_comment_background, current_user.id, post_id)
    
    return db_comment

@router.get("/{post_id}/comments", response_model=List[schemas.Comment])
def read_post_comments(post_id: int, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    return crud_video.get_comments(db, post_id=post_id, current_user_id=current_user.id if current_user else None)

@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check ownership or admin
    if post.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    # Delete local image if exists
    if post.image_url and post.image_url.startswith(config.BASE_URL):
        import os
        relative_path = post.image_url.replace(f"{config.BASE_URL}/static/", "")
        local_path = os.path.join(config.STATIC_DIR, relative_path.replace("/", os.sep))
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception as e:
                print(f"Failed to delete post image {local_path}: {e}")
                
    db.delete(post)
    db.commit()
    return {"status": "success", "message": "Post deleted successfully"}

@router.put("/{post_id}/comments/{comment_id}", response_model=schemas.Comment)
def update_comment(
    post_id: int,
    comment_id: int,
    comment_in: schemas.CommentBase,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Verify post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    result = crud_video.update_comment(db, comment_id=comment_id, user_id=current_user.id, content=comment_in.content)
    if result is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if result is False:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    return result

@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Verify post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    result = crud_video.delete_comment(db, comment_id=comment_id, user_id=current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if result is False:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    return {"status": "success", "message": "Comment deleted successfully"}
