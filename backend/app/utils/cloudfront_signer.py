"""
CloudFront signed URL generation for direct CDN video streaming.

Uses a custom policy with a path wildcard so the signed URL covers:
  - The master manifest (master.m3u8)
  - All segment files (.ts/.m4s) referenced by the manifest

AWS requires SHA-1 for CloudFront signing (hard requirement, not a choice).
"""

import re
import logging
from datetime import datetime, timezone
from urllib.parse import quote

from app.core import config

logger = logging.getLogger(__name__)


def _rsa_signer(message: bytes) -> bytes:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    private_key = serialization.load_pem_private_key(
        config.CLOUDFRONT_PRIVATE_KEY.encode(), password=None
    )
    return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())


def _get_signer():
    from botocore.signers import CloudFrontSigner
    return CloudFrontSigner(config.CLOUDFRONT_KEY_PAIR_ID, _rsa_signer)


def generate_signed_url(resource_url: str, expires_in_seconds: int = 21600) -> str:
    """
    Generate a CloudFront signed URL with a custom policy.

    The policy covers the video's directory path with a wildcard (*),
    so the manifest AND all segment files are accessible with one signature.

    Args:
        resource_url: Full CDN URL to the master manifest, e.g.
            https://d123.cloudfront.net/videos/123/hls/master.m3u8
        expires_in_seconds: Time until the signed URL expires (default 6h).

    Returns:
        Signed URL string.
    """
    signer = _get_signer()

    # Build wildcard resource: replace the filename with *
    # https://d123.cloudfront.net/videos/123/hls/master.m3u8
    #   → https://d123.cloudfront.net/videos/123/hls/*
    base_path = re.sub(r'[^/]+\.m3u8$', '*', resource_url)

    expiration = datetime.now(timezone.utc).timestamp() + expires_in_seconds
    expiration_dt = datetime.fromtimestamp(expiration, tz=timezone.utc)

    policy = signer.build_policy(
        resource=base_path,
        date_less_than=expiration_dt,
    )

    return signer.generate_presigned_url(
        resource_url,
        policy=policy,
    )


def is_cloudfront_configured() -> bool:
    """Check if CloudFront signing is configured."""
    return bool(config.CLOUDFRONT_KEY_PAIR_ID and config.CLOUDFRONT_PRIVATE_KEY)
