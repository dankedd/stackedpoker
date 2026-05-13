"""
Supabase persistence layer — writes analysis results to hand_analyses table.

Uses the service-role key (bypasses RLS) for server-side writes.
All saves are best-effort: failures are logged with full detail but never
propagate to callers. Returns the saved row UUID on success, "" on failure.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.models.schemas import AnalysisResponse, SessionAnalysisResponse, VisionAnalysisResponse

logger = logging.getLogger(__name__)


def _supa_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _flat_board(board_obj) -> list[str]:
    """Flatten BoardCards object → ['Ah', 'Kd', '2c', '9s'] for frontend rendering."""
    if board_obj is None:
        return []
    flop  = board_obj.flop  if hasattr(board_obj, "flop")  else []
    turn  = board_obj.turn  if hasattr(board_obj, "turn")  else []
    river = board_obj.river if hasattr(board_obj, "river") else []
    return (flop or []) + (turn or []) + (river or [])


async def _post_row(payload: dict, user_id: str, label: str) -> str:
    """POST a single row to hand_analyses. Returns row ID or "" on failure."""
    s = get_settings()
    if not s.supabase_url:
        logger.warning("%s: SUPABASE_URL not set — skipping save for user %s", label, user_id)
        return ""
    if not s.supabase_service_role_key:
        logger.warning("%s: SUPABASE_SERVICE_ROLE_KEY not set — skipping save for user %s", label, user_id)
        return ""

    row_id = payload.get("id", "")
    url = f"{s.supabase_url}/rest/v1/hand_analyses"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=_supa_headers(), json=payload)

        if resp.status_code in (200, 201):
            try:
                rows = resp.json()
                saved_id = rows[0]["id"] if (isinstance(rows, list) and rows) else row_id
            except Exception:
                saved_id = row_id
            logger.info(
                "%s: saved row %s for user %s (status=%d)",
                label, saved_id, user_id, resp.status_code,
            )
            return str(saved_id)

        # Detailed failure log so Railway shows exactly what Supabase rejected
        logger.error(
            "%s: Supabase insert FAILED for user %s | status=%d | body=%s",
            label, user_id, resp.status_code, resp.text[:500],
        )
    except Exception as exc:
        logger.error("%s: network error saving for user %s: %s", label, user_id, exc)
    return ""


async def save_hand_analysis(
    user_id: str,
    raw_text: str,
    result: AnalysisResponse,
) -> str:
    """Persist a text hand analysis to Supabase. Returns new row ID or ""."""
    parsed = result.parsed_hand

    payload: dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "input_type": "text",
        "raw_hand_text": raw_text,
        "site": parsed.site or "",
        "game_type": parsed.game_type or "cash",
        "stakes": parsed.stakes or "",
        "hero_position": parsed.hero_position or "",
        "hero_cards": parsed.hero_cards or [],
        # Flat card array so frontend board.map() works correctly
        "board": _flat_board(parsed.board),
        "actions": [a.model_dump() for a in (parsed.actions or [])],
        "effective_stack_bb": float(parsed.effective_stack_bb or 0),
        "spot_classification": result.spot_classification.model_dump() if result.spot_classification else {},
        "board_texture": result.board_texture.model_dump() if result.board_texture else {},
        "findings": [f.model_dump() for f in (result.findings or [])],
        "overall_score": result.overall_score or 0,
        "ai_coaching": result.ai_coaching or "",
        "mistakes_count": result.mistakes_count or 0,
        "replay_state": result.replay.model_dump() if result.replay else None,
        "analysis_type": "hand",
        "analyzed_at": _now(),
    }

    return await _post_row(payload, user_id, "save_hand_analysis")


async def save_session_analysis(
    user_id: str,
    raw_text: str,
    result: SessionAnalysisResponse,
) -> str:
    """Persist a session review as a single hand_analyses row (analysis_type='session')."""
    stats = result.session_stats
    session_data = {
        "total_hands_found": result.total_hands_found,
        "hands_parsed": result.hands_parsed,
        "session_stats": stats.model_dump() if stats else {},
        "selected_hands": [h.model_dump() for h in (result.selected_hands or [])],
        "all_hands_count": len(result.all_hands) if result.all_hands else 0,
    }

    payload: dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "input_type": "text",
        "raw_hand_text": raw_text,
        "site": "",
        "game_type": "cash",
        "stakes": "",
        "hero_position": "",
        "hero_cards": [],
        "board": [],
        "actions": [],
        "effective_stack_bb": 0.0,
        "spot_classification": {},
        "board_texture": {},
        "findings": [],
        "overall_score": 0,
        "ai_coaching": stats.ai_summary if stats else "",
        "mistakes_count": 0,
        "replay_state": session_data,
        "analysis_type": "session",
        "analyzed_at": _now(),
    }

    return await _post_row(payload, user_id, "save_session_analysis")


async def save_image_analysis(
    user_id: str,
    result: VisionAnalysisResponse,
) -> str:
    """Persist a screenshot-based analysis to Supabase."""
    analysis = result.analysis
    summary = analysis.hand_summary if analysis else None
    verdict = analysis.overall_verdict if analysis else None

    payload: dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "input_type": "image",
        "raw_hand_text": "",
        "site": "screenshot",
        "game_type": "cash",
        "stakes": summary.stakes if summary else "",
        "hero_position": summary.hero_position if summary else "",
        "hero_cards": summary.hero_cards if summary else [],
        # Flat card array
        "board": _flat_board(summary.board) if summary and summary.board else [],
        "actions": [a.model_dump() for a in (analysis.actions or [])] if analysis else [],
        "effective_stack_bb": float(summary.effective_stack_bb or 0) if summary else 0.0,
        "spot_classification": {},
        "board_texture": {},
        "findings": [],
        "overall_score": verdict.score if verdict else 0,
        "ai_coaching": verdict.summary if verdict else "",
        "mistakes_count": len(verdict.key_mistakes) if verdict and verdict.key_mistakes else 0,
        "replay_state": analysis.model_dump() if analysis else None,
        "analysis_type": "hand",
        "analyzed_at": _now(),
    }

    return await _post_row(payload, user_id, "save_image_analysis")
