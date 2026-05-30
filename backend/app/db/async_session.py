from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import DATABASE_URL

# Convert postgresql:// to postgresql+asyncpg:// if needed
ASYNC_SQLALCHEMY_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

async_engine = create_async_engine(
    ASYNC_SQLALCHEMY_DATABASE_URL,
    echo=False,
    future=True,
    pool_size=3,         # Reduced to prevent Supabase pool exhaustion (max 15 clients)
    max_overflow=2,      # Reduced to prevent Supabase pool exhaustion
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
