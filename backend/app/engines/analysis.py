"""
Main analysis orchestrator — combines parsing, spot classification,
board texture analysis, heuristics, and AI coaching.
"""
from __future__ import annotations
from app.models.schemas import (
    ParsedHand, AnalysisResponse, SpotClassification, BoardTexture, HeuristicFinding
)
from app.engines.board_texture import classify_board
from app.engines.spot_classifier import classify_spot
from app.engines.heuristics import run_heuristics
from app.engines.draw_evaluator import analyze_draws


def analyse_hand(hand: ParsedHand, ai_coaching: str = "") -> AnalysisResponse:
    texture = classify_board(hand.board.flop, hand.board.turn, hand.board.river)
    spot = classify_spot(hand)

    # Draw analysis: only when hero has cards and a flop exists.
    # Evaluated on the flop board; heuristics may re-evaluate on turn separately.
    draw_analysis = None
    if hand.hero_cards and hand.board.flop:
        try:
            draw_analysis = analyze_draws(hand.hero_cards, hand.board.flop)
        except Exception:
            pass  # never let draw errors break the pipeline

    findings = run_heuristics(hand, spot, texture, draw_analysis)
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
    score = 80  # default good baseline
    deductions = {
        "mistake": 15,
        "suboptimal": 7,
        "note": 0,
        "good": 0,
    }
    bonuses = {
        "good": 5,
    }
    for f in findings:
        score -= deductions.get(f.severity, 0)
        score += bonuses.get(f.severity, 0)
    return max(0, min(100, score))


def _build_recommendations(
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
) -> list[str]:
    recs = []

    # Add finding-specific recommendations
    for f in findings:
        if f.severity in ("mistake", "suboptimal"):
            recs.append(f.recommendation)

    # Add spot-specific general recommendations
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

    return list(dict.fromkeys(recs))  # deduplicate while preserving order
