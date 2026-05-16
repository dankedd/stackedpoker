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

_UNLIMITED_PLANS = {"admin", "pro", "premium"}


def _supabase_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _default_free_profile() -> dict:
    return {"subscription_tier": "free", "hands_analyzed_count": 0, "analyses_limit": 3}


async def _ensure_profile(user_id: str) -> None:
    """Best-effort: insert a default free profile row if one is missing."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return
    url = f"{settings.supabase_url}/rest/v1/profiles"
    headers = {
        **_supabase_headers(),
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    payload = {
        "id": user_id,
        "subscription_tier": "free",
        "hands_analyzed_count": 0,
        "analyses_limit": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code not in (200, 201, 204):
            logger.warning(
                "Failed to auto-create profile for user %s: %s %s",
                user_id, resp.status_code, resp.text[:200],
            )
        else:
            logger.info("Auto-created default profile for user %s", user_id)
    except Exception as exc:
        logger.warning("Error auto-creating profile for user %s: %s", user_id, exc)


async def get_user_profile(user_id: str) -> dict:
    """Fetch plan + usage for a user via the service role key (bypasses RLS).

    Never raises on infrastructure failures — returns safe defaults so that a
    Supabase outage or missing migration never hard-blocks analysis.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.debug("Supabase not configured — using admin fallback for user %s", user_id)
        return {"subscription_tier": "admin", "hands_analyzed_count": 0, "analyses_limit": 9999}

    url = f"{settings.supabase_url}/rest/v1/profiles"
    params = {
        "id": f"eq.{user_id}",
        "select": "subscription_tier,hands_analyzed_count,analyses_limit",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=_supabase_headers(), params=params)
    except Exception as exc:
        logger.warning("Supabase profile fetch network error for user %s: %s — allowing with defaults", user_id, exc)
        return _default_free_profile()

    if resp.status_code != 200:
        logger.warning(
            "Supabase profile fetch failed (%s) for user %s: %s — allowing with defaults",
            resp.status_code, user_id, resp.text[:300],
        )
        return _default_free_profile()

    rows = resp.json()
    if not rows:
        logger.info("No profile row found for user %s — inserting default and allowing analysis", user_id)
        await _ensure_profile(user_id)
        return _default_free_profile()

    row = rows[0]
    profile = {
        "subscription_tier": row.get("subscription_tier") or "free",
        "hands_analyzed_count": int(row.get("hands_analyzed_count") or 0),
        "analyses_limit": int(row.get("analyses_limit") or 3),
    }
    logger.debug(
        "Profile for user %s: plan=%s used=%s limit=%s",
        user_id, profile["subscription_tier"], profile["hands_analyzed_count"], profile["analyses_limit"],
    )
    return profile


def assert_usage_allowed(profile: dict) -> None:
    """Raise 403 if the user has hit their analysis limit. Admin/pro always pass."""
    plan = profile.get("subscription_tier") or "free"
    if plan in _UNLIMITED_PLANS:
        return

    used: int  = int(profile.get("hands_analyzed_count") or 0)
    limit: int = int(profile.get("analyses_limit") or 3)

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
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=_supabase_headers(), json={"p_user_id": user_id})
        if resp.status_code not in (200, 204):
            logger.warning(
                "Failed to increment usage for user %s: %s %s",
                user_id, resp.status_code, resp.text[:200],
            )
        else:
            logger.debug("Incremented usage for user %s", user_id)
    except Exception as exc:
        logger.warning("Error incrementing usage for user %s: %s", user_id, exc)
