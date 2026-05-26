"""
Mistake detection engine — compares user actions against solver strategies.

Core philosophy:
  Poker has MIXED strategies. Checking when the solver checks 40% and bets 60%
  is NOT a mistake — it's an acceptable deviation within the mixed strategy.
  Only actions the solver NEVER takes (or takes at very low frequency) are
  true mistakes.

EV loss estimation:
  Without full EV data per action, we estimate EV loss from frequency deviation.
  An action used at 0% frequency likely has negative EV relative to alternatives.
  An action used at 5% frequency is barely -EV and gets the TRIVIAL label.

Calibration thresholds (% pot EV loss estimate):
  NONE:     solver_freq >= 30%  (clearly in the mix)
  TRIVIAL:  solver_freq 10-30%  (low-frequency but intentional — <0.5% EV)
  MINOR:    solver_freq 2-10%   (marginal action — 0.5-2% EV)
  MODERATE: solver_freq 0-2%    (solver avoids this — 2-5% EV)
  MAJOR:    solver_freq == 0% and preferred >= 60%  (clear solver preference)
  CRITICAL: solver_freq == 0% and it's a fold-instead-of-value or vice versa

Difficulty adjustment:
  Close decisions (solver splits 45/55) get reduced severity even if the user
  picks the minority action. We measure decision difficulty and adjust accordingly.
"""

from __future__ import annotations

import logging
import math

from app.strategy.profiles import StrategyProfile, ActionFrequency

from .models import (
    ActionQuality,
    MistakeReport,
    MistakeSeverity,
)

logger = logging.getLogger(__name__)

# ── Frequency thresholds ──────────────────────────────────────────────────

_OPTIMAL_THRESHOLD = 0.30       # >= 30% frequency → clearly optimal
_GOOD_THRESHOLD = 0.20          # >= 20% → good
_ACCEPTABLE_THRESHOLD = 0.05    # >= 5% → acceptable
_INACCURACY_THRESHOLD = 0.02    # >= 2% → slight inaccuracy
# Below 2% → mistake. 0% → blunder.

# ── EV loss estimation curves ─────────────────────────────────────────────
# These map frequency deviation to approximate EV loss as % of pot.
# Derived from analysis of real solver outputs where EV data is available.

_EV_LOSS_CURVE = [
    # (solver_freq_ceiling, ev_loss_pct_of_pot)
    (0.30, 0.0),     # Clearly in the mix — no loss
    (0.20, 0.2),     # Slight preference for other action
    (0.10, 0.5),     # Minor deviation
    (0.05, 1.5),     # Meaningful deviation
    (0.02, 3.0),     # Solver mostly avoids this
    (0.00, 6.0),     # Solver never does this
]


def _estimate_ev_loss_pct(solver_freq: float) -> float:
    """Estimate EV loss as % of pot from solver frequency of the taken action."""
    for ceiling, loss in _EV_LOSS_CURVE:
        if solver_freq >= ceiling:
            return loss
    return 8.0  # 0% frequency, strong solver preference elsewhere


def _classify_quality(solver_freq: float) -> ActionQuality:
    """Map solver frequency to action quality label."""
    if solver_freq >= _OPTIMAL_THRESHOLD:
        return ActionQuality.OPTIMAL
    if solver_freq >= _GOOD_THRESHOLD:
        return ActionQuality.GOOD
    if solver_freq >= _ACCEPTABLE_THRESHOLD:
        return ActionQuality.ACCEPTABLE
    if solver_freq >= _INACCURACY_THRESHOLD:
        return ActionQuality.INACCURACY
    if solver_freq > 0:
        return ActionQuality.MISTAKE
    return ActionQuality.BLUNDER


def _classify_severity(
    solver_freq: float,
    ev_loss_pct: float,
    preferred_freq: float,
    difficulty: float,
) -> MistakeSeverity:
    """
    Classify mistake severity with difficulty adjustment.

    Close decisions (difficulty > 0.7) get one severity level reduction.
    """
    # Base severity from EV loss
    if ev_loss_pct < 0.3:
        severity = MistakeSeverity.NONE
    elif ev_loss_pct < 1.0:
        severity = MistakeSeverity.TRIVIAL
    elif ev_loss_pct < 2.5:
        severity = MistakeSeverity.MINOR
    elif ev_loss_pct < 5.0:
        severity = MistakeSeverity.MODERATE
    elif ev_loss_pct < 15.0:
        severity = MistakeSeverity.MAJOR
    else:
        severity = MistakeSeverity.CRITICAL

    # Difficulty adjustment: reduce severity for genuinely close decisions
    if difficulty >= 0.70 and severity.value not in ("none", "trivial"):
        _SEVERITY_ORDER = list(MistakeSeverity)
        idx = _SEVERITY_ORDER.index(severity)
        if idx > 0:
            severity = _SEVERITY_ORDER[idx - 1]

    return severity


def _compute_difficulty(action_distribution: dict[str, float]) -> float:
    """
    Measure how difficult a decision is based on solver frequency split.

    Close splits (45/55) → high difficulty (0.9)
    Lopsided (5/95) → low difficulty (0.1)

    Uses entropy of the distribution as a proxy for decision complexity.
    """
    freqs = [f for f in action_distribution.values() if f > 0.01]
    if len(freqs) <= 1:
        return 0.0  # Only one real option → trivial

    # Normalized entropy: 0 = one dominant action, 1 = perfectly split
    total = sum(freqs)
    if total < 0.01:
        return 0.0

    entropy = 0.0
    for f in freqs:
        p = f / total
        if p > 0:
            entropy -= p * math.log2(p)

    max_entropy = math.log2(len(freqs))
    if max_entropy < 0.01:
        return 0.0

    return min(1.0, entropy / max_entropy)


def _normalize_action_type(action: str) -> str:
    """Normalize action strings for comparison."""
    action_lower = action.lower().strip()
    if action_lower.startswith("bet") or action_lower.startswith("raise"):
        return "bet"
    if action_lower in ("check", "call"):
        return action_lower
    if action_lower == "fold":
        return "fold"
    return action_lower


def detect_mistake(
    action_taken: str,
    street: str,
    strategy: StrategyProfile,
    pot_bb: float = 6.5,
    solver_confidence: float = 0.8,
) -> MistakeReport:
    """
    Analyze a single user action against the solver strategy.

    Args:
        action_taken: The action the user took ("bet 75%", "check", "fold")
        street: Which street ("flop", "turn", "river")
        strategy: The solver's strategy profile for this spot
        pot_bb: Current pot size in BB (for EV loss conversion)
        solver_confidence: Confidence in the solver data [0,1]

    Returns:
        MistakeReport with severity, EV loss, and coaching explanation.
    """
    action_type = _normalize_action_type(action_taken)

    # Build action distribution from strategy profile
    distribution: dict[str, float] = {}
    if strategy.action_frequencies:
        for af in strategy.action_frequencies:
            distribution[af.action] = af.frequency
    else:
        # Fallback: use bet/check frequencies
        distribution["bet"] = strategy.bet_frequency
        distribution["check"] = strategy.check_frequency

    # Find the user's action frequency in solver strategy
    solver_freq = 0.0
    if action_type in distribution:
        solver_freq = distribution[action_type]
    elif action_type == "bet" and "raise" in distribution:
        solver_freq = distribution["raise"]
    elif action_type == "call" and "check" in distribution:
        # Call and check are different actions; don't conflate
        pass

    # Find the solver's preferred action
    preferred_action = max(distribution, key=distribution.get) if distribution else "check"
    preferred_freq = distribution.get(preferred_action, 0.5)

    # Compute difficulty
    difficulty = _compute_difficulty(distribution)

    # Estimate EV loss
    ev_loss_pct = _estimate_ev_loss_pct(solver_freq)
    ev_loss_bb = (ev_loss_pct / 100.0) * pot_bb

    # Scale by solver confidence — less confident data means less certain mistakes
    ev_loss_pct *= solver_confidence
    ev_loss_bb *= solver_confidence

    # Classify
    quality = _classify_quality(solver_freq)
    severity = _classify_severity(solver_freq, ev_loss_pct, preferred_freq, difficulty)

    # Determine concept tags for leak detection
    concept_tags = _derive_concept_tags(action_type, preferred_action, street, strategy)

    return MistakeReport(
        street=street,
        action_taken=action_taken,
        action_type=action_type,
        severity=severity,
        quality=quality,
        ev_loss_pct=round(ev_loss_pct, 2),
        ev_loss_bb=round(ev_loss_bb, 2),
        solver_frequency=round(solver_freq, 3),
        solver_preferred_action=preferred_action,
        solver_preferred_freq=round(preferred_freq, 3),
        solver_confidence=round(solver_confidence, 3),
        action_distribution={k: round(v, 3) for k, v in distribution.items()},
        difficulty=round(difficulty, 3),
        concept_tags=concept_tags,
    )


def _derive_concept_tags(
    action_type: str,
    preferred_action: str,
    street: str,
    strategy: StrategyProfile,
) -> list[str]:
    """Map action deviation to coaching concept tags."""
    tags: list[str] = []

    # Missed c-bet
    if preferred_action == "bet" and action_type == "check" and street == "flop":
        tags.append("cbet_theory")
        if strategy.range_advantage > 0.6:
            tags.append("range_advantage")

    # Unnecessary fold
    if action_type == "fold" and preferred_action != "fold":
        tags.append("mdf")
        tags.append("fold_too_much")

    # Over-betting / over-aggression
    if action_type == "bet" and preferred_action == "check":
        if strategy.nut_advantage < 0.4:
            tags.append("nut_advantage")
        tags.append("over_aggression")

    # Sizing leak
    if action_type == "bet" and preferred_action == "bet":
        tags.append("bet_sizing")

    # Pot control
    if strategy.pressure_score < 0.3 and action_type == "bet":
        tags.append("pot_control")

    # SPR awareness
    if strategy.node_key and "0_2" in strategy.node_key:
        tags.append("spr_theory")

    return tags


def detect_hand_mistakes(
    actions: list[dict],
    strategies: list[StrategyProfile | None],
    pot_bbs: list[float],
    solver_confidence: float = 0.8,
) -> list[MistakeReport]:
    """
    Analyze all hero actions in a hand against solver strategies.

    Args:
        actions: List of {street, action, is_hero} dicts.
        strategies: Solver strategy for each hero action (None if unavailable).
        pot_bbs: Pot size at each action point.

    Returns:
        List of MistakeReport for each hero action.
    """
    reports = []
    for action, strategy, pot in zip(actions, strategies, pot_bbs):
        if not action.get("is_hero", False):
            continue
        if strategy is None:
            continue

        report = detect_mistake(
            action_taken=action.get("action", "check"),
            street=action.get("street", "flop"),
            strategy=strategy,
            pot_bb=pot,
            solver_confidence=solver_confidence,
        )
        reports.append(report)

    return reports
