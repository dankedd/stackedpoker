import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import HandAnalysisRequest, AnalysisResponse
from app.parsers.detector import detect_and_parse
from app.engines.analysis import analyse_hand
from app.services.openai_coach import generate_coaching
from app.services.hand_service import save_analysis
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse, tags=["analysis"])
async def analyze_hand(
    request: HandAnalysisRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """Full pipeline: parse → classify → heuristics → AI coaching → persist."""
    try:
        # 1. Parse
        parsed = detect_and_parse(request.hand_text)

        # 2. Structural analysis (no AI yet)
        result = analyse_hand(parsed)

        # 3. AI coaching
        coaching = await generate_coaching(
            hand=parsed,
            spot=result.spot_classification,
            texture=result.board_texture,
            findings=result.findings,
            overall_score=result.overall_score,
        )
        result.ai_coaching = coaching

        # 4. Persist (best-effort — skipped if DB unavailable)
        if db is not None:
            try:
                await save_analysis(db, request.hand_text, result)
            except Exception:
                logger.warning("DB persist failed — returning result anyway")

        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Analyze error")
        raise HTTPException(status_code=500, detail="Analysis failed. Please check your hand history format.")
