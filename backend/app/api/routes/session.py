import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.schemas import SessionAnalysisRequest, SessionAnalysisResponse
from app.services.session_service import analyze_session
from app.services.supabase_persistence import save_session_analysis
from app.services.usage_service import get_user_profile, assert_usage_allowed
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)


@router.post("/analyze-session", response_model=SessionAnalysisResponse, tags=["analysis"])
async def analyze_session_endpoint(
    request: SessionAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> SessionAnalysisResponse:
    """Parse a full session, score every hand, return the top 3 spots to review."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        result = await analyze_session(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Session analyze error")
        raise HTTPException(status_code=500, detail="Session analysis failed. Check your session format.")

    saved_id, save_error = await save_session_analysis(
        user_id, request.session_text, result, user_jwt=user_jwt
    )
    result.saved_id = saved_id or None
    result.save_error = save_error or None
    if save_error:
        logger.warning("Session Supabase persist failed for user=%s: %s", user_id, save_error)

    return result
