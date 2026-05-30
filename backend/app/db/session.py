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
        pool_size=3,         # Reduced to prevent Supabase pool exhaustion (max 15 clients)
        max_overflow=2,      # Reduced to prevent Supabase pool exhaustion
        pool_timeout=30,     # 30 seconds wait for a connection
        pool_recycle=1800,   # Recycle connections every 30 minutes
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
