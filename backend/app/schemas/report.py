from pydantic import BaseModel, ConfigDict
from typing import Optional, Union
from datetime import datetime

class ReportCreate(BaseModel):
    content_type: str  # "video", "flash", "post", "comment"
    content_id: Union[int, str]  # Can be string public_id (for videos/flash) or integer ID
    reason: str  # spam, harassment, hate, violence, copyright, sexual, scam, other
    description: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reporter_username: Optional[str] = None
    content_type: str
    content_id: Union[int, str]
    reason: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    resolver_username: Optional[str] = None
    notes: Optional[str] = None
    
    # Extra fields for previewing reported content
    reported_content_preview: Optional[str] = None
    reported_content_creator: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReportAction(BaseModel):
    action: str  # "dismiss", "resolve", "delete_content", "suspend_user"
    notes: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: int
    action: str
    moderator_id: Optional[int] = None
    moderator_username: Optional[str] = None
    target_type: str
    target_id: str
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
