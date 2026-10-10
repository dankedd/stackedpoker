"""
"Ask the coach" in the hand replayer — the existing AI coach (same model call,
system prompt, daily quota, rate limit and training_sessions storage as
routes/coach.py), with a HAND REVIEW mode whose context is built here,
server-side, from the caller's own stored hand.

The browser only sends a hand id, the replayer step and the question. The hand
is loaded with `id = hand_id AND user_id = caller`; any other id is a 404
before the quota is touched or the model is called.

One conversation per user per hand: a training_sessions row with
session_type 'hand_review' and context {"hand_ref": <hand id>}. "New
conversation" closes it ({"closed": true}) and the next message starts another.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.api.routes.coach import _supabase_get, _supabase_patch, _supabase_post
from app.config import get_settings
from app.engines.hand_review.context import build_hand_context
from app.engines.learn.ai_coach import CoachUnavailableError, generate_coach_reply
from app.engines.learn.coach_context import MAX_MESSAGE_LENGTH
from app.engines.learn.coach_usage import release_coach_usage, reserve_coach_usage
from app.engines.learn.xp_calculator import level_for_xp
from app.middleware.auth import get_current_user
from app.middleware.rate_limiter import _check_rate_limit, _get_ip

logger = logging.getLogger(__name__)
router = APIRouter(tags=["hand-coach"])

SESSION_TYPE = "hand_review"
HAND_COLUMNS = "data,raw_text,preflop_check,preflop_detail,analysis,favorited_at"
HAND_COLUMNS_FALLBACK = "data,raw_text,preflop_check,preflop_detail"  # before the analysis/favourites migrations


class HandCoachMessage(BaseModel):
    hand_id: UUID
    message: str
    step_index: int | None = Field(default=None, ge=0, le=10_000)

    @field_validator("message")
    @classmethod
    def _bounded(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty.")
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message too long (max {MAX_MESSAGE_LENGTH} characters).")
        return v


async def load_own_hand(hand_id: UUID, user_id: str, settings) -> dict:
    """The caller's hand, or 404 — never anyone else's."""
    base = f"id=eq.{hand_id}&user_id=eq.{user_id}"
    try:
        rows = await _supabase_get("hh_hands", f"{base}&select={HAND_COLUMNS}", settings)
    except httpx.HTTPStatusError as e:
        if e.response is None or e.response.status_code != 400:
            raise
        rows = await _supabase_get("hh_hands", f"{base}&select={HAND_COLUMNS_FALLBACK}", settings)
    if not rows:
        raise HTTPException(status_code=404, detail="Hand not found.")
    return rows[0]


async def _notes(hand_id: UUID, user_id: str, settings) -> list[dict]:
    try:
        return await _supabase_get("hh_hand_notes", f"hand_ref=eq.{hand_id}&user_id=eq.{user_id}&select=street,body", settings)
    except httpx.HTTPError:
        return []


async def _open_session(hand_id: UUID, user_id: str, settings) -> dict | None:
    rows = await _supabase_get(
        "training_sessions",
        f"user_id=eq.{user_id}&session_type=eq.{SESSION_TYPE}&context->>hand_ref=eq.{hand_id}"
        "&context->>closed=is.null&order=started_at.desc&limit=1&select=id,messages,context",
        settings,
    )
    return rows[0] if rows else None


async def _user_level(user_id: str, settings) -> int:
    try:
        rows = await _supabase_get("user_skill_progress", f"user_id=eq.{user_id}&select=total_xp", settings)
        return level_for_xp(rows[0].get("total_xp", 0)) if rows else 1
    except Exception:
        return 1


def _wire_messages(messages: list[dict]) -> list[dict]:
    return [{"role": "user" if m.get("role") == "user" else "coach", "content": m.get("content", ""), "ts": m.get("ts")} for m in messages]


# ── GET /hand-coach/{hand_id} — the open conversation for this hand ──────────

@router.get("/hand-coach/{hand_id}")
async def get_conversation(hand_id: UUID, current_user: dict = Depends(get_current_user)) -> dict:
    settings = get_settings()
    user_id = current_user.get("sub", "")
    try:
        await load_own_hand(hand_id, user_id, settings)
        session = await _open_session(hand_id, user_id, settings)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not load the conversation.")
    if not session:
        return {"session_id": None, "messages": []}
    return {"session_id": session["id"], "messages": _wire_messages(session.get("messages") or [])}


# ── POST /hand-coach/{hand_id}/new — close the conversation ──────────────────

@router.post("/hand-coach/{hand_id}/new")
async def new_conversation(hand_id: UUID, current_user: dict = Depends(get_current_user)) -> dict:
    settings = get_settings()
    user_id = current_user.get("sub", "")
    try:
        await load_own_hand(hand_id, user_id, settings)
        session = await _open_session(hand_id, user_id, settings)
        if session:
            await _supabase_patch(
                "training_sessions",
                f"id=eq.{session['id']}&user_id=eq.{user_id}",
                {"context": {**(session.get("context") or {}), "closed": True}},
                settings,
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not start a new conversation.")
    return {"session_id": None, "messages": []}


# ── POST /hand-coach/message ─────────────────────────────────────────────────

@router.post("/hand-coach/message")
async def hand_coach_message(
    body: HandCoachMessage,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    req_id = uuid.uuid4().hex[:8]

    allowed, retry_after = _check_rate_limit(_get_ip(request), "/api/coach/message")
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many coach messages. Please slow down.", headers={"Retry-After": str(retry_after)})

    # Ownership first: a foreign or unknown hand costs nothing and reveals nothing.
    try:
        row = await load_own_hand(body.hand_id, user_id, settings)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not load the hand.")

    stage = "QUOTA_RESERVATION"
    try:
        usage, ok = await reserve_coach_usage(user_id, settings)
        if not ok:
            raise HTTPException(status_code=429, detail={"code": "AI_COACH_DAILY_LIMIT_REACHED", **usage.to_dict()})

        stage = "SESSION"
        now = datetime.now(timezone.utc).isoformat()
        session = await _open_session(body.hand_id, user_id, settings)
        if session:
            session_id = session["id"]
            messages: list[dict] = session.get("messages") or []
        else:
            session_id = str(uuid.uuid4())
            messages = []
            await _supabase_post(
                "training_sessions",
                {
                    "id": session_id,
                    "user_id": user_id,
                    "session_type": SESSION_TYPE,
                    "messages": [],
                    "context": {"hand_ref": str(body.hand_id)},
                    "started_at": now,
                    "updated_at": now,
                },
                settings,
            )
        messages.append({"role": "user", "content": body.message, "ts": now})

        stage = "CONTEXT"
        notes = await _notes(body.hand_id, user_id, settings)
        llm_context = {"hand_review_block": build_hand_context(row, notes, body.step_index)}
        logger.info("hand_coach_request req_id=%s user=%s step=%s", req_id, user_id, body.step_index)

        stage = "LLM"
        reply = await generate_coach_reply(messages, llm_context, await _user_level(user_id, settings), mode="hand_review")

        stage = "SESSION"
        reply_ts = datetime.now(timezone.utc).isoformat()
        messages.append({"role": "assistant", "content": reply, "ts": reply_ts})
        await _supabase_patch(
            "training_sessions",
            f"id=eq.{session_id}&user_id=eq.{user_id}",
            {"messages": messages, "updated_at": reply_ts},
            settings,
        )
        return {"session_id": session_id, "reply": reply, "message_count": len(messages), "usage": usage.to_dict()}

    except HTTPException:
        raise
    except CoachUnavailableError as e:
        await release_coach_usage(user_id, settings)
        logger.error("hand_coach_llm_unavailable req_id=%s user=%s stage=%s exc_type=%s", req_id, user_id, stage, type(e).__name__)
        raise HTTPException(status_code=503, detail="The coach is temporarily unavailable. Please try again shortly.")
    except httpx.HTTPError as e:
        logger.error("hand_coach_db_error req_id=%s user=%s stage=%s exc_type=%s", req_id, user_id, stage, type(e).__name__)
        raise HTTPException(status_code=502, detail="Something went wrong processing your message. Please try again.")
    except Exception as e:
        logger.exception("hand_coach_unhandled req_id=%s user=%s stage=%s exc_type=%s", req_id, user_id, stage, type(e).__name__)
        raise HTTPException(status_code=500, detail="Coach unavailable. Please try again.")
