"""
Equity Bucket (EQB) Classification System
==========================================
Original implementation of hand-vs-range equity classification.

The concept of categorizing hands by their equity relative to opponent's range
into discrete buckets (Strong/Good/Weak/Trash) is a well-established analytical
framework in poker theory used by solvers and coaches worldwide.

Thresholds used here are standard analytical breakpoints, not proprietary values.

EQB Definitions:
  Strong  — hand vs range equity ≥ 75%   (dominant value, wants big pot)
  Good    — hand vs range equity 50–74%  (ahead of range, wants medium pot)
  Weak    — hand vs range equity 33–49%  (marginal, wants cheap showdown)
  Trash   — hand vs range equity < 33%   (bluff or fold territory)

Bucket behavior drives:
  - Bet sizing choice (polar/merged/small)
  - Check-back vs c-bet decisions
  - Calling vs folding decisions
  - Range construction balance
"""

from __future__ import annotations
from enum import Enum
from dataclasses import dataclass


class EquityBucket(str, Enum):
    STRONG = "strong"   # ≥75% equity vs range
    GOOD   = "good"     # 50–74%
    WEAK   = "weak"     # 33–49%
    TRASH  = "trash"    # <33%


EQB_THRESHOLDS = {
    EquityBucket.STRONG: 0.75,
    EquityBucket.GOOD:   0.50,
    EquityBucket.WEAK:   0.33,
    EquityBucket.TRASH:  0.0,
}


def classify_equity_bucket(hand_vs_range_equity: float) -> EquityBucket:
    """
    Classify a hand's equity vs opponent range into an EQB tier.

    Args:
        hand_vs_range_equity: Float in [0, 1] — hero's equity vs villain range

    Returns:
        EquityBucket enum value
    """
    if hand_vs_range_equity >= 0.75:
        return EquityBucket.STRONG
    if hand_vs_range_equity >= 0.50:
        return EquityBucket.GOOD
    if hand_vs_range_equity >= 0.33:
        return EquityBucket.WEAK
    return EquityBucket.TRASH


@dataclass(frozen=True)
class EQBDistribution:
    """Distribution of equity buckets across an entire range."""
    strong_pct: float   # fraction of range with ≥75% equity
    good_pct:   float   # fraction of range with 50–74% equity
    weak_pct:   float   # fraction of range with 33–49% equity
    trash_pct:  float   # fraction of range with <33% equity

    def __post_init__(self) -> None:
        total = self.strong_pct + self.good_pct + self.weak_pct + self.trash_pct
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"EQB percentages must sum to 1.0, got {total:.3f}")

    @property
    def polarization_score(self) -> float:
        """
        How polar the range is: high score = lots of strong + trash hands,
        low score = concentrated in good/weak (condensed range).
        Returns float in [0, 1].
        """
        return self.strong_pct + self.trash_pct

    @property
    def is_polarized(self) -> bool:
        return self.polarization_score > 0.6

    @property
    def is_condensed(self) -> bool:
        """Range concentrated in good/weak — lacks nuts and air."""
        return (self.good_pct + self.weak_pct) > 0.7

    @property
    def nut_advantage_indicator(self) -> float:
        """Strong hands as fraction of non-trash — proxy for nut advantage."""
        non_trash = self.strong_pct + self.good_pct + self.weak_pct
        return self.strong_pct / non_trash if non_trash > 0 else 0.0


# Reference EQB distributions from aggregated solver data (MTT, 20-40bb)
# These are illustrative reference values, not solver-exact outputs
REFERENCE_EQB = {
    # IP (BN–UTG opener range) vs BB on average across all 1755 flops
    "ip_vs_bb_average": EQBDistribution(
        strong_pct=0.22,
        good_pct=0.43,
        weak_pct=0.29,
        trash_pct=0.06,
    ),
    # BB calling range vs IP on average across all 1755 flops
    "bb_vs_ip_average": EQBDistribution(
        strong_pct=0.07,
        good_pct=0.25,
        weak_pct=0.23,
        trash_pct=0.45,
    ),
    # High donk-bet boards (connected low boards like 654r) — BB range
    "bb_high_donk_boards": EQBDistribution(
        strong_pct=0.18,
        good_pct=0.32,
        weak_pct=0.24,
        trash_pct=0.26,
    ),
    # High card boards (A-high, K-high) — BB range
    "bb_high_card_boards": EQBDistribution(
        strong_pct=0.04,
        good_pct=0.18,
        weak_pct=0.20,
        trash_pct=0.58,
    ),
}


# Strategy implications by equity bucket
EQB_STRATEGY_NOTES = {
    EquityBucket.STRONG: {
        "preferred_action": "bet_or_raise",
        "sizing_preference": "large_to_polar",
        "rationale": (
            "Strong hands dominate villain's range and benefit from building the pot. "
            "Prefer larger bets when the range is polarized to extract maximum value "
            "from the weaker portions of villain's continuing range."
        ),
        "check_when": "protecting checking range or slowplaying vs aggressive villain",
        "coaching_tag": "value_bet_strong",
    },
    EquityBucket.GOOD: {
        "preferred_action": "bet_or_call",
        "sizing_preference": "medium_merged",
        "rationale": (
            "Good hands are ahead of villain's range and want to bet for value while "
            "building the pot at a size that doesn't fold out too many worse hands. "
            "A merged (medium) sizing captures value across more of villain's range."
        ),
        "check_when": "IP on wet board to control pot size with vulnerable hands",
        "coaching_tag": "thin_value_or_pot_control",
    },
    EquityBucket.WEAK: {
        "preferred_action": "check_or_call",
        "sizing_preference": "small_or_none",
        "rationale": (
            "Weak hands are marginally ahead or marginally behind. They want to reach "
            "showdown cheaply. Betting with weak hands as a bluff is rarely profitable "
            "because villain's range contains too many hands that beat them."
        ),
        "check_when": "most situations — check to realize equity",
        "coaching_tag": "bluff_catcher_or_showdown_value",
    },
    EquityBucket.TRASH: {
        "preferred_action": "fold_or_bluff",
        "sizing_preference": "large_if_bluffing",
        "rationale": (
            "Trash hands have minimal equity vs villain's range. They are either folded "
            "to any bet, or used as bluffs when there is sufficient fold equity. "
            "If betting as a bluff, larger sizing is preferred (forces more folds). "
            "Hands with backdoor equity or blocker effects are the best bluff candidates."
        ),
        "check_when": "no fold equity; realize small backdoor equity for free",
        "coaching_tag": "air_or_bluff_candidate",
    },
}
