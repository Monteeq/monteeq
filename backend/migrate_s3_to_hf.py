"""
migrate_s3_to_hf.py
-------------------
Migrates all objects from AWS S3 (monteeq-2) to a Hugging Face Storage Bucket.
Streams data directly between the two — no local disk required.

Usage:
    python migrate_s3_to_hf.py [--prefix videos/] [--dry-run]

Requirements:
    pip install boto3 tqdm python-dotenv
"""

import argparse
import logging
import os
import sys

from dotenv import load_dotenv
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# Load credentials from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── CONFIG ───────────────────────────────────────────────────────────────────

# SOURCE: AWS S3 — loaded automatically from .env
AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_BUCKET            = os.getenv("AWS_STORAGE_BUCKET_NAME", "monteeq-2")
AWS_REGION            = os.getenv("AWS_S3_REGION_NAME", "eu-central-1")

# DESTINATION: Hugging Face Storage Bucket
# Get these from: https://huggingface.co/settings/tokens → Generate S3 credentials
HF_ACCESS_KEY_ID      = "HFAKYf0n48jLtMggbVKWtroTkbLor6K"
HF_SECRET_ACCESS_KEY  = "efa9b3e2c8c9246b573394c344cb1349608af35d855384f75d5fce3972b209c9"
HF_ENDPOINT           = "https://s3.hf.co/MonteeqOrg"
HF_BUCKET             = "backend-storage"
HF_REGION             = "us-east-1"

# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def build_aws_client():
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
    )


def build_hf_client():
    return boto3.client(
        "s3",
        aws_access_key_id=HF_ACCESS_KEY_ID,
        aws_secret_access_key=HF_SECRET_ACCESS_KEY,
        endpoint_url=HF_ENDPOINT,
        region_name=HF_REGION,
        config=Config(s3={"addressing_style": "path"}),
    )


def list_all_objects(s3_client, bucket: str, prefix: str = ""):
    """Paginate through all objects in the bucket, yielding each object dict."""
    paginator = s3_client.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
    for page in pages:
        for obj in page.get("Contents", []):
            yield obj


def object_exists_in_hf(hf_client, key: str) -> bool:
    """Check if an object already exists in the HF bucket (for resume support)."""
    try:
        hf_client.head_object(Bucket=HF_BUCKET, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def migrate_object(aws_client, hf_client, key: str, size: int, dry_run: bool):
    """Stream a single object from AWS S3 to HF Storage."""
    if dry_run:
        logger.info(f"[DRY-RUN] Would copy: {key} ({size / 1024 / 1024:.2f} MB)")
        return True

    try:
        # Stream from AWS
        response = aws_client.get_object(Bucket=AWS_BUCKET, Key=key)
        body = response["Body"]
        content_type = response.get("ContentType", "application/octet-stream")

        # Upload to HF
        hf_client.upload_fileobj(
            body,
            HF_BUCKET,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return True
    except Exception as e:
        logger.error(f"  ✗ Failed: {key} — {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Migrate AWS S3 → HF Storage Bucket")
    parser.add_argument("--prefix", default="", help="Only migrate keys with this prefix (e.g. 'videos/')")
    parser.add_argument("--dry-run", action="store_true", help="List files without copying")
    parser.add_argument("--skip-existing", action="store_true", default=True, help="Skip files already in HF (default: True)")
    args = parser.parse_args()

    if not args.dry_run and not AWS_ACCESS_KEY_ID:
        logger.error("❌ AWS credentials not found. Make sure .env has AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.")
        sys.exit(1)

    if not args.dry_run and not HF_ACCESS_KEY_ID:
        logger.error("❌ Please fill in your HF credentials in the script before running.")
        sys.exit(1)

    logger.info("Connecting to AWS S3...")
    aws = build_aws_client()

    if not args.dry_run:
        logger.info("Connecting to HF Storage Bucket...")
        hf = build_hf_client()
    else:
        hf = None

    logger.info(f"Listing objects in s3://{AWS_BUCKET}/{args.prefix} ...")
    objects = list(list_all_objects(aws, AWS_BUCKET, prefix=args.prefix))
    total_size = sum(o["Size"] for o in objects)

    logger.info(f"Found {len(objects)} objects ({total_size / 1024 / 1024:.1f} MB total)")

    if args.dry_run:
        for obj in objects:
            logger.info(f"  {obj['Key']}  ({obj['Size'] / 1024:.1f} KB)")
        return

    success = 0
    skipped = 0
    failed = 0

    iterator = tqdm(objects, unit="file") if HAS_TQDM else objects

    for obj in iterator:
        key = obj["Key"]
        size = obj["Size"]

        if args.skip_existing and object_exists_in_hf(hf, key):
            if HAS_TQDM:
                iterator.set_postfix_str(f"SKIP {key[:40]}")
            else:
                logger.info(f"  → Skipping (exists): {key}")
            skipped += 1
            continue

        if HAS_TQDM:
            iterator.set_postfix_str(f"COPY {key[:40]}")
        else:
            logger.info(f"  → Copying: {key} ({size / 1024:.1f} KB)")

        ok = migrate_object(aws, hf, key, size, dry_run=False)
        if ok:
            success += 1
        else:
            failed += 1

    logger.info("\n── Migration Complete ─────────────────────────────")
    logger.info(f"  ✓ Copied:  {success}")
    logger.info(f"  → Skipped: {skipped}")
    logger.info(f"  ✗ Failed:  {failed}")

    if failed > 0:
        logger.warning(f"\n{failed} files failed. Re-run the script to retry (--skip-existing will skip successful ones).")
        sys.exit(1)


if __name__ == "__main__":
    main()
