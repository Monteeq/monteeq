"""
Email preference and unsubscribe endpoints.

GET  /api/v1/email/unsubscribe?token=<TOKEN>           — one-click unsubscribe (from email link)
POST /api/v1/email/unsubscribe                         — programmatic unsubscribe (authenticated)
GET  /api/v1/email/preferences                         — get current preferences (authenticated)
PATCH /api/v1/email/preferences                        — update preferences (authenticated)
POST /api/v1/email/webhook                             — ESP open/click webhook (internal)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import User, EmailLog
from app.utils.unsubscribe_token import verify_unsubscribe_token
from app.api.v1.endpoints.auth import get_current_user  # reuse existing auth dependency

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmailPreferencesUpdate(BaseModel):
    email_weekly:     Optional[bool] = None
    email_challenges: Optional[bool] = None
    email_payouts:    Optional[bool] = None
    email_marketing:  Optional[bool] = None


class EmailPreferencesOut(BaseModel):
    email_weekly:     bool
    email_challenges: bool
    email_payouts:    bool
    email_marketing:  bool

    class Config:
        from_attributes = True


class WebhookPayload(BaseModel):
    type:        str             # "email.opened" | "email.clicked" | "email.bounced"
    message_id:  str
    timestamp:   Optional[str] = None


# ── Unsubscribe (one-click, from email link) ──────────────────────────────────

@router.get("/unsubscribe", response_class=HTMLResponse)
def one_click_unsubscribe(
    token: str = Query(..., description="Signed unsubscribe token from email link"),
    db: Session = Depends(get_db),
):
    """
    One-click unsubscribe endpoint — linked from every marketing email footer.
    Verifies the HMAC token and updates the relevant preference column.
    Returns a friendly HTML confirmation page (no login required).
    """
    result = verify_unsubscribe_token(token)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired unsubscribe link.")

    user_id, group = result
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    _apply_unsubscribe(user, group, db)

    return HTMLResponse(content=_unsubscribe_page(user.username, group), status_code=200)


@router.post("/unsubscribe")
def api_unsubscribe(
    group: str = Query(default="marketing"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Programmatic unsubscribe for authenticated users via settings page."""
    _apply_unsubscribe(current_user, group, db)
    return {"status": "unsubscribed", "group": group}


def _apply_unsubscribe(user: User, group: str, db: Session):
    mapping = {
        "marketing":  "email_marketing",
        "weekly":     "email_weekly",
        "challenges": "email_challenges",
        "all": None,  # handled specially
    }
    if group == "all":
        user.email_marketing  = False
        user.email_weekly     = False
        user.email_challenges = False
    elif group in mapping:
        setattr(user, mapping[group], False)
    db.commit()
    logger.info("User %s unsubscribed from group '%s'", user.id, group)


# ── Preferences (authenticated) ───────────────────────────────────────────────

@router.get("/preferences", response_model=EmailPreferencesOut)
def get_preferences(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/preferences", response_model=EmailPreferencesOut)
def update_preferences(
    payload: EmailPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Analytics (Admin only) ──────────────────────────────────────────────────

@router.get("/analytics")
def get_email_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get aggregated email metrics per template type.
    Includes send count, open count, open rate, click count, click-through rate.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required.")

    from sqlalchemy import func as sqlfunc
    
    # Query total sent, opened, clicked per template
    stats = db.query(
        EmailLog.template,
        sqlfunc.count(EmailLog.id).label("sent"),
        sqlfunc.count(EmailLog.opened_at).label("opened"),
        sqlfunc.count(EmailLog.clicked_at).label("clicked"),
        sqlfunc.count(sqlfunc.nullif(EmailLog.bounced, False)).label("bounced")
    ).group_by(EmailLog.template).all()

    results = []
    for row in stats:
        sent = row.sent
        opened = row.opened
        clicked = row.clicked
        open_rate = round((opened / sent) * 100, 2) if sent > 0 else 0.0
        ctr = round((clicked / sent) * 100, 2) if sent > 0 else 0.0
        results.append({
            "template": row.template,
            "sent": sent,
            "opened": opened,
            "clicked": clicked,
            "bounced": row.bounced,
            "open_rate": open_rate,
            "ctr": ctr
        })

    return {"templates": results}



# ── ESP Webhook (open / click tracking) ──────────────────────────────────────

@router.post("/webhook")
async def esp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives open/click/bounce events from ESP (Resend or Zoho).
    Updates email_log rows for analytics.

    Protect this endpoint with an API secret in production:
    verify request headers against WEBHOOK_SECRET env var.
    """
    try:
        body = await request.json()
        event_type = body.get("type", "")
        message_id = body.get("data", {}).get("email_id") or body.get("message_id", "")

        if not message_id:
            return {"status": "ignored"}

        log_row = db.query(EmailLog).filter(
            EmailLog.esp_message_id == message_id
        ).first()

        if not log_row:
            return {"status": "not_found"}

        now = datetime.now(timezone.utc)
        if event_type in ("email.opened", "opened") and not log_row.opened_at:
            log_row.opened_at = now
        elif event_type in ("email.clicked", "clicked") and not log_row.clicked_at:
            log_row.clicked_at = now
        elif event_type in ("email.bounced", "bounced"):
            log_row.bounced = True
        elif event_type in ("email.complained", "complained"):
            log_row.unsubscribed = True

        db.commit()
        return {"status": "ok"}

    except Exception as e:
        logger.error("ESP webhook error: %s", e)
        return {"status": "error"}


# ── Unsubscribe confirmation page ─────────────────────────────────────────────

def _unsubscribe_page(username: str, group: str) -> str:
    group_label = {
        "marketing": "marketing and promotional emails",
        "weekly":    "the weekly digest",
        "challenges": "challenge announcement emails",
        "all":       "all non-essential emails",
    }.get(group, "these emails")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed — Monteeq</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #080808; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
    }}
    .card {{
      background: #0f0f0f; border: 1px solid #2e2e2e;
      border-radius: 12px; padding: 48px 40px; max-width: 480px;
      width: 100%; text-align: center;
    }}
    h1 {{ font-size: 22px; font-weight: 800; margin-bottom: 12px; }}
    p  {{ color: #8e8e93; font-size: 15px; line-height: 1.7; margin-bottom: 24px; }}
    a  {{
      display: inline-block; background: #ff3b30; color: #fff;
      padding: 12px 28px; border-radius: 8px; font-weight: 800;
      font-size: 14px; text-decoration: none; letter-spacing: 0.5px;
    }}
    .note {{ font-size: 13px; color: #48484a; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>You're unsubscribed, {username}.</h1>
    <p>We've removed you from {group_label}. You won't receive them anymore.</p>
    <a href="https://monteeq.com">Back to Monteeq</a>
    <p class="note">
      You'll still receive account security emails and important service notifications.
      You can update your preferences anytime in
      <a href="https://monteeq.com/settings/notifications" style="color:#ff3b30;background:none;padding:0;">Settings</a>.
    </p>
  </div>
</body>
</html>"""
