import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.middleware.rate_limiter import RateLimitMiddleware
from app.utils.logging import setup_logging
from app.api.routes import health, parse, analyze, image_analyze, image_extract, session, stripe_routes, history, tournament, learn, coach, train

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
    # Never expose internal error details in production
    openapi_url="/openapi.json" if settings.debug else None,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
# Applied before CORS so abusive IPs are dropped without wasting preflight work.
app.add_middleware(RateLimitMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Explicitly enumerate allowed methods and headers — never use wildcards with
# allow_credentials=True, which would expose cookies/auth tokens to any origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Security headers middleware ───────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    try:
        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Strict XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Only send Referer to same origin
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Disable powerful features not needed by the API
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # HSTS — only meaningful in production behind HTTPS
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        # Remove server fingerprint — MutableHeaders has no .pop(); use del with guard
        if "server" in response.headers:
            del response.headers["server"]
    except Exception:
        # Middleware MUST NOT crash the pipeline — a successful analysis response
        # must always reach the client even if header mutation fails.
        logger.warning(
            "Security header middleware failed on %s %s — response sent without security headers",
            request.method, request.url.path, exc_info=True,
        )
    return response


app.include_router(health.router, prefix="/api")
app.include_router(parse.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(image_analyze.router, prefix="/api")
app.include_router(image_extract.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(stripe_routes.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(tournament.router, prefix="/api")
app.include_router(learn.router, prefix="/api")
app.include_router(coach.router, prefix="/api")
app.include_router(train.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Stacked Poker API"}
