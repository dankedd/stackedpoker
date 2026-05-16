import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.models.schemas import HandAnalysisRequest, ParseResponse
from app.parsers.detector import detect_and_parse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/parse", response_model=ParseResponse, tags=["analysis"])
async def parse_hand(
    request: HandAnalysisRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ParseResponse:
    """Parse a raw hand history into a normalised structure. Requires auth."""
    try:
        parsed = detect_and_parse(request.hand_text)
        return ParseResponse(parsed_hand=parsed)
    except ValueError as e:
        logger.warning("Parse error for user=%s: %s", current_user.get("sub", "?"), str(e)[:200])
        raise HTTPException(status_code=422, detail="Invalid hand history format")
    except Exception:
        logger.exception("Parse error")
        raise HTTPException(status_code=500, detail="Failed to parse hand history")
