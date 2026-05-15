import os
import sys

# Add backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.models.models import Video, VideoInteraction, Like, Comment, View, WatchLater, Repost, ChallengeEntry, Challenge, User
from app.core.storage import storage

def delete_all_videos():
    db = SessionLocal()
    try:
        videos = db.query(Video).all()
        print(f"Found {len(videos)} videos in database. Deleting metadata and S3 files...")

        # Clear S3 directories
        print("Clearing S3 prefix 'uploads/'...")
        storage.delete_prefix("uploads/")
        print("Clearing S3 prefix 'videos/'...")
        storage.delete_prefix("videos/")
        print("Clearing S3 prefix 'thumbnails/'...")
        storage.delete_prefix("thumbnails/")
        print("Clearing S3 prefix 'thumbs/'...")
        storage.delete_prefix("thumbs/")

        print("Deleting video metadata from database...")
        
        # Helper function to delete safely
        def safe_delete(model, filter_cond=None):
            try:
                query = db.query(model)
                if filter_cond is not None:
                    query = query.filter(filter_cond)
                query.delete()
            except Exception as ex:
                db.rollback()
                print(f"Skipping {model.__tablename__}: {ex}")

        # Reset Challenge entry counts
        challenges = db.query(Challenge).all()
        for c in challenges:
            c.entry_count = 0
            
        # Delete dependent records
        safe_delete(VideoInteraction)
        safe_delete(WatchLater)
        safe_delete(Repost, Repost.video_id.isnot(None))
        safe_delete(ChallengeEntry, ChallengeEntry.video_id.isnot(None))
        safe_delete(Like, Like.video_id.isnot(None))
        
        # For comments, handle self-referential replies before deleting root comments
        try:
            db.query(Comment).filter(Comment.video_id.isnot(None), Comment.parent_id.isnot(None)).delete()
            db.query(Comment).filter(Comment.video_id.isnot(None)).delete()
        except Exception as ex:
            db.rollback()
            print(f"Skipping comments: {ex}")
        
        safe_delete(View, View.video_id.isnot(None))
        
        # Finally delete videos
        safe_delete(Video)
        
        # Reset user upload counts
        try:
            db.query(User).update({"flash_uploads": 0, "home_uploads": 0})
        except Exception as ex:
            db.rollback()
            pass

        db.commit()
        print("✅ Successfully deleted all videos, associated metadata, and S3 files.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    delete_all_videos()
