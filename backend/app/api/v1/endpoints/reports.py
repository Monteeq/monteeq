from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Union

from app.db.async_session import get_async_db
from app.core.async_dependencies import get_async_current_user
from app.models.models import ContentReport, ModerationAuditLog, Video, Post, Comment
from app.schemas.report import ReportCreate

router = APIRouter()

async def get_video_db_async(db: AsyncSession, video_id: Union[int, str]) -> Video:
    if isinstance(video_id, str) and not video_id.isdigit():
        result = await db.execute(select(Video).filter(Video.public_id == video_id))
    else:
        result = await db.execute(select(Video).filter(Video.id == int(video_id)))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@router.post("/", status_code=status.HTTP_201_CREATED) # Note: status_code can be 201 or 200, let's use 201
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_content_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_async_current_user)
):
    # 1. Rate Limiting: Max 10 reports per user per hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    report_count_query = await db.execute(
        select(func.count(ContentReport.id))
        .filter(ContentReport.reporter_id == current_user.id, ContentReport.created_at >= one_hour_ago)
    )
    report_count = report_count_query.scalar() or 0
    if report_count >= 10:
        raise HTTPException(status_code=429, detail="Too many reports. Please try again later.")

    content_type = report_in.content_type.lower()
    content_id = report_in.content_id
    reason = report_in.reason
    description = report_in.description

    # 2. Resolve target and check duplicate
    if content_type in ["video", "flash"]:
        video = await get_video_db_async(db, content_id)
        
        dup_query = await db.execute(
            select(ContentReport)
            .filter(ContentReport.reporter_id == current_user.id, ContentReport.video_id == video.id)
        )
        if dup_query.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You have already reported this content.")
            
        new_report = ContentReport(
            reporter_id=current_user.id,
            content_type=content_type,
            video_id=video.id,
            reason=reason,
            description=description
        )
    elif content_type == "post":
        post_result = await db.execute(select(Post).filter(Post.id == int(content_id)))
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        dup_query = await db.execute(
            select(ContentReport)
            .filter(ContentReport.reporter_id == current_user.id, ContentReport.post_id == post.id)
        )
        if dup_query.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You have already reported this content.")

        new_report = ContentReport(
            reporter_id=current_user.id,
            content_type="post",
            post_id=post.id,
            reason=reason,
            description=description
        )
    elif content_type == "comment":
        comment_result = await db.execute(select(Comment).filter(Comment.id == int(content_id)))
        comment = comment_result.scalar_one_or_none()
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")

        dup_query = await db.execute(
            select(ContentReport)
            .filter(ContentReport.reporter_id == current_user.id, ContentReport.comment_id == comment.id)
        )
        if dup_query.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You have already reported this content.")

        new_report = ContentReport(
            reporter_id=current_user.id,
            content_type="comment",
            comment_id=comment.id,
            reason=reason,
            description=description
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid content type.")

    # 3. Save to database
    db.add(new_report)
    
    # 4. Audit Trail
    audit_log = ModerationAuditLog(
        action="report_created",
        target_type=content_type,
        target_id=str(content_id),
        details=f"Report created by user {current_user.username} for reason: {reason}"
    )
    db.add(audit_log)
    
    await db.commit()
    return {"message": "Report submitted successfully."}
