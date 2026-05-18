"""
Pipeline API routes.

POST /api/pipeline/prepare
  Accepts raw hand text.
  Returns PipelineResult (CanonicalHand + PipelineValidationResult).
  Does NOT run analysis.
  Use this to show the repair/confirmation UI before committing to analysis.

POST /api/pipeline/analyze
  Accepts a PipelineResult whose validation.can_analyze=True.
  Runs the full analysis engine and returns AnalysisResponse.
  Returns 422 if can_analyze=False.

These routes require authentication.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canonical import PipelineResult, CanonicalHand, PipelineValidationResult
from app.engines.pipeline import run_text_pipeline
from app.middleware.auth import get_current_user
from app.database import get_db

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)
router = APIRouter()


class PrepareRequest(BaseModel):
    hand_text: str = Field(..., min_length=20, max_length=102_400)
    debug: bool = Field(False, description="Include parse diagnostics in response")


class AnalyzeFromCanonicalRequest(BaseModel):
    canonical: CanonicalHand
    validation: PipelineValidationResult
    game_type: str | None = None
    player_count: int | None = Field(None, ge=1, le=9)


@router.post(
    "/pipeline/prepare",
    response_model=PipelineResult,
    tags=["pipeline"],
    summary="Parse + normalize + validate — no analysis",
)
async def prepare_hand(
    request: PrepareRequest,
    current_user: dict = Depends(get_current_user),
) -> PipelineResult:
    """
    Step 1 of the 2-step pipeline.

    Parses the hand text, normalizes it into canonical form, and validates it.
    Returns the PipelineResult so the frontend can:
      - Auto-proceed to analyze if valid + high-confidence
      - Show the repair UI if invalid or low-confidence

    Does NOT run AI coaching or GTO analysis.
    Does NOT decrement usage quota.
    """
    try:
        result = run_text_pipeline(request.hand_text, debug=request.debug)
        return result
    except Exception as e:
        logger.exception("pipeline/prepare error")
        raise HTTPException(status_code=500, detail=f"Pipeline preparation failed: {e}")


@router.post(
    "/pipeline/analyze",
    tags=["pipeline"],
    summary="Run analysis on a pre-validated canonical hand",
)
async def analyze_canonical(
    request: AnalyzeFromCanonicalRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 of the 2-step pipeline.

    Accepts a CanonicalHand that has already passed validation.
    Runs the full analysis engine (spot classification, board texture,
    heuristics, AI coaching, replay construction).

    Returns 422 if can_analyze=False.
    """
    if not request.validation.can_analyze:
        error_summary = "; ".join(
            e.message for e in request.validation.errors[:3]
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"Analysis blocked: hand failed validation. "
                f"Errors: {error_summary}"
            ),
        )

    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    from app.services.usage_service import get_user_profile, assert_usage_allowed, increment_usage
    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        # Convert canonical → ParsedHand for existing analysis engine
        from app.engines.pipeline import _canonical_to_parsed_hand
        parsed = _canonical_to_parsed_hand(request.canonical)

        from app.engines.analysis import analyse_hand
        result = analyse_hand(parsed)

        from app.services.openai_coach import generate_coaching
        coaching = await generate_coaching(
            hand=parsed,
            spot=result.spot_classification,
            texture=result.board_texture,
            findings=result.findings,
            overall_score=result.overall_score,
            game_type=request.game_type,
            player_count=request.player_count,
        )
        result.ai_coaching = coaching

        from app.api.routes.analyze import _build_replay
        result.replay = _build_replay(result)

        from app.services.supabase_persistence import save_hand_analysis as save_to_supabase
        raw_text = request.canonical.raw_text or ""
        saved_id, save_error = await save_to_supabase(
            user_id, raw_text, result, user_jwt=user_jwt
        )
        result.saved_id = saved_id or None
        result.save_error = save_error or None

        if db is not None:
            try:
                from app.services.hand_service import save_analysis
                await save_analysis(db, raw_text, result)
            except Exception:
                logger.warning("DB persist failed — returning result anyway")

        from app.services.learning_integration import process_analysis_for_learning
        await process_analysis_for_learning(
            user_id=user_id,
            findings=result.findings or [],
            analysis_id=saved_id,
        )

        await increment_usage(user_id)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("pipeline/analyze error")
        raise HTTPException(status_code=500, detail="Analysis failed after validation.")
