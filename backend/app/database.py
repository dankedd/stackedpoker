import logging
import ssl
from typing import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Parse and log DB connection (never log credentials) ──────────────────
_db_url = settings.database_url
try:
    _parsed = urlparse(_db_url)
    _db_host = _parsed.hostname or "unknown"
    _db_port = _parsed.port or 5432
    _db_user = _parsed.username or "unknown"
    _db_name = _parsed.path.lstrip("/") if _parsed.path else "unknown"
    _has_ssl = "sslmode" in (_parsed.query or "")
    logger.info("=== Database Configuration ===")
    logger.info("  host:     %s:%s", _db_host, _db_port)
    logger.info("  user:     %s", _db_user)
    logger.info("  database: %s", _db_name)
    logger.info("  driver:   asyncpg (from URL scheme)")
    logger.info("  ssl:      %s", "yes (in URL)" if _has_ssl else "no")
except Exception:
    _db_host = "unknown"
    _db_user = "unknown"
    _db_name = "unknown"
    logger.warning("Could not parse DATABASE_URL")

# ── Create async engine ──────────────────────────────────────────────────
# Railway Postgres may require SSL. asyncpg needs an ssl.SSLContext, not
# just sslmode=require in the URL. We create the engine with SSL support
# if the URL contains sslmode or if the host looks like a Railway/cloud host.
_connect_args = {}
_is_cloud = _db_host not in ("localhost", "127.0.0.1", "db", "unknown", "")
if _is_cloud:
    # Railway and most cloud Postgres require SSL
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE  # Railway uses self-signed certs
    _connect_args["ssl"] = _ssl_ctx
    logger.info("  SSL context: enabled (cloud host detected)")

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_pre_ping=True,
    connect_args=_connect_args,
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
        logger.info("DB connected: %s@%s/%s | Persistence enabled: true", _db_user, _db_host, _db_name)
    except Exception as exc:
        db_available = False
        logger.warning(
            "DB connection FAILED: %s@%s/%s | Persistence enabled: false | Reason: %s",
            _db_user, _db_host, _db_name, exc,
        )
