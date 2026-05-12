import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from app.models.schemas import HealthResponse
from app.middleware.auth import get_current_user
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/auth-check", tags=["system"])
async def auth_check(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Diagnostic: verify that auth is working end-to-end.
    Returns partial user info (no secrets) so you can confirm the token
    round-trips correctly from browser → Next.js rewrite → FastAPI.
    """
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    logger.info("auth-check: user=%s jwt_secret_set=%s", user_id[:8] if user_id else "none", bool(settings.supabase_jwt_secret))
    return {
        "ok": True,
        "user_id_prefix": user_id[:8] if user_id else None,
        "jwt_secret_configured": bool(settings.supabase_jwt_secret),
        "supabase_url_configured": bool(settings.supabase_url),
        "service_role_configured": bool(settings.supabase_service_role_key),
    }
