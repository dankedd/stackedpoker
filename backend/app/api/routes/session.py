import logging
from fastapi import APIRouter, HTTPException, Depends

from app.models.schemas import SessionAnalysisRequest, SessionAnalysisResponse
from app.services.session_service import analyze_session
from app.services.usage_service import get_user_profile, assert_usage_allowed
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze-session", response_model=SessionAnalysisResponse, tags=["analysis"])
async def analyze_session_endpoint(
    request: SessionAnalysisRequest,
    current_user: dict = Depends(get_current_user),
) -> SessionAnalysisResponse:
    """Parse a full session, score every hand, return the top 3 spots to review."""
    user_id: str = current_user.get("sub", "")

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        return await analyze_session(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Session analyze error")
        raise HTTPException(status_code=500, detail="Session analysis failed. Check your session format.")
