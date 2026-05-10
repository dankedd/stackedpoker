import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.utils.logging import setup_logging
from app.api.routes import health, parse, analyze, image_analyze, image_extract

settings = get_settings()
setup_logging(settings.debug)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Stacked Poker starting ===")
    logger.info("OpenAI key configured: %s", bool(settings.openai_api_key))
    logger.info("Vision model: %s", settings.openai_vision_model)
    logger.info("Allowed origins: %s", settings.allowed_origins)
    await init_db()
    logger.info("Routes: /api/health  /api/parse  /api/analyze  /api/analyze-image  /api/extract-hand  /api/confirm-hand")
    logger.info("Docs: http://localhost:8000/docs")
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


@app.get("/")
async def root():
    return {"message": "Stacked Poker API", "docs": "/docs"}
