from app.db.session import SessionLocal
from app.models.models import Video

db = SessionLocal()
try:
    videos = db.query(Video).limit(10).all()
    for v in videos:
        print(f"ID: {v.id}, Type: {v.video_type}, Status: {v.status}")
        print(f"  URL: {v.video_url}")
        print(f"  720p: {v.url_720p}")
        print(f"  Thumbnail: {v.thumbnail_url}")
finally:
    db.close()
