import logging
import os
import ssl
from typing import AsyncGenerator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Log raw env var presence (NEVER log the value — contains password) ────
_raw_env = os.environ.get("DATABASE_URL", "")
logger.info("=== Database Configuration ===")
logger.info("  DATABASE_URL env var present: %s", bool(_raw_env))
logger.info("  DATABASE_URL env var length:  %d", len(_raw_env))
if _raw_env:
    # Log just the scheme and host from the RAW env var (before pydantic touches it)
    _at = _raw_env.find("@")
    if _at > 0 and len(_raw_env) > _at + 1:
        logger.info("  DATABASE_URL raw host part:   ...@%s", _raw_env[_at + 1:][:60])
logger.info("  settings.database_url scheme: %s", settings.database_url.split("://")[0] if "://" in settings.database_url else "NONE")
logger.info("  .env file exists at CWD:      %s", os.path.exists(".env"))

# ── Parse using SQLAlchemy's make_url (handles all driver schemes) ────────
_db_url_str = settings.database_url
try:
    _sa_url = make_url(_db_url_str)
    _db_host = _sa_url.host or "unknown"
    _db_port = _sa_url.port or 5432
    _db_user = _sa_url.username or "unknown"
    _db_name = _sa_url.database or "unknown"
    _db_driver = _sa_url.drivername
    logger.info("  Parsed driver:   %s", _db_driver)
    logger.info("  Parsed host:     %s:%s", _db_host, _db_port)
    logger.info("  Parsed user:     %s", _db_user)
    logger.info("  Parsed database: %s", _db_name)
    logger.info("  Password present: %s", bool(_sa_url.password))
except Exception as exc:
    _db_host = "unknown"
    _db_user = "unknown"
    _db_name = "unknown"
    _db_driver = "unknown"
    logger.error("  FAILED to parse DATABASE_URL: %s", exc)

# ── Create async engine ──────────────────────────────────────────────────
_connect_args: dict = {}
_is_cloud = _db_host not in ("localhost", "127.0.0.1", "db", "unknown", "")
if _is_cloud:
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx
    logger.info("  SSL: enabled (cloud host: %s)", _db_host)
else:
    logger.info("  SSL: disabled (local host)")

engine = create_async_engine(
    _db_url_str,
    echo=settings.debug,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

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
        yield None


async def init_db() -> None:
    global db_available
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        db_available = True
        logger.info("DB CONNECTED: %s@%s/%s | Persistence: ON", _db_user, _db_host, _db_name)
    except Exception as exc:
        db_available = False
        logger.warning(
            "DB FAILED: %s@%s/%s | Persistence: OFF | Error: %s",
            _db_user, _db_host, _db_name, exc,
        )
