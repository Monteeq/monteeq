#!/usr/bin/env python3
"""Backfill visual_embedding for existing media_analysis rows.

Queries media_analysis rows where visual_embedding IS NULL but
frame_sample_paths IS NOT NULL (i.e. the frames exist but the CLIP
embedding was never computed), runs CLIP encode, and writes the result.

Dry-run by default.  Pass --apply to execute.

Usage:
    python scripts/backfill_visual_embeddings.py          # dry-run
    python scripts/backfill_visual_embeddings.py --apply  # execute
    python scripts/backfill_visual_embeddings.py --batch-size 20
"""
import logging
import os
import sys
import time
from argparse import ArgumentParser

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text

from app.core.config import DATABASE_URL
from app.db.session import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill_visual_embeddings")


def count_pending(db) -> int:
    return db.execute(
        text(
            "SELECT COUNT(*) FROM media_analysis "
            "WHERE status = 'done' "
            "AND visual_embedding IS NULL "
            "AND frame_sample_paths IS NOT NULL"
        )
    ).scalar()


def fetch_batch(db, offset: int, limit: int):
    return db.execute(
        text(
            "SELECT video_id, frame_sample_paths FROM media_analysis "
            "WHERE status = 'done' "
            "AND visual_embedding IS NULL "
            "AND frame_sample_paths IS NOT NULL "
            "ORDER BY video_id "
            "LIMIT :lim OFFSET :off"
        ),
        {"lim": limit, "off": offset},
    ).fetchall()


def main():
    parser = ArgumentParser(description="Backfill visual_embedding for existing media_analysis rows")
    parser.add_argument("--apply", action="store_true", help="Execute updates (default is dry-run)")
    parser.add_argument("--batch-size", type=int, default=10, help="Rows to process per batch")
    parser.add_argument("--sleep", type=float, default=1.0, help="Seconds between batches to avoid hammering CLIP/S3")
    args = parser.parse_args()

    print("=== Backfill visual_embedding ===\n")

    db = SessionLocal()
    try:
        total = count_pending(db)
        print(f"Found {total} media_analysis rows missing visual_embedding\n")

        if total == 0:
            print("Nothing to backfill.")
            return

        processed = 0
        errors = 0
        offset = 0

        while offset < total:
            rows = fetch_batch(db, offset, args.batch_size)
            if not rows:
                break

            for row in rows:
                video_id = row[0]
                frame_s3_keys = row[1]
                logger.info(
                    "[%d/%d] Processing video %s (%d frames)",
                    offset + 1, total, video_id, len(frame_s3_keys) if frame_s3_keys else 0,
                )

                if args.apply:
                    try:
                        from app.services.media_analysis import generate_visual_embedding
                        from app.services.pgvector_utils import vector_to_str

                        visual_vec = generate_visual_embedding(frame_s3_keys)
                        if visual_vec is None:
                            logger.warning("  -> Could not produce embedding for video %s (skipping)", video_id)
                            errors += 1
                            offset += 1
                            continue

                        db.execute(
                            text(
                                "UPDATE media_analysis "
                                "SET visual_embedding = :vec, updated_at = now() "
                                "WHERE video_id = :vid"
                            ),
                            {"vec": vector_to_str(visual_vec), "vid": video_id},
                        )
                        db.commit()
                        processed += 1
                    except Exception as e:
                        db.rollback()
                        logger.exception("  -> Failed for video %s: %s", video_id, e)
                        errors += 1
                else:
                    # dry-run: just log
                    print(f"  Would process video {video_id} ({len(frame_s3_keys) or 0} frames)")
                    processed += 1

                offset += 1

            if args.sleep and args.apply and offset < total:
                time.sleep(args.sleep)

        print()
        print("=== Summary ===")
        print(f"  Total pending: {total}")
        print(f"  Processed:     {processed}")
        print(f"  Errors:        {errors}")
        if args.apply:
            print("  Backfill complete.")
        else:
            print("  Dry-run complete. Re-run with --apply to execute.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
