import logging
from typing import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Resolve the DB host for startup logging (no credentials in log output).
try:
    _parsed = urlparse(settings.database_url)
    _db_host = f"{_parsed.hostname or 'unknown'}:{_parsed.port or 5432}"
except Exception:
    _db_host = "unknown"

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Set to True only after init_db() connects successfully.
db_available: bool = False


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    if not db_available:
        yield None
        return
    try:
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    except Exception:
        # DB unavailable mid-request — yield None so routes can skip persistence
        yield None


async def init_db() -> None:
    global db_available
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        db_available = True
        logger.info("DB host: %s | Persistence enabled: true", _db_host)
    except Exception as exc:
        db_available = False
        logger.warning(
            "DB host: %s | Persistence enabled: false | Reason: %s",
            _db_host, exc,
        )
