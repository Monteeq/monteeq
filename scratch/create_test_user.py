import sys
import os
import json
import hashlib
import pyotp
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append('/home/smasduq/montage/backend')

from app.db.session import SessionLocal
from app.models.models import User
from app.core import security

def create_2fa_user():
    db = SessionLocal()
    try:
        username = "test2fa"
        email = "test2fa@example.com"
        password = "Password123!" # Meets complexity requirements
        
        # Check if exists
        user = db.query(User).filter(User.username == username).first()
        if user:
            db.delete(user)
            db.commit()
        
        hashed_password = security.get_password_hash(password)
        secret = pyotp.random_base32()
        
        # Recovery codes
        codes = []
        hashed_codes = []
        for _ in range(3):
            code = "TEST-CODE-" + str(_)
            codes.append(code)
            clean_code = code.upper().replace("-", "")
            hashed_codes.append(hashlib.sha256(clean_code.encode()).hexdigest())
            
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            is_verified=True,
            two_factor_enabled=True,
            totp_secret=secret,
            recovery_codes=json.dumps(hashed_codes)
        )
        db.add(user)
        db.commit()
        
        print(f"User created: {username}")
        print(f"Password: {password}")
        print(f"TOTP Secret: {secret}")
        print(f"Recovery Codes: {codes}")
        
        # Generate current TOTP
        totp = pyotp.TOTP(secret)
        print(f"Current TOTP: {totp.now()}")
        
    finally:
        db.close()

if __name__ == "__main__":
    create_2fa_user()
