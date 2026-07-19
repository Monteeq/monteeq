"""One-off: delete videos with status='failed' and related rows."""
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text, inspect
from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

CANDIDATE_TABLES = [
    "views",
    "likes",
    "comments",
    "challenge_entries",
    "reposts",
    "watch_later",
    "video_interactions",
    "content_reports",
    "watch_history",
    "library_watch_later",
    "liked_videos",
]


def main():
    insp = inspect(engine)

    with engine.connect() as c:
        rows = c.execute(
            text("SELECT status, COUNT(*) AS n FROM videos GROUP BY status ORDER BY n DESC")
        ).fetchall()
        print("STATUS COUNTS:")
        for r in rows:
            print(f"  {r[0]!r}: {r[1]}")

        failed_total = c.execute(
            text("SELECT COUNT(*) FROM videos WHERE status = 'failed'")
        ).scalar()
        print(f"FAILED TOTAL: {failed_total}")
        if not failed_total:
            return

    with engine.begin() as c:
        pinned = c.execute(
            text(
                "UPDATE users SET pinned_video_id = NULL "
                "WHERE pinned_video_id IN (SELECT id FROM videos WHERE status = 'failed')"
            )
        )
        print(f"Cleared pinned_video_id on users: {pinned.rowcount}")

        for table in CANDIDATE_TABLES:
            if not insp.has_table(table):
                print(f"Skip {table}: table missing")
                continue
            cols = {col["name"] for col in insp.get_columns(table)}
            if "video_id" not in cols:
                print(f"Skip {table}: no video_id column")
                continue
            res = c.execute(
                text(
                    f"DELETE FROM {table} WHERE video_id IN "
                    f"(SELECT id FROM videos WHERE status = 'failed')"
                )
            )
            print(f"Deleted from {table}: {res.rowcount}")

        deleted = c.execute(text("DELETE FROM videos WHERE status = 'failed'"))
        print(f"Deleted failed videos: {deleted.rowcount}")

    with engine.connect() as c:
        left = c.execute(text("SELECT COUNT(*) FROM videos WHERE status = 'failed'")).scalar()
        print(f"Remaining failed: {left}")
        rows = c.execute(
            text("SELECT status, COUNT(*) AS n FROM videos GROUP BY status ORDER BY n DESC")
        ).fetchall()
        print("STATUS COUNTS AFTER:")
        for r in rows:
            print(f"  {r[0]!r}: {r[1]}")


if __name__ == "__main__":
    main()
