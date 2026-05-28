from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core import dependencies
from app.db.session import get_db
from app.crud import notification as crud_notification
from app.models.models import User
from app.schemas import notification as schemas
from app.schemas import push as push_schemas
import os

router = APIRouter()

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe to push notifications."""
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": key}


@router.get("/unread", response_model=List[schemas.Notification])
def get_unread_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    return crud_notification.get_unread_notifications(db, user_id=current_user.id)

@router.put("/{notification_id}/read", response_model=schemas.Notification)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    notification = crud_notification.mark_notification_read(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    crud_notification.mark_all_notifications_read(db, user_id=current_user.id)
    return {"message": "All notifications marked as read"}

@router.get("/", response_model=List[schemas.Notification])
def read_notifications(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    return crud_notification.get_notifications(db, user_id=current_user.id, skip=skip, limit=limit)

@router.post("/push-subscriptions", response_model=push_schemas.PushSubscription)
def subscribe_push(
    subscription: push_schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    return crud_notification.create_push_subscription(db, subscription=subscription, user_id=current_user.id)

@router.delete("/push-subscriptions")
def unsubscribe_push(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_user)
):
    success = crud_notification.delete_push_subscription(db, endpoint=endpoint, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Successfully unsubscribed"}
