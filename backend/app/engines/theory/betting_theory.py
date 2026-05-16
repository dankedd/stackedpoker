"""
Bet-Sizing Theory
==================
Original implementation of bet-sizing principles derived from fundamental
poker mathematics and game theory.

Key concepts:
  - Geometric bet-sizing (equal fraction of pot on each street → all-in on river)
  - Alpha and MDF at various bet fractions
  - Polar vs merged sizing strategy
  - SPR-based optimal bet-size recommendations
  - Bluff candidate selection criteria

All formulas are original implementations of well-established poker math,
not reproduced from copyrighted sources.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from .mdf_alpha import alpha, mdf


class BetSizingStrategy(str, Enum):
    MERGED    = "merged"     # Small, high frequency (most of range bets)
    POLAR     = "polar"      # Large, low frequency (nuts + bluffs only)
    GEOMETRIC = "geometric"  # Escalating sizes to set up river all-in
    ALL_IN    = "all_in"     # Pot committed
    CHECK     = "check"      # Optimal is to check (depolarized vs range)


@dataclass(frozen=True)
class BetSizeRecommendation:
    """A recommended bet-size with strategic context."""
    size_fraction: float       # As fraction of pot (1.0 = pot-size)
    size_label: str            # Human label: "33%", "67%", etc.
    strategy: BetSizingStrategy
    frequency_guidance: str    # "high (70%+)", "medium (40-70%)", "low (<40%)"
    rationale: str
    bluff_to_value: tuple[float, float]  # (bluff_fraction, value_fraction) at this size


def geometric_bet_size(
    starting_pot: float,
    effective_stack: float,
    streets_remaining: int,
) -> float:
    """
    Compute the geometrically optimal bet size per street.

    The geometric bet size is the fraction of pot that, if bet on every
    remaining street with the same ratio, results in an all-in on the last street.

    Formula:
        pot_growth_rate (R) = (final_pot / starting_pot) ^ (1 / streets) - 1

    Where:
        final_pot = starting_pot + 2 × effective_stack (both players all-in)

    Args:
        starting_pot:       Current pot size (in any unit, e.g. BB)
        effective_stack:    Effective stack (smaller of two stacks)
        streets_remaining:  Number of betting streets left (e.g., 3 for flop)

    Returns:
        Fraction of pot to bet each street (e.g., 0.75 = 75% pot)

    Example:
        Pot: 10bb, Stack: 95bb, 3 streets remaining:
        final_pot = 10 + 2×95 = 200
        R = (200/10)^(1/3) - 1 ≈ 1.714 (171% of pot each street — huge overbet)
        → With realistic stacks, geometric bets are often overbets → use min(R, 1.0)
    """
    if streets_remaining <= 0:
        return 1.0  # river: bet pot (or all-in)
    if starting_pot <= 0:
        return 0.5  # default 50% if no pot

    final_pot = starting_pot + 2.0 * effective_stack
    if final_pot <= starting_pot:
        return 0.5  # stacks are 0, no meaningful calculation

    ratio = final_pot / starting_pot
    growth_rate = ratio ** (1.0 / streets_remaining) - 1.0
    return growth_rate  # this IS the fraction of pot to bet each street


def optimal_bet_size_for_spr(spr: float) -> BetSizeRecommendation:
    """
    Return the optimal bet-size recommendation given current SPR.

    Based on SPR theory:
      - Very low SPR (≤1): Go all-in
      - Low SPR (1–3): 50–75% pot / pot-size bets
      - Medium SPR (3–7): 33–67% pot
      - High SPR (7–15): 25–50% flop; escalate on later streets
      - Deep SPR (15+): Small on flop; geometric escalation to river

    Args:
        spr: Stack-to-pot ratio

    Returns:
        BetSizeRecommendation with strategic context
    """
    if spr <= 1.0:
        return BetSizeRecommendation(
            size_fraction=1.0,
            size_label="all-in",
            strategy=BetSizingStrategy.ALL_IN,
            frequency_guidance="100% — any value hand commits",
            rationale=(
                "At SPR ≤1, both players are pot-committed. Commit with any "
                "reasonable made hand or draw. There is no implied odds or "
                "future-street consideration — get the money in."
            ),
            bluff_to_value=(alpha(1.0, 1.0), 1 - alpha(1.0, 1.0)),
        )

    if spr <= 3.0:
        return BetSizeRecommendation(
            size_fraction=0.75,
            size_label="75% pot",
            strategy=BetSizingStrategy.POLAR,
            frequency_guidance="medium (40-60%)",
            rationale=(
                "Low SPR favors polarized bets with strong hands and selected bluffs. "
                "75% pot charges draws heavily and forces fold/commitment decisions. "
                "Top pair and overpairs can often commit at this SPR."
            ),
            bluff_to_value=(alpha(0.75, 1.0), 1 - alpha(0.75, 1.0)),
        )

    if spr <= 7.0:
        return BetSizeRecommendation(
            size_fraction=0.50,
            size_label="50% pot",
            strategy=BetSizingStrategy.MERGED,
            frequency_guidance="high (60-75%)",
            rationale=(
                "Standard SRP SPR range. A medium 50% pot sizing balances "
                "value extraction (good hands want to be called by worse) "
                "with equity denial (draws should not see free cards). "
                "Both merged and polarized approaches work depending on board texture."
            ),
            bluff_to_value=(alpha(0.50, 1.0), 1 - alpha(0.50, 1.0)),
        )

    if spr <= 15.0:
        return BetSizeRecommendation(
            size_fraction=0.33,
            size_label="33% pot",
            strategy=BetSizingStrategy.MERGED,
            frequency_guidance="very high (75%+)",
            rationale=(
                "Deep SPR encourages smaller early-street bets to build the pot "
                "gradually. Betting 33% allows the range to merge (bet most hands), "
                "denying equity widely while preserving future betting streets. "
                "The geometric approach means escalating on later streets."
            ),
            bluff_to_value=(alpha(0.33, 1.0), 1 - alpha(0.33, 1.0)),
        )

    # Very deep SPR (15+)
    return BetSizeRecommendation(
        size_fraction=0.25,
        size_label="25% pot",
        strategy=BetSizingStrategy.MERGED,
        frequency_guidance="very high (80%+)",
        rationale=(
            "At very deep SPR, small early bets set up geometric escalation. "
            "A 25% pot bet on the flop with high frequency is the standard approach "
            "to build the pot incrementally while maintaining range balance "
            "across all three streets."
        ),
        bluff_to_value=(alpha(0.25, 1.0), 1 - alpha(0.25, 1.0)),
    )


def classify_bet_size(bet_fraction: float) -> str:
    """
    Classify a bet-size fraction into a named category.

    Args:
        bet_fraction: Bet size as fraction of pot (e.g., 0.5 = half-pot)

    Returns:
        Category string
    """
    if bet_fraction <= 0:
        return "check"
    if bet_fraction <= 0.30:
        return "small_donk_or_blocker"
    if bet_fraction <= 0.45:
        return "small_cbet"
    if bet_fraction <= 0.60:
        return "medium_cbet"
    if bet_fraction <= 0.85:
        return "large_bet"
    if bet_fraction <= 1.1:
        return "pot_size_bet"
    return "overbet"


@dataclass(frozen=True)
class BluffCandidate:
    """Criteria for selecting good bluffing hands."""
    name: str
    description: str
    why_good_bluff: str
    why_bad_bluff: str
    examples: list[str]


BLUFF_CANDIDATE_CRITERIA: list[BluffCandidate] = [
    BluffCandidate(
        name="nut_blocker",
        description="Hand blocks the nuts in villain's range",
        why_good_bluff=(
            "Blocking the nuts reduces the frequency with which villain has a "
            "calling hand, making bluffs more profitable. E.g., A-high on a flush "
            "board blocks villain's nut flush combos."
        ),
        why_bad_bluff="Having a nut blocker doesn't mean villain always folds — only helps probabilistically.",
        examples=["Ax on flush board", "Kx blocking KK on K-high board"],
    ),
    BluffCandidate(
        name="backdoor_equity",
        description="Hand has backdoor draw potential (flush or straight)",
        why_good_bluff=(
            "Backdoor equity provides insurance against calls. Even if villain calls, "
            "the bluff has ~4-9% equity to improve. This reduces the breakeven "
            "fold frequency needed, making the bluff profitable in more scenarios."
        ),
        why_bad_bluff="Low total equity — still needs substantial fold equity to profit.",
        examples=["76s on A82 (backdoor flush + backdoor straight)"],
    ),
    BluffCandidate(
        name="poor_showdown_value",
        description="Hand has minimal chance of winning at showdown",
        why_good_bluff=(
            "A hand with zero showdown value gains nothing from checking (except "
            "a rare free card). Turning it into a bluff gives it the only path to "
            "winning the pot. This is correct semi-bluff logic applied to air."
        ),
        why_bad_bluff=(
            "Pure air with no equity must succeed on current street — "
            "no fallback if called. Requires high fold equity to be profitable."
        ),
        examples=["76o on AK2r (no pair, no draw, no backdoors)"],
    ),
    BluffCandidate(
        name="range_coverage",
        description="Hand improves the range's board coverage on specific runouts",
        why_good_bluff=(
            "Including hands that represent specific runout improvements "
            "maintains range balance across all possible turn/river cards. "
            "A hand that represents a flush turn on two-tone boards deserves "
            "a check-raise frequency to preserve that coverage."
        ),
        why_bad_bluff="Requires range awareness — not a simple mechanical rule.",
        examples=["Suited gutter on two-tone boards as c-bet bluff candidate"],
    ),
]


# Reference bluff:value targets by bet size
BLUFF_VALUE_TARGETS = {
    "25%_pot": {"alpha": 0.200, "bluffs_per_value": "1:4"},
    "33%_pot": {"alpha": 0.248, "bluffs_per_value": "1:3"},
    "50%_pot": {"alpha": 0.333, "bluffs_per_value": "1:2"},
    "67%_pot": {"alpha": 0.401, "bluffs_per_value": "2:3"},
    "75%_pot": {"alpha": 0.429, "bluffs_per_value": "3:7"},
    "pot":     {"alpha": 0.500, "bluffs_per_value": "1:1"},
    "1.5x":    {"alpha": 0.600, "bluffs_per_value": "3:2"},
    "2x":      {"alpha": 0.667, "bluffs_per_value": "2:1"},
}
