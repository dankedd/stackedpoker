"""Global XP leaderboard — All Time + Last 24 Hours.

ARCHITECTURE RULE: this module never calculates or awards XP. It only READS
the canonical XP ledger (user_skill_progress.total_xp, xp_events) that
backend/app/api/routes/learn.py's _award_xp already writes atomically on
every step/lesson/module/achievement/guest-merge award. Level is always
derived via the shared xp_calculator.level_for_xp helper — never
recalculated independently here.

All ranking/aggregation happens in Postgres (see supabase_xp_leaderboard_schema.sql's
leaderboard_all_time / leaderboard_24h / leaderboard_my_rank_all_time /
leaderboard_my_rank_24h RPCs) — this module never fetches every user's rows
and sorts them in Python.

PRIVACY: raw user_id (the Supabase auth UUID) is used server-side only, to
mark which row is the caller's own (`is_you`) — it is never included in any
response. Only the existing public `profiles.username` is exposed.
"""

from __future__ import annotations

import logging
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.engines.learn.xp_calculator import level_for_xp

logger = logging.getLogger(__name__)
router = APIRouter(tags=["leaderboard"])

Period = Literal["all", "24h"]

_ALL_TIME_RPC = "leaderboard_all_time"
_24H_RPC = "leaderboard_24h"
_MY_RANK_ALL_TIME_RPC = "leaderboard_my_rank_all_time"
_MY_RANK_24H_RPC = "leaderboard_my_rank_24h"


# ── Supabase REST helpers (mirrors learn.py/achievements.py's own copies —
# this codebase's established convention is a small private copy per route
# module rather than a shared client) ──────────────────────────────────────

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


async def _supabase_rpc(fn_name: str, args: dict, settings) -> list[dict]:
    """Calls a table-returning RPC and returns every row — unlike learn.py's
    `_supabase_post`, this does NOT unwrap to a single dict, since every RPC
    here (leaderboard_all_time, leaderboard_24h, ...) returns 0-N rows."""
    url = f"{settings.supabase_url}/rest/v1/rpc/{fn_name}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=_sb_headers(settings), json=args)
        r.raise_for_status()
        return r.json()


# ── Response models ────────────────────────────────────────────────────────

class LeaderboardRow(BaseModel):
    rank: int
    username: str
    level: int
    total_xp: int
    # Only populated for period="24h" — the XP earned within the rolling
    # window. Level is always derived from total_xp, never from this.
    period_xp: int | None = None
    is_you: bool


class LeaderboardResponse(BaseModel):
    period: Period
    rows: list[LeaderboardRow]
    has_more: bool


class MyRankResponse(BaseModel):
    period: Period
    # None means "not currently ranked" — either no XP has been earned at
    # all (all-time) or none was earned in the rolling window (24h). The
    # frontend distinguishes this from "no one is ranked yet" (empty rows)
    # to render the correct empty-state copy.
    rank: int | None
    username: str
    level: int
    total_xp: int
    period_xp: int | None = None


def _display_username(raw: str | None) -> str:
    # Matches the existing fallback convention (UserMenu.tsx's displayName,
    # handle_new_user()'s trigger default) — never falls back to email.
    return raw or "Player"


# ── GET /leaderboard — Top-N page, either ranking ─────────────────────────

@router.get("/leaderboard")
async def get_leaderboard(
    period: Period = "all",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
) -> LeaderboardResponse:
    settings = get_settings()
    my_user_id = current_user.get("sub", "")
    rpc_name = _ALL_TIME_RPC if period == "all" else _24H_RPC

    try:
        # Fetch one extra row to detect "is there a next page" without a
        # separate COUNT(*) query.
        raw_rows = await _supabase_rpc(
            rpc_name, {"p_limit": limit + 1, "p_offset": offset}, settings,
        )
    except httpx.HTTPError as e:
        logger.error("Leaderboard fetch DB error period=%s: %s", period, e)
        raise HTTPException(status_code=502, detail="Could not load leaderboard.")

    has_more = len(raw_rows) > limit
    page = raw_rows[:limit]

    rows = [
        LeaderboardRow(
            rank=r["rank"],
            username=_display_username(r.get("username")),
            level=level_for_xp(r.get("total_xp", 0)),
            total_xp=r.get("total_xp", 0),
            period_xp=r.get("period_xp") if period == "24h" else None,
            is_you=(r.get("user_id") == my_user_id),
        )
        for r in page
    ]

    return LeaderboardResponse(period=period, rows=rows, has_more=has_more)


# ── GET /leaderboard/me — caller's own rank, even if outside the loaded page ──

@router.get("/leaderboard/me")
async def get_my_leaderboard_rank(
    period: Period = "all",
    current_user: dict = Depends(get_current_user),
) -> MyRankResponse:
    settings = get_settings()
    user_id = current_user.get("sub", "")
    rpc_name = _MY_RANK_ALL_TIME_RPC if period == "all" else _MY_RANK_24H_RPC

    try:
        rows = await _supabase_rpc(rpc_name, {"p_user_id": user_id}, settings)
    except httpx.HTTPError as e:
        logger.error("Leaderboard my-rank DB error period=%s user=%s: %s", period, user_id, e)
        raise HTTPException(status_code=502, detail="Could not load your rank.")

    if rows:
        r = rows[0]
        total_xp = r.get("total_xp", 0)
        return MyRankResponse(
            period=period,
            rank=r.get("rank"),
            username=_display_username(r.get("username")),
            level=level_for_xp(total_xp),
            total_xp=total_xp,
            period_xp=r.get("period_xp") if period == "24h" else None,
        )

    # Not currently ranked (0 all-time XP, or 0 XP in the rolling 24h window)
    # — still resolve their real username/total_xp/level so the empty state
    # can be personalized ("Complete a lesson to join the leaderboard")
    # instead of just hiding the section entirely.
    try:
        profile_rows = await _supabase_get("profiles", f"id=eq.{user_id}&select=username", settings)
        skill_rows = await _supabase_get(
            "user_skill_progress", f"user_id=eq.{user_id}&select=total_xp", settings,
        )
    except httpx.HTTPError as e:
        logger.error("Leaderboard my-rank fallback DB error user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load your rank.")

    username = _display_username(profile_rows[0].get("username") if profile_rows else None)
    total_xp = skill_rows[0].get("total_xp", 0) if skill_rows else 0

    return MyRankResponse(
        period=period,
        rank=None,
        username=username,
        level=level_for_xp(total_xp),
        total_xp=total_xp,
        period_xp=0 if period == "24h" else None,
    )
