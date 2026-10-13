"""
Free / Pro entitlements — the backend's view of supabase_subscriptions.sql.

The database owns every decision (effective_plan, limits, Amsterdam-day
counters); this module only calls its service-role RPCs:

  get_entitlements(user_id)        plan, limits and current usage
  consume_usage(user_id, metric)   atomic check-and-increment ('trainer_hand', 'ai_question')
  release_usage(user_id, metric)   give one back after a failed request

Nothing here accepts a plan, limit or count from the client.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

PLANS = ("free", "trial", "pro")


@dataclass
class UsageResult:
    allowed: bool
    used: int
    limit: int | None  # None = unlimited
    plan: str
    reset_at: str

    @property
    def is_paid(self) -> bool:
        """Pro and trial share the same (unlimited / fair-use) limits."""
        return self.plan != "free"

    def to_dict(self) -> dict:
        return {"allowed": self.allowed, "used": self.used, "limit": self.limit, "plan": self.plan, "reset_at": self.reset_at}


def _headers(settings) -> dict:
    key = settings.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


async def _rpc(fn: str, args: dict, settings):
    url = f"{settings.supabase_url}/rest/v1/rpc/{fn}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=_headers(settings), json=args)
        r.raise_for_status()
        return r.json()


def _usage(row: dict) -> UsageResult:
    plan = row.get("plan") if row.get("plan") in PLANS else "free"
    return UsageResult(
        allowed=bool(row.get("allowed", False)),
        used=int(row.get("used") or 0),
        limit=row.get("limit"),
        plan=plan,
        reset_at=str(row.get("reset_at") or ""),
    )


async def consume_usage(user_id: str, metric: str, settings) -> UsageResult:
    """Raises httpx.HTTPError when the database can't be reached — the caller
    decides whether that blocks the request."""
    return _usage(await _rpc("consume_usage", {"p_user_id": user_id, "p_metric": metric}, settings) or {})


async def release_usage(user_id: str, metric: str, settings) -> None:
    """Best-effort: a failed release must never mask the error being handled."""
    try:
        await _rpc("release_usage", {"p_user_id": user_id, "p_metric": metric}, settings)
    except Exception:
        logger.exception("release_usage_failed user=%s metric=%s", user_id, metric)


async def get_entitlements(user_id: str, settings) -> dict:
    return await _rpc("get_entitlements", {"p_user_id": user_id}, settings) or {}
