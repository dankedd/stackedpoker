"""
Usage & access control service.

All checks are server-side via Supabase REST API using the service role key,
which bypasses RLS. The service role key is never exposed to the frontend.

Plan hierarchy:
  free  → limited (default: 3 analyses)
  pro   → unlimited (future paid tier)
  admin → unlimited + no tracking block
"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)

_UNLIMITED_PLANS = {"admin", "pro"}


def _supabase_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def get_user_profile(user_id: str) -> dict:
    """Fetch plan + usage for a user via the service role key (bypasses RLS)."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        # No Supabase configured — allow all (dev/test fallback)
        return {"subscription_tier": "admin", "hands_analyzed_count": 0, "analyses_limit": 9999}

    url = f"{settings.supabase_url}/rest/v1/profiles"
    params = {
        "id": f"eq.{user_id}",
        "select": "subscription_tier,hands_analyzed_count,analyses_limit",
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(url, headers=_supabase_headers(), params=params)

    if resp.status_code != 200:
        logger.warning("Supabase profile fetch failed (%s): %s", resp.status_code, resp.text)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not verify account status")

    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User profile not found")

    return rows[0]


def assert_usage_allowed(profile: dict) -> None:
    """Raise 403 if the user has hit their analysis limit. Admin/pro always pass."""
    plan = profile.get("subscription_tier", "free")
    if plan in _UNLIMITED_PLANS:
        return

    used: int  = profile.get("hands_analyzed_count", 0)
    limit: int = profile.get("analyses_limit", 3)

    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "limit_reached",
                "used": used,
                "limit": limit,
                "plan": plan,
                "message": f"You've used all {limit} free analyses. Upgrade to continue.",
            },
        )


async def increment_usage(user_id: str) -> None:
    """Atomically increment hands_analyzed_count via a Supabase RPC function."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return  # dev/test fallback — no-op

    url = f"{settings.supabase_url}/rest/v1/rpc/increment_analyses_used"
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(url, headers=_supabase_headers(), json={"p_user_id": user_id})

    if resp.status_code not in (200, 204):
        # Non-fatal: log and continue — analysis result is already returned to user
        logger.warning("Failed to increment usage for user %s: %s %s", user_id, resp.status_code, resp.text)
