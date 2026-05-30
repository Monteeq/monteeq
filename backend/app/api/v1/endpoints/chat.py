from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import os
import uuid
from app.core import config

from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models.models import User, Conversation, ChatMessage, UserDevicePrekeyBundle, UserOneTimePrekey

router = APIRouter()

@router.post("/keys", response_model=schemas.User)
def upload_public_key(
    key_in: schemas.KeyUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.public_key = key_in.public_key
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/keys/{username}")
def get_user_public_key(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"public_key": user.public_key}

from sqlalchemy.exc import IntegrityError

@router.post("/keys/prekey-bundle", response_model=schemas.PrekeyBundleOut)
def upload_prekey_bundle(
    bundle_in: schemas.PrekeyBundleUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if bundle already exists for this user and device
    bundle = db.query(UserDevicePrekeyBundle).filter(
        UserDevicePrekeyBundle.user_id == current_user.id,
        UserDevicePrekeyBundle.device_id == bundle_in.device_id
    ).first()
    
    if not bundle:
        bundle = UserDevicePrekeyBundle(
            user_id=current_user.id,
            device_id=bundle_in.device_id,
            identity_key=bundle_in.identity_key,
            signed_prekey=bundle_in.signed_prekey,
            signed_prekey_signature=bundle_in.signature
        )
        db.add(bundle)
    else:
        bundle.identity_key = bundle_in.identity_key
        bundle.signed_prekey = bundle_in.signed_prekey
        bundle.signed_prekey_signature = bundle_in.signature
        
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        bundle = db.query(UserDevicePrekeyBundle).filter(
            UserDevicePrekeyBundle.user_id == current_user.id,
            UserDevicePrekeyBundle.device_id == bundle_in.device_id
        ).first()
        if bundle:
            bundle.identity_key = bundle_in.identity_key
            bundle.signed_prekey = bundle_in.signed_prekey
            bundle.signed_prekey_signature = bundle_in.signature
            db.commit()
        else:
            raise HTTPException(status_code=500, detail="Database integrity error during bundle upload")
            
    db.refresh(bundle)
    
    # Store new one-time prekeys
    for otkey in bundle_in.one_time_prekeys:
        exists = db.query(UserOneTimePrekey).filter(
            UserOneTimePrekey.user_id == current_user.id,
            UserOneTimePrekey.device_id == bundle_in.device_id,
            UserOneTimePrekey.key_value == otkey
        ).first()
        if not exists:
            new_otk = UserOneTimePrekey(
                user_id=current_user.id,
                device_id=bundle_in.device_id,
                key_value=otkey,
                used=False
            )
            db.add(new_otk)
        
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        
    return schemas.PrekeyBundleOut(
        user_id=bundle.user_id,
        device_id=bundle.device_id,
        identity_key=bundle.identity_key,
        signed_prekey=bundle.signed_prekey,
        signature=bundle.signed_prekey_signature,
        one_time_prekey=None
    )

@router.get("/keys/prekey-bundle/{username}", response_model=List[schemas.PrekeyBundleOut])
def get_recipient_prekey_bundles(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recipient = db.query(User).filter(User.username == username).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
        
    bundles = db.query(UserDevicePrekeyBundle).filter(UserDevicePrekeyBundle.user_id == recipient.id).all()
    
    response_bundles = []
    for b in bundles:
        # Get one unused one-time prekey
        otk = db.query(UserOneTimePrekey).filter(
            UserOneTimePrekey.user_id == recipient.id,
            UserOneTimePrekey.device_id == b.device_id,
            UserOneTimePrekey.used == False
        ).first()
        
        otk_value = None
        if otk:
            otk_value = otk.key_value
            otk.used = True
            db.add(otk)
            
        response_bundles.append(
            schemas.PrekeyBundleOut(
                user_id=b.user_id,
                device_id=b.device_id,
                identity_key=b.identity_key,
                signed_prekey=b.signed_prekey,
                signature=b.signed_prekey_signature,
                one_time_prekey=otk_value
            )
        )
        
    db.commit()
    return response_bundles

@router.post("/keys/one-time-prekeys")
def upload_one_time_prekeys(
    keys_in: schemas.OneTimePrekeysUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    for key in keys_in.keys:
        otk = UserOneTimePrekey(
            user_id=current_user.id,
            device_id=keys_in.device_id,
            key_value=key,
            used=False
        )
        db.add(otk)
        
    db.commit()
    return {"status": "ok", "added": len(keys_in.keys)}

@router.get("/keys/devices")
def list_user_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all registered devices for the current user."""
    bundles = db.query(UserDevicePrekeyBundle).filter(
        UserDevicePrekeyBundle.user_id == current_user.id
    ).all()
    return [
        {
            "device_id": b.device_id,
            "created_at": b.created_at.isoformat() if b.created_at else None
        }
        for b in bundles
    ]

@router.delete("/keys/devices/{device_id}")
def revoke_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke a device by deleting its prekey bundle and associated one-time prekeys."""
    bundle = db.query(UserDevicePrekeyBundle).filter(
        UserDevicePrekeyBundle.user_id == current_user.id,
        UserDevicePrekeyBundle.device_id == device_id
    ).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Device not found")

    # Delete associated one-time prekeys
    db.query(UserOneTimePrekey).filter(
        UserOneTimePrekey.user_id == current_user.id,
        UserOneTimePrekey.device_id == device_id
    ).delete()

    db.delete(bundle)
    db.commit()
    return {"status": "ok", "device_id": device_id}

@router.post("/messages", response_model=schemas.ChatMessage)
def send_message(
    message_in: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find recipient
    recipient = db.query(User).filter(User.username == message_in.recipient_username).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    from sqlalchemy import and_
    # Find or create conversation
    conv = db.query(Conversation).filter(
        or_(
            and_(Conversation.user1_id == current_user.id, Conversation.user2_id == recipient.id),
            and_(Conversation.user1_id == recipient.id, Conversation.user2_id == current_user.id)
        )
    ).first()
    
    if not conv:
        conv = Conversation(user1_id=current_user.id, user2_id=recipient.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    
    # Create message
    message = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        encrypted_content=message_in.encrypted_content,
        iv=message_in.iv,
        recipient_key=message_in.recipient_key,
        sender_key=message_in.sender_key,
        message_type=message_in.message_type,
        attachment_url=message_in.attachment_url,
        file_metadata=message_in.file_metadata
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Real-time WebSocket push to both parties
    import asyncio
    from app.core.ws_manager import manager as ws_manager
    ws_payload = {
        "type": "new_message",
        "message": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "encrypted_content": message.encrypted_content,
            "iv": message.iv,
            "recipient_key": message.recipient_key,
            "sender_key": message.sender_key,
            "message_type": message.message_type,
            "attachment_url": message.attachment_url,
            "file_metadata": message.file_metadata,
            "created_at": message.created_at.isoformat()
        }
    }
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(ws_manager.broadcast_to_conversation(
            [current_user.id, recipient.id], ws_payload
        ))
    except Exception:
        pass  # WebSocket push is best-effort

    return message

@router.get("/conversations", response_model=List[schemas.Conversation])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conversations = db.query(Conversation).filter(
        or_(Conversation.user1_id == current_user.id, Conversation.user2_id == current_user.id)
    ).all()
    return conversations

@router.get("/messages/{conversation_id}", response_model=List[schemas.ChatMessage])
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if user is part of the conversation
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.user1_id != current_user.id and conv.user2_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these messages")
    
    messages = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation_id).order_by(ChatMessage.created_at.asc()).all()
    return messages

@router.post("/messages/ack")
def acknowledge_messages(
    message_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not message_ids:
        return {"status": "ok", "deleted": 0}

    # Find conversations the user belongs to
    user_conv_ids = [
        r[0] for r in db.query(Conversation.id).filter(
            (Conversation.user1_id == current_user.id) | (Conversation.user2_id == current_user.id)
        ).all()
    ]

    # Perform bulk delete on matching messages, bypassing session state sync warnings
    deleted_count = db.query(ChatMessage).filter(
        ChatMessage.id.in_(message_ids),
        ChatMessage.conversation_id.in_(user_conv_ids)
    ).delete(synchronize_session=False)

    db.commit()
    return {"status": "ok", "deleted": deleted_count}

@router.post("/upload", response_model=schemas.AttachmentResponse)
def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Ensure directory exists
    attachments_dir = os.path.join(config.STATIC_DIR, "chat_attachments")
    os.makedirs(attachments_dir, exist_ok=True)
    
    # Save file
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(attachments_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(file.file.read())
        
    url = f"{config.BASE_URL}/static/chat_attachments/{filename}"
    return {"url": url, "filename": file.filename}
