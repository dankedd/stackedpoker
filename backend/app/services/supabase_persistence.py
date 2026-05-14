"""
Supabase persistence layer — writes analysis results to hand_analyses table.

Auth strategy (in priority order):
  1. service-role key  — bypasses RLS, always works if configured
  2. user JWT          — subject to RLS INSERT policy, works when service-role missing

All saves are best-effort: failures log the exact Supabase error and propagate
the error detail string to callers. Returns (saved_uuid, error_detail) tuples.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.models.schemas import (
    AnalysisResponse,
    SessionAnalysisResponse,
    TournamentAnalysisResponse,
    VisionAnalysisResponse,
)

logger = logging.getLogger(__name__)

# Columns known to exist in any schema version — used as fallback when full insert fails.
_CORE_COLUMNS = frozenset({
    "id", "user_id", "input_type", "raw_hand_text",
    "site", "game_type", "stakes", "hero_position",
    "hero_cards", "board", "effective_stack_bb",
    "overall_score", "ai_coaching", "mistakes_count", "analyzed_at",
})


def _build_headers(user_jwt: str | None = None) -> tuple[dict[str, str], str]:
    """Return (headers, auth_method) for Supabase REST calls.

    Uses service-role key when available (bypasses RLS).
    Falls back to user JWT + anon key when service-role not configured.
    """
    s = get_settings()
    if s.supabase_service_role_key:
        return {
            "apikey": s.supabase_service_role_key,
            "Authorization": f"Bearer {s.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }, "service_role"
    if user_jwt and s.supabase_anon_key:
        return {
            "apikey": s.supabase_anon_key,
            "Authorization": f"Bearer {user_jwt}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }, "user_jwt"
    return {}, ""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _flat_board(board_obj) -> list[str]:
    """Flatten BoardCards object → ['Ah', 'Kd', '2c'] for frontend rendering."""
    if board_obj is None:
        return []
    flop  = board_obj.flop  if hasattr(board_obj, "flop")  else []
    turn  = board_obj.turn  if hasattr(board_obj, "turn")  else []
    river = board_obj.river if hasattr(board_obj, "river") else []
    return (flop or []) + (turn or []) + (river or [])


async def _post_minimal(
    payload: dict,
    user_id: str,
    label: str,
    headers: dict,
) -> tuple[str, str]:
    """Fallback: insert only _CORE_COLUMNS to handle schema-drift situations."""
    s = get_settings()
    minimal = {k: v for k, v in payload.items() if k in _CORE_COLUMNS}
    url = f"{s.supabase_url}/rest/v1/hand_analyses"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=minimal)
        if resp.status_code in (200, 201):
            try:
                rows = resp.json()
                saved_id = rows[0]["id"] if (isinstance(rows, list) and rows) else minimal.get("id", "")
            except Exception:
                saved_id = minimal.get("id", "")
            logger.info("%s: minimal-insert OK id=%s user=%s", label, saved_id, user_id)
            return str(saved_id), ""
        err = resp.text[:400]
        logger.error("%s: minimal-insert FAILED user=%s status=%d body=%s", label, user_id, resp.status_code, err)
        return "", f"minimal_insert: status={resp.status_code} body={err}"
    except Exception as exc:
        return "", f"minimal_insert_network: {exc}"


async def _post_row(
    payload: dict,
    user_id: str,
    label: str,
    user_jwt: str | None = None,
) -> tuple[str, str]:
    """POST payload to hand_analyses. Returns (row_id, error_detail).

    row_id is "" and error_detail is non-empty on any failure.
    On schema-mismatch (unknown column), retries with _CORE_COLUMNS only.
    """
    s = get_settings()

    if not s.supabase_url:
        msg = "SUPABASE_URL not configured"
        logger.error("%s: %s — save skipped for user=%s", label, msg, user_id)
        return "", msg

    headers, auth_method = _build_headers(user_jwt)
    if not headers:
        msg = "no_credentials: SUPABASE_SERVICE_ROLE_KEY not set and no user JWT available"
        logger.error("%s: %s for user=%s", label, msg, user_id)
        return "", msg

    row_id = str(payload.get("id", ""))
    url = f"{s.supabase_url}/rest/v1/hand_analyses"

    logger.info(
        "%s: inserting id=%s user=%s auth=%s columns=%s replay=%s",
        label, row_id, user_id, auth_method,
        list(payload.keys()),
        payload.get("replay_state") is not None,
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code in (200, 201):
            try:
                rows = resp.json()
                saved_id = rows[0]["id"] if (isinstance(rows, list) and rows) else row_id
            except Exception:
                saved_id = row_id
            logger.info("%s: saved id=%s user=%s auth=%s", label, saved_id, user_id, auth_method)
            return str(saved_id), ""

        # Parse Supabase error body
        try:
            err_body = resp.json()
            pg_code = err_body.get("code", "")
            pg_msg  = err_body.get("message", "") or resp.text[:300]
            hint    = err_body.get("hint", "") or ""
        except Exception:
            pg_code, pg_msg, hint = "", resp.text[:300], ""

        error_detail = f"status={resp.status_code} pg_code={pg_code} msg={pg_msg}"
        logger.error(
            "%s: INSERT FAILED user=%s id=%s auth=%s | %s | hint=%s",
            label, user_id, row_id, auth_method, error_detail, hint,
        )

        # 42703 = undefined_column, 42P01 = undefined_table
        is_schema_error = (
            pg_code in ("42703", "42P01")
            or "does not exist" in pg_msg
            or "column" in pg_msg.lower()
        )
        if resp.status_code in (400, 422) and is_schema_error:
            logger.warning(
                "%s: schema mismatch detected — retrying with core columns only for user=%s",
                label, user_id,
            )
            min_id, min_err = await _post_minimal(payload, user_id, label, headers)
            if min_id:
                return min_id, ""
            return "", f"{error_detail} | fallback_also_failed: {min_err}"

        return "", error_detail

    except Exception as exc:
        msg = f"network_error: {exc}"
        logger.error("%s: %s user=%s", label, msg, user_id)
        return "", msg


# ── Public save functions ────────────────────────────────────────────────────

async def save_hand_analysis(
    user_id: str,
    raw_text: str,
    result: AnalysisResponse,
    user_jwt: str | None = None,
) -> tuple[str, str]:
    """Persist a text hand analysis. Returns (saved_uuid, error_detail)."""
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

    return await _post_row(payload, user_id, "save_hand_analysis", user_jwt)


async def save_session_analysis(
    user_id: str,
    raw_text: str,
    result: SessionAnalysisResponse,
    user_jwt: str | None = None,
) -> tuple[str, str]:
    """Persist a session review. Returns (saved_uuid, error_detail)."""
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

    return await _post_row(payload, user_id, "save_session_analysis", user_jwt)


async def save_tournament_analysis(
    user_id: str,
    raw_text: str,
    result: TournamentAnalysisResponse,
    user_jwt: str | None = None,
) -> tuple[str, str]:
    """Persist a tournament review. Returns (saved_uuid, error_detail)."""
    stats = result.tournament_stats
    tournament_data = {
        "total_hands_found": result.total_hands_found,
        "hands_parsed": result.hands_parsed,
        "tournament_stats": stats.model_dump() if stats else {},
        "selected_hands": [h.model_dump() for h in (result.selected_hands or [])],
        "all_hands_count": len(result.all_hands) if result.all_hands else 0,
    }

    payload: dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "input_type": "text",
        "raw_hand_text": raw_text,
        "site": "",
        "game_type": stats.tournament_type if stats else "MTT",
        "stakes": stats.buy_in if stats else "",
        "hero_position": "",
        "hero_cards": [],
        "board": [],
        "actions": [],
        "effective_stack_bb": float(stats.avg_stack_bb if stats else 0),
        "spot_classification": {},
        "board_texture": {},
        "findings": [],
        "overall_score": 0,
        "ai_coaching": stats.ai_summary if stats else "",
        "mistakes_count": 0,
        "replay_state": tournament_data,
        "analysis_type": "tournament",
        "analyzed_at": _now(),
    }

    return await _post_row(payload, user_id, "save_tournament_analysis", user_jwt)


async def save_image_analysis(
    user_id: str,
    result: VisionAnalysisResponse,
    user_jwt: str | None = None,
) -> tuple[str, str]:
    """Persist a screenshot-based analysis. Returns (saved_uuid, error_detail)."""
    analysis = result.analysis
    summary  = analysis.hand_summary if analysis else None
    verdict  = analysis.overall_verdict if analysis else None

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

    return await _post_row(payload, user_id, "save_image_analysis", user_jwt)
