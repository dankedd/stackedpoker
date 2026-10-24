"""Preflop Trainer XP — one award per graded hand.

POST /preflop-trainer/hands  grade one hand server-side and apply it
GET  /preflop-trainer/state  current streak, record and today's XP

The verdict comes from app.engines.preflop_trainer.grade_hand (the server's
own copy of the charts), never from the client. Streak, record, daily cap and
XP are applied atomically by the `record_preflop_trainer_hand` RPC
(supabase_preflop_trainer_xp.sql), which also writes the award through
increment_user_xp — so trainer XP lands in user_skill_progress.total_xp and
the xp_events ledger exactly like lesson XP, and both leaderboards (all-time
and 24h) pick it up with no change of their own.

Free accounts get 50 answered hands per Amsterdam day (supabase_subscriptions.sql,
consume_usage): hand 51 is refused with 429 before anything is recorded.
"""

from __future__ import annotations

import logging
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.engines.learn.xp_calculator import level_for_xp
from app.engines.preflop_trainer import ChartRef, InvalidHand, chart_for, grade_hand
from app.middleware.auth import get_current_user
from app.services import billing

logger = logging.getLogger(__name__)
router = APIRouter(tags=["preflop-trainer"])


def _sb_headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def _rpc(fn_name: str, args: dict, settings) -> dict:
    url = f"{settings.supabase_url}/rest/v1/rpc/{fn_name}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=_sb_headers(settings), json=args)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else (rows or {})


class HandRequest(BaseModel):
    kind: Literal["open", "pushfold", "defense"]
    #: Chart id ("open_mtt_lj_25"); a legacy number from an older client also resolves.
    chart_id: str | int
    stack: int | None = Field(default=None, ge=1, le=100)
    hand: str = Field(min_length=2, max_length=3)
    action: Literal["fold", "limp", "call", "raise", "allin"]


class TrainerState(BaseModel):
    streak: int
    best_streak: int
    daily_xp: int
    daily_cap: int
    xp_per_correct: int
    next_tier_at: int | None


class HandResponse(TrainerState):
    verdict: Literal["correct", "mixed", "wrong"]
    xp_awarded: int
    too_fast: bool
    total_xp: int
    level: int
    leveled_up: bool
    #: Today's trainer usage after this hand ({used, limit, reset_at}); limit None = unlimited.
    usage: dict | None = None


def _state(row: dict) -> dict:
    return {
        "streak": row.get("streak", 0),
        "best_streak": row.get("best_streak", 0),
        "daily_xp": row.get("daily_xp", 0),
        "daily_cap": row.get("daily_cap", 0),
        "xp_per_correct": row.get("xp_per_correct", 1),
        "next_tier_at": row.get("next_tier_at"),
    }


@router.post("/preflop-trainer/hands")
async def record_hand(body: HandRequest, current_user: dict = Depends(get_current_user)) -> HandResponse:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        graded = grade_hand(ChartRef(body.kind, body.chart_id, body.stack), body.hand, body.action)
    except InvalidHand as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Daily limit: checked after grading (an invalid hand costs nothing) and
    # before recording (a refused hand earns no XP and moves no streak).
    usage: billing.UsageResult | None = None
    try:
        usage = await billing.consume_usage(user_id, "trainer_hand", settings)
    except httpx.HTTPError as e:
        # The limit store being unreachable must not break the trainer.
        logger.error("trainer usage check failed user=%s: %s", user_id, e)
    if usage is not None and not usage.allowed:
        raise HTTPException(
            status_code=429,
            detail={"code": "TRAINER_DAILY_LIMIT_REACHED", "used": usage.used, "limit": usage.limit, "reset_at": usage.reset_at},
        )

    # Always log the chart id, also for a legacy number (lifecycle emails resolve ids).
    hand_ref = f"{body.kind}:{chart_for(ChartRef(body.kind, body.chart_id))['id']}:{body.stack or ''}:{body.hand}"
    try:
        row = await _rpc(
            "record_preflop_trainer_hand",
            {"p_user_id": user_id, "p_verdict": graded.verdict, "p_hand_ref": hand_ref},
            settings,
        )
    except httpx.HTTPError as e:
        logger.error("record_preflop_trainer_hand failed user=%s: %s", user_id, e)
        if usage is not None:
            await billing.release_usage(user_id, "trainer_hand", settings)
        raise HTTPException(status_code=502, detail="Could not save this hand.")

    xp = row.get("xp_awarded", 0)
    total = row.get("total_xp", 0)
    level = level_for_xp(total)
    return HandResponse(
        **_state(row),
        verdict=graded.verdict,
        xp_awarded=xp,
        too_fast=bool(row.get("too_fast", False)),
        total_xp=total,
        level=level,
        leveled_up=xp > 0 and level > level_for_xp(total - xp),
        usage={"used": usage.used, "limit": usage.limit, "reset_at": usage.reset_at} if usage else None,
    )


@router.get("/preflop-trainer/state")
async def get_state(current_user: dict = Depends(get_current_user)) -> TrainerState:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    try:
        row = await _rpc("preflop_trainer_state", {"p_user_id": user_id}, settings)
    except httpx.HTTPError as e:
        logger.error("preflop_trainer_state failed user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load trainer state.")
    return TrainerState(**_state(row))
