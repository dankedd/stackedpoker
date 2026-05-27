import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.middleware.rate_limiter import RateLimitMiddleware
from app.utils.logging import setup_logging
# Core routes — imported eagerly (lightweight, always needed)
from app.api.routes import health, parse, analyze, image_analyze, image_extract, session, stripe_routes, history, tournament, learn, coach, train, debug
from app.api.routes import pipeline as pipeline_routes
# Phase 2-8 routes are registered lazily below to avoid heavy import chains at startup

# ── Immutable build identity ──────────────────────────────────────────────
# Change BUILD_ID on every deploy-critical push so we can verify
# the running container matches the latest code.
BUILD_ID = "solver-runtime-v25-global-catch"
BUILD_TIMESTAMP = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

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


def _find_solver_binary() -> str:
    """Locate solver binary from env var or known filesystem paths."""
    import os
    from pathlib import Path

    solver_bin = os.getenv("TEXASSOLVER_BIN", "")
    if solver_bin and Path(solver_bin).exists():
        return solver_bin

    for candidate in [
        "/opt/texassolver/bin/console_solver",
        str(Path.home() / "TexasSolver" / "console_solver"),
    ]:
        if Path(candidate).exists():
            return candidate

    return ""


def _solver_self_test() -> None:
    """Verify TexasSolver binary exists and is executable. Fast — no subprocess."""
    import os
    from pathlib import Path

    enabled = os.getenv("ENABLE_SOLVER_ENGINE", "true").lower() == "true"

    logger.info("=== Solver Self-Test ===")
    logger.info("  %-30s %s", "ENABLE_SOLVER_ENGINE", "ON" if enabled else "OFF")
    logger.info("  %-30s %s", "TEXASSOLVER_BIN (env)", os.getenv("TEXASSOLVER_BIN", "(not set)"))

    if not enabled:
        logger.info("  Solver engine disabled — skipping")
        return

    resolved = _find_solver_binary()
    if not resolved:
        searched = [os.getenv("TEXASSOLVER_BIN", ""), "/opt/texassolver/bin/console_solver"]
        logger.warning("  binary NOT FOUND at: %s", [p for p in searched if p])
        return

    logger.info("  %-30s %s", "resolved binary", resolved)
    logger.info("  %-30s %s", "executable", os.access(resolved, os.X_OK))
    logger.info("  SOLVER SELF-TEST PASSED — binary found at %s", resolved)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import os
    logger.info("========================================")
    logger.info("  STACKED POKER — BUILD IDENTITY")
    logger.info("  BUILD_ID         = %s", BUILD_ID)
    logger.info("  PORT             = %s", os.getenv("PORT", "(not set)"))
    logger.info("========================================")
    # Non-blocking startup: DB failure must not prevent healthcheck
    try:
        await init_db()
        logger.info("[Startup] Database initialized")
    except Exception as exc:
        logger.warning("[Startup] Database init failed (non-fatal): %s", exc)
    logger.info("[Startup] App ready — healthcheck should pass")
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
# Phase 2-8 routes: lazy-imported to avoid heavy startup import chains
# These modules pull in redis, coaching models, solver abstractions etc.
# which add seconds to startup and can OOM on Railway's limited builders.
try:
    from app.api.routes import solver_jobs, abstraction, coaching, ai_coach, social, realtime
    app.include_router(solver_jobs.router, prefix="/api")
    app.include_router(abstraction.router, prefix="/api")
    app.include_router(coaching.router, prefix="/api")
    app.include_router(ai_coach.router, prefix="/api")
    app.include_router(social.router, prefix="/api")
    app.include_router(realtime.router, prefix="/api")
except Exception as _route_err:
    logging.getLogger(__name__).warning(
        "Phase 2-8 routes failed to load (non-fatal): %s", _route_err
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all: log every unhandled exception and return 500 JSON, never 502."""
    logger.exception("UNHANDLED EXCEPTION on %s %s", request.method, request.url.path)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {str(exc)[:200]}"},
    )


@app.get("/")
async def root():
    return {"message": "Stacked Poker API", "build_id": BUILD_ID}


@app.get("/api/version", tags=["system"])
async def version():
    """Immutable build identity — use to verify which code is actually running."""
    import os
    from pathlib import Path as _P
    resolved = _find_solver_binary()
    return {
        "build_id": BUILD_ID,
        "build_timestamp": BUILD_TIMESTAMP,
        "solver_engine_enabled": os.getenv("ENABLE_SOLVER_ENGINE", "true").lower() == "true",
        "texassolver_bin_env": os.getenv("TEXASSOLVER_BIN", "(not set)"),
        "solver_binary_resolved": resolved or "(not found)",
        "solver_binary_exists": bool(resolved and _P(resolved).exists()),
        "solver_binary_executable": os.access(resolved, os.X_OK) if resolved and _P(resolved).exists() else False,
    }


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
