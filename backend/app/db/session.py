from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

SQLALCHEMY_DATABASE_URL = DATABASE_URL

# Remove check_same_thread for postgres
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=5,         # 5 persistent connections (Supabase free tier allows ~15-20)
        max_overflow=5,      # 5 burst connections → 10 total max
        pool_timeout=30,     # 30 seconds wait for a connection
        pool_recycle=1800,   # Recycle connections every 30 minutes
        pool_pre_ping=True,  # Discard stale connections before use
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
