import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.schemas import TournamentAnalysisRequest, TournamentAnalysisResponse
from app.services.tournament_service import analyze_tournament, analyze_tournament_from_upload
from app.services.supabase_persistence import save_tournament_analysis
from app.services.usage_service import get_user_profile, assert_usage_allowed
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

_ALLOWED_EXTENSIONS = (".zip", ".txt")
_MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/analyze-tournament", response_model=TournamentAnalysisResponse, tags=["analysis"])
async def analyze_tournament_endpoint(
    request: TournamentAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TournamentAnalysisResponse:
    """Parse a full tournament history (text), score every hand by ICM importance."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        result = await analyze_tournament(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid tournament hand history format")
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
        logger.warning("Tournament Supabase persist failed for user=%s: %s", user_id, save_error)

    return result


@router.post("/analyze-tournament-upload", response_model=TournamentAnalysisResponse, tags=["analysis"])
async def analyze_tournament_upload_endpoint(
    file: UploadFile = File(...),
    tournament_type: str = Form(""),
    buy_in: str = Form(""),
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TournamentAnalysisResponse:
    """Accept a .zip or .txt tournament export, auto-detect metadata, return analysis."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    fname = (file.filename or "upload.txt").lower()
    if not any(fname.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=422,
            detail="Unsupported file format. Upload a .zip or .txt tournament export.",
        )

    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise ValueError("Uploaded file is empty")
        if len(file_bytes) > _MAX_BYTES:
            raise ValueError("File too large (max 50 MB)")
        result = await analyze_tournament_from_upload(
            file_bytes,
            file.filename or "upload.txt",
            tournament_type=tournament_type,
            buy_in=buy_in,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Tournament upload analyze error for user=%s", user_id)
        raise HTTPException(
            status_code=500,
            detail="Tournament analysis failed. Check your export format.",
        )

    saved_id, save_error = await save_tournament_analysis(
        user_id, f"[file:{file.filename}]", result, user_jwt=user_jwt
    )
    result.saved_id = saved_id or None
    result.save_error = save_error or None
    if save_error:
        logger.warning("Tournament upload persist failed for user=%s: %s", user_id, save_error)

    return result
