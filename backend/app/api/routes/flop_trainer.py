"""Flop Equity Trainer — one award per answered flop.

POST /flop-trainer/answers          grade one answer server-side and apply it
POST /flop-trainer/versus           quick fire: which of two flops is better for the raiser
GET  /flop-trainer/state            today's XP, best session, accuracy per texture category
GET  /flop-trainer/examples         a few typical hands per Equity Bucket for one flop
GET  /flop-trainer/explorer/hands   per-hand equity for the 13x13 heatmap (Pro)
GET  /flop-trainer/hand-position    where one starting hand sits in its range on a flop (Hand Review)

The exact equity and nut-advantage answer are read from flop_equity (the
precomputed table, supabase_flop_equity.sql) by the server — the client only
says which flop it saw and what it guessed. XP, the daily cap, the session
highscore and the answer log are applied atomically by the
`record_flop_trainer_answer` RPC (supabase_flop_trainer.sql), which writes the
award through increment_user_xp with source_type 'flop_equity'. The optional
c-bet question is graded from the book's c-bet profiles (grading.cbet_advice,
supabase_flop_trainer_phase3.sql).

Free accounts share the Preflop Trainer's 50 answers per Amsterdam day
(consume_usage 'trainer_hand'): answer 51 is refused with 429 before
anything is recorded.
"""

from __future__ import annotations

import logging
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings
from app.engines.learn.xp_calculator import level_fields
from app.flop_equity.grading import cbet_advice, grade_answer, grade_cbet, texture_category
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
            "select": "equity_ip,nut_adv,texture,buckets_ip,buckets_oop,flop_spots!inner(enabled)",
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
    #: Optional c-bet question (both or neither).
    cbet_band: Literal["high", "mid", "low"] | None = None
    cbet_size: Literal["small", "big"] | None = None


class TrainerState(BaseModel):
    daily_xp: int
    daily_cap: int
    best_session_points: int
    hands_played: int
    #: {category: [answers, average error, % within 7 points]} over the last 200 answers.
    categories: dict[str, list[float]]
    versus_streak: int = 0
    versus_best: int = 0


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
    #: Play-streak bonus on top of xp_awarded (its own ledger row).
    bonus_xp: int = 0
    #: Highest level shown before this answer — the level-up moment starts here.
    previous_level: int | None = None
    session_answers: int
    session_points: int
    session_complete: bool
    best_session_points: int
    new_record: bool
    #: The c-bet verdict and the advice it was graded against (None without the question).
    cbet: dict | None = None
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
    points = graded.points
    cbet = None
    if body.cbet_band and body.cbet_size:
        advice = cbet_advice(body.spot_id, body.flop, row["buckets_ip"], row["buckets_oop"], row["texture"])
        band_ok, size_ok, cbet_points = grade_cbet(body.cbet_band, body.cbet_size, advice)
        points += cbet_points
        # Page numbers stay server-side: the browser never sees where a profile is printed.
        shown = {k: v for k, v in advice.items() if k != "pages"}
        cbet = {"band_ok": band_ok, "size_ok": size_ok, "points": cbet_points, "advice": shown}

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
                "p_points": points,
                "p_session_id": body.session_id,
                "p_cbet_band": body.cbet_band if cbet else None,
                "p_cbet_size": body.cbet_size if cbet else None,
                "p_cbet_band_ok": cbet["band_ok"] if cbet else None,
                "p_cbet_size_ok": cbet["size_ok"] if cbet else None,
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
    return AnswerResponse(
        verdict=graded.verdict,
        error=graded.error,
        exact_equity=exact,
        nut_actual=nut_actual,
        nut_correct=graded.nut_correct,
        points=points,
        xp_awarded=xp,
        daily_xp=res.get("daily_xp", 0),
        daily_cap=res.get("daily_cap", 0),
        too_fast=bool(res.get("too_fast", False)),
        total_xp=total,
        **level_fields(res, xp),
        session_answers=res.get("session_answers", 0),
        session_points=res.get("session_points", 0),
        session_complete=bool(res.get("session_complete", False)),
        best_session_points=res.get("best_session_points", 0),
        new_record=bool(res.get("new_record", False)),
        cbet=cbet,
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
        versus_streak=row.get("versus_streak") or 0,
        versus_best=row.get("versus_best") or 0,
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


# ── Quick fire: flop A vs flop B ────────────────────────────────────────────


class VersusRequest(BaseModel):
    spot_id: str = Field(pattern=SPOT_RE)
    flop_a: str = Field(pattern=FLOP_RE)
    flop_b: str = Field(pattern=FLOP_RE)
    pick: Literal["a", "b"]


class VersusResponse(BaseModel):
    correct: bool
    equity_a: float
    equity_b: float
    xp_awarded: int
    daily_xp: int
    daily_cap: int
    too_fast: bool
    total_xp: int
    level: int
    leveled_up: bool
    #: Play-streak bonus on top of xp_awarded (its own ledger row).
    bonus_xp: int = 0
    #: Highest level shown before this answer — the level-up moment starts here.
    previous_level: int | None = None
    streak: int
    best_streak: int
    usage: dict | None = None


#: Flops closer than this (equity points) count either pick as right.
VERSUS_TIE = 0.5


@router.post("/flop-trainer/versus")
async def record_versus(body: VersusRequest, current_user: dict = Depends(get_current_user)) -> VersusResponse:
    """The better flop for the preflop raiser is the one where their range has more equity."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    if body.flop_a == body.flop_b:
        raise HTTPException(status_code=422, detail="Two different flops are needed.")
    try:
        rows = await _select(
            "flop_equity",
            {"select": "flop,equity_ip", "spot_id": f"eq.{body.spot_id}", "flop": f"in.({body.flop_a},{body.flop_b})"},
            settings,
        )
    except httpx.HTTPError as e:
        logger.error("flop_equity versus lookup failed spot=%s: %s", body.spot_id, e)
        raise HTTPException(status_code=502, detail="Could not load these flops.")
    eq = {r["flop"]: float(r["equity_ip"]) for r in rows}
    if body.flop_a not in eq or body.flop_b not in eq:
        raise HTTPException(status_code=422, detail="Unknown spot or flop.")
    a, b = eq[body.flop_a], eq[body.flop_b]
    picked, other = (a, b) if body.pick == "a" else (b, a)
    correct = picked >= other - VERSUS_TIE

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
            "record_flop_versus_answer",
            {"p_user_id": user_id, "p_spot_id": body.spot_id, "p_flop_a": body.flop_a, "p_flop_b": body.flop_b,
             "p_pick": body.pick, "p_correct": correct, "p_gap": round(abs(a - b), 2)},
            settings,
        )
    except httpx.HTTPError as e:
        logger.error("record_flop_versus_answer failed user=%s: %s", user_id, e)
        if usage is not None:
            await billing.release_usage(user_id, "trainer_hand", settings)
        raise HTTPException(status_code=502, detail="Could not save this answer.")

    xp = res.get("xp_awarded", 0)
    total = res.get("total_xp", 0)
    return VersusResponse(
        correct=correct,
        equity_a=a,
        equity_b=b,
        xp_awarded=xp,
        daily_xp=res.get("daily_xp", 0),
        daily_cap=res.get("daily_cap", 0),
        too_fast=bool(res.get("too_fast", False)),
        total_xp=total,
        **level_fields(res, xp),
        streak=res.get("streak", 0),
        best_streak=res.get("best_streak", 0),
        usage={"used": usage.used, "limit": usage.limit, "reset_at": usage.reset_at} if usage else None,
    )


# ── Explorer (Pro) ──────────────────────────────────────────────────────────

#: effective_plan() values that unlock the explorer (supabase_subscriptions.sql).
PAID_PLANS = {"pro", "trial"}


async def _plan(user_id: str, settings) -> str:
    url = f"{settings.supabase_url}/rest/v1/rpc/effective_plan"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, headers=_sb_headers(settings), json={"p_user_id": user_id})
        r.raise_for_status()
        return r.json()


@router.get("/flop-trainer/explorer/hands")
async def explorer_hands(
    spot_id: str = Query(pattern=SPOT_RE),
    flop: str = Query(pattern=FLOP_RE),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Per starting hand [frequency, equity %] for both players — Pro and trial only."""
    settings = get_settings()
    user_id: str = current_user.get("sub", "")
    try:
        plan = await _plan(user_id, settings)
    except httpx.HTTPError as e:
        logger.error("effective_plan failed user=%s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Could not check your plan.")
    if plan not in PAID_PLANS:
        raise HTTPException(status_code=403, detail={"code": "PRO_REQUIRED"})
    try:
        rows = await _select(
            "flop_equity_hands", {"select": "hands", "spot_id": f"eq.{spot_id}", "flop": f"eq.{flop}"}, settings
        )
    except httpx.HTTPError as e:
        logger.error("flop_equity_hands lookup failed spot=%s flop=%s: %s", spot_id, flop, e)
        raise HTTPException(status_code=502, detail="Could not load the hands.")
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown spot or flop.")
    return rows[0]["hands"]


# ── Hand Review: where hero's hand sits in its range ────────────────────────

HAND_RE = r"^[2-9TJQKA]{2}[so]?$"
RANKS = "23456789TJQKA"
SUITS = "cdhs"


def live_combos(hand: str, board: list[str]) -> int:
    """Combos of a starting hand that don't use a board card."""
    a, b = hand[0], hand[1]
    used = set(board)
    if a == b:
        cards = [a + s for s in SUITS if a + s not in used]
        return len(cards) * (len(cards) - 1) // 2
    pairs = [(a + s1, b + s2) for s1 in SUITS for s2 in SUITS if (s1 == s2) == hand.endswith("s")]
    return sum(1 for x, y in pairs if x not in used and y not in used)


def hand_position(hands: dict[str, list[float]], hand: str, board: list[str]) -> dict:
    """Hero's hand class among the range on this flop: its equity, bucket and
    how much of the range is at least as strong ("top X%"), weighting every
    hand by its preflop frequency times its live combos."""
    weights = {h: f * live_combos(h, board) for h, (f, _) in hands.items() if f > 0}
    total = sum(weights.values())
    entry = hands.get(hand)
    if not entry or total <= 0:
        return {"in_range": False}
    freq, eq = entry
    bucket = next(b for b, lo in BUCKETS if eq >= lo)
    if freq <= 0 or weights.get(hand, 0) <= 0:
        return {"in_range": False, "equity": eq, "bucket": bucket}
    at_least = sum(w for h, w in weights.items() if hands[h][1] >= eq)
    return {"in_range": True, "equity": eq, "bucket": bucket, "frequency": freq,
            "top_pct": round(100 * at_least / total, 1)}


@router.get("/flop-trainer/hand-position")
async def get_hand_position(
    spot_id: str = Query(pattern=SPOT_RE),
    flop: str = Query(pattern=FLOP_RE),
    hand: str = Query(pattern=HAND_RE),
    side: Literal["ip", "oop"] = Query(),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """One hand only (never the whole table, which is Pro): signed-in Hand
    Review users on every plan. `hand` is the class, e.g. AKs; `flop` the
    canonical flop."""
    # Pairs have no suffix, other hands must have one (s/o); higher rank first.
    if not re.fullmatch(HAND_RE, hand) or (len(hand) == 2) != (hand[0] == hand[1]) or RANKS.index(hand[0]) < RANKS.index(hand[1]):
        raise HTTPException(status_code=422, detail="Invalid hand.")
    settings = get_settings()
    try:
        rows = await _select(
            "flop_equity_hands", {"select": "hands", "spot_id": f"eq.{spot_id}", "flop": f"eq.{flop}"}, settings
        )
    except httpx.HTTPError as e:
        logger.error("flop_equity_hands lookup failed spot=%s flop=%s: %s", spot_id, flop, e)
        raise HTTPException(status_code=502, detail="Could not load the range.")
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown spot or flop.")
    board = [flop[i : i + 2] for i in (0, 2, 4)]
    return hand_position(rows[0]["hands"][side], hand, board)
