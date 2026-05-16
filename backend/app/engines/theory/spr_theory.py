"""
SPR Theory — Stack-to-Pot Ratio Guidelines
===========================================
Original implementation of SPR-based strategy guidelines.

SPR = effective_stack / pot

SPR determines how much money is left to play relative to the pot, which
directly affects hand selection, commitment thresholds, and betting strategy.

Guidelines here derive from fundamental poker mathematics:
- Low SPR: fewer streets to play, raw equity dominates, made hands prefer commitment
- High SPR: more streets, equity realization and nuttiness dominate
"""

from __future__ import annotations
from enum import Enum
from dataclasses import dataclass


class SPRZone(str, Enum):
    MICRO  = "micro"   # SPR 0–1    (essentially committed)
    LOW    = "low"     # SPR 1–5    (1-2 streets of play)
    MEDIUM = "medium"  # SPR 5–11   (2-3 streets, standard SRP)
    HIGH   = "high"    # SPR 11–20  (deep, 3+ streets)
    DEEP   = "deep"    # SPR 20+    (very deep, implied odds dominant)


def classify_spr(spr: float) -> SPRZone:
    """Classify SPR into a strategic zone."""
    if spr <= 1:
        return SPRZone.MICRO
    if spr <= 5:
        return SPRZone.LOW
    if spr <= 11:
        return SPRZone.MEDIUM
    if spr <= 20:
        return SPRZone.HIGH
    return SPRZone.DEEP


def compute_spr(effective_stack_bb: float, pot_bb: float) -> float:
    """
    Compute Stack-to-Pot Ratio.

    Args:
        effective_stack_bb: Smaller of hero/villain stacks (in BB)
        pot_bb:             Current pot size (in BB)

    Returns:
        SPR value; returns 0 if pot is 0
    """
    return effective_stack_bb / pot_bb if pot_bb > 0 else 0.0


@dataclass(frozen=True)
class SPRHandGuidelines:
    """Strategic guidelines for a given SPR zone."""
    zone: SPRZone
    description: str
    commitment_threshold: str       # What hand strength justifies commitment?
    preferred_hand_types: list[str] # Hand types that perform well
    underperforming_types: list[str]# Hand types that struggle
    bet_size_preference: str        # Preferred bet-size range
    key_concept: str                # Core strategic idea
    coaching_tag: str


SPR_GUIDELINES: dict[SPRZone, SPRHandGuidelines] = {
    SPRZone.MICRO: SPRHandGuidelines(
        zone=SPRZone.MICRO,
        description="SPR ≤1: Pot-committed territory. Any reasonable equity justifies call.",
        commitment_threshold="Any pair or better; even draws with 20%+ equity",
        preferred_hand_types=["top_pair", "middle_pair", "pair_plus_draw", "any_draw"],
        underperforming_types=["speculative_draws_needing_implied_odds"],
        bet_size_preference="all_in",
        key_concept=(
            "At micro SPR, both players are effectively all-in. Folding is rarely correct "
            "once you have any pair or reasonable equity. Raw equity drives decisions; "
            "implied odds are irrelevant because no future streets exist."
        ),
        coaching_tag="pot_committed",
    ),
    SPRZone.LOW: SPRHandGuidelines(
        zone=SPRZone.LOW,
        description="SPR 1–5: Top pair strong. 1-2 streets of play remaining.",
        commitment_threshold="Top pair top kicker or better; strong draws",
        preferred_hand_types=["overpair", "top_pair_top_kicker", "two_pair", "set", "strong_draw"],
        underperforming_types=["speculative_hands", "weak_pairs_needing_implied_odds"],
        bet_size_preference="50_to_100_pct_pot",
        key_concept=(
            "In low SPR pots, made hands like top pair and overpairs perform best. "
            "Speculative hands lose value because SPR doesn't provide enough implied odds "
            "to justify calling. Top pair is strong enough to commit at low SPR. "
            "The goal is to build the pot with made hands and deny equity to draws."
        ),
        coaching_tag="top_pair_commits",
    ),
    SPRZone.MEDIUM: SPRHandGuidelines(
        zone=SPRZone.MEDIUM,
        description="SPR 5–11: Standard SRP dynamics. 2-3 streets of play.",
        commitment_threshold="Two pair or better; strong draws with good implied odds",
        preferred_hand_types=["two_pair", "set", "strong_flush_draw", "nut_straight_draw"],
        underperforming_types=["weak_pairs", "low_pocket_pairs_as_bluff_catchers"],
        bet_size_preference="33_to_75_pct_pot",
        key_concept=(
            "Medium SPR is the standard single raised pot (SRP) range. "
            "Top pair becomes demoted — it can still be played for value but "
            "cannot commit stacks without improvement risk. "
            "Suitedness and connectedness become increasingly important because "
            "hands that can make the nuts (straights, flushes) gain implied odds. "
            "The primary challenge is navigating 2-3 streets efficiently."
        ),
        coaching_tag="two_pair_or_better_commits",
    ),
    SPRZone.HIGH: SPRHandGuidelines(
        zone=SPRZone.HIGH,
        description="SPR 11–20: Deep stacks. Nuttiness and equity realization drive value.",
        commitment_threshold="Sets, straights, flushes; nut-potential draws",
        preferred_hand_types=["set", "nut_straight", "nut_flush", "nut_draw"],
        underperforming_types=["top_pair_no_redraw", "weak_two_pair", "underpairs"],
        bet_size_preference="25_to_50_pct_pot_early_streets",
        key_concept=(
            "At high SPR, the potential to make the nuts drives hand value. "
            "Hands that can be coolered (dominated straights, flush over flush) "
            "lose significant EV. Suitedness, wheel potential, and nut draws "
            "increase in value. Top pair alone cannot justify building a huge pot. "
            "Position becomes even more valuable because more streets remain."
        ),
        coaching_tag="nuttiness_dominates",
    ),
    SPRZone.DEEP: SPRHandGuidelines(
        zone=SPRZone.DEEP,
        description="SPR 20+: Very deep. Implied odds and playability dominate.",
        commitment_threshold="Only the absolute nuts or near-nuts",
        preferred_hand_types=["set", "nut_flush", "wheel_potential", "nut_straight", "strong_suited_connectors"],
        underperforming_types=["offsuit_high_cards", "top_pair_weak_kicker", "underpairs"],
        bet_size_preference="small_builds_on_early_streets",
        key_concept=(
            "At very deep SPR, implied odds are maximized. Hands that flop strong and "
            "can grow to the absolute nuts (sets, nut draws) become dramatically more "
            "valuable. Conversely, one-pair hands become liabilities because they "
            "can face enormous pressure across multiple streets. "
            "The gap between nut potential and capped ranges widens dramatically."
        ),
        coaching_tag="implied_odds_maximum",
    ),
}


def spr_hand_guidelines(spr: float) -> SPRHandGuidelines:
    """Return strategic guidelines for a given SPR value."""
    return SPR_GUIDELINES[classify_spr(spr)]


def commitment_threshold_met(
    hand_category: str,
    spr: float,
) -> bool:
    """
    Heuristic check: does the hand meet the commitment threshold for this SPR?

    Args:
        hand_category: e.g. "top_pair", "two_pair", "set", "overpair"
        spr: current stack-to-pot ratio

    Returns:
        True if the hand justifies commitment at this SPR
    """
    zone = classify_spr(spr)

    COMMIT_MAP: dict[SPRZone, set[str]] = {
        SPRZone.MICRO:  {"any_pair", "top_pair", "middle_pair", "bottom_pair", "two_pair",
                          "set", "straight", "flush", "full_house", "quads", "overpair",
                          "strong_draw", "pair_plus_draw"},
        SPRZone.LOW:    {"top_pair", "two_pair", "set", "straight", "flush", "full_house",
                          "quads", "overpair", "tptk", "strong_draw"},
        SPRZone.MEDIUM: {"two_pair", "set", "straight", "flush", "full_house", "quads",
                          "strong_draw", "nut_draw"},
        SPRZone.HIGH:   {"set", "straight", "flush", "full_house", "quads", "nut_draw"},
        SPRZone.DEEP:   {"nut_straight", "nut_flush", "full_house", "quads"},
    }

    return hand_category in COMMIT_MAP.get(zone, set())
