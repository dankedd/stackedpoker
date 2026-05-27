"""Stacked Poker — AI-powered poker hand analysis and GTO coaching."""
import logging
import os
import time
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Immutable build identity ──────────────────────────────────────────────
BUILD_ID = "solver-runtime-v38-incremental-restore"
BUILD_TIMESTAMP = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

port = int(os.environ.get("PORT", "8080"))
print(f"[BOOT] PORT={port} BUILD_ID={BUILD_ID}")

# ── Settings (safe — has defaults for everything) ─────────────────────────
from app.config import get_settings
from app.utils.logging import setup_logging

settings = get_settings()
setup_logging(settings.debug)
logger = logging.getLogger(__name__)
print("[BOOT] Settings loaded OK")

# ── Database import (module-level, but init is deferred to lifespan) ──────
from app.database import init_db
print("[BOOT] Database module imported OK")


# ── Lifespan (non-blocking DB init) ──────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("BUILD_ID = %s | PORT = %s", BUILD_ID, port)
    try:
        await init_db()
        logger.info("[Startup] DB initialized")
    except Exception as exc:
        logger.warning("[Startup] DB init failed (non-fatal): %s", exc)
    logger.info("[Startup] App ready")
    yield
    logger.info("Shutting down")


# ── App creation ──────────────────────────────────────────────────────────
app = FastAPI(
    title="Stacked Poker",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
)

# CORS — permissive for now, tighten after confirming everything works
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
print("[BOOT] App + CORS created OK")


# ── Global exception handler ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("UNHANDLED: %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)[:300]})


# ── Core routes ──────────────────────────────────────────────────────────
print("[BOOT] Importing core routes...")
try:
    from app.api.routes import (
        health, parse, analyze, image_analyze, image_extract,
        session, stripe_routes, history, tournament, learn,
        coach, train, debug,
    )
    from app.api.routes import pipeline as pipeline_routes

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
    print("[BOOT] Core routes registered OK")
except Exception as e:
    print(f"[BOOT] Core routes FAILED: {e}")
    import traceback; traceback.print_exc()

# ── Phase 2-8 routes (optional, non-fatal) ───────────────────────────────
print("[BOOT] Importing Phase 2-8 routes...")
try:
    from app.api.routes import solver_jobs, abstraction, coaching, ai_coach, social, realtime
    app.include_router(solver_jobs.router, prefix="/api")
    app.include_router(abstraction.router, prefix="/api")
    app.include_router(coaching.router, prefix="/api")
    app.include_router(ai_coach.router, prefix="/api")
    app.include_router(social.router, prefix="/api")
    app.include_router(realtime.router, prefix="/api")
    print("[BOOT] Phase 2-8 routes registered OK")
except Exception as e:
    print(f"[BOOT] Phase 2-8 routes FAILED (non-fatal): {e}")
    import traceback; traceback.print_exc()


# ── Bare endpoints (always work, no auth/DB) ─────────────────────────────
@app.get("/")
def root():
    return {"message": "Stacked Poker API", "build_id": BUILD_ID}


@app.get("/api/version")
def version():
    return {
        "build_id": BUILD_ID,
        "build_timestamp": BUILD_TIMESTAMP,
        "port": port,
        "solver_binary": os.path.exists("/opt/texassolver/bin/console_solver"),
    }


print(f"[BOOT] All done. Starting uvicorn on 0.0.0.0:{port}")

# ── Entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=port)
