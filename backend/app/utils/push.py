import json
import os
from pywebpush import webpush, WebPushException
from app.models.models import PushSubscription
from sqlalchemy.orm import Session
import logging
from app.crud.notification import create_notification
from app.schemas.notification import NotificationCreate

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@monteeq.com")

def send_push_notification(subscription: PushSubscription, message_data: dict):
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth
                }
            },
            data=json.dumps(message_data),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={
                "sub": VAPID_EMAIL if VAPID_EMAIL.startswith("mailto:") else f"mailto:{VAPID_EMAIL}",
            }
        )
        return True
    except WebPushException as ex:
        logger.error("WebPush error: %s", ex)
        # If subscription is no longer valid, we should probably delete it
        # but we don't have db here. Caller should handle.
        return False
    except Exception as ex:
        logger.error("Failed to send push: %s", ex)
        return False

from app.services.email_service import send_email
from app.models.models import User

def notify_user_push(db: Session, user_id: int, title: str, body: str, link: str = None, n_type: str = "info"):
    """
    Unified dispatcher for in-app notifications, web push, and email.
    """
    # 1. Fetch user to check preferences and email
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    # 2. Always save to database for In-App history
    notif_in = NotificationCreate(
        user_id=user_id,
        message=body,
        link=link,
        type=n_type
    )
    create_notification(db, notif_in)

    # 3. Trigger Email if applicable
    # We map notification types to user email preferences
    should_email = False
    if n_type == "follower" and user.notif_new_follower: should_email = True
    elif n_type == "achievement" and user.notif_challenge_win: should_email = True
    elif n_type == "comment" and user.notif_comments: should_email = True
    elif n_type == "status_change": should_email = True # Vital status changes always email
    elif n_type == "morning" and user.email_marketing: should_email = True
    
    if should_email and user.email:
        send_email(
            to_email=user.email,
            subject=f"Monteeq: {title}",
            title=title,
            message=body,
            action_text="View on Monteeq" if link else None,
            action_url=link
        )

    # 4. Trigger Web Push if subscribed
    from app.crud.notification import get_user_push_subscriptions
    subscriptions = get_user_push_subscriptions(db, user_id)
    if subscriptions:
        payload = {
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "data": {
                "url": link
            }
        }
        for sub in subscriptions:
            send_push_notification(sub, payload)
