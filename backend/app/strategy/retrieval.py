"""
resolve_strategy — deterministic SolverSpot → StrategyProfile.

This is the Phase 4 solver strategy entry point.

NO AI. NO hardcoded per-hand logic. NO fabricated solver percentages.
All output is deterministically derived from SolverSpot abstraction dimensions.
"""

from __future__ import annotations

import logging

from app.solver.models import SolverSpot

from .profiles import ActionFrequency, StrategyProfile
from .registry import build_profile_dict

logger = logging.getLogger(__name__)


def resolve_strategy(spot: SolverSpot) -> StrategyProfile:
    """
    Resolve a deterministic StrategyProfile for the given SolverSpot.

    Parameters
    ----------
    spot : SolverSpot
        Fully classified spot from SolverSpotClassifier.

    Returns
    -------
    StrategyProfile
        Deterministic strategy profile.  Never raises — returns a fallback
        profile if the registry lookup fails.
    """
    spot_type = spot.spot_type.value
    is_ip = spot.is_ip
    spr_bucket = spot.spr_bucket.value
    board_class = spot.board_class.value

    node_key = (
        f"{spot_type}::{spot.position_matchup.value}"
        f"::{spot.stack_depth_bucket.value}::{spr_bucket}"
        f"::{board_class}::{spot.street.value}::{spot.player_count}p"
    )

    logger.debug(
        "[resolve_strategy] node_key=%s is_ip=%s spr=%s board=%s",
        node_key, is_ip, spr_bucket, board_class,
    )

    try:
        raw = build_profile_dict(spot_type, is_ip, spr_bucket, board_class)
        source = "registry"
    except Exception:
        logger.warning(
            "[resolve_strategy] registry lookup failed for %s — using fallback",
            node_key, exc_info=True,
        )
        raw = build_profile_dict("UNKNOWN", is_ip, "8_PLUS", "NEUTRAL")
        source = "fallback"

    bet_freq = raw["bet_frequency"]
    check_freq = raw["check_frequency"]
    sizing = raw["primary_sizing"]

    action_frequencies = sorted(
        [
            ActionFrequency(action="bet", frequency=bet_freq, sizing=sizing),
            ActionFrequency(action="check", frequency=check_freq, sizing=None),
        ],
        key=lambda af: af.frequency,
        reverse=True,
    )

    caveats: list[str] = []
    if spot.player_count >= 3:
        caveats.append(
            "Multiway pot: all frequency signals reflect heads-up theory and "
            "should be applied with reduced confidence"
        )
    if board_class == "NEUTRAL" and spot.street.value != "preflop":
        caveats.append(
            "Board class is NEUTRAL — classification may be incomplete; "
            "treat all signals with reduced confidence"
        )

    return StrategyProfile(
        node_key=node_key,
        bet_frequency=bet_freq,
        check_frequency=check_freq,
        primary_sizing=sizing,
        range_advantage=raw["range_advantage"],
        nut_advantage=raw["nut_advantage"],
        pressure_score=raw["pressure_score"],
        volatility_score=raw["volatility_score"],
        equity_realization=raw["equity_realization"],
        action_frequencies=action_frequencies,
        rationale=raw["rationale"],
        caveats=caveats,
        source=source,
    )
