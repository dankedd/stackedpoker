"""
Extended Density Analysis — Phase 4
======================================
Supplements the base RangeInteractionEngine metrics (top_pair / overpair /
set / draw / broadway) with three additional strategic density categories:

    nut      — sets + straights + nut flushes + top two pair
    two_pair — holdings that paired two board cards
    air      — complete misses with minimal equity (pure bluffs)

All outputs are qualitative: "high" | "medium" | "low" | "minimal"

DESIGN RULES
------------
  - No exact equity math
  - No brute-force combo enumeration beyond what the base metrics already provide
  - Heuristic formulas that produce strategically coherent estimates
  - Deterministic: same metrics + board → same output
"""
from __future__ import annotations

from typing import Optional

from app.solver.board_features import BoardFeatures
from app.solver.enums import BoardClassEnum
from app.ranges.interactions import RangeMetrics, DensityLabel


# ── Threshold constants (weighted combo counts) ───────────────────────────────

_NUT_HIGH    = 18.0   # ≥ this → "high" nut density
_NUT_MEDIUM  =  8.0
_NUT_LOW     =  2.0

_TP_HIGH     = 20.0   # top_pair_combos threshold for "high"
_TP_MEDIUM   =  8.0


def _label(val: float, high: float, medium: float, low: float = 0.0) -> DensityLabel:
    """Convert a float to a qualitative density label using thresholds."""
    if val >= high:
        return "high"
    if val >= medium:
        return "medium"
    if val > low:
        return "low"
    return "minimal"


# ── Nut density ────────────────────────────────────────────────────────────────

def _nut_density(
    m: RangeMetrics,
    board: Optional[BoardFeatures],
    board_class: BoardClassEnum,
) -> DensityLabel:
    """
    Estimate nut density for a range on this board.

    Nut = sets + overpairs (strong) + top pair with top kicker (partial credit)
    We also add a bonus for connected boards where straights are likely.
    """
    bc = board_class.value if board_class else "NEUTRAL"

    # Base: sets and overpairs are the primary nut candidates
    nut_base = m.set_combos + m.overpair_combos

    # On broadway-heavy boards, top pair with strong kickers is also nutted
    if bc in ("A_HIGH_DRY", "K_HIGH_DRY", "TRIPLE_BROADWAY", "DOUBLE_BROADWAY"):
        nut_base += m.top_pair_combos * 0.25   # AK top-pair is near-nut on some runouts

    # On connected boards, straights (hidden in draw_density_est) are relevant
    if board and (board.straight_completed or board.connectedness_score >= 7):
        nut_base += m.draw_density_est * 0.3   # a portion of draws made straights/flushes

    # On monotone boards, flush combos from draw_density_est are nuts
    if board and board.flush_completed:
        nut_base += m.draw_density_est * 0.4

    return _label(nut_base, _NUT_HIGH, _NUT_MEDIUM, _NUT_LOW)


# ── Two-pair density ───────────────────────────────────────────────────────────

def _two_pair_density(
    m: RangeMetrics,
    board: Optional[BoardFeatures],
) -> DensityLabel:
    """
    Estimate two-pair density.

    Base: two_pair_candidates from RangeMetrics (combos that contain 2 board ranks).
    Adjustments for board class and texture.
    """
    base = m.two_pair_candidates

    # Two-pair is more likely on connected boards (more overlapping rank combos)
    if board and board.connectedness_score >= 5:
        base *= 1.2

    # On paired boards, two-pair via hole-card + board pair is harder to count;
    # use a conservative reduction
    if board and board.paired:
        base *= 0.8

    return _label(base, high=12.0, medium=5.0, low=1.0)


# ── Air density ────────────────────────────────────────────────────────────────

def _air_density(
    m: RangeMetrics,
    board: Optional[BoardFeatures],
    board_class: BoardClassEnum,
) -> DensityLabel:
    """
    Estimate air density (complete misses).

    Air = combos that hit neither top pair, second pair, a set, nor a draw.
    Heuristic: start from total range width estimate, subtract made-hand combos.

    We don't know total range combos here, so we estimate from the inverse of
    the density of hits:
      low hit density → high air density
      high hit density → low air density
    """
    bc = board_class.value if board_class else "NEUTRAL"
    hits = m.top_pair_combos + m.second_pair_combos + m.set_combos + m.overpair_combos

    # On very high boards (A/K), many combos in wide ranges miss
    if bc in ("A_HIGH_DRY", "K_HIGH_DRY") and hits < 15:
        # Wide IP ranges (BTN) have lots of low suited connectors that brick
        return "high"

    # On connected low boards, draws contribute to equity so "air" is lower
    if bc in ("LOW_CONNECTED", "LOW_DYNAMIC"):
        draw_presence = m.draw_density_est > 5
        if draw_presence:
            # Draws have equity; not pure air
            if hits < 8:
                return "medium"
            return "low"

    # General formula: if hits are sparse relative to typical range width
    if hits < 5:
        return "high"
    if hits < 12:
        return "medium"
    if hits < 25:
        return "low"
    return "minimal"


# ── Public API ─────────────────────────────────────────────────────────────────

def extend_density_profile(
    ip_metrics: RangeMetrics,
    oop_metrics: RangeMetrics,
    board: Optional[BoardFeatures],
    board_class: Optional[BoardClassEnum] = None,
) -> dict[str, dict[str, DensityLabel]]:
    """
    Extend a base RangeInteractionProfile with nut / two_pair / air densities.

    Args:
        ip_metrics:   Metrics for the IP player's range.
        oop_metrics:  Metrics for the OOP player's range.
        board:        BoardFeatures for texture context (may be None for preflop).
        board_class:  BoardClassEnum (derived from board or SolverSpot).

    Returns:
        Dict with keys "nut", "two_pair", "air", each mapping to
        {"IP": DensityLabel, "OOP": DensityLabel}.
    """
    bc = board_class or BoardClassEnum.NEUTRAL

    ip_nut    = _nut_density(ip_metrics, board, bc)
    oop_nut   = _nut_density(oop_metrics, board, bc)

    ip_tp     = _two_pair_density(ip_metrics, board)
    oop_tp    = _two_pair_density(oop_metrics, board)

    ip_air    = _air_density(ip_metrics, board, bc)
    oop_air   = _air_density(oop_metrics, board, bc)

    return {
        "nut":      {"IP": ip_nut,  "OOP": oop_nut},
        "two_pair": {"IP": ip_tp,   "OOP": oop_tp},
        "air":      {"IP": ip_air,  "OOP": oop_air},
    }


def density_summary(
    profile_densities: dict[str, dict[str, DensityLabel]],
    perspective: str,  # "IP" or "OOP"
) -> str:
    """
    Build a human-readable density summary for one player.

    Example:
        "Top pair: high | Sets: medium | Draws: low | Air: high"
    """
    parts = []
    for category, by_side in profile_densities.items():
        val = by_side.get(perspective, "minimal")
        parts.append(f"{category.replace('_', ' ')}: {val}")
    return " | ".join(parts)
