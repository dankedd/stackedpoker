"""
Central subscription-entitlement helpers — the backend mirror of
frontend/lib/entitlements.ts. Every route that needs to know "does this user
have paid access" (AI Coach quota, Learn lesson locking, any future premium
API) should call these instead of re-deriving `tier in {"pro", "premium", ...}`
locally.

Tier values match the DB CHECK constraint on profiles.subscription_tier:
free / pro / premium / admin (see supabase_schema.sql). "Plus"/"Elite" are
frontend display labels only — never used as a value here.
"""
from __future__ import annotations

PAID_TIERS = {"pro", "premium", "admin"}

# Matches usage_service.py's existing "effectively unlimited" sentinel for
# analyses_limit, reused here so the AI Coach's daily_limit int stays
# consistent with the rest of the codebase instead of inventing a second
# unlimited convention.
UNLIMITED = 2_147_483_647

FREE_AI_COACH_DAILY_LIMIT = 3


def is_paid_tier(tier: str | None) -> bool:
    return (tier or "free") in PAID_TIERS


def can_access_premium(tier: str | None) -> bool:
    """Whole-page premium features: Bankroll Tracker, Community, etc."""
    return is_paid_tier(tier)


def can_use_unlimited_ai(tier: str | None) -> bool:
    return is_paid_tier(tier)


def ai_coach_daily_limit(tier: str | None) -> int:
    return UNLIMITED if is_paid_tier(tier) else FREE_AI_COACH_DAILY_LIMIT


async def get_subscription_tier(user_id: str, settings=None) -> str:
    """Fetches the user's current tier via usage_service's existing
    service-role profile lookup — never a second, independent Supabase call.
    `settings` is forwarded as-is (see get_user_profile's own docstring).

    Imported locally (not at module level) because usage_service.py itself
    imports is_paid_tier from this module for assert_usage_allowed — a
    module-level import here would be circular.
    """
    from app.services.usage_service import get_user_profile

    profile = await get_user_profile(user_id, settings)
    return profile.get("subscription_tier") or "free"
