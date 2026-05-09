import logging
from celery import shared_task
from app.db.session import SessionLocal
from app.models.models import User, Challenge
from app.services.email_service import send_challenge_announcement_batch

logger = logging.getLogger(__name__)

@shared_task(name="tasks.email.queue_new_challenge_announcement")
def queue_new_challenge_announcement(challenge_id: int):
    """
    Celery task to fetch eligible users and dispatch challenge announcement
    emails in bulk via Brevo's BCC API to respect privacy.
    """
    db = SessionLocal()
    try:
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not challenge:
            logger.error(f"Challenge {challenge_id} not found in DB for email task.")
            return

        # Fetch all users who have opted in to challenge emails
        subscribers = db.query(User).filter(
            User.email_challenges == True,
            User.email.isnot(None) # Remove is_active check if it doesn't exist natively
        ).all()

        if not subscribers:
            logger.info("No opted-in users found. Skipping challenge announcement email.")
            return
            
        emails = [u.email for u in subscribers]
        
        # We process in batches of 50 to satisfy standard BCC limit thresholds
        batch_size = 50
        batches = [emails[i:i + batch_size] for i in range(0, len(emails), batch_size)]
        
        success_count = 0
        end_date_str = challenge.end_date.strftime("%Y-%m-%d") if challenge.end_date else "TBD"
        
        for batch in batches:
            res = send_challenge_announcement_batch(
                bcc_emails=batch,
                title=challenge.title,
                prize=challenge.prize,
                end_date=end_date_str
            )
            if res:
                success_count += len(batch)
                
        logger.info(f"Challenge '{challenge.title}' announcement successfully grouped to {success_count} inboxes.")        
    except Exception as e:
        logger.error(f"Failed executing queue_new_challenge_announcement: {e}")
    finally:
        db.close()


