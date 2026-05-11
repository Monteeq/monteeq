import sys
import os
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append('/home/smasduq/montage/backend')

from app.db.session import SessionLocal
from app.models.models import User, Video, Challenge, ChallengeEntry

def verify_challenge_cleanup():
    db = SessionLocal()
    try:
        # 1. Setup
        user = db.query(User).first()
        if not user:
            print("No user found, creating one...")
            user = User(username="cleanup_test", email="cleanup@test.com")
            db.add(user)
            db.commit()
            db.refresh(user)

        challenge = Challenge(title="Cleanup Test", prize="Test Prize", description="Test Desc")
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        
        video = Video(title="Entry Video", video_url="test.mp4", thumbnail_url="test.jpg", owner_id=user.id)
        db.add(video)
        db.commit()
        db.refresh(video)
        
        entry = ChallengeEntry(challenge_id=challenge.id, user_id=user.id, video_id=video.id)
        db.add(entry)
        challenge.entry_count += 1
        db.commit()
        db.refresh(challenge)
        
        print(f"Initial setup complete. Entry count: {challenge.entry_count}")
        assert challenge.entry_count == 1
        
        # 2. Verify leaderboard (mock call logic)
        entries = db.query(ChallengeEntry).filter(ChallengeEntry.challenge_id == challenge.id).all()
        for e in entries:
            v = e.video
            print(f"Leaderboard entry found. Video: {v.title if v else 'None'}")
            assert v is not None
            _ = v.views # This would crash if v is None
            
        # 3. Simulate deletion via the logic I added (or just delete and let cascade work)
        # Note: I'll simulate what the endpoint does
        print("Simulating video deletion...")
        for e in video.challenge_entries:
            if e.challenge:
                e.challenge.entry_count = max(0, e.challenge.entry_count - 1)
        
        db.delete(video)
        db.commit()
        db.refresh(challenge)
        
        print(f"After deletion. Entry count: {challenge.entry_count}")
        assert challenge.entry_count == 0
        
        # Check if entry is gone
        orphaned_entry = db.query(ChallengeEntry).filter(ChallengeEntry.id == entry.id).first()
        print(f"Challenge entry state: {'Exists' if orphaned_entry else 'Deleted'}")
        assert orphaned_entry is None
        
        # 4. Final leaderboard check (robustness check)
        entries = db.query(ChallengeEntry).filter(ChallengeEntry.challenge_id == challenge.id).all()
        print(f"Final entries count in DB: {len(entries)}")
        assert len(entries) == 0
        
        print("VERIFICATION SUCCESSFUL")
        
    finally:
        # Cleanup
        db.query(ChallengeEntry).filter(ChallengeEntry.challenge_id == challenge.id).delete()
        db.delete(challenge)
        # video is already deleted
        db.commit()
        db.close()

if __name__ == "__main__":
    verify_challenge_cleanup()
