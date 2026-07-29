"""AI Coach daily usage quota — server-authoritative, concurrency-safe.

Temporary flat limit (10 messages/UTC day, same for every user) structured
so a future subscription-tier system only has to change
`get_ai_coach_entitlement` — nothing in coach.py, CoachChat.tsx, or the
quota-enforcement RPCs needs to know why a given user has a given limit.

See supabase_ai_coach_usage_schema.sql for the `ai_coach_usage` table and
the `reserve_coach_usage`/`release_coach_usage` RPCs this module calls.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

# Entitlement seam: today, every user gets the same "default" tier. A
# subscription system later adds keys here (free/starter/pro/premium) and
# get_ai_coach_entitlement looks up the user's actual tier instead of always
# returning "default" — no caller of this module needs to change.
AI_COACH_LIMITS: dict[str, dict] = {
    "default": {"daily_messages": 10},
}


def get_ai_coach_entitlement(user_id: str) -> dict:
    """Resolves a user's AI Coach entitlement. `user_id` is accepted (not yet
    used) so a future subscription lookup can key off it without changing
    this function's signature or any caller."""
    del user_id  # unused today — kept in the signature for the future lookup
    return AI_COACH_LIMITS["default"]


@dataclass
class CoachUsage:
    limit: int
    used: int
    remaining: int
    reset_at: str  # ISO8601, next UTC midnight

    def to_dict(self) -> dict:
        return {"limit": self.limit, "used": self.used, "remaining": self.remaining, "reset_at": self.reset_at}


def compute_reset_at() -> str:
    """Next UTC midnight, as an ISO8601 string. "Per day" is defined as one
    UTC calendar day — deliberately not the client's local Date(), and not
    (yet) a per-user timezone, until a real timezone/entitlement system
    exists. Documented here rather than left implicit."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    reset = datetime.combine(tomorrow, datetime.min.time(), tzinfo=timezone.utc)
    return reset.isoformat()


# ── Supabase REST helpers (local to this module — mirrors coach.py's own) ────

def _sb_headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def _supabase_post(path: str, data: dict, settings) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{path}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=_sb_headers(settings), json=data)
        r.raise_for_status()
        return r.json()


async def _supabase_get(path: str, query: str, settings) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{path}?{query}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, headers=_sb_headers(settings))
        r.raise_for_status()
        return r.json()


async def reserve_coach_usage(user_id: str, settings) -> tuple[CoachUsage, bool]:
    """Atomically checks-and-increments today's usage via the
    reserve_coach_usage RPC (see supabase_ai_coach_usage_schema.sql).
    Returns (usage, allowed). Never trusts a client-supplied count — the
    entitlement limit is resolved server-side and the increment/check is one
    atomic SQL statement, so concurrent requests for the same user can never
    both land the same final slot."""
    entitlement = get_ai_coach_entitlement(user_id)
    limit = entitlement["daily_messages"]
    rows = await _supabase_post(
        "rpc/reserve_coach_usage",
        {"p_user_id": user_id, "p_daily_limit": limit},
        settings,
    )
    row = rows[0] if rows else {"message_count": 0, "allowed": False}
    used = row.get("message_count", 0)
    allowed = bool(row.get("allowed", False))
    usage = CoachUsage(limit=limit, used=used, remaining=max(limit - used, 0), reset_at=compute_reset_at())
    return usage, allowed


async def release_coach_usage(user_id: str, settings) -> None:
    """Rolls back one reserved-but-never-processed request (the LLM call
    itself failed after the quota gate already let it through) — best-effort,
    a release failure must never mask the original error the caller is
    already handling."""
    try:
        await _supabase_post("rpc/release_coach_usage", {"p_user_id": user_id}, settings)
    except Exception:
        logger.exception("coach_usage_release_failed user=%s", user_id)


async def get_coach_usage(user_id: str, settings) -> CoachUsage:
    """Read-only — no side effects, safe to call on every page load/drawer
    open so the frontend shows correct usage even before any message is sent
    this session (and after a refresh)."""
    entitlement = get_ai_coach_entitlement(user_id)
    limit = entitlement["daily_messages"]
    today = datetime.now(timezone.utc).date().isoformat()
    rows = await _supabase_get(
        "ai_coach_usage",
        f"user_id=eq.{user_id}&usage_date=eq.{today}&select=message_count",
        settings,
    )
    used = rows[0]["message_count"] if rows else 0
    return CoachUsage(limit=limit, used=used, remaining=max(limit - used, 0), reset_at=compute_reset_at())
