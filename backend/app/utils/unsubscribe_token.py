"""
Unsubscribe token utility for Monteeq email links.

Each email footer contains a one-click unsubscribe link:
  https://monteeq.com/api/v1/email/unsubscribe?token=<TOKEN>

The token is an HMAC-signed payload:  base64(user_id:template_group:ts)
No database lookup needed to verify — stateless.
"""

import base64
import hashlib
import hmac
import time
from typing import Optional

from app.core.config import SECRET_KEY

_SEP = ":"


def _sign(payload: str) -> str:
    return hmac.new(
        SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]


def generate_unsubscribe_token(user_id: int, group: str = "marketing") -> str:
    """
    Generate a signed unsubscribe token.

    group options:
      'marketing'  — weekly digest, tips, platform news
      'social'     — likes, followers, comments
      'challenges' — challenge emails
      'all'        — everything except P0 transactional
    """
    ts      = int(time.time())
    payload = f"{user_id}{_SEP}{group}{_SEP}{ts}"
    sig     = _sign(payload)
    raw     = f"{payload}{_SEP}{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_unsubscribe_token(token: str, max_age_days: int = 30) -> Optional[tuple[int, str]]:
    """
    Verify token and return (user_id, group) or None if invalid/expired.
    """
    try:
        raw     = base64.urlsafe_b64decode(token.encode()).decode()
        parts   = raw.split(_SEP)
        if len(parts) != 4:
            return None
        user_id_str, group, ts_str, provided_sig = parts
        payload  = f"{user_id_str}{_SEP}{group}{_SEP}{ts_str}"
        expected = _sign(payload)
        if not hmac.compare_digest(expected, provided_sig):
            return None
        age = time.time() - int(ts_str)
        if age > max_age_days * 86400:
            return None
        return int(user_id_str), group
    except Exception:
        return None
