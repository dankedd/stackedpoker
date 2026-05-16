"""
Outs Engine — True outs calculation for Texas Hold'em draws.

METHODOLOGY
===========

True outs = cards remaining in the deck that improve the hero's hand,
minus cards already accounted for (hero's hole cards + board cards).

For each draw type, we enumerate the specific ranks/suits that complete it,
then subtract cards already seen to get the true count.

DIRECT OUTS (turn or river):
  flush_draw    → 9 outs (13 of suit − 4 seen)
  oesd          → 8 outs (4 ranks × 1 each end, minus already-seen)
  double_gutter → 8 outs (same as OESD: 2 gutshots × 4 outs each)
  gutshot       → 4 outs (4 cards of the needed rank, minus seen)

BACKDOOR OUTS (runner-runner equity approximation):
  backdoor_flush    → ~4.2% equity (10 turn + flush river combination)
  backdoor_straight → ~1–3% equity depending on gaps needed

DEDUPLICATION:
  If a card completes BOTH a flush AND a straight:
  count it only ONCE (no double-counting).

BLOCKER HANDLING:
  Cards seen (hole + board) are removed from the out count.
  E.g., if Ah is on board and hero has AsKh, the flush has 8 outs not 9.

BOARD PAIRING CONSIDERATIONS:
  When the board pairs, some outs may now make the villain a full house.
  This is noted in warnings but does not automatically reduce the count.
  (Exact EV calculation would require range analysis.)

COUNTERFEIT HANDLING:
  On river, outs are 0 (no cards coming).
  Two-pair can be counterfeited when the board pairs — noted as warning.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Sequence

from app.engines.draw_evaluator import DrawAnalysis, analyze_draws
from app.engines.hand_evaluator import parse_card, RANK_VALUES, _rank_name

logger = logging.getLogger(__name__)

ALL_RANKS = list(range(2, 15))  # 2..14 (Ace=14)
ALL_SUITS = list("cdhs")


@dataclass
class OutsResult:
    """Precise outs calculation for a given draw situation."""
    hole_cards: list[str]
    board_cards: list[str]
    street: str

    # Per-draw outs breakdown
    flush_outs: int = 0
    straight_outs: int = 0
    total_outs: int = 0

    # Specific out cards (for verification and display)
    flush_out_cards: list[str] = field(default_factory=list)
    straight_out_cards: list[str] = field(default_factory=list)
    combined_out_cards: list[str] = field(default_factory=list)

    # Backdoor equity (approximate)
    backdoor_flush_equity_pct: float = 0.0
    backdoor_straight_equity_pct: float = 0.0

    # Rule-of-two / rule-of-four approximations
    turn_equity_pct: float = 0.0    # outs × 2 (one card to come)
    flop_equity_pct: float = 0.0    # outs × 4 (two cards to come)

    # Diagnostics
    warnings: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# ── Public API ─────────────────────────────────────────────────────────────────

def calculate_outs(
    hole_cards: Sequence[str],
    board_cards: Sequence[str],
    draw_analysis: DrawAnalysis | None = None,
) -> OutsResult:
    """
    Calculate precise outs for hero's draws.

    Parameters
    ----------
    hole_cards : e.g. ['9h', '8h']
    board_cards : e.g. ['Ah', '7d', '2s']
    draw_analysis : optional pre-computed DrawAnalysis (avoids redundant work)

    Returns
    -------
    OutsResult with per-draw out counts and specific out cards.
    """
    if draw_analysis is None:
        draw_analysis = analyze_draws(hole_cards, board_cards)

    result = OutsResult(
        hole_cards=list(hole_cards),
        board_cards=list(board_cards),
        street=draw_analysis.street,
    )

    if draw_analysis.street == "river":
        result.warnings.append(
            "River: no cards remaining — outs are 0. Hand is complete."
        )
        return result

    # Cards already seen — subtract from available outs
    seen_cards: set[str] = set()
    for c in list(hole_cards) + list(board_cards):
        parsed = parse_card(c)
        seen_cards.add(f"{parsed.rank}{parsed.suit}")

    # ── Flush outs ────────────────────────────────────────────────────────────
    flush_out_cards: list[str] = []
    for fd in draw_analysis.flush_draws:
        if fd.draw_type != "flush_draw":
            continue
        suit = fd.suit
        # All cards of that suit not yet seen
        for rank_val in ALL_RANKS:
            rank_char = _rv_to_char(rank_val)
            card_str = f"{rank_char}{suit}"
            if card_str not in seen_cards:
                flush_out_cards.append(card_str)

    # ── Straight outs ─────────────────────────────────────────────────────────
    straight_out_cards: list[str] = []
    straight_needed_ranks: set[int] = set()

    for sd in draw_analysis.straight_draws:
        if sd.draw_type in ("oesd", "double_gutter", "gutshot"):
            for nr in sd.needed_ranks:
                straight_needed_ranks.add(nr)
        # Backdoor — handled separately below

    for needed_rank in straight_needed_ranks:
        rank_char = _rv_to_char(needed_rank)
        for suit in ALL_SUITS:
            card_str = f"{rank_char}{suit}"
            if card_str not in seen_cards:
                straight_out_cards.append(card_str)

    # ── Deduplicate: remove flush outs from straight outs ─────────────────────
    flush_out_set = set(flush_out_cards)
    straight_only_cards = [c for c in straight_out_cards if c not in flush_out_set]

    # ── Combined: flush + straight (union) ───────────────────────────────────
    combined = list(flush_out_set | set(straight_out_cards))

    result.flush_outs = len(flush_out_cards)
    result.straight_outs = len(straight_only_cards)
    result.total_outs = len(combined)
    result.flush_out_cards = sorted(flush_out_cards)
    result.straight_out_cards = sorted(straight_only_cards)
    result.combined_out_cards = sorted(combined)

    # ── Backdoor equity approximation ─────────────────────────────────────────
    if draw_analysis.has_backdoor_flush and not draw_analysis.has_flush_draw:
        # ~4% runner-runner flush (10 turn cards × ~1/10 river = ~4%)
        result.backdoor_flush_equity_pct = 4.2

    if draw_analysis.has_backdoor_straight and not draw_analysis.has_direct_straight_draw:
        # Roughly 1-3% depending on number of backdoor combinations
        bd_draws = [
            s for s in draw_analysis.straight_draws
            if s.draw_type == "backdoor_straight"
        ]
        n_bd = len(bd_draws)
        # Each backdoor window: ~4 turn outs × ~4 river outs / deck_remaining²
        # Very rough: 1.5% per backdoor window, max ~3%
        result.backdoor_straight_equity_pct = min(1.5 * n_bd, 4.0)

    # ── Rule-of-N equity approximations ───────────────────────────────────────
    if draw_analysis.street == "flop":
        result.turn_equity_pct = round(result.total_outs * 2.0, 1)
        result.flop_equity_pct = round(result.total_outs * 4.0, 1)
        result.notes.append(
            f"Rule-of-4: ~{result.flop_equity_pct}% equity with {result.total_outs} outs (flop to river)"
        )
        result.notes.append(
            f"Rule-of-2: ~{result.turn_equity_pct}% equity (flop to turn only)"
        )
    elif draw_analysis.street == "turn":
        result.turn_equity_pct = round(result.total_outs * 2.0, 1)
        result.notes.append(
            f"Rule-of-2: ~{result.turn_equity_pct}% equity with {result.total_outs} outs (turn to river)"
        )

    # ── Board pairing warnings ────────────────────────────────────────────────
    board_rank_vals = [parse_card(c).rank_value for c in board_cards]
    if len(set(board_rank_vals)) < len(board_rank_vals):
        result.warnings.append(
            "Paired board: some straight outs may improve villain to a full house. "
            "True EV of draws is reduced."
        )

    return result


def outs_summary(result: OutsResult) -> str:
    """Human-readable outs summary."""
    parts = []
    if result.flush_outs:
        parts.append(f"{result.flush_outs} flush outs")
    if result.straight_outs:
        parts.append(f"{result.straight_outs} straight outs")
    total = result.total_outs
    if total:
        equity_str = (
            f"~{result.flop_equity_pct}% equity (R4)"
            if result.flop_equity_pct
            else f"~{result.turn_equity_pct}% equity (R2)"
            if result.turn_equity_pct
            else ""
        )
        return (
            f"{total} total outs ({' + '.join(parts)})"
            + (f" — {equity_str}" if equity_str else "")
        )

    backdoor_parts = []
    if result.backdoor_flush_equity_pct:
        backdoor_parts.append(f"~{result.backdoor_flush_equity_pct:.1f}% backdoor flush")
    if result.backdoor_straight_equity_pct:
        backdoor_parts.append(f"~{result.backdoor_straight_equity_pct:.1f}% backdoor straight")
    if backdoor_parts:
        return "Backdoor only: " + ", ".join(backdoor_parts)

    return "No outs — no draw"


# ── Helpers ────────────────────────────────────────────────────────────────────

_RANK_CHARS_BY_VALUE: dict[int, str] = {v: k for k, v in RANK_VALUES.items()}
# Handle Ace=1 (for wheel) not in standard dict
_RANK_CHARS_BY_VALUE[1] = "A"


def _rv_to_char(rank_value: int) -> str:
    """Convert rank value (2-14) back to rank char."""
    return _RANK_CHARS_BY_VALUE.get(rank_value, str(rank_value))
