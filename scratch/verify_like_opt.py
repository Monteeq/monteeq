import sys
import os
from unittest.mock import patch, MagicMock

# Add backend to path
sys.path.append('/home/smasduq/montage/backend')

from app.db.session import SessionLocal
from app.models.models import User, Video, Like

def verify_like_optimization():
    db = SessionLocal()
    try:
        # 1. Setup
        user = db.query(User).first()
        video = db.query(Video).filter(Video.status == "approved").first()
        
        if not user or not video:
            print("Setup failed: need at least one user and one approved video")
            return

        print(f"Testing like optimization for user {user.id} on video {video.id}")
        
        # 2. Mock side effects
        with patch('app.crud.video.handle_like_side_effects') as mock_side_effects:
            from app.crud import video as crud_video
            
            # Clean existing like if any
            db.query(Like).filter(Like.user_id == user.id, Like.video_id == video.id).delete()
            db.commit()
            
            # Simulate endpoint behavior
            print("Performing toggle_like...")
            is_liked = crud_video.toggle_like(db, user_id=user.id, video_id=video.id)
            print(f"Is liked: {is_liked}")
            assert is_liked == True
            
            # Side effects should NOT have been called yet (because it's the endpoint's responsibility now)
            print(f"Side effects called immediately? {mock_side_effects.called}")
            assert mock_side_effects.called == False
            
            # Now simulate the background task call
            print("Simulating background task...")
            # We can't easily simulate BackgroundTasks.add_task without more context,
            # but we can verify that calling the task helper works.
            from app.api.v1.endpoints.videos import handle_like_background
            
            with patch('app.api.v1.endpoints.videos.SessionLocal', return_value=db):
                handle_like_background(user_id=user.id, video_id=video.id)
                
            print(f"Side effects called after background task? {mock_side_effects.called}")
            assert mock_side_effects.called == True
            
        print("VERIFICATION SUCCESSFUL")
        
    finally:
        db.close()

if __name__ == "__main__":
    verify_like_optimization()
