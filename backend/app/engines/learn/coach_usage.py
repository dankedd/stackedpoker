"""AI Coach daily usage quota — server-authoritative, concurrency-safe.

Backed by supabase_subscriptions.sql: consume_usage/release_usage with metric
'ai_question' and get_entitlements for the read-only view. The database
resolves the plan and the limit (Free 3/day; Pro and trial a hidden
fair-use cap, plan_limits.pro_ai_questions_per_day) and counts per
Europe/Amsterdam calendar day — nothing in coach.py, hand_coach.py or
CoachChat.tsx needs to know why a user has a given limit.

Pro/trial usage is reported as `unlimited` with the UNLIMITED sentinel as
the limit, so the fair-use number never reaches the browser.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.services import billing
from app.services.entitlements import UNLIMITED

logger = logging.getLogger(__name__)

METRIC = "ai_question"

FAIR_USE_MESSAGE = (
    "You've reached today's fair-use limit for the AI Coach. "
    "It resets at midnight (Amsterdam time)."
)


@dataclass
class CoachUsage:
    limit: int
    used: int
    remaining: int
    reset_at: str  # ISO8601, next 00:00 Europe/Amsterdam (computed by the database)
    unlimited: bool = False

    def to_dict(self) -> dict:
        return {
            "limit": self.limit, "used": self.used, "remaining": self.remaining,
            "reset_at": self.reset_at, "unlimited": self.unlimited,
        }

    def limit_error_detail(self) -> dict:
        """429 body for a refused question. Free users get the quota shape
        CoachChat turns into the upgrade panel; Pro users hitting the hidden
        fair-use cap get a plain message instead."""
        if self.unlimited:
            return {"code": "AI_COACH_FAIR_USE_LIMIT", "message": FAIR_USE_MESSAGE, "reset_at": self.reset_at}
        return {"code": "AI_COACH_DAILY_LIMIT_REACHED", **self.to_dict()}


def _from_result(r: billing.UsageResult) -> CoachUsage:
    if r.is_paid:
        return CoachUsage(limit=UNLIMITED, used=r.used, remaining=max(UNLIMITED - r.used, 0), reset_at=r.reset_at, unlimited=True)
    limit = r.limit if r.limit is not None else UNLIMITED
    return CoachUsage(limit=limit, used=r.used, remaining=max(limit - r.used, 0), reset_at=r.reset_at, unlimited=False)


async def reserve_coach_usage(user_id: str, settings) -> tuple[CoachUsage, bool]:
    """Atomically checks-and-increments today's usage (one SQL statement, so
    two concurrent requests at 2/3 can never both land question 3).
    Returns (usage, allowed). Never trusts a client-supplied count."""
    r = await billing.consume_usage(user_id, METRIC, settings)
    return _from_result(r), r.allowed


async def release_coach_usage(user_id: str, settings) -> None:
    """Rolls back one reserved-but-never-processed request (the LLM call
    failed after the gate let it through) — best-effort, never raises."""
    await billing.release_usage(user_id, METRIC, settings)


async def get_coach_usage(user_id: str, settings) -> CoachUsage:
    """Read-only — no side effects, safe to call on every page load."""
    e = await billing.get_entitlements(user_id, settings)
    plan = e.get("plan") or "free"
    used = int((e.get("usage") or {}).get("ai_questions_today") or 0)
    limit = (e.get("limits") or {}).get("ai_questions_per_day")
    r = billing.UsageResult(allowed=True, used=used, limit=limit, plan=plan, reset_at=str(e.get("daily_reset_at") or ""))
    return _from_result(r)
