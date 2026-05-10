"""
Hand service — database persistence layer.
"""
from __future__ import annotations
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import UploadedHand, ParsedHand as DBParsedHand, Analysis as DBAnalysis
from app.models.schemas import AnalysisResponse

logger = logging.getLogger(__name__)


async def save_analysis(
    db: AsyncSession,
    raw_text: str,
    result: AnalysisResponse,
) -> str:
    """Persist the full analysis to the database. Returns the uploaded hand ID."""
    try:
        hand_id = uuid.uuid4()

        uploaded = UploadedHand(
            id=hand_id,
            raw_text=raw_text,
            site=result.parsed_hand.site,
        )
        db.add(uploaded)
        await db.flush()

        parsed = DBParsedHand(
            uploaded_hand_id=hand_id,
            hand_id=result.parsed_hand.hand_id,
            site=result.parsed_hand.site,
            game_type=result.parsed_hand.game_type,
            stakes=result.parsed_hand.stakes,
            hero_position=result.parsed_hand.hero_position,
            hero_cards=result.parsed_hand.hero_cards,
            board=result.parsed_hand.board.model_dump(),
            actions=[a.model_dump() for a in result.parsed_hand.actions],
            effective_stack_bb=result.parsed_hand.effective_stack_bb,
        )
        db.add(parsed)
        await db.flush()

        analysis = DBAnalysis(
            parsed_hand_id=parsed.id,
            spot_classification=result.spot_classification.model_dump(),
            board_texture=result.board_texture.model_dump(),
            findings=[f.model_dump() for f in result.findings],
            overall_score=result.overall_score,
            ai_coaching=result.ai_coaching,
            mistakes_count=result.mistakes_count,
        )
        db.add(analysis)
        await db.commit()

        return str(hand_id)
    except Exception as e:
        logger.error("Failed to save analysis: %s", e)
        await db.rollback()
        return ""
