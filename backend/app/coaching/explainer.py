"""
Coaching explanation layer — converts solver output into human-readable advice.

This is the CRITICAL module that makes the platform valuable. Raw solver output
("bet 75% at 63% frequency") is meaningless to most users. This module generates
coaching like:

  "This board strongly favors your range. As the preflop raiser on A♠K♠3♥,
   you have more strong Ax hands and broadway combos than BB. Bet large (75% pot)
   with your value hands and best draws to pressure BB's capped range."

Architecture:
  1. Classify the strategic context (range advantage, board texture, position)
  2. Select explanation template based on context
  3. Fill template with board-specific details
  4. Add confidence caveats when solver data is uncertain
  5. Simplify without becoming inaccurate

Design rules:
  - NEVER cite fake frequencies or EVs
  - ALWAYS ground explanations in poker theory concepts
  - Prefer "why" over "what" — teach the principle, not just the answer
  - Adapt language to solver confidence level
"""

from __future__ import annotations

from app.strategy.profiles import StrategyProfile

from .models import (
    ActionQuality,
    CoachingAdvice,
    MistakeReport,
    MistakeSeverity,
)


# ── Board description helpers ─────────────────────────────────────────────

_SUIT_SYMBOLS = {"s": "♠", "h": "♥", "d": "♦", "c": "♣"}


def _card_display(card: str) -> str:
    """Convert 'Ah' to 'A♥'."""
    if len(card) < 2:
        return card
    rank = card[:-1]
    suit = card[-1]
    return f"{rank}{_SUIT_SYMBOLS.get(suit, suit)}"


def _board_display(board: list[str]) -> str:
    return " ".join(_card_display(c) for c in board)


# ── Range advantage explanations ──────────────────────────────────────────

_RANGE_ADVANTAGE_EXPLANATIONS = {
    "strong_pfr": (
        "As the preflop raiser, your range is significantly stronger here. "
        "You hold more overpairs, top pairs with good kickers, and strong "
        "broadway combos. This range advantage supports frequent betting."
    ),
    "moderate_pfr": (
        "Your range has a moderate advantage on this board. You have more "
        "strong hands than your opponent, but the texture allows them some "
        "equity with draws and middle-strength hands."
    ),
    "neutral": (
        "Neither player has a clear range advantage here. The board connects "
        "with both ranges, so a more cautious approach with smaller bets or "
        "checking makes strategic sense."
    ),
    "caller_favored": (
        "This board actually favors the caller's range. They hit more two-pair "
        "and set combos on low connected boards. Checking more often and "
        "controlling the pot is the theory-sound approach."
    ),
}

# ── Board texture explanations ────────────────────────────────────────────

_TEXTURE_EXPLANATIONS = {
    "dry": "Few draws are possible, so your opponent's range is easier to read and equity shifts on later streets are small.",
    "wet": "Many draws are possible, which means your opponent has significant equity even without a made hand. Larger bets deny equity more effectively.",
    "monotone": "The monotone texture means flush draws dominate the equity landscape. Hands without the flush draw lose significant value.",
    "paired": "The paired board reduces the number of strong hands possible, making ranges more transparent. Overpairs and trips are the key holdings.",
    "connected": "High connectivity means straight draws and combo draws are common. Protecting strong made hands with larger sizing is important.",
    "static": "This static board means equities won't change much on later streets. You can bet smaller since your opponent can't catch up easily.",
    "dynamic": "This dynamic board means later cards can dramatically shift equities. Larger bets now protect your strong hands against free cards.",
}


def _select_range_explanation(strategy: StrategyProfile, is_pfr: bool) -> str:
    """Pick the right range advantage explanation based on strategy signals."""
    ra = strategy.range_advantage

    if is_pfr:
        if ra >= 0.65:
            return _RANGE_ADVANTAGE_EXPLANATIONS["strong_pfr"]
        if ra >= 0.45:
            return _RANGE_ADVANTAGE_EXPLANATIONS["moderate_pfr"]
        return _RANGE_ADVANTAGE_EXPLANATIONS["caller_favored"]
    else:
        if ra <= 0.35:
            return _RANGE_ADVANTAGE_EXPLANATIONS["caller_favored"]
        if ra <= 0.55:
            return _RANGE_ADVANTAGE_EXPLANATIONS["neutral"]
        return _RANGE_ADVANTAGE_EXPLANATIONS["moderate_pfr"]


def _select_texture_explanation(board_class: str) -> str:
    """Pick texture explanation from board class."""
    board_lower = board_class.lower()
    if "dry" in board_lower or "static" in board_lower:
        return _TEXTURE_EXPLANATIONS["static"]
    if "wet" in board_lower or "dynamic" in board_lower:
        return _TEXTURE_EXPLANATIONS["dynamic"]
    if "monotone" in board_lower:
        return _TEXTURE_EXPLANATIONS["monotone"]
    if "paired" in board_lower:
        return _TEXTURE_EXPLANATIONS["paired"]
    if "connected" in board_lower:
        return _TEXTURE_EXPLANATIONS["connected"]
    return _TEXTURE_EXPLANATIONS["dry"]


# ── Verdict generation ────────────────────────────────────────────────────

_VERDICT_TEMPLATES = {
    ActionQuality.OPTIMAL: "Well played — this is the solver's preferred action.",
    ActionQuality.GOOD: "Solid play — the solver uses this action frequently.",
    ActionQuality.ACCEPTABLE: "Reasonable — this action is part of a mixed strategy.",
    ActionQuality.INACCURACY: "Slight inaccuracy — a better option is available.",
    ActionQuality.MISTAKE: "Strategic error — the solver strongly prefers a different action.",
    ActionQuality.BLUNDER: "Significant mistake — this action is not part of the solver's strategy.",
}


def _build_what_to_do_instead(mistake: MistakeReport, strategy: StrategyProfile) -> str:
    """Generate the 'what to do instead' recommendation."""
    preferred = mistake.solver_preferred_action
    freq = mistake.solver_preferred_freq

    if preferred == "bet":
        sizing = strategy.primary_sizing or "medium"
        sizing_label = {
            "33pct": "small (33% pot)",
            "50pct": "half pot",
            "67pct": "two-thirds pot",
            "75pct": "75% pot",
            "pot": "pot-sized",
        }.get(sizing, sizing)
        return f"The solver prefers betting {sizing_label} in this spot."

    if preferred == "check":
        return "Checking is the solver's preferred action here, keeping the pot controlled."

    if preferred == "fold":
        return "Folding is the disciplined play — your hand doesn't have enough equity to continue."

    if preferred == "call":
        return "Calling is preferred — you have enough equity to continue but not enough to raise."

    if preferred == "raise":
        return "Raising is the solver's preferred action, applying maximum pressure."

    return f"The solver prefers to {preferred} in this spot."


def _build_key_factors(
    strategy: StrategyProfile,
    board_class: str,
    is_ip: bool,
    is_pfr: bool,
) -> list[str]:
    """Generate 2-3 key strategic factors for this spot."""
    factors = []

    # Range advantage
    if strategy.range_advantage >= 0.65:
        factors.append("Strong range advantage — your range dominates this board")
    elif strategy.range_advantage <= 0.35:
        factors.append("Opponent has range advantage — tread carefully")

    # Nut advantage
    if strategy.nut_advantage >= 0.7:
        factors.append("You hold the nut advantage — strong hands are in your range")
    elif strategy.nut_advantage <= 0.3:
        factors.append("Opponent has the nut advantage — avoid building large pots without strong hands")

    # Position
    if is_ip:
        factors.append("You act last — you can control pot size and extract thin value")
    else:
        factors.append("Acting first is a disadvantage — check-raising and leading require stronger hands")

    # Board texture
    texture_note = _select_texture_explanation(board_class)
    if len(texture_note) < 100:
        factors.append(texture_note)

    return factors[:3]  # Max 3 factors


# ── Main explanation generator ────────────────────────────────────────────


def generate_coaching(
    mistake: MistakeReport,
    strategy: StrategyProfile,
    *,
    board: list[str] | None = None,
    board_class: str = "",
    spot_type: str = "SRP",
    positions: str = "BTN_vs_BB",
    is_ip: bool = True,
    is_pfr: bool = True,
    stack_depth: int = 100,
) -> CoachingAdvice:
    """
    Generate human-readable coaching from a mistake report and solver strategy.

    This is the primary entry point for the explanation system.
    """
    board_str = _board_display(board) if board else ""
    ip_label = "IP" if is_ip else "OOP"
    pfr_label = "PFR" if is_pfr else "caller"

    # Build spot description
    pos_parts = positions.split("_vs_")
    hero_pos = pos_parts[0] if pos_parts else "Hero"
    villain_pos = pos_parts[1] if len(pos_parts) > 1 else "Villain"
    spot_desc = f"{spot_type} pot, {hero_pos} ({ip_label}/{pfr_label}) vs {villain_pos}, {stack_depth}bb"
    if board_str:
        spot_desc += f" on {board_str}"

    # Verdict
    verdict = _VERDICT_TEMPLATES.get(mistake.quality, "")

    # Score (0-100)
    score = {
        ActionQuality.OPTIMAL: 95,
        ActionQuality.GOOD: 82,
        ActionQuality.ACCEPTABLE: 68,
        ActionQuality.INACCURACY: 52,
        ActionQuality.MISTAKE: 35,
        ActionQuality.BLUNDER: 15,
    }.get(mistake.quality, 50)

    # Headline
    if mistake.severity in (MistakeSeverity.NONE, MistakeSeverity.TRIVIAL):
        headline = "Good decision — this action aligns with solver strategy."
    elif mistake.severity == MistakeSeverity.MINOR:
        headline = "Slight deviation — a marginally better option exists."
    elif mistake.severity == MistakeSeverity.MODERATE:
        headline = f"Consider {mistake.solver_preferred_action}ing instead — your range supports it here."
    else:
        headline = f"{mistake.solver_preferred_action.capitalize()} is strongly preferred in this spot."

    # Why it's right/wrong
    why_right = ""
    why_wrong = ""

    if not mistake.is_mistake():
        why_right = _select_range_explanation(strategy, is_pfr)
    else:
        why_wrong = _select_range_explanation(strategy, is_pfr)

    # What to do instead
    what_instead = ""
    if mistake.is_mistake():
        what_instead = _build_what_to_do_instead(mistake, strategy)

    # Simplified strategy
    if strategy.bet_frequency >= 0.70:
        simplified = "Bet frequently on this board texture."
    elif strategy.bet_frequency >= 0.40:
        simplified = "Mix between betting and checking on this texture."
    else:
        simplified = "Check most of your range on this board texture."

    strategy_reasoning = _select_texture_explanation(board_class)

    # Key factors
    key_factors = _build_key_factors(strategy, board_class, is_ip, is_pfr)

    # Transferable concept
    concept = _derive_transferable_concept(mistake, strategy, board_class, is_pfr)

    # Confidence
    confidence = mistake.solver_confidence
    source = "solver" if confidence >= 0.7 else "hybrid" if confidence >= 0.4 else "heuristic"

    return CoachingAdvice(
        headline=headline,
        verdict=verdict,
        score=score,
        spot_description=spot_desc,
        what_happened=f"You chose to {mistake.action_taken} on the {mistake.street}.",
        why_its_right=why_right,
        why_its_wrong=why_wrong,
        what_to_do_instead=what_instead,
        transferable_concept=concept,
        simplified_strategy=simplified,
        strategy_reasoning=strategy_reasoning,
        key_factors=key_factors,
        confidence=confidence,
        source=source,
    )


def _derive_transferable_concept(
    mistake: MistakeReport,
    strategy: StrategyProfile,
    board_class: str,
    is_pfr: bool,
) -> str:
    """Extract a single transferable poker concept from this spot."""
    tags = mistake.concept_tags

    if "range_advantage" in tags:
        return "When you have range advantage, bet more frequently with a wider range — not just your strongest hands."

    if "cbet_theory" in tags:
        if strategy.range_advantage >= 0.6:
            return "On boards that favor your range, continuation betting frequently applies maximum pressure."
        return "Not every board is a good c-bet spot. Check when the board favors the caller's range."

    if "mdf" in tags or "fold_too_much" in tags:
        return "When facing a bet, you need to defend enough hands to prevent your opponent from profiting with any two cards."

    if "nut_advantage" in tags:
        return "The player with the nut advantage can bet larger, because their strong hands are stronger than the opponent's."

    if "over_aggression" in tags:
        return "Betting without a range or nut advantage allows your opponent to exploit you by raising or trapping."

    if "spr_theory" in tags:
        return "With a low stack-to-pot ratio, commitment decisions become binary — you're either all-in or folding."

    if "pot_control" in tags:
        return "With medium-strength hands, controlling the pot by checking keeps you from building a pot you can't win."

    # Generic concept based on board texture
    if "dry" in board_class.lower():
        return "On dry boards, equities are stable — small bets accomplish the same as large ones."
    if "wet" in board_class.lower() or "dynamic" in board_class.lower():
        return "On wet boards, larger bets deny equity to draws and protect your strong made hands."

    return "In poker, the right play depends on your range advantage, position, and board texture — not just your hand."
