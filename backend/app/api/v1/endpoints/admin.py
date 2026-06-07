from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import admin_only
from app.core import security, config
from app.crud import user as crud_user, setting as crud_setting
from app.models.models import User, Video, View, Challenge, ChallengeEntry, Transaction, PayoutRequest
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from typing import List, Optional
from sqlalchemy import cast, Date
from app.tasks.email_tasks import queue_new_challenge_announcement
from app.services.email_service import send_pro_upgrade_email

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
async def login_for_admin_access_token(
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = crud_user.get_user_by_username(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin privileges required",
        )

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users", response_model=List[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.get("/stats")
def read_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    user_count = db.query(func.count(User.id)).scalar() or 0
    video_count = db.query(func.count(Video.id)).scalar() or 0
    premium_count = db.query(func.count(User.id)).filter(User.is_premium == True).scalar() or 0
    
    # Sum views
    total_views_sum = db.query(func.sum(Video.views)).scalar() or 0

    # Total Revenue (Subscriptions)
    total_rev = db.query(func.sum(Transaction.amount)).filter(Transaction.transaction_type == 'pro_subscription').scalar() or 0
    
    # Pending Payouts (Liabilities)
    pending_payouts_sum = db.query(func.sum(PayoutRequest.amount)).filter(PayoutRequest.status == 'pending').scalar() or 0

    # Top Countries Breakdown
    top_signup_countries_query = (
        db.query(User.country, func.count(User.id).label("count"))
        .filter(User.country != None)
        .group_by(User.country)
        .order_by(func.count(User.id).desc())
        .limit(5)
        .all()
    )
    top_signup_countries = [{"country": c, "count": cnt} for c, cnt in top_signup_countries_query]

    return {
        "users": user_count,
        "videos": video_count,
        "premium_users": premium_count,
        "total_views": total_views_sum,
        "total_revenue": float(total_rev),
        "pending_payouts": float(pending_payouts_sum),
        "top_signup_countries": top_signup_countries
    }

@router.post("/promote/{user_id}")
def promote_user(
    user_id: int,
    background_tasks: BackgroundTasks,
    is_premium: bool = True,
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    user = crud_user.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    was_premium = user.is_premium
    user.is_premium = is_premium
    db.commit()
    db.refresh(user)
    
    if is_premium and not was_premium and user.email:
        background_tasks.add_task(send_pro_upgrade_email, user.email, user.username)
    
    return {"message": f"User {user.username} premium status set to {is_premium}"}

@router.get("/settings/storage-mode")
def get_storage_mode(
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    mode = crud_setting.get_setting(db, "storage_mode")
    return {"mode": mode or config.STORAGE_MODE}

@router.put("/settings/storage-mode")
def update_storage_mode(
    mode: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    if mode not in ["gcs", "local"]:
        raise HTTPException(status_code=400, detail="Invalid storage mode")
    
    crud_setting.update_setting(db, "storage_mode", mode)
    return {"message": f"Storage mode updated to {mode}", "mode": mode}

@router.get("/stats/performance")
def get_performance_stats(
    metric: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    if metric == "users":
        query = db.query(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("value")
        ).filter(User.created_at >= start_date)
    elif metric == "videos":
        query = db.query(
            func.date(Video.created_at).label("date"),
            func.count(Video.id).label("value")
        ).filter(Video.created_at >= start_date)
    elif metric == "premium":
        query = db.query(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("value")
        ).filter(User.created_at >= start_date, User.is_premium == True)
    elif metric == "views":
        query = db.query(
            func.date(View.created_at).label("date"),
            func.count(View.id).label("value")
        ).filter(View.created_at >= start_date)
    elif metric == "revenue":
        query = db.query(
            func.date(Transaction.created_at).label("date"),
            func.sum(Transaction.amount).label("value")
        ).filter(
            Transaction.created_at >= start_date,
            Transaction.transaction_type == 'pro_subscription'
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid metric")

    results = query.group_by("date").order_by("date").all()
    
    return [{"date": str(r.date), "value": float(r.value or 0)} for r in results]

@router.get("/config")
def get_admin_config(
    current_user: dict = Depends(admin_only)
):
    return {
        "rust_service_url": config.RUST_SERVICE_URL
    }

# Challenges Management

@router.get("/challenges", response_model=List[schemas.Challenge])
def read_challenges(
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    return db.query(Challenge).order_by(Challenge.created_at.desc()).all()

@router.post("/challenges", response_model=schemas.Challenge)
def create_challenge(
    challenge_in: schemas.ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    db_challenge = Challenge(**challenge_in.model_dump())
    db.add(db_challenge)
    db.commit()
    db.refresh(db_challenge)
    
    # Dispatch Celery background task for email broadcasting
    queue_new_challenge_announcement.delay(db_challenge.id)
    
    return db_challenge

@router.put("/challenges/{challenge_id}", response_model=schemas.Challenge)
def update_challenge(
    challenge_id: int,
    challenge_in: schemas.ChallengeBase, # using base for partial update logic if desired or complete update
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    db_challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not db_challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    update_data = challenge_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_challenge, key, value)
    
    db.commit()
    db.refresh(db_challenge)
    return db_challenge

@router.delete("/challenges/{challenge_id}")
def delete_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(admin_only)
):
    db_challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not db_challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    db.delete(db_challenge)
    db.commit()
    return {"message": "Challenge deleted successfully"}


# Content Reports Admin APIs
from app.schemas.report import ReportResponse, ReportAction, AuditLogResponse
from app.models.models import ContentReport, ModerationAuditLog, Comment, Post

@router.get("/reports", response_model=List[ReportResponse])
def get_reports(
    status: Optional[str] = None,
    content_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(admin_only)
):
    query = db.query(ContentReport)
    if status:
        query = query.filter(ContentReport.status == status)
    if content_type:
        query = query.filter(ContentReport.content_type == content_type)
    
    reports = query.order_by(ContentReport.created_at.desc()).offset(skip).limit(limit).all()
    
    response_list = []
    for r in reports:
        reporter_username = r.reporter.username if r.reporter else "Unknown"
        resolver_username = r.resolver.username if r.resolver else None
        
        preview = "Content unavailable"
        creator = "Unknown"
        c_id = r.video_id or r.post_id or r.comment_id or 0
        
        if r.content_type in ["video", "flash"] and r.video:
            preview = r.video.title
            creator = r.video.owner.username if r.video.owner else "Unknown"
            c_id = r.video.public_id if r.video.public_id else str(r.video.id)
        elif r.content_type == "post" and r.post:
            preview = r.post.content[:100] + "..." if len(r.post.content) > 100 else r.post.content
            creator = r.post.owner.username if r.post.owner else "Unknown"
            c_id = r.post.id
        elif r.content_type == "comment" and r.comment:
            preview = r.comment.content[:100] + "..." if len(r.comment.content) > 100 else r.comment.content
            creator = r.comment.owner.username if r.comment.owner else "Unknown"
            c_id = r.comment.id
            
        response_list.append(
            ReportResponse(
                id=r.id,
                reporter_id=r.reporter_id,
                reporter_username=reporter_username,
                content_type=r.content_type,
                content_id=c_id,
                reason=r.reason,
                description=r.description,
                status=r.status,
                created_at=r.created_at,
                resolved_at=r.resolved_at,
                resolved_by=r.resolved_by,
                resolver_username=resolver_username,
                notes=r.notes,
                reported_content_preview=preview,
                reported_content_creator=creator
            )
        )
    return response_list

@router.post("/reports/{report_id}/action")
def take_report_action(
    report_id: int,
    action_in: ReportAction,
    db: Session = Depends(get_db),
    current_user = Depends(admin_only)
):
    report = db.query(ContentReport).filter(ContentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    action = action_in.action.lower()
    notes = action_in.notes
    
    # Identify content creator
    creator_user = None
    target_id_str = ""
    
    if report.content_type in ["video", "flash"] and report.video:
        creator_user = report.video.owner
        target_id_str = report.video.public_id or str(report.video.id)
    elif report.content_type == "post" and report.post:
        creator_user = report.post.owner
        target_id_str = str(report.post.id)
    elif report.content_type == "comment" and report.comment:
        creator_user = report.comment.owner
        target_id_str = str(report.comment.id)

    # 1. Update Report status
    report.status = "dismissed" if action == "dismiss" else "resolved"
    report.resolved_at = datetime.utcnow()
    report.resolved_by = current_user.id
    report.notes = notes

    # 2. Perform requested Action
    details_str = f"Action taken: {action} by admin: {current_user.username}. Notes: {notes}"
    
    if action == "delete_content":
        if report.content_type in ["video", "flash"] and report.video:
            db.delete(report.video)
        elif report.content_type == "post" and report.post:
            db.delete(report.post)
        elif report.content_type == "comment" and report.comment:
            db.delete(report.comment)
            
    elif action == "suspend_user":
        if creator_user:
            creator_user.is_active = False
            details_str += f" | Suspended user: @{creator_user.username}"
            
    # 3. Create Audit Log
    audit_log = ModerationAuditLog(
        action=f"report_{action}",
        moderator_id=current_user.id,
        target_type=report.content_type,
        target_id=target_id_str,
        details=details_str
    )
    db.add(audit_log)
    db.commit()
    
    return {"message": f"Action '{action}' processed successfully."}

@router.get("/moderation/audit-logs", response_model=List[AuditLogResponse])
def get_moderation_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(admin_only)
):
    logs = db.query(ModerationAuditLog).order_by(ModerationAuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    response_list = []
    for l in logs:
        mod_name = l.moderator.username if l.moderator else "System"
        response_list.append(
            AuditLogResponse(
                id=l.id,
                action=l.action,
                moderator_id=l.moderator_id,
                moderator_username=mod_name,
                target_type=l.target_type,
                target_id=l.target_id,
                details=l.details,
                created_at=l.created_at
            )
        )
    return response_list

