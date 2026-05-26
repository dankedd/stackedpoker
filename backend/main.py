import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.middleware.rate_limiter import RateLimitMiddleware
from app.utils.logging import setup_logging
from app.api.routes import health, parse, analyze, image_analyze, image_extract, session, stripe_routes, history, tournament, learn, coach, train, debug, solver_jobs, abstraction, coaching, ai_coach, social, realtime
from app.api.routes import pipeline as pipeline_routes

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

    # Strategy engine status
    logger.info("  %-30s %s", "ENABLE_SOLVER_ENGINE", "ON" if settings.enable_solver_engine else "OFF")
    logger.info("  %-30s %s", "DEBUG_STRATEGY_ENABLED", "ON" if settings.debug_strategy_enabled else "OFF")

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


def _solver_self_test() -> None:
    """Verify TexasSolver binary is available and executable at startup."""
    import os
    from pathlib import Path

    enabled = os.getenv("ENABLE_SOLVER_ENGINE", "true").lower() == "true"

    logger.info("=== Solver Self-Test ===")
    logger.info("  %-30s %s", "ENABLE_SOLVER_ENGINE", "ON" if enabled else "OFF")
    logger.info("  %-30s %s", "TEXASSOLVER_BIN (env)", os.getenv("TEXASSOLVER_BIN", "(not set)"))

    if not enabled:
        logger.info("  Solver engine disabled — skipping binary check")
        return

    # Search for binary: env var first, then known Docker paths
    solver_bin = os.getenv("TEXASSOLVER_BIN", "")
    known_paths = [
        "/opt/texassolver/bin/console_solver",
        str(Path.home() / "TexasSolver" / "console_solver"),
    ]

    resolved_path = ""
    if solver_bin and Path(solver_bin).exists():
        resolved_path = solver_bin
        logger.info("  %-30s %s (from env)", "resolved binary", resolved_path)
    else:
        for candidate in known_paths:
            if Path(candidate).exists():
                resolved_path = candidate
                logger.info("  %-30s %s (from known path)", "resolved binary", resolved_path)
                break

    if not resolved_path:
        all_searched = [solver_bin] + known_paths if solver_bin else known_paths
        logger.warning(
            "  SOLVER SELF-TEST: binary NOT FOUND at any of: %s",
            all_searched,
        )
        logger.warning("  Live solving will use heuristic fallback until binary is available")
        return

    executable = os.access(resolved_path, os.X_OK)
    logger.info("  %-30s %s", "binary exists", True)
    logger.info("  %-30s %s", "binary executable", executable)

    if not executable:
        logger.error("  SOLVER SELF-TEST FAILED: binary not executable at %s", resolved_path)
        return

    # Check resources
    res_dir = os.getenv("TEXASSOLVER_RESOURCE_DIR", "/opt/texassolver/resources")
    compairer = Path(res_dir) / "compairer"
    res_ok = compairer.exists() and any(compairer.iterdir()) if compairer.exists() else False
    logger.info("  %-30s %s (%s)", "resources available", res_ok, res_dir)

    if not res_ok:
        logger.warning("  Solver resources missing at %s — solves may fail", res_dir)
        return

    logger.info("  SOLVER SELF-TEST PASSED — live solving enabled at %s", resolved_path)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("=== Stacked Poker starting ===")
    logger.info("Allowed origins: %s", settings.allowed_origins)
    _log_env_check()
    _solver_self_test()
    await init_db()
    yield
    logger.info("=== Stacked Poker stopped ===")


app = FastAPI(
    title="Stacked Poker",
    description="Premium AI-powered poker hand analysis and GTO coaching",
    version="1.0.0",
    lifespan=lifespan,
    # Docs are controlled by DOCS_ENABLED (default: True) — independent of the
    # DEBUG flag so local dev always has Swagger UI regardless of log verbosity.
    # Set DOCS_ENABLED=false in Railway/production to suppress public exposure.
    openapi_url="/openapi.json" if settings.docs_enabled else None,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
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
app.include_router(pipeline_routes.router, prefix="/api")
app.include_router(debug.router, prefix="/api")
app.include_router(solver_jobs.router, prefix="/api")
app.include_router(abstraction.router, prefix="/api")
app.include_router(coaching.router, prefix="/api")
app.include_router(ai_coach.router, prefix="/api")
app.include_router(social.router, prefix="/api")
app.include_router(realtime.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Stacked Poker API"}


@app.get("/health-debug", tags=["debug"])
async def health_debug():
    """Temporary debug endpoint — confirm docs are enabled and routes work."""
    return {
        "docs_url": app.docs_url,
        "openapi_url": app.openapi_url,
        "redoc_url": app.redoc_url,
        "registered_paths": [
            r.path for r in app.routes if hasattr(r, "path")
        ],
    }
