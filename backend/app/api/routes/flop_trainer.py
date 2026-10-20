"""Flop Equity Trainer — one award per answered flop.

POST /flop-trainer/answers   grade one answer server-side and apply it
GET  /flop-trainer/state     today's XP, best session, error per texture category
GET  /flop-trainer/examples  a few typical hands per Equity Bucket for one flop

The exact equity and nut-advantage answer are read from flop_equity (the
precomputed table, supabase_flop_equity.sql) by the server — the client only
says which flop it saw and what it guessed. XP, the daily cap, the session
highscore and the answer log are applied atomically by the
`record_flop_trainer_answer` RPC (supabase_flop_trainer.sql), which writes the
award through increment_user_xp with source_type 'flop_equity'.

Free accounts share the Preflop Trainer's 50 answers per Amsterdam day
(consume_usage 'trainer_hand'): answer 51 is refused with 429 before
anything is recorded.
"""

from __future__ import annotations

import logging
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings
from app.engines.learn.xp_calculator import level_for_xp
from app.flop_equity.grading import grade_answer, texture_category
from app.middleware.auth import get_current_user
from app.services import billing

logger = logging.getLogger(__name__)
router = APIRouter(tags=["flop-trainer"])

SPOT_RE = r"^[a-z0-9_]{3,40}$"
FLOP_RE = r"^([2-9TJQKA][cdhs]){3}$"
BUCKETS = (("strong", 75.0), ("good", 50.0), ("weak", 33.0), ("trash", -1.0))
EXAMPLES_PER_BUCKET = 4


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


async def _select(table: str, params: dict, settings) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{settings.supabase_url}/rest/v1/{table}", headers=_sb_headers(settings), params=params)
        r.raise_for_status()
        return r.json()


async def _flop_row(spot_id: str, flop: str, settings) -> dict | None:
    """The answer key for one flop of an enabled spot, or None."""
    rows = await _select(
        "flop_equity",
        {
            "select": "equity_ip,nut_adv,texture,flop_spots!inner(enabled)",
            "spot_id": f"eq.{spot_id}",
            "flop": f"eq.{flop}",
            "flop_spots.enabled": "eq.true",
        },
        settings,
    )
    return rows[0] if rows else None


class AnswerRequest(BaseModel):
    spot_id: str = Field(pattern=SPOT_RE)
    #: The canonical flop as stored in flop_equity (the browser may show other suits).
    flop: str = Field(pattern=FLOP_RE)
    guess_equity: float = Field(ge=0, le=100)
    nut_guess: Literal["IP", "OOP", "EQUAL"]
    #: Client-made id of the current 10-flop session.
    session_id: str = Field(min_length=1, max_length=64)


class TrainerState(BaseModel):
    daily_xp: int
    daily_cap: int
    best_session_points: int
    hands_played: int
    #: {category: [answers, average error]} over the last 200 answers.
    categories: dict[str, list[float]]


class AnswerResponse(BaseModel):
    verdict: Literal["perfect", "good", "miss"]
    error: float
    exact_equity: float
    nut_actual: Literal["IP", "OOP", "EQUAL"]
    nut_correct: bool
    points: int
    xp_awarded: int
    daily_xp: int
    daily_cap: int
    too_fast: bool
    total_xp: int
    level: int
    leveled_up: bool
    session_answers: int
    session_points: int
    session_complete: bool
    best_session_points: int
    new_record: bool
    #: Today's trainer usage after this answer ({used, limit, reset_at}); limit None = unlimited.
    usage: dict | None = None


@router.post("/flop-trainer/answers")
async def record_answer(body: AnswerRequest, current_user: dict = Depends(get_current_user)) -> AnswerResponse:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")

    try:
        row = await _flop_row(body.spot_id, body.flop, settings)
    except httpx.HTTPError as e:
        logger.error("flop_equity lookup failed spot=%s flop=%s: %s", body.spot_id, body.flop, e)
        raise HTTPException(status_code=502, detail="Could not load this flop.")
    if row is None:
        raise HTTPException(status_code=422, detail="Unknown spot or flop.")

    exact = float(row["equity_ip"])
    nut_actual = row["nut_adv"]["leader"]
    graded = grade_answer(body.guess_equity, exact, body.nut_guess, nut_actual)

    # Same daily limit as the Preflop Trainer: checked after the lookup (an
    # invalid flop costs nothing) and before recording.
    usage: billing.UsageResult | None = None
    try:
        usage = await billing.consume_usage(user_id, "trainer_hand", settings)
    except httpx.HTTPError as e:
        logger.error("trainer usage check failed user=%s: %s", user_id, e)
    if usage is not None and not usage.allowed:
        raise HTTPException(
            status_code=429,
            detail={"code": "TRAINER_DAILY_LIMIT_REACHED", "used": usage.used, "limit": usage.limit, "reset_at": usage.reset_at},
        )

    try:
        res = await _rpc(
            "record_flop_trainer_answer",
            {
                "p_user_id": user_id,
                "p_spot_id": body.spot_id,
                "p_flop": body.flop,
                "p_category": texture_category(row["texture"]),
                "p_guess": round(body.guess_equity, 2),
                "p_actual": exact,
                "p_verdict": graded.verdict,
                "p_nut_guess": body.nut_guess,
                "p_nut_actual": nut_actual,
                "p_points": graded.points,
                "p_session_id": body.session_id,
            },
            settings,
        )
    except httpx.HTTPError as e:
        logger.error("record_flop_trainer_answer failed user=%s: %s", user_id, e)
        if usage is not None:
            await billing.release_usage(user_id, "trainer_hand", settings)
        raise HTTPException(status_code=502, detail="Could not save this answer.")

    xp = res.get("xp_awarded", 0)
    total = res.get("total_xp", 0)
    level = level_for_xp(total)
    return AnswerResponse(
        verdict=graded.verdict,
        error=graded.error,
        exact_equity=exact,
        nut_actual=nut_actual,
        nut_correct=graded.nut_correct,
        points=graded.points,
        xp_awarded=xp,
        daily_xp=res.get("daily_xp", 0),
        daily_cap=res.get("daily_cap", 0),
        too_fast=bool(res.get("too_fast", False)),
        total_xp=total,
        level=level,
        leveled_up=xp > 0 and level > level_for_xp(total - xp),
        session_answers=res.get("session_answers", 0),
        session_points=res.get("session_points", 0),
        session_complete=bool(res.get("session_complete", False)),
        best_session_points=res.get("best_session_points", 0),
        new_record=bool(res.get("new_record", False)),
        usage={"used": usage.used, "limit": usage.limit, "reset_at": usage.reset_at} if usage else None,
    )


@router.get("/flop-trainer/state")
async def get_state(current_user: dict = Depends(get_current_user)) -> TrainerState:
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    try:
        row = await _rpc("flop_trainer_state", {"p_user_id": user_id}, settings)
    except httpx.HTTPError as e:
        logger.error("flop_trainer_state failed user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not load trainer state.")
    return TrainerState(
        daily_xp=row.get("daily_xp", 0),
        daily_cap=row.get("daily_cap", 0),
        best_session_points=row.get("best_session_points", 0),
        hands_played=row.get("hands_played", 0),
        categories=row.get("categories") or {},
    )


# ── Example hands per bucket ────────────────────────────────────────────────


def _combos(hand: str) -> int:
    return 6 if len(hand) == 2 else 4 if hand.endswith("s") else 12


def bucket_examples(hands: dict[str, list[float]], n: int = EXAMPLES_PER_BUCKET) -> dict[str, list[str]]:
    """The n most frequent starting hands per bucket, by the hand's average
    equity on this flop (a hand's suits can split it across buckets; these
    are typical members, not a full list)."""
    out: dict[str, list[tuple[float, str]]] = {b: [] for b, _ in BUCKETS}
    for hand, (freq, eq) in hands.items():
        if freq <= 0:
            continue
        bucket = next(b for b, lo in BUCKETS if eq >= lo)
        out[bucket].append((freq * _combos(hand), hand))
    return {b: [h for _, h in sorted(v, key=lambda x: (-x[0], x[1]))[:n]] for b, v in out.items()}


# The precomputed data never changes between loads, so answers are kept in memory.
_EXAMPLES: dict[tuple[str, str], dict] = {}


@router.get("/flop-trainer/examples")
async def get_examples(
    spot_id: str = Query(pattern=SPOT_RE),
    flop: str = Query(pattern=FLOP_RE),
) -> dict:
    """Public (guests see the answer screen too). Only a handful of hands per
    bucket — the full per-hand table stays for the Pro explorer."""
    key = (spot_id, flop)
    if key in _EXAMPLES:
        return _EXAMPLES[key]
    settings = get_settings()
    try:
        rows = await _select(
            "flop_equity_hands", {"select": "hands", "spot_id": f"eq.{spot_id}", "flop": f"eq.{flop}"}, settings
        )
    except httpx.HTTPError as e:
        logger.error("flop_equity_hands lookup failed spot=%s flop=%s: %s", spot_id, flop, e)
        raise HTTPException(status_code=502, detail="Could not load example hands.")
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown spot or flop.")
    hands = rows[0]["hands"]
    result = {"ip": bucket_examples(hands["ip"]), "oop": bucket_examples(hands["oop"])}
    if len(_EXAMPLES) > 4000:
        _EXAMPLES.clear()
    _EXAMPLES[key] = result
    return result
