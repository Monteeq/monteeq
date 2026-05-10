from app.db.session import SessionLocal
from app.models.models import Video

db = SessionLocal()
videos = db.query(Video).filter(Video.status == 'pending').all()
for v in videos:
    print(f"ID: {v.id}, Status: {v.status}, Key: {v.processing_key}")
db.close()
