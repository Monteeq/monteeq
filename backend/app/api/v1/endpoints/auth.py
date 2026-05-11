from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests

from app.db.session import get_db
from app.core import security, config
from app.crud import user as crud_user
from app.schemas import schemas
from app.models.models import User, UserSession
from app.services.email_service import send_verification_email
import hashlib

router = APIRouter()

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    request: Request,
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    # Rate Limit: 10 attempts per minute per IP
    if not security.check_rate_limit(f"ratelimit:login:{request.client.host}", 10, 60):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please wait.")

    # Support login by username OR email
    user = crud_user.get_user_by_username(db, username=form_data.username)
    if not user:
        user = crud_user.get_user_by_email(db, email=form_data.username)
        
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    

    if getattr(user, 'two_factor_enabled', False) is True:
        methods = ["totp"]
        if user.recovery_codes:
            methods.append("recovery_code")
        return {"two_factor_required": True, "username": user.username, "methods": methods}

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Create Session
    token_hash = hashlib.sha256(access_token.encode()).hexdigest()
    new_session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        device_info="Mock Device (Browser)", 
        ip_address="127.0.0.1"
    )
    db.add(new_session)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

@router.post("/register", response_model=schemas.VerificationResponse)
def register_user(request: Request, user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Rate Limit: 3 registrations per hour per IP (very strict)
    if not security.check_rate_limit(f"ratelimit:register:{request.client.host}", 3, 3600):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please wait.")

    db_user = crud_user.get_user_by_email(db, email=user_in.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = crud_user.get_user_by_username(db, username=user_in.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = crud_user.create_user(db, user=user_in, is_onboarded=True, ip_address=request.client.host)
    user.is_verified = False # Mandatory verification
    db.commit()
    
    # Generate and send verification code
    code = crud_user.create_verification_code(db, email=user.email)
    try:
        send_verification_email(user.email, code)
    except Exception as e:
        print(f"Failed to send email: {e}")
        # We don't fail registration if email sending fails in dev, but in prod we might
    
    db.refresh(user)
    
    return {
        "message": "Registration successful. Welcome to Monteeq!",
        "email": user.email,
        "username": user.username
    }

@router.post("/verify-email", response_model=schemas.VerificationResponse)
def verify_email(data: schemas.EmailVerification, db: Session = Depends(get_db)):
    if crud_user.verify_code(db, email=data.email, code=data.code):
        user = crud_user.get_user_by_email(db, email=data.email)
        if user:
            # Update is_verified
            user.is_verified = True
            db.commit()
            db.refresh(user)
            return {"message": "Email verified successfully", "username": user.username}
    
    raise HTTPException(status_code=400, detail="Invalid or expired verification code")

@router.post("/resend-verification", response_model=schemas.VerificationResponse)
def resend_verification(data: schemas.ResendVerification, db: Session = Depends(get_db)):
    """Resend the email verification code. Rate-limited by code expiry."""
    user = crud_user.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not registered")
    
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified.")
    
    code = crud_user.create_verification_code(db, email=data.email)
    send_verification_email(data.email, code)
    
    return {
        "message": "A new verification code has been sent to your email.",
        "email": data.email,
        "username": user.username
    }

@router.post("/google", response_model=schemas.Token)
async def google_auth(request: Request, auth_data: schemas.UserGoogleAuth, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            auth_data.credential, requests.Request(), config.GOOGLE_CLIENT_ID
        )
        email = idinfo['email']
        google_id = idinfo['sub']
        name = idinfo.get('name', email.split('@')[0])
        picture = idinfo.get('picture')
        
        user = crud_user.get_user_by_email(db, email=email)
        if not user:
            # Generate a temporary unique username
            base_username = name.lower().replace(" ", "")
            if not base_username:
                base_username = "user"
            username = base_username
            suffix = 1
            while crud_user.get_user_by_username(db, username=username):
                username = f"{base_username}{suffix}"
                suffix += 1
            
            user_create = schemas.UserCreate(
                username=username, 
                email=email, 
                full_name=name,
                profile_pic=picture,
                password=None # Google auth users don't have passwords
            )
            # Google users are auto-verified
            user = crud_user.create_user(db, user=user_create, google_id=google_id, is_onboarded=False, ip_address=request.client.host)
            user.is_verified = True
            db.commit()
            db.refresh(user)
        else:
            # If user exists but is trying to 'sign up' with Google, we might want to distinguish.
            # But the requirement is: "if the email was registered, tell him to login"
            # If they are using the Google auth flow, they ARE logging in.
            # However, if they don't have a google_id, they originally signed up with a password.
            if not user.google_id:
                # This matches "tell him to login" (using his password)
                raise HTTPException(
                    status_code=400, 
                    detail="Email already registered with password. Please log in with your credentials."
                )
            
            if picture and not user.profile_pic:
                user.profile_pic = picture
            
            user.is_verified = True
            db.commit()
            db.refresh(user)

        if getattr(user, 'two_factor_enabled', False) is True:
            methods = ["totp"]
            if user.recovery_codes:
                methods.append("recovery_code")
            return {"two_factor_required": True, "username": user.username, "methods": methods}

        access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        # Create Session
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()
        new_session = UserSession(
            user_id=user.id,
            token_hash=token_hash,
            device_info="Google Auth Device", 
            ip_address="127.0.0.1"
        )
        db.add(new_session)
        db.commit()
        
        return {"access_token": access_token, "token_type": "bearer", "username": user.username}
        
    except ValueError as e:
        print(f"Google Auth Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")

@router.post("/verify-2fa", response_model=schemas.Token)
def verify_login_2fa(
    data: schemas.TokenData, # Reusing schemas to avoid new ones
    db: Session = Depends(get_db)
):
    """Verify TOTP code for login."""
    if not data.username or not data.code:
        raise HTTPException(status_code=400, detail="Missing username or code")
    
    user = crud_user.get_user_by_username(db, username=data.username)
    if not user or not user.totp_secret:
         raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    import pyotp
    import json
    
    is_valid = False
    
    # Try TOTP
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(data.code):
        is_valid = True
    
    # Try Recovery Codes
    if not is_valid and user.recovery_codes:
        codes = json.loads(user.recovery_codes)
        hashed_input = hashlib.sha256(data.code.replace("-", "").upper().encode()).hexdigest()
        if hashed_input in codes:
            is_valid = True
            # Consume the code
            codes.remove(hashed_input)
            user.recovery_codes = json.dumps(codes)
            db.commit()
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid verification code")
    
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Create Session
    token_hash = hashlib.sha256(access_token.encode()).hexdigest()
    new_session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        device_info="2FA Verified Device", 
        ip_address="127.0.0.1"
    )
    db.add(new_session)
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

@router.post("/forgot-password")
def forgot_password(data: schemas.ResendVerification, db: Session = Depends(get_db)):
    """Send a secure reset link."""
    user = crud_user.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    
    import secrets
    from datetime import datetime, timedelta
    from app.models.models import VerificationCode
    
    token = secrets.token_urlsafe(32)
    # Delete existing tokens for this email
    db.query(VerificationCode).filter(VerificationCode.email == user.email).delete()
    
    # Store token in VerificationCode table (it's a String column)
    # Reset links usually last longer than OTPs (e.g., 1 hour)
    expires_at = datetime.now() + timedelta(hours=1)
    db_code = VerificationCode(email=user.email, code=token, expires_at=expires_at)
    db.add(db_code)
    db.commit()

    try:
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(user.email, token)
    except Exception:
        pass
    
    return {"message": "A secure reset link has been sent to your email."}

@router.post("/reset-password")
def reset_password(data: schemas.PasswordReset, db: Session = Depends(get_db)):
    """Verify link token and update password."""
    # We reuse verify_code logic which checks code (token) and expiry
    if crud_user.verify_code(db, email=data.email, code=data.code):
        user = crud_user.get_user_by_email(db, email=data.email)
        if user:
            user.hashed_password = security.get_password_hash(data.new_password)
            db.commit()
            return {"message": "Password updated successfully. You can now log in."}
    
    raise HTTPException(status_code=400, detail="Invalid or expired reset link")

@router.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_username(db, username=username)
    return {"available": user is None}

@router.get("/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, email=email)
    return {"available": user is None}

@router.get("/check-email-exists")
def check_email_exists(email: str, db: Session = Depends(get_db)):
    """Check if an email is registered."""
    user = crud_user.get_user_by_email(db, email=email)
    return {"exists": user is not None}
