"""AI coach API routes — conversation sessions with GPT-4o Socratic coaching."""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.engines.learn.ai_coach import generate_coach_reply

logger = logging.getLogger(__name__)
router = APIRouter(tags=["coach"])


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


# ── POST /coach/message ───────────────────────────────────────────────────────

@router.post("/coach/message")
async def coach_message(
    body: CoachMessageBody,
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

        # ── Generate coach reply ──────────────────────────────────────────────
        # Merge stored context with the context sent in this request
        merged_context = {**(session.get("context") or {}), **body.context}
        reply = await generate_coach_reply(messages, merged_context, user_level)

        # ── Append assistant reply ────────────────────────────────────────────
        reply_ts = datetime.now(timezone.utc).isoformat()
        messages.append({"role": "assistant", "content": reply, "ts": reply_ts})

        # ── Persist updated messages ──────────────────────────────────────────
        await _supabase_patch(
            "training_sessions",
            f"id=eq.{session_id}&user_id=eq.{user_id}",
            {
                "messages": messages,
                "context": merged_context,
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
