"""
Solver-backed action scoring — grades every hero action in a hand.

Integrates with the existing scoring.py ActionCoaching system by adding
solver frequency data. When solver data is available, it overrides the
heuristic-only scoring with calibrated EV-based grades.

Scoring formula:
  base_score = frequency_to_score(solver_freq)
  difficulty_bonus = difficulty * 10  (harder spots forgive more)
  confidence_penalty = (1 - solver_confidence) * 15  (less certain = closer to 50)
  final_score = clamp(base_score + difficulty_bonus - confidence_penalty, 0, 100)

Grade thresholds:
  A+ (95-100): Optimal — solver's top action
  A  (85-94):  Excellent — high-frequency solver action
  B+ (75-84):  Good — clearly in the mixed strategy
  B  (65-74):  Solid — acceptable mixing action
  C+ (55-64):  Marginal — low-frequency but not wrong
  C  (40-54):  Inaccuracy — solver prefers other options
  D  (25-39):  Mistake — solver rarely/never uses this
  F  (0-24):   Blunder — significant EV loss
"""

from __future__ import annotations

from app.strategy.profiles import StrategyProfile

from .mistake_detector import detect_mistake
from .explainer import generate_coaching
from .models import (
    ActionQuality,
    ActionScore,
    CoachingAdvice,
    HandScore,
    MistakeReport,
)


def _frequency_to_base_score(solver_freq: float) -> int:
    """Map solver frequency to a base score 0-100."""
    if solver_freq >= 0.50:
        return 95
    if solver_freq >= 0.30:
        return 85
    if solver_freq >= 0.20:
        return 75
    if solver_freq >= 0.10:
        return 65
    if solver_freq >= 0.05:
        return 55
    if solver_freq >= 0.02:
        return 40
    if solver_freq > 0:
        return 25
    return 10


def _score_to_grade(score: int) -> tuple[str, str]:
    """Convert numeric score to letter grade and label."""
    if score >= 95:
        return "A+", "Elite"
    if score >= 85:
        return "A", "Excellent"
    if score >= 75:
        return "B+", "Good"
    if score >= 65:
        return "B", "Solid"
    if score >= 55:
        return "C+", "Marginal"
    if score >= 40:
        return "C", "Inaccuracy"
    if score >= 25:
        return "D", "Mistake"
    return "F", "Blunder"


def score_action(
    action_taken: str,
    action_index: int,
    street: str,
    strategy: StrategyProfile,
    *,
    pot_bb: float = 6.5,
    solver_confidence: float = 0.8,
    board: list[str] | None = None,
    board_class: str = "",
    spot_type: str = "SRP",
    positions: str = "BTN_vs_BB",
    is_ip: bool = True,
    is_pfr: bool = True,
    stack_depth: int = 100,
) -> ActionScore:
    """
    Score a single hero action against solver strategy.

    Returns an ActionScore with embedded MistakeReport and CoachingAdvice.
    """
    # Detect mistake
    mistake = detect_mistake(
        action_taken=action_taken,
        street=street,
        strategy=strategy,
        pot_bb=pot_bb,
        solver_confidence=solver_confidence,
    )

    # Generate coaching explanation
    advice = generate_coaching(
        mistake=mistake,
        strategy=strategy,
        board=board,
        board_class=board_class,
        spot_type=spot_type,
        positions=positions,
        is_ip=is_ip,
        is_pfr=is_pfr,
        stack_depth=stack_depth,
    )

    # Compute final score
    base_score = _frequency_to_base_score(mistake.solver_frequency)
    difficulty_bonus = int(mistake.difficulty * 10)
    confidence_penalty = int((1.0 - solver_confidence) * 15)
    final_score = max(0, min(100, base_score + difficulty_bonus - confidence_penalty))

    advice.score = final_score

    return ActionScore(
        action_index=action_index,
        street=street,
        action=action_taken,
        is_hero=True,
        score=final_score,
        quality=mistake.quality,
        difficulty=mistake.difficulty,
        mistake=mistake,
        advice=advice,
    )


def score_hand(
    actions: list[dict],
    strategies: list[StrategyProfile | None],
    *,
    pot_bbs: list[float] | None = None,
    solver_confidence: float = 0.8,
    board: list[str] | None = None,
    board_class: str = "",
    spot_type: str = "SRP",
    positions: str = "BTN_vs_BB",
    is_ip: bool = True,
    is_pfr: bool = True,
    stack_depth: int = 100,
) -> HandScore:
    """
    Score all hero actions in a hand and produce an aggregate HandScore.

    Actions without solver data are scored at 50 (neutral).
    """
    if pot_bbs is None:
        pot_bbs = [6.5] * len(actions)

    action_scores: list[ActionScore] = []
    total_ev_loss = 0.0
    mistakes_count = 0
    worst_mistake: MistakeReport | None = None
    worst_ev_loss = 0.0

    hero_idx = 0
    for i, action in enumerate(actions):
        if not action.get("is_hero", False):
            continue

        strategy = strategies[hero_idx] if hero_idx < len(strategies) else None
        pot = pot_bbs[i] if i < len(pot_bbs) else 6.5

        if strategy is not None:
            scored = score_action(
                action_taken=action.get("action", "check"),
                action_index=i,
                street=action.get("street", "flop"),
                strategy=strategy,
                pot_bb=pot,
                solver_confidence=solver_confidence,
                board=board,
                board_class=board_class,
                spot_type=spot_type,
                positions=positions,
                is_ip=is_ip,
                is_pfr=is_pfr,
                stack_depth=stack_depth,
            )
        else:
            # No solver data — neutral score
            scored = ActionScore(
                action_index=i,
                street=action.get("street", "flop"),
                action=action.get("action", "check"),
                is_hero=True,
                score=50,
                quality=ActionQuality.GOOD,
                difficulty=0.5,
            )

        action_scores.append(scored)

        if scored.mistake and scored.mistake.is_mistake():
            mistakes_count += 1
            total_ev_loss += scored.mistake.ev_loss_bb
            if scored.mistake.ev_loss_bb > worst_ev_loss:
                worst_ev_loss = scored.mistake.ev_loss_bb
                worst_mistake = scored.mistake

        hero_idx += 1

    # Weighted overall score (later streets weighted slightly more)
    if action_scores:
        street_weights = {"preflop": 0.8, "flop": 1.0, "turn": 1.1, "river": 1.2}
        weighted_sum = sum(
            s.score * street_weights.get(s.street, 1.0) for s in action_scores
        )
        weight_total = sum(
            street_weights.get(s.street, 1.0) for s in action_scores
        )
        overall_score = int(weighted_sum / weight_total)
    else:
        overall_score = 50

    grade, grade_label = _score_to_grade(overall_score)

    return HandScore(
        overall_score=overall_score,
        actions=action_scores,
        mistakes_count=mistakes_count,
        worst_mistake=worst_mistake,
        total_ev_loss_bb=round(total_ev_loss, 2),
        grade=grade,
        grade_label=grade_label,
    )
