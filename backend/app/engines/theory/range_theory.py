"""
Range Morphology Theory
========================
Original implementation of range classification concepts.

Poker ranges can be described by their equity distribution shape:
  Linear     — top hands only, no gaps (e.g., opens from EP)
  Polarized  — nuts + air, nothing in between (e.g., river bets on some runouts)
  Condensed  — middle-equity hands, lacks top and bottom (e.g., calling range)
  Capped     — missing the strongest hands (e.g., BB flat-call range on AKQ flop)
  Uncapped   — contains all hand strengths including the nuts

These are structural descriptions of range distributions, not copyrighted concepts.
"""

from __future__ import annotations
from enum import Enum
from dataclasses import dataclass


class RangeMorphology(str, Enum):
    LINEAR     = "linear"     # Strong hands without gaps; no air
    POLARIZED  = "polarized"  # Nuts + bluffs; minimal middle
    CONDENSED  = "condensed"  # Middle equity; lacks nuts and air
    CAPPED     = "capped"     # Missing the very top of range
    UNCAPPED   = "uncapped"   # Has all hand strengths including nuts
    MERGED     = "merged"     # Wide betting range — combines value + semi-bluffs + thin value


@dataclass(frozen=True)
class RangeMorphologyProfile:
    morphology: RangeMorphology
    description: str
    nut_presence: str      # "present", "absent", "limited"
    air_presence: str      # "present", "absent", "limited"
    betting_style: str     # preferred strategic approach
    typical_spot: str      # example of where this range shape appears
    coaching_implication: str


MORPHOLOGY_PROFILES: dict[RangeMorphology, RangeMorphologyProfile] = {
    RangeMorphology.LINEAR: RangeMorphologyProfile(
        morphology=RangeMorphology.LINEAR,
        description=(
            "Highest equity hands without gaps — a strong, straightforward range. "
            "Commonly seen in early-position preflop opens where only premium holdings are included."
        ),
        nut_presence="present",
        air_presence="absent",
        betting_style="bet_for_value_most_of_range",
        typical_spot="EP RFI range, 3-bet/call range after 4-bet",
        coaching_implication=(
            "Against a linear range, bluffing is risky because they rarely have air. "
            "Your fold equity is low. Value betting thin is also riskier because they rarely "
            "have weak holdings — their range is composed of strong hands throughout."
        ),
    ),
    RangeMorphology.POLARIZED: RangeMorphologyProfile(
        morphology=RangeMorphology.POLARIZED,
        description=(
            "Nuts + air, with minimal medium-strength hands. "
            "Classic river betting range when the bettor has either the best hand or a bluff."
        ),
        nut_presence="present",
        air_presence="present",
        betting_style="large_bets_preferred",
        typical_spot="River 3-bet range, OOP donk leads on low connected boards",
        coaching_implication=(
            "Against a polarized range, you are a bluff catcher. Use MDF to determine "
            "how often to call. Raising with medium-strength hands is rarely correct "
            "because you cannot profitably raise the nuts portion and you lose to it. "
            "Large bets are optimal for the polarized player — as bet size grows, "
            "fewer bluffs are needed to remain balanced."
        ),
    ),
    RangeMorphology.CONDENSED: RangeMorphologyProfile(
        morphology=RangeMorphology.CONDENSED,
        description=(
            "Middle-equity hands — lacks both the nuts and air. "
            "A calling range after a raise typically looks like this: "
            "it has no premium holdings (those would 3-bet) and no pure trash (those fold)."
        ),
        nut_presence="absent",
        air_presence="absent",
        betting_style="small_bets_or_check",
        typical_spot="BB flat-call vs LP open (preflop); river calls after multiple streets",
        coaching_implication=(
            "Condensed ranges cannot profitably overbet because they lack the nuts "
            "to balance overbets. Small bets for thin value and pot control are "
            "strategically appropriate. Against a condensed range, overbets with "
            "polarized ranges are very profitable."
        ),
    ),
    RangeMorphology.CAPPED: RangeMorphologyProfile(
        morphology=RangeMorphology.CAPPED,
        description=(
            "Missing the strongest hands — the top of range has been removed "
            "by the action sequence. For example, calling a raise when you would "
            "3-bet your strongest holdings leaves the calling range capped."
        ),
        nut_presence="absent",
        air_presence="limited",
        betting_style="medium_bets_vulnerable_to_overbets",
        typical_spot="Flat-call ranges on high-card boards after PFR opportunity",
        coaching_implication=(
            "A capped range is vulnerable to large bets and overbets because "
            "the opponent knows you cannot have the nuts. They can exploit this "
            "by betting large frequently. To protect against this, some strong hands "
            "should be included in the flat-call range (slowplaying) to re-cap the range."
        ),
    ),
    RangeMorphology.UNCAPPED: RangeMorphologyProfile(
        morphology=RangeMorphology.UNCAPPED,
        description=(
            "Contains all hand strengths including the strongest holdings. "
            "Typically the last-aggressor's range entering the postflop — "
            "they could have any hand they opened/3-bet with."
        ),
        nut_presence="present",
        air_presence="present",
        betting_style="full_betting_flexibility",
        typical_spot="PFR range on the flop; 3-bettor's range after 3-bet called",
        coaching_implication=(
            "An uncapped range has full strategic flexibility. It can bet large "
            "for value, bet small to merge, check back to deceive, or bluff. "
            "Having nut hands in your range is crucial for protecting your range "
            "and preventing exploitation on later streets."
        ),
    ),
    RangeMorphology.MERGED: RangeMorphologyProfile(
        morphology=RangeMorphology.MERGED,
        description=(
            "Betting a wide range that includes strong, medium, and semi-bluff hands "
            "at a uniform small-to-medium sizing. A merged strategy maximizes "
            "betting frequency and range coverage rather than maximizing value per bet."
        ),
        nut_presence="present",
        air_presence="present",
        betting_style="small_to_medium_high_frequency",
        typical_spot="Dry board c-bets; IP small cbet on paired boards",
        coaching_implication=(
            "Merged betting works best when you have a significant range advantage "
            "and want to deny equity to villain's large trash/weak bucket. "
            "A small, high-frequency cbet on dry boards is a merged strategy: "
            "you bet most of your range for a small size, not just the nuts."
        ),
    ),
}


def classify_range_morphology(
    nut_pct: float,
    air_pct: float,
    medium_pct: float,
) -> RangeMorphology:
    """
    Classify range morphology from its composition.

    Args:
        nut_pct:    Fraction of range that are 'strong' (EQB ≥75%)
        air_pct:    Fraction of range that are 'trash' (EQB <33%)
        medium_pct: Fraction that are 'good' or 'weak' (33–74%)

    Returns:
        RangeMorphology classification
    """
    total = nut_pct + air_pct + medium_pct
    if total < 0.5:
        return RangeMorphology.CONDENSED  # not enough data

    # Normalize
    n = nut_pct / total
    a = air_pct / total
    m = medium_pct / total

    if n < 0.05:  # essentially no nuts
        return RangeMorphology.CAPPED
    if a < 0.05 and n > 0.2:  # strong with little air
        return RangeMorphology.LINEAR
    if n > 0.2 and a > 0.3 and m < 0.4:  # nuts + air, little middle
        return RangeMorphology.POLARIZED
    if m > 0.7:  # overwhelmingly middle equity
        return RangeMorphology.CONDENSED
    return RangeMorphology.MERGED  # mixed / merged default


# Combos math constants
POCKET_PAIR_COMBOS = 6    # e.g., AA = 6 combos (C(4,2))
SUITED_HAND_COMBOS = 4    # e.g., AKs = 4 combos
OFFSUIT_HAND_COMBOS = 12  # e.g., AKo = 12 combos
TOTAL_STARTING_HANDS = 1326

# Frequencies of hand categories in a full deck
FREQUENCY_OF_POCKET_PAIRS = 78 / 1326  # ~5.88%
FREQUENCY_OF_SUITED_HANDS = 312 / 1326  # ~23.53%
FREQUENCY_OF_OFFSUIT_HANDS = 936 / 1326  # ~70.59%
