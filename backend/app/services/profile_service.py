"""
Player Profile Service — aggregates all stored hand_analyses for a user into
a structured PlayerStats object consumed by the profile pipeline.

Data flow:
  Supabase hand_analyses rows
    → _fetch_analyses()
    → _compute_stats()
    → PlayerStats
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean
from typing import Any

import httpx

from app.config import get_settings
from app.models.schemas import (
    PlayerStats,
    PositionStat,
    ScoreTrendPoint,
    StreetMistakes,
)

logger = logging.getLogger(__name__)

# EV-loss proxies per severity
_EV_WEIGHTS: dict[str, float] = {
    "mistake":    3.0,
    "suboptimal": 1.0,
    "good":       0.0,
    "note":       0.0,
}

_TOURNAMENT_GAME_TYPES = {"MTT", "SNG", "Hyper Turbo", "Satellite", "Bounty"}

POSITIONS_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]


# ── Supabase fetch ────────────────────────────────────────────────────────────

def _service_headers() -> dict[str, str]:
    s = get_settings()
    if s.supabase_service_role_key:
        return {
            "apikey": s.supabase_service_role_key,
            "Authorization": f"Bearer {s.supabase_service_role_key}",
        }
    return {}


async def fetch_analyses(user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    """Fetch all hand_analyses rows for the user from Supabase (service-role key)."""
    s = get_settings()
    if not s.supabase_url:
        logger.warning("SUPABASE_URL not set — returning empty analyses list")
        return []

    headers = _service_headers()
    if not headers:
        logger.warning("No service-role key — profile fetch skipped")
        return []

    url = f"{s.supabase_url}/rest/v1/hand_analyses"
    params = {
        "user_id": f"eq.{user_id}",
        "select": (
            "id,hero_position,actions,findings,overall_score,mistakes_count,"
            "spot_classification,game_type,analyzed_at,effective_stack_bb,stakes"
        ),
        "order": "analyzed_at.desc",
        "limit": str(limit),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, headers=headers, params=params)
        if resp.status_code != 200:
            logger.error("Supabase profile fetch failed: %s %s", resp.status_code, resp.text[:200])
            return []
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logger.error("Supabase profile fetch exception: %s", exc)
        return []


# ── Analysis type detection ───────────────────────────────────────────────────

def _is_hand_analysis(row: dict) -> bool:
    """True if this row represents a single-hand analysis (has findings + actions)."""
    findings = row.get("findings") or []
    actions  = row.get("actions") or []
    return bool(findings) or bool(actions)


def _is_tournament(row: dict) -> bool:
    gt = (row.get("game_type") or "").strip()
    return gt in _TOURNAMENT_GAME_TYPES


# ── Preflop stat helpers ──────────────────────────────────────────────────────

def _hero_preflop_actions(actions: list[dict]) -> list[str]:
    return [
        a.get("action", "")
        for a in actions
        if a.get("street") == "preflop" and a.get("is_hero")
    ]


def _is_vpip(actions: list[dict]) -> bool:
    """Voluntarily put money in (call or raise preflop, not just posting)."""
    return any(a in ("call", "raise") for a in _hero_preflop_actions(actions))


def _is_pfr(actions: list[dict]) -> bool:
    return "raise" in _hero_preflop_actions(actions)


def _is_3bet(actions: list[dict]) -> bool:
    """True when hero's preflop raise was the second raise (re-raise = 3bet)."""
    raise_count = 0
    for a in actions:
        if a.get("street") == "preflop" and a.get("action") == "raise":
            raise_count += 1
            if raise_count == 2 and a.get("is_hero"):
                return True
    return False


# ── EV loss estimation ────────────────────────────────────────────────────────

def _ev_loss_for_findings(findings: list[dict]) -> float:
    total = 0.0
    for f in findings:
        total += _EV_WEIGHTS.get(f.get("severity", "note"), 0.0)
    return round(total, 2)


# ── Core stat computation ─────────────────────────────────────────────────────

def compute_stats(rows: list[dict]) -> PlayerStats:
    """Aggregate all fetched rows into a PlayerStats object."""
    if not rows:
        return PlayerStats()

    # Separate hand analyses from session/tournament aggregates
    hand_rows   = [r for r in rows if _is_hand_analysis(r)]
    all_rows    = rows  # use all for trend (includes session/tournament overall_score)

    total_hands = len(hand_rows)

    # ── Basic score stats ─────────────────────────────────────────────────────
    scores = [r.get("overall_score") or 0 for r in hand_rows]
    avg_score = round(mean(scores), 1) if scores else 0.0

    # ── Preflop stats ─────────────────────────────────────────────────────────
    vpip_count = pfr_count = three_bet_count = 0
    preflop_eligible = 0  # hands with action data

    for row in hand_rows:
        actions = row.get("actions") or []
        if not actions:
            continue
        preflop_eligible += 1
        if _is_vpip(actions):
            vpip_count += 1
        if _is_pfr(actions):
            pfr_count += 1
        if _is_3bet(actions):
            three_bet_count += 1

    denom = preflop_eligible or 1
    vpip_pct      = round(vpip_count      / denom * 100, 1)
    pfr_pct       = round(pfr_count       / denom * 100, 1)
    three_bet_pct = round(three_bet_count / denom * 100, 1)

    # ── Mistake + EV loss ─────────────────────────────────────────────────────
    total_mistakes = sum(r.get("mistakes_count") or 0 for r in hand_rows)
    avg_mistakes   = round(total_mistakes / (total_hands or 1), 2)

    total_ev_loss = sum(
        _ev_loss_for_findings(r.get("findings") or [])
        for r in hand_rows
    )
    total_ev_loss = round(total_ev_loss, 1)

    # ── Position stats ────────────────────────────────────────────────────────
    pos_scores: dict[str, list[float]]  = defaultdict(list)
    pos_mistakes: dict[str, list[int]]  = defaultdict(list)
    pos_ev_loss: dict[str, float]       = defaultdict(float)

    for row in hand_rows:
        pos = (row.get("hero_position") or "Unknown").upper().strip()
        if not pos:
            pos = "Unknown"
        score = row.get("overall_score") or 0
        mc    = row.get("mistakes_count") or 0
        ev    = _ev_loss_for_findings(row.get("findings") or [])
        pos_scores[pos].append(score)
        pos_mistakes[pos].append(mc)
        pos_ev_loss[pos] += ev

    position_stats = [
        PositionStat(
            position=pos,
            hands=len(scores_list),
            avg_score=round(mean(scores_list), 1),
            mistakes_per_hand=round(mean(pos_mistakes[pos]), 2),
            ev_loss_bb=round(pos_ev_loss[pos], 1),
        )
        for pos, scores_list in sorted(
            pos_scores.items(),
            key=lambda kv: _pos_sort_key(kv[0]),
        )
    ]

    # ── Spot-classification breakdown ──────────────────────────────────────────
    srp_scores:    list[float] = []
    tbet_scores:   list[float] = []
    fbet_scores:   list[float] = []
    deep_scores:   list[float] = []
    med_scores:    list[float] = []
    short_scores:  list[float] = []
    ip_scores:     list[float] = []
    oop_scores:    list[float] = []
    pfr_scores:    list[float] = []
    caller_scores: list[float] = []

    for row in hand_rows:
        sc    = row.get("spot_classification") or {}
        score = float(row.get("overall_score") or 0)

        pot_type    = sc.get("pot_type", "")
        stack_depth = sc.get("stack_depth", "")
        hero_is_ip  = sc.get("hero_is_ip", None)
        hero_is_pfr = sc.get("hero_is_pfr", None)

        if pot_type == "SRP":    srp_scores.append(score)
        elif pot_type == "3bet": tbet_scores.append(score)
        elif pot_type == "4bet": fbet_scores.append(score)

        if stack_depth == "deep":   deep_scores.append(score)
        elif stack_depth == "medium": med_scores.append(score)
        elif stack_depth == "short":  short_scores.append(score)

        if hero_is_ip is True:  ip_scores.append(score)
        elif hero_is_ip is False: oop_scores.append(score)

        if hero_is_pfr is True:  pfr_scores.append(score)
        elif hero_is_pfr is False: caller_scores.append(score)

    def _avg(lst: list[float]) -> float:
        return round(mean(lst), 1) if lst else 0.0

    # ── Street mistakes ───────────────────────────────────────────────────────
    street_map: dict[str, int] = defaultdict(int)
    for row in hand_rows:
        for finding in (row.get("findings") or []):
            if finding.get("severity") in ("mistake", "suboptimal"):
                street = (finding.get("street") or "other").lower()
                street_map[street] += 1

    street_mistakes = StreetMistakes(
        preflop=street_map.get("preflop", 0),
        flop=street_map.get("flop", 0),
        turn=street_map.get("turn", 0),
        river=street_map.get("river", 0),
        other=sum(v for k, v in street_map.items() if k not in ("preflop", "flop", "turn", "river")),
    )

    # ── Score trend (last 30) ─────────────────────────────────────────────────
    trend_rows = [r for r in all_rows if r.get("overall_score") is not None][:30]
    score_trend = [
        ScoreTrendPoint(
            date=_fmt_date(r.get("analyzed_at", "")),
            score=float(r.get("overall_score") or 0),
            hand_id=str(r.get("id", "")),
        )
        for r in reversed(trend_rows)   # oldest first for chart
    ]

    # ── Cash vs tournament split ──────────────────────────────────────────────
    cash_rows  = [r for r in hand_rows if not _is_tournament(r)]
    tourney_rows = [r for r in hand_rows if _is_tournament(r)]

    cash_scores   = [r.get("overall_score") or 0 for r in cash_rows]
    tourney_scores = [r.get("overall_score") or 0 for r in tourney_rows]

    return PlayerStats(
        total_hands=total_hands,
        avg_score=avg_score,
        vpip_pct=vpip_pct,
        pfr_pct=pfr_pct,
        three_bet_pct=three_bet_pct,
        avg_mistakes_per_hand=avg_mistakes,
        total_ev_loss_bb=total_ev_loss,
        position_stats=position_stats,
        srp_score=_avg(srp_scores),
        three_bet_pot_score=_avg(tbet_scores),
        four_bet_pot_score=_avg(fbet_scores),
        deep_score=_avg(deep_scores),
        medium_score=_avg(med_scores),
        short_score=_avg(short_scores),
        street_mistakes=street_mistakes,
        ip_score=_avg(ip_scores),
        oop_score=_avg(oop_scores),
        pfr_score=_avg(pfr_scores),
        caller_score=_avg(caller_scores),
        score_trend=score_trend,
        cash_hands=len(cash_rows),
        tournament_hands=len(tourney_rows),
        cash_avg_score=_avg(cash_scores),
        tournament_avg_score=_avg(tourney_scores),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pos_sort_key(pos: str) -> int:
    try:
        return POSITIONS_ORDER.index(pos.upper())
    except ValueError:
        return 99


def _fmt_date(ts: str) -> str:
    if not ts:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        return ts[:10]  # ISO date prefix
    except Exception:
        return ts
