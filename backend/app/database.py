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

# ── Early diagnostics (print, not logger — logging not configured yet) ───
_raw_db_env = os.environ.get("DATABASE_URL", "")
_settings_url = settings.database_url
print(f"[DB EARLY] DATABASE_URL env present: {bool(_raw_db_env)}, len={len(_raw_db_env)}")
print(f"[DB EARLY] settings.database_url scheme: {_settings_url.split('://')[0] if '://' in _settings_url else 'NONE'}")
print(f"[DB EARLY] .env file exists: {os.path.exists('.env')}")
if _raw_db_env:
    # Show scheme + host only (never credentials)
    _at = _raw_db_env.find("@")
    _scheme_end = _raw_db_env.find("://")
    if _scheme_end > 0:
        print(f"[DB EARLY] raw env scheme: {_raw_db_env[:_scheme_end]}")
    if _at > 0:
        print(f"[DB EARLY] raw env after @: {_raw_db_env[_at+1:][:80]}")
    else:
        print(f"[DB EARLY] raw env has NO @ sign — format may be incomplete")

# ── Parse URL ────────────────────────────────────────────────────────────
try:
    _sa_url = make_url(_settings_url)
    _db_host = _sa_url.host or "unknown"
    _db_port = _sa_url.port or 5432
    _db_user = _sa_url.username or "unknown"
    _db_name = _sa_url.database or "unknown"
    _db_pass = _sa_url.password
    print(f"[DB EARLY] parsed: user={_db_user} host={_db_host}:{_db_port} db={_db_name} password={'YES' if _db_pass else 'NO'}")

    # If username is missing from URL, try PGUSER env var, then default to 'postgres'
    if _db_user == "unknown" or not _sa_url.username:
        _fallback_user = os.environ.get("PGUSER", "postgres")
        print(f"[DB EARLY] username missing from URL — injecting '{_fallback_user}'")
        _sa_url = _sa_url.set(username=_fallback_user)
        _db_user = _fallback_user
        _settings_url = str(_sa_url)
        print(f"[DB EARLY] fixed URL scheme: {_settings_url.split('://')[0]}")

except Exception as exc:
    _db_host = "unknown"
    _db_user = "unknown"
    _db_name = "unknown"
    print(f"[DB EARLY] PARSE FAILED: {exc}")

# ── Engine creation ──────────────────────────────────────────────────────
_connect_args: dict = {}
_is_cloud = _db_host not in ("localhost", "127.0.0.1", "db", "unknown", "")
if _is_cloud:
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx
    print(f"[DB EARLY] SSL: enabled for cloud host {_db_host}")

engine = create_async_engine(
    _settings_url,
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
