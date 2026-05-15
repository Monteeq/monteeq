from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import SECRET_KEY, ALGORITHM
from app.models import models
from app.schemas import schemas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import User

async def get_current_user(
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Fetch user from DB
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    from datetime import datetime, timezone
    if user.is_premium and user.premium_expires_at:
        if user.premium_expires_at < datetime.now(timezone.utc):
            user.is_premium = False
            db.commit()
            
    return user

async def get_current_user_optional(
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme_optional)
):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    
    # Fetch user from DB
    user = db.query(User).filter(User.username == username).first()
    
    if user:
        from datetime import datetime, timezone
        if user.is_premium and user.premium_expires_at:
            if user.premium_expires_at < datetime.now(timezone.utc):
                user.is_premium = False
                db.commit()
                
    return user


def role_checker(allowed_roles: list):
    def checker(current_user: dict = Depends(get_current_user)):
        # Handle dict or model
        role = current_user.get("role") if isinstance(current_user, dict) else getattr(current_user, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return checker

admin_only = role_checker(["admin"])

