"""
Main analysis orchestrator — canonical pipeline.

Order of operations:
  1. Classify spot (IP/OOP, PFR, pot type)
  2. Build PokerState — single source of truth
  3. Classify board texture
  4. Analyze draws (flop+board only; errors logged, never silent)
  5. Run heuristics (receives PokerState so draws never override made hands)
  6. Score all hero actions (node-aware, made-hand-priority)
  7. Return AnalysisResponse

Every engine downstream reads from PokerState — no duplicate state derivation.
"""
from __future__ import annotations

import logging

from app.models.schemas import (
    AnalysisResponse, HeuristicFinding, ParsedHand,
)
from app.engines.board_texture import classify_board
from app.engines.spot_classifier import classify_spot
from app.engines.heuristics import run_heuristics
from app.engines.draw_evaluator import analyze_draws
from app.engines.poker_state import PokerState

_log = logging.getLogger(__name__)


def analyse_hand(hand: ParsedHand, ai_coaching: str = "") -> AnalysisResponse:
    # ── 1. Spot classification (IP/OOP, PFR, pot type) ────────────────────
    spot = classify_spot(hand)

    # ── 2. Canonical PokerState — single source of truth ──────────────────
    poker_state = PokerState.build(hand, spot.hero_is_ip, spot.hero_is_pfr)

    if poker_state.validation_errors:
        _log.warning(
            "PokerState validation errors for hand %s: %s",
            hand.hand_id,
            poker_state.validation_errors,
        )
    if poker_state.validation_warnings:
        _log.debug(
            "PokerState warnings for hand %s: %s",
            hand.hand_id,
            poker_state.validation_warnings,
        )
    if poker_state.debug_notes:
        _log.debug("PokerState debug %s: %s", hand.hand_id, poker_state.debug_notes)

    # ── 3. Board texture ───────────────────────────────────────────────────
    texture = classify_board(hand.board.flop, hand.board.turn, hand.board.river)

    # ── 4. Draw analysis — logged on failure, never silently swallowed ─────
    draw_analysis = None
    if hand.hero_cards and hand.board.flop:
        try:
            draw_analysis = analyze_draws(hand.hero_cards, hand.board.flop)
        except Exception as exc:
            _log.warning(
                "Draw analysis failed for hand %s (%s %s): %s",
                hand.hand_id,
                hand.hero_cards,
                hand.board.flop,
                exc,
            )

    # ── 5. Heuristics — receives PokerState for made-hand priority ─────────
    findings = run_heuristics(
        hand, spot, texture,
        draw_analysis=draw_analysis,
        poker_state=poker_state,
    )

    # ── 6. Score + recommendations ─────────────────────────────────────────
    score = _calculate_score(findings)
    mistakes = sum(1 for f in findings if f.severity == "mistake")
    recommendations = _build_recommendations(findings, spot, texture)

    return AnalysisResponse(
        parsed_hand=hand,
        spot_classification=spot,
        board_texture=texture,
        findings=findings,
        overall_score=score,
        ai_coaching=ai_coaching,
        mistakes_count=mistakes,
        recommendations=recommendations,
    )


def _calculate_score(findings: list[HeuristicFinding]) -> int:
    score = 80
    deductions = {"mistake": 15, "suboptimal": 7, "note": 0, "good": 0}
    bonuses = {"good": 5}
    for f in findings:
        score -= deductions.get(f.severity, 0)
        score += bonuses.get(f.severity, 0)
    return max(0, min(100, score))


def _build_recommendations(findings, spot, texture) -> list[str]:
    recs = []
    for f in findings:
        if f.severity in ("mistake", "suboptimal"):
            recs.append(f.recommendation)

    if texture.range_advantage == "pfr":
        recs.append(
            f"You have a range advantage on this {texture.bucket.replace('_', '-')} board. "
            "Leverage it with high-frequency small bets."
        )
    elif texture.range_advantage == "caller":
        recs.append(
            "The caller's range is stronger on this board type. "
            "Be more selective with your continuation bets."
        )

    if spot.stack_depth == "short":
        recs.append(
            "With shallow stacks (<50BB), prefer simpler lines. "
            "Avoid bluffing multi-street and prioritize getting all-in with strong hands."
        )

    return list(dict.fromkeys(recs))
