import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.database import init_db
from app.utils.logging import setup_logging
from app.api.routes import health, parse, analyze, image_analyze, image_extract

settings = get_settings()
setup_logging(settings.debug)
logger = logging.getLogger(__name__)


class AuthDiagnosticMiddleware(BaseHTTPMiddleware):
    """Log whether Authorization header is present on /api/analyze requests."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/analyze":
            has_auth = "authorization" in request.headers
            auth_prefix = ""
            if has_auth:
                raw = request.headers.get("authorization", "")
                # Log only the first 20 chars of the token (safe — no secrets)
                auth_prefix = raw[:27] + "..." if len(raw) > 27 else raw
            logger.info(
                "analyze request: method=%s has_auth_header=%s prefix=%s",
                request.method, has_auth, auth_prefix,
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("=== Stacked Poker starting ===")
    logger.info("OpenAI key configured: %s", bool(settings.openai_api_key))
    logger.info("Allowed origins: %s", settings.allowed_origins)
    # ── Auth / Supabase sanity check ─────────────────────────────────────
    logger.info("SUPABASE_JWT_SECRET configured: %s", bool(settings.supabase_jwt_secret))
    logger.info("SUPABASE_URL configured: %s", bool(settings.supabase_url))
    logger.info("SUPABASE_SERVICE_ROLE_KEY configured: %s", bool(settings.supabase_service_role_key))
    if not settings.supabase_jwt_secret:
        logger.error(
            "CRITICAL: SUPABASE_JWT_SECRET is not set — every /api/analyze "
            "request will fail with 401 'Invalid token'. Add it and restart."
        )
    # ─────────────────────────────────────────────────────────────────────
    await init_db()
    yield
    logger.info("=== Stacked Poker stopped ===")


app = FastAPI(
    title="Stacked Poker",
    description="Premium AI-powered poker hand analysis and GTO coaching",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(AuthDiagnosticMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(parse.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(image_analyze.router, prefix="/api")
app.include_router(image_extract.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Stacked Poker API", "docs": "/docs"}
