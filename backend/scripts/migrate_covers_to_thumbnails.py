#!/usr/bin/env python3
"""Migrate S3 objects from covers/ to thumbnails/ and patch DB URLs.

Run from the backend/ directory:
    python scripts/migrate_covers_to_thumbnails.py

Dry-run by default.  Pass --apply to execute.
"""
import sys, os, argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core import config
from app.core.storage import storage
from app.db.session import SessionLocal
from sqlalchemy import text

BUCKET = config.AWS_STORAGE_BUCKET_NAME
SRC_PREFIX = "covers/"
DST_PREFIX = "thumbnails/"


def list_s3_keys(prefix: str) -> list[str]:
    keys = []
    paginator = storage.s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def copy_s3_object(src_key: str, dst_key: str):
    copy_source = {"Bucket": BUCKET, "Key": src_key}
    storage.s3_client.copy_object(
        Bucket=BUCKET, CopySource=copy_source, Key=dst_key
    )


def delete_s3_object(key: str):
    storage.s3_client.delete_object(Bucket=BUCKET, Key=key)


def patch_db_urls(db):
    """Replace covers/ with thumbnails/ in thumbnail_url and cover_url columns."""
    for col in ("thumbnail_url", "cover_url"):
        result = db.execute(
            text(f"SELECT id, {col} FROM videos WHERE {col} LIKE :pat"),
            {"pat": f"%/{SRC_PREFIX}%"},
        ).fetchall()
        for row in result:
            old_url = getattr(row, col)
            new_url = old_url.replace(f"/{SRC_PREFIX}", f"/{DST_PREFIX}")
            db.execute(
                text(f"UPDATE videos SET {col} = :new WHERE id = :id"),
                {"new": new_url, "id": row.id},
            )
            print(f"  DB [{col}] video {row.id}: {old_url} -> {new_url}")
    db.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Execute (default is dry-run)")
    args = parser.parse_args()

    apply = args.apply
    mode = "APPLY" if apply else "DRY-RUN"

    print(f"=== Migrate covers/ -> thumbnails/  [{mode}] ===\n")

    # 1) S3 migration
    keys = list_s3_keys(SRC_PREFIX)
    print(f"Found {len(keys)} objects under s3://{BUCKET}/{SRC_PREFIX}\n")

    for key in keys:
        dst_key = DST_PREFIX + key[len(SRC_PREFIX):]
        print(f"  {key} -> {dst_key}")
        if apply:
            copy_s3_object(key, dst_key)
            delete_s3_object(key)

    # 2) DB URL patching
    print("\nPatching database URLs...")
    db = SessionLocal()
    try:
        if apply:
            patch_db_urls(db)
        else:
            for col in ("thumbnail_url", "cover_url"):
                result = db.execute(
                    text(f"SELECT id, {col} FROM videos WHERE {col} LIKE :pat"),
                    {"pat": f"%/{SRC_PREFIX}%"},
                ).fetchall()
                for row in result:
                    old_url = getattr(row, col)
                    new_url = old_url.replace(f"/{SRC_PREFIX}", f"/{DST_PREFIX}")
                    print(f"  DB [{col}] video {row.id}: {old_url} -> {new_url}")
                print(f"  ({len(result)} rows would be patched in [{col}])")

        # Also patch cover_s3_key on upload_jobs (S3 keys, not full URLs)
        src_key_pattern = f"{SRC_PREFIX}%"
        result = db.execute(
            text("SELECT id, cover_s3_key FROM upload_jobs WHERE cover_s3_key LIKE :pat"),
            {"pat": src_key_pattern},
        ).fetchall()
        for row in result:
            old_key = row.cover_s3_key
            new_key = DST_PREFIX + old_key[len(SRC_PREFIX):]
            if apply:
                db.execute(
                    text("UPDATE upload_jobs SET cover_s3_key = :new WHERE id = :id"),
                    {"new": new_key, "id": row.id},
                )
            print(f"  DB [cover_s3_key] job {row.id}: {old_key} -> {new_key}")
        print(f"  ({len(result)} upload_job rows with covers/ key)")
        if apply:
            db.commit()
    finally:
        db.close()

    print(f"\nDone. {'Objects moved and DB patched.' if apply else 'Dry-run complete. Re-run with --apply.'}")


if __name__ == "__main__":
    main()
