"""
Feature availability — the backend mirror of frontend/lib/features.ts.

    "dev"     only users with development access (profiles.subscription_tier
              = 'admin') may call the feature's API; everyone else gets 403.
    "public"  normal behaviour.

To make a feature public, change it here AND in frontend/lib/features.ts
(frontend/lib/__tests__/features.test.ts fails when the two disagree).
"""
from __future__ import annotations

from fastapi import Depends, HTTPException

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.services.entitlements import get_subscription_tier

FEATURES: dict[str, str] = {
    "learn": "dev",
    "puzzles": "dev",
}


def is_feature_public(feature: str) -> bool:
    return FEATURES.get(feature) == "public"


def has_dev_access(tier: str | None) -> bool:
    return (tier or "free") == "admin"


def require_feature(feature: str):
    """FastAPI dependency: 403 unless the feature is public or the caller has dev access."""

    async def check(current_user: dict = Depends(get_current_user)) -> None:
        if is_feature_public(feature):
            return
        tier = await get_subscription_tier(current_user.get("sub", ""), get_settings())
        if not has_dev_access(tier):
            raise HTTPException(status_code=403, detail="This feature is not available yet.")

    return check
