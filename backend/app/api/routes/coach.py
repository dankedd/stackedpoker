"""AI coach API routes — conversation sessions with GPT-4o Socratic coaching."""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.middleware.rate_limiter import _PATH_LIMITS, _check_rate_limit, _get_ip
from app.engines.learn.ai_coach import generate_coach_reply
from app.engines.learn.coach_context import (
    MAX_MESSAGE_LENGTH,
    extract_concept_ids,
    ground_theory,
    resolve_coaching_mode,
    sanitize_context,
)

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

class CoachMessageBody(BaseModel):
    session_id: str | None = None
    message: str
    context: dict = {}

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
    Send a message to the AI coach and receive a Socratic reply.

    If session_id is None, a new session is created automatically.
    The full conversation history is stored in training_sessions.
    """
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    allowed, retry_after = _check_rate_limit(_get_ip(request), "/api/coach/message")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many coach messages. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
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
                    "messages": [],
                    "context": body.context,
                    "created_at": now,
                    "updated_at": now,
                },
                settings,
            )

        # ── Append user message ───────────────────────────────────────────────
        messages.append({"role": "user", "content": body.message, "ts": now})

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

        logger.info(
            "coach_request user=%s mode=%s lesson_id=%s step_id=%s theory_ids=%s",
            user_id, mode, lesson_id, step_id, [t["id"] for t in theory],
        )

        # ── Generate coach reply ──────────────────────────────────────────────
        reply = await generate_coach_reply(messages, safe_context, user_level, mode=mode, theory=theory)

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
        }

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Coach message DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not save session.")
    except Exception:
        logger.exception("Coach message error user=%s", user_id)
        raise HTTPException(status_code=500, detail="Coach unavailable. Please try again.")


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
            "created_at": session.get("created_at"),
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
