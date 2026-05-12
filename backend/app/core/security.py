from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import SECRET_KEY, ALGORITHM

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

import hashlib

def verify_password(plain_password, hashed_password):
    try:
        if pwd_context.verify(plain_password, hashed_password):
            return True
    except ValueError:
        # Password too long for bcrypt, try pre-hashed version
        pass
    
    # Try verifying with pre-hashed password (for new users or long passwords)
    # We use SHA256 hexdigest as the input to bcrypt, which is always 64 chars
    pre_hashed = hashlib.sha256(plain_password.encode()).hexdigest()
    return pwd_context.verify(pre_hashed, hashed_password)

def get_password_hash(password):
    # Always pre-hash new passwords to support arbitrary length
    pre_hashed = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(pre_hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def is_bot(request) -> bool:
    """
    Heuristic-based bot detection.
    Checks User-Agent, missing standard headers, and known headless browser patterns.
    """
    user_agent = request.headers.get("User-Agent", "").lower()
    
    # 1. Extensive User-Agent Blacklist
    bot_keywords = [
        "bot", "crawler", "spider", "slurp", "headless",
        "phantom", "selenium", "puppeteer", "playwright", "python", "curl", "wget",
        "postman", "insomnia", "scrapy", "ahrefs", "semrush", "majestic",
        "dotbot", "rogerbot", "exabot", "gigabot", "yandex", "baiduspider", "petalbot"
    ]
    
    # Legit crawlers to allowlist
    legit_crawlers = ["googlebot", "bingbot", "google-site-verification", "adsbot-google", "bingpreview"]
    
    if any(keyword in user_agent for keyword in bot_keywords):
        # Double check if it's a legit one
        if any(legit in user_agent for legit in legit_crawlers):
            return False
        return True
    
    # 2. Headless Detection: Headless browsers often omit certain headers
    # Legitimate browsers usually have Sec-CH-UA or Accept-Language
    # Note: This might block very old browsers, but for Monteeq it's acceptable.
    if not request.headers.get("Accept-Language") and not request.headers.get("Sec-CH-UA"):
        # Very suspicious for a real user
        return True
        
    # 3. Automation-specific headers
    if request.headers.get("X-Selenium-Driver") or request.headers.get("X-Puppeteer-Session"):
        return True
        
    return False

def check_rate_limit(key: str, limit: int, period: int) -> bool:
    """
    Rate limiting has been disabled per user request.
    Always returns True.
    """
    return True
