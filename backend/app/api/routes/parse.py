import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import HandAnalysisRequest, ParseResponse
from app.parsers.detector import detect_and_parse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/parse", response_model=ParseResponse, tags=["analysis"])
async def parse_hand(request: HandAnalysisRequest) -> ParseResponse:
    """Parse a raw hand history into a normalised structure."""
    try:
        parsed = detect_and_parse(request.hand_text)
        return ParseResponse(parsed_hand=parsed)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Parse error")
        raise HTTPException(status_code=500, detail="Failed to parse hand history")
