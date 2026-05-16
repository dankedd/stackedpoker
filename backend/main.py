import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.utils.logging import setup_logging
from app.api.routes import health, parse, analyze, image_analyze, image_extract, session, stripe_routes, history, tournament, profile

settings = get_settings()
setup_logging(settings.debug)
logger = logging.getLogger(__name__)


def _log_env_check() -> None:
    """Log which critical env vars are present. Never log values."""
    checks = {
        "DATABASE_URL":               bool(settings.database_url),
        "OPENAI_API_KEY":             bool(settings.openai_api_key),
        "SUPABASE_URL":               bool(settings.supabase_url),
        "SUPABASE_SERVICE_ROLE_KEY":  bool(settings.supabase_service_role_key),
        "SUPABASE_JWT_SECRET":        bool(settings.supabase_jwt_secret),
        "STRIPE_SECRET_KEY":          bool(settings.stripe_secret_key),
        "STRIPE_PRO_PRICE_ID":        bool(settings.stripe_pro_price_id),
    }
    for var, present in checks.items():
        level = logger.info if present else logger.warning
        level("  %-30s %s", var, "OK" if present else "MISSING")

    missing = [k for k, v in checks.items() if not v]
    if missing:
        logger.warning("Missing env vars: %s", missing)
    if not checks["SUPABASE_URL"]:
        logger.error(
            "CRITICAL: SUPABASE_URL is not set — JWT validation will fail "
            "and every /api/analyze request will return 401."
        )
    if not checks["STRIPE_SECRET_KEY"]:
        logger.warning(
            "STRIPE_SECRET_KEY is not set — /api/stripe/create-checkout "
            "will return 503 until it is configured."
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("=== Stacked Poker starting ===")
    logger.info("Allowed origins: %s", settings.allowed_origins)
    _log_env_check()
    await init_db()
    yield
    logger.info("=== Stacked Poker stopped ===")


app = FastAPI(
    title="Stacked Poker",
    description="Premium AI-powered poker hand analysis and GTO coaching",
    version="1.0.0",
    lifespan=lifespan,
)

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
app.include_router(session.router, prefix="/api")
app.include_router(stripe_routes.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(tournament.router, prefix="/api")
app.include_router(profile.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Stacked Poker API", "docs": "/docs"}
