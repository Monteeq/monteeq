from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import logging

from app.db.session import get_db
from app.models.models import User, PartnerLead
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.utils.emails import send_email
from app.core import config

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/brief", response_model=schemas.PartnerLead)
async def submit_partner_brief(
    payload: schemas.PartnerLeadCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for brands to submit campaign briefs.
    Saves to DB and sends an email notification to the admin.
    """
    lead = PartnerLead(
        brand_name=payload.brand_name,
        contact_email=payload.contact_email,
        campaign_type=payload.campaign_type,
        details=payload.details
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Notify Admin via Email
    message = (
        f"New Partnership Brief from {payload.brand_name}.\n\n"
        f"Contact: {payload.contact_email}\n"
        f"Campaign Type: {payload.campaign_type}\n"
        f"Details: {payload.details}\n\n"
        "You can view and manage this lead in the Admin Dashboard."
    )
    
    background_tasks.add_task(
        send_email,
        to_email=config.SMTP_USER, # Send to the configured admin email
        subject=f"New Partner Lead: {payload.brand_name}",
        title="New Campaign Brief Received",
        message=message,
        action_text="View in Dashboard",
        action_url="/admin/partners" # Hypothetical admin path
    )

    return lead

@router.get("/admin/leads", response_model=List[schemas.PartnerLead])
def get_partner_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin-only endpoint to list all partnership leads.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return db.query(PartnerLead).order_by(PartnerLead.created_at.desc()).all()

@router.put("/admin/leads/{lead_id}", response_model=schemas.PartnerLead)
def update_lead_status(
    lead_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin-only endpoint to update the status of a lead.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    lead = db.query(PartnerLead).filter(PartnerLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead.status = status
    db.commit()
    db.refresh(lead)
    return lead
