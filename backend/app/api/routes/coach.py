"""AI coach API routes — conversation sessions with a GPT-4o poker coach."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.middleware.rate_limiter import _PATH_LIMITS, _check_rate_limit, _get_ip
from app.engines.learn.ai_coach import CoachUnavailableError, generate_coach_reply
from app.engines.learn.coach_context import (
    MAX_MESSAGE_LENGTH,
    extract_concept_ids,
    ground_theory,
    lookup_canonical_open_range,
    resolve_coaching_mode,
    sanitize_context,
)
from app.engines.learn.coach_usage import get_coach_usage, release_coach_usage, reserve_coach_usage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["coach"])

# Coach messages hit an LLM on every call — tighter than the default path
# limit. This only adds a new key to the shared rate-limit rule table (it
# does not touch any existing path's limit), and the middleware itself is
# only consulted here via `_check_rate_limit` — no global registration, so
# no other route's traffic is affected.
_PATH_LIMITS.setdefault("/api/coach", (20, 60))  # 20 requests / 60s per IP


# ── Supabase REST helpers (local to this module) ──────────────────────────────

def _sb_headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def _supabase_get(table: str, query: str, settings) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{table}?{query}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, headers=_sb_headers(settings))
        r.raise_for_status()
        return r.json()


async def _supabase_post(table: str, data: dict, settings) -> dict:
    url = f"{settings.supabase_url}/rest/v1/{table}"
    headers = {**_sb_headers(settings), "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=headers, json=data)
        r.raise_for_status()
        result = r.json()
        return result[0] if result else {}


async def _supabase_patch(table: str, query: str, data: dict, settings) -> None:
    url = f"{settings.supabase_url}/rest/v1/{table}?{query}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(url, headers=_sb_headers(settings), json=data)
        r.raise_for_status()


# ── Request body ──────────────────────────────────────────────────────────────

# Quick-action id -> the user-facing label stored/sent as the message when the
# client triggers the action via a button rather than typing free text (see
# LessonCoachDrawer.tsx) — keeps the transcript reading naturally either way.
ACTION_LABELS: dict[str, str] = {
    "hint": "Give me a hint",
    "explain_concept": "Explain the concept",
    "walkthrough": "Walk me through it",
    "why_wrong": "Why was my answer wrong?",
    "why_correct": "Why is this correct?",
    "key_takeaway": "What should I remember?",
}


class CoachMessageBody(BaseModel):
    session_id: str | None = None
    message: str = ""
    context: dict = {}
    action: Literal[
        "hint", "explain_concept", "walkthrough", "why_wrong", "why_correct", "key_takeaway",
    ] | None = None

    @field_validator("message")
    @classmethod
    def _bounded_message(cls, v: str) -> str:
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message too long (max {MAX_MESSAGE_LENGTH} characters).")
        return v


async def _step_already_completed(user_id: str, lesson_id: str, step_id: str, settings) -> bool:
    """Server-side check for whether the learner has actually finished this
    step — the only thing allowed to unlock answer-key fields for it. Never
    trusts a client-supplied flag (mirrors the verify-don't-trust pattern
    already used for achievement/module completion in routes/learn.py)."""
    try:
        rows = await _supabase_get(
            "user_step_progress",
            f"user_id=eq.{user_id}&lesson_id=eq.{lesson_id}&step_id=eq.{step_id}&select=attempts",
            settings,
        )
        return bool(rows) and (rows[0].get("attempts") or 0) >= 1
    except httpx.HTTPError:
        # Fail closed — if we can't verify completion, treat as not completed.
        return False


# ── POST /coach/message ───────────────────────────────────────────────────────

@router.post("/coach/message")
async def coach_message(
    body: CoachMessageBody,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Send a message to the AI coach and receive a reply.

    If session_id is None, a new session is created automatically.
    The full conversation history is stored in training_sessions.
    """
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    req_id = uuid.uuid4().hex[:8]  # correlates this request's log lines without exposing anything sensitive

    # A quick-action click (LessonCoachDrawer's Hint/Explain/Walkthrough/Why
    # buttons) sends no typed text — synthesize the stored/sent message from
    # its label so the transcript reads naturally either way.
    effective_message = body.message.strip() or ACTION_LABELS.get(body.action or "", "")
    if not effective_message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    allowed, retry_after = _check_rate_limit(_get_ip(request), "/api/coach/message")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many coach messages. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        # ── Daily quota gate (server-authoritative, concurrency-safe) ───────────
        # Checked before any session/DB work: a rejected request creates no
        # session and never reaches the LLM, so it costs the user nothing.
        # reserve_coach_usage does the check-and-increment atomically in a
        # single SQL statement — see supabase_ai_coach_usage_schema.sql.
        usage, allowed = await reserve_coach_usage(user_id, settings)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={"code": "AI_COACH_DAILY_LIMIT_REACHED", **usage.to_dict()},
            )

        now = datetime.now(timezone.utc).isoformat()

        # ── Resolve or create session ─────────────────────────────────────────
        if body.session_id:
            rows = await _supabase_get(
                "training_sessions",
                f"id=eq.{body.session_id}&user_id=eq.{user_id}&select=*",
                settings,
            )
            if not rows:
                raise HTTPException(status_code=404, detail="Session not found.")
            session = rows[0]
            messages: list[dict] = session.get("messages") or []
            session_id = body.session_id
        else:
            # New session
            session_id = str(uuid.uuid4())
            messages = []
            session = await _supabase_post(
                "training_sessions",
                {
                    "id": session_id,
                    "user_id": user_id,
                    "session_type": "chat",
                    "messages": [],
                    "context": body.context,
                    "started_at": now,
                    "updated_at": now,
                },
                settings,
            )

        # ── Append user message ───────────────────────────────────────────────
        messages.append({"role": "user", "content": effective_message, "ts": now})

        # ── Determine user skill level from progress ──────────────────────────
        user_level = 1
        try:
            progress_rows = await _supabase_get(
                "user_progress",
                f"user_id=eq.{user_id}&select=level",
                settings,
            )
            if progress_rows:
                user_level = progress_rows[0].get("level", 1)
        except Exception:
            pass  # non-critical — fall back to level 1

        # ── Resolve coaching mode + sanitize context (server-enforced) ─────────
        # Merge stored context with the context sent in this request. The mode
        # and answer-key visibility are then derived here — never trusted from
        # a client-supplied flag — before anything reaches the LLM.
        raw_merged = {**(session.get("context") or {}), **body.context}
        lesson_id = raw_merged.get("lessonId")
        step_id = raw_merged.get("stepId")
        step_verified = (
            await _step_already_completed(user_id, lesson_id, step_id, settings)
            if lesson_id and step_id else False
        )
        mode = resolve_coaching_mode(raw_merged, step_verified)
        safe_context = sanitize_context(raw_merged, mode)
        theory = ground_theory(extract_concept_ids(safe_context))

        # Best-effort real-data enrichment for the LLM call only — never
        # persisted, so the stored session context stays a faithful record of
        # what the client actually sent (see canonical_range docstring for
        # the narrow conditions this activates under).
        canonical = lookup_canonical_open_range(safe_context)
        llm_context = {**safe_context, **canonical} if canonical else safe_context

        logger.info(
            "coach_request req_id=%s user=%s mode=%s action=%s lesson_id=%s step_id=%s theory_ids=%s canonical=%s",
            req_id, user_id, mode, body.action, lesson_id, step_id, [t["id"] for t in theory], bool(canonical),
        )

        # ── Generate coach reply ──────────────────────────────────────────────
        reply = await generate_coach_reply(
            messages, llm_context, user_level, mode=mode, theory=theory, action=body.action,
        )

        # ── Append assistant reply ────────────────────────────────────────────
        reply_ts = datetime.now(timezone.utc).isoformat()
        messages.append({"role": "assistant", "content": reply, "ts": reply_ts})

        # ── Persist updated messages ──────────────────────────────────────────
        # Persist the SANITIZED context, not the raw merge — so a stripped
        # answer-key field can never re-enter a later turn's context via
        # session storage.
        await _supabase_patch(
            "training_sessions",
            f"id=eq.{session_id}&user_id=eq.{user_id}",
            {
                "messages": messages,
                "context": safe_context,
                "updated_at": reply_ts,
            },
            settings,
        )

        return {
            "session_id": session_id,
            "reply": reply,
            "message_count": len(messages),
            "usage": usage.to_dict(),
        }

    except HTTPException:
        raise
    except CoachUnavailableError as e:
        # The reserved slot was never actually processed by the AI — release
        # it so a genuinely failed request costs the user nothing. Best-effort:
        # release_coach_usage already swallows its own errors internally.
        await release_coach_usage(user_id, settings)
        # The LLM request itself failed (quota/timeout/rate limit/auth/provider
        # error) — surface this as a real, distinguishable failure rather than
        # persisting a canned string into the session as if the coach had
        # actually replied. Logged already inside generate_coach_reply.
        logger.error("coach_llm_unavailable req_id=%s user=%s exc_type=%s", req_id, user_id, type(e).__name__)
        raise HTTPException(status_code=503, detail="The coach is temporarily unavailable. Please try again shortly.")
    except httpx.HTTPError as e:
        status_code = getattr(getattr(e, "response", None), "status_code", None)
        body = getattr(getattr(e, "response", None), "text", None)
        logger.error(
            "coach_db_error req_id=%s user=%s exc_type=%s upstream_status=%s upstream_body=%s",
            req_id, user_id, type(e).__name__, status_code, (body or "")[:500],
        )
        raise HTTPException(status_code=502, detail="Could not save session.")
    except Exception as e:
        logger.exception("coach_unhandled_error req_id=%s user=%s exc_type=%s", req_id, user_id, type(e).__name__)
        raise HTTPException(status_code=500, detail="Coach unavailable. Please try again.")


# ── GET /coach/usage ──────────────────────────────────────────────────────────

@router.get("/coach/usage")
async def coach_usage(current_user: dict = Depends(get_current_user)) -> dict:
    """Read-only current-usage lookup — no side effects (does not reserve a
    slot). Lets the frontend show correct usage on page load/drawer open,
    before any message has been sent this session, and after a refresh."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    try:
        usage = await get_coach_usage(user_id, settings)
        return {"usage": usage.to_dict()}
    except httpx.HTTPError:
        logger.error("coach_usage_lookup_failed user=%s", user_id)
        raise HTTPException(status_code=502, detail="Could not load usage.")


# ── GET /coach/session/{session_id} ──────────────────────────────────────────

@router.get("/coach/session/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Retrieve the full message history for a coaching session.

    Only the session owner can access their session.
    """
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        rows = await _supabase_get(
            "training_sessions",
            f"id=eq.{session_id}&user_id=eq.{user_id}&select=*",
            settings,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Session not found.")

        session = rows[0]
        return {
            "session_id": session_id,
            "user_id": user_id,
            "messages": session.get("messages") or [],
            "context": session.get("context") or {},
            "created_at": session.get("started_at"),  # DB column is `started_at`; wire key kept for API stability
            "updated_at": session.get("updated_at"),
            "message_count": len(session.get("messages") or []),
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Get session DB error session=%s user=%s: %s", session_id, user_id, e)
        raise HTTPException(status_code=502, detail="Could not load session.")
    except Exception:
        logger.exception("Get session error session=%s user=%s", session_id, user_id)
        raise HTTPException(status_code=500, detail="Session unavailable.")
