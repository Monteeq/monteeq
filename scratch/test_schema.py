from app.schemas.schemas import Video
from app.models.models import Video as VideoModel
from app.db.session import SessionLocal

db = SessionLocal()
v_model = db.query(VideoModel).filter(VideoModel.id == 78).first()
v_schema = Video.model_validate(v_model)
print(f"ID 78 (Flash) Resolved URL: {v_schema.video_url}")

v_model_80 = db.query(VideoModel).filter(VideoModel.id == 80).first()
v_schema_80 = Video.model_validate(v_model_80)
print(f"ID 80 (Home) Resolved URL: {v_schema_80.video_url}")
db.close()
