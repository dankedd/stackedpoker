"""
Bridge: StrategyProfile → HeuristicFinding list.

Compares the theory-grounded StrategyProfile against the hero's actual
flop actions and generates appropriately hedged coaching findings.

DESIGN RULES (matching heuristics.py):
  - NO raw frequency percentages in user-facing text
  - Language must be appropriately hedged ("generally", "tends to", "theory supports")
  - Findings are NON-OVERLAPPING with existing heuristic findings:
      existing heuristics → bet sizing analysis
      strategy findings   → range dynamics, board type frequency context
  - Hard cap of 2 findings per call to avoid noise
"""

from __future__ import annotations

from app.models.schemas import HeuristicFinding, ParsedHand, SpotClassification

from .profiles import StrategyProfile

# Thresholds for generating findings
_HIGH_BET_FREQ = 0.72   # above this, betting is strongly preferred
_LOW_BET_FREQ = 0.40    # below this, checking is strongly preferred
_HIGH_RANGE_ADV = 0.68  # above this, mention range advantage
_LOW_RANGE_ADV = 0.40   # below this, mention range disadvantage


def _board_label(node_key: str) -> str:
    """Extract a human-readable board class label from the node key."""
    parts = node_key.split("::")
    raw = parts[4] if len(parts) > 4 else "this"
    return raw.replace("_", " ").lower()


def strategy_findings_for_hand(
    profile: StrategyProfile,
    hand: ParsedHand,
    spot: SpotClassification,
) -> list[HeuristicFinding]:
    """
    Generate strategy-grounded HeuristicFindings from the hero's flop action.

    Produces at most 2 findings:
      1. Bet-frequency deviation — when hero's action diverges from the
         expected strategy for this board type.
      2. Range advantage context — informational note about which player
         holds a theoretical range advantage on this texture.

    Parameters
    ----------
    profile : StrategyProfile
        Resolved strategy profile for this spot.
    hand : ParsedHand
        The parsed hand containing hero's actions.
    spot : SpotClassification
        Spot classification (used for context only; not re-derived here).
    """
    if not hand.board.flop:
        return []

    flop_hero = [a for a in hand.actions if a.street == "flop" and a.is_hero]
    if not flop_hero:
        return []

    findings: list[HeuristicFinding] = []
    first = flop_hero[0]
    board = _board_label(profile.node_key)
    size_hint = (
        f"{'Small bet sizing' if profile.primary_sizing == '33pct' else 'Medium bet sizing'} "
        f"is generally supported here"
    )

    # ── 1. Bet-frequency deviation ─────────────────────────────────────────
    if first.action == "check" and profile.bet_frequency >= _HIGH_BET_FREQ:
        findings.append(HeuristicFinding(
            severity="note",
            street="flop",
            action_taken="Check on high-frequency betting texture",
            recommendation=(
                f"Theory generally favours betting frequently on {board} boards — "
                f"checking is a valid deceptive line but foregoes expected pressure"
            ),
            explanation=(
                f"{profile.rationale}. "
                f"On {board} textures the preflop raiser's range tends to connect "
                f"strongly enough to support continued betting. "
                f"Checking is defensible as a trap or range-protection play, but "
                f"theory generally supports the betting approach on this texture."
            ),
            freq_recommendation=(
                f"Betting at high frequency is generally supported on {board} boards"
            ),
        ))

    elif first.action in ("bet", "raise") and profile.bet_frequency <= _LOW_BET_FREQ:
        findings.append(HeuristicFinding(
            severity="note",
            street="flop",
            action_taken="Bet on low-frequency betting texture",
            recommendation=(
                f"Theory generally supports checking more often on {board} boards — "
                f"the caller's range tends to connect well with this texture"
            ),
            explanation=(
                f"{profile.rationale}. "
                f"On {board} boards the caller's range typically holds more equity — "
                f"connected holdings, two pairs, and draws are common. "
                f"A check-heavy approach is generally more balanced on this texture."
            ),
            freq_recommendation=(
                f"Checking more frequently is generally supported on {board} boards"
            ),
        ))

    # ── 2. Range advantage context ─────────────────────────────────────────
    if profile.range_advantage >= _HIGH_RANGE_ADV:
        findings.append(HeuristicFinding(
            severity="good",
            street="flop",
            action_taken=f"{first.action.capitalize()} (range advantage context)",
            recommendation=(
                f"Range advantage on {board} boards supports continued pressure — "
                f"leverage it with appropriate sizing"
            ),
            explanation=(
                f"On {board} textures the preflop raiser's range generally holds a "
                f"meaningful equity advantage over the caller. This supports continued "
                f"betting at appropriate frequency. {size_hint}."
            ),
            freq_recommendation=None,
        ))

    elif profile.range_advantage <= _LOW_RANGE_ADV:
        findings.append(HeuristicFinding(
            severity="note",
            street="flop",
            action_taken=f"{first.action.capitalize()} (range disadvantage context)",
            recommendation=(
                f"The caller's range tends to be stronger on {board} boards — "
                f"avoid building a large pot without strong equity"
            ),
            explanation=(
                f"On {board} textures the caller's range often connects more strongly "
                f"than the preflop raiser's. This limits the effectiveness of "
                f"continuation betting and increases the cost of bluffing. "
                f"A more conservative approach is generally appropriate here."
            ),
            freq_recommendation=None,
        ))

    return findings[:2]  # hard cap: maximum 2 strategy findings per hand
