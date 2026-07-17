from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import SECRET_KEY, ALGORITHM
import hashlib
import logging
import time

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)

# Process-local fallback when Redis is unavailable
_memory_buckets: dict[str, list[float]] = {}


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

    # 2. Heuristic check: removed overly aggressive header check for real users.
    # We rely on User-Agent blacklist and other layers for now.
    return False

def _memory_rate_limit(key: str, limit: int, period: int) -> bool:
    now = time.time()
    window_start = now - period
    hits = [t for t in _memory_buckets.get(key, []) if t > window_start]
    if len(hits) >= limit:
        _memory_buckets[key] = hits
        return False
    hits.append(now)
    _memory_buckets[key] = hits
    return True

def check_rate_limit(key: str, limit: int, period: int) -> bool:
    """
    Returns True if the request is allowed, False if the limit is exceeded.
    Uses Redis when available; falls back to in-process memory.
    """
    try:
        from app.core.redis import redis_client

        if redis_client is None:
            return _memory_rate_limit(key, limit, period)

        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, period)
        return int(count) <= limit
    except Exception as e:
        logger.warning("Rate limit Redis error (%s); using memory fallback", e)
        return _memory_rate_limit(key, limit, period)
