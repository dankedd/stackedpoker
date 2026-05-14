import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.schemas import TournamentAnalysisRequest, TournamentAnalysisResponse
from app.services.tournament_service import analyze_tournament
from app.services.supabase_persistence import save_tournament_analysis
from app.services.usage_service import get_user_profile, assert_usage_allowed
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)


@router.post("/analyze-tournament", response_model=TournamentAnalysisResponse, tags=["analysis"])
async def analyze_tournament_endpoint(
    request: TournamentAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TournamentAnalysisResponse:
    """Parse a full tournament history, score every hand by ICM importance,
    return the top 5 spots with tournament stats and AI coaching."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        result = await analyze_tournament(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Tournament analyze error")
        raise HTTPException(
            status_code=500,
            detail="Tournament analysis failed. Check your hand history format.",
        )

    saved_id, save_error = await save_tournament_analysis(
        user_id, request.tournament_text, result, user_jwt=user_jwt
    )
    result.saved_id = saved_id or None
    result.save_error = save_error or None
    if save_error:
        logger.warning(
            "Tournament Supabase persist failed for user=%s: %s", user_id, save_error
        )

    return result
