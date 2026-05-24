"""
Blocker Analysis Engine — Phase 4
====================================
Evaluates the blocker properties of hero's specific hole cards on a board.

A blocker is a card in hero's hand that reduces the number of combinations
villain can hold in a particular category.

IMPORTANT DESIGN RULES
-----------------------
  - Qualitative analysis only — "strong", "moderate", "weak", "none"
  - No exact combo counting via subtraction
  - No solver outputs or fabricated frequencies
  - Structural reasoning from card overlap with board + nut categories

KEY CONCEPTS
------------
  blocks_nuts:        Hero holds a card that matches a nut combo (reduces villain
                      strong hands → bluffing is more profitable).
  blocks_calls:       Hero holds cards that reduce villain's calling range density.
  blocks_folds:       Hero does NOT block villain's weak/fold hands (good for bluffs).
  nut_blocker_quality: Strength of the specific nut blocked.
  bluff_viability:     Aggregate assessment of this hand as a bluff vehicle.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Literal, Optional

from app.solver.board_features import BoardFeatures
from app.solver.enums import BoardClassEnum
from app.ranges.models import RANK_VAL


# ── Constants ──────────────────────────────────────────────────────────────────

_BROADWAY = frozenset({"T", "J", "Q", "K", "A"})


# ── Data model ─────────────────────────────────────────────────────────────────

@dataclass
class BlockerProfile:
    """
    Blocker assessment for hero's hole cards on a given board.

    All outputs are qualitative — no exact combo counts.
    """

    hand: list[str]
    """Hero's hole cards, e.g. ["Qh", "Jh"]."""

    # ── What hero blocks ──────────────────────────────────────────────────────

    blocks_nuts: bool
    """Hero holds a card that reduces villain's nut combinations."""

    blocks_top_pair: bool
    """Hero holds the top-board-rank card (reduces top-pair combos)."""

    blocks_flush_draw: bool
    """Hero holds ≥1 card in the dominant board suit (reduces flush draws/flushes)."""

    blocks_straight_draw: bool
    """Hero holds a card within a straight-draw window with board cards."""

    blocks_broadway: bool
    """Hero holds a broadway card, reducing villain's broadway combo density."""

    # ── Call / fold blocker effects ───────────────────────────────────────────

    blocks_calls: bool
    """
    Hero's hand reduces villain's calling combinations.
    This is NEUTRAL for bluffing: fewer calls means more folds, which is good,
    but also fewer bluff-catchers, which reduces bluff value.
    True when hero overlaps with the board or holds strong broadway cards.
    """

    blocks_folds: bool
    """
    Hero's hand does NOT block villain's weak holdings.
    Good for bluffing: villain retains their fold range.
    True when hero holds cards unrelated to board texture and villain's call hands.
    """

    # ── Aggregate quality assessments ────────────────────────────────────────

    nut_blocker_quality: Literal["strong", "moderate", "weak", "none"]
    """Strength of the nut blocker: strong = blocks the specific top nut."""

    bluff_viability: Literal["high", "moderate", "low"]
    """
    Overall assessment of this hand as a bluff vehicle given blockers.

    High:     Blocks nuts + doesn't block folds (ideal bluff)
    Moderate: Partial nut block or partial fold block
    Low:      Doesn't block nuts, or blocks too many folds
    """

    reasoning: str
    """Short qualitative explanation of the blocker profile."""


# ── Main evaluator ─────────────────────────────────────────────────────────────

def evaluate_blockers(
    hero_hand: list[str],
    board_cards: list[str],
    board: Optional[BoardFeatures],
    board_class: BoardClassEnum,
) -> BlockerProfile:
    """
    Evaluate blocker properties of hero's hole cards on this board.

    Args:
        hero_hand:   Hero's two hole cards (e.g. ["Qh", "Jd"]).
        board_cards: Current board cards (e.g. ["Ah", "Kd", "3c"]).
        board:       BoardFeatures for texture context.
        board_class: Primary board classification.

    Returns:
        BlockerProfile with qualitative assessments.
    """
    if len(hero_hand) != 2:
        return _invalid_profile(hero_hand)

    # ── Parse cards ───────────────────────────────────────────────────────────
    h1r, h1s = _parse(hero_hand[0])
    h2r, h2s = _parse(hero_hand[1])
    hero_ranks = {h1r, h2r}
    hero_suits = {h1s, h2s}

    board_rank_list = [_parse(c)[0] for c in board_cards]
    board_suit_list = [_parse(c)[1] for c in board_cards]
    board_rank_set  = set(board_rank_list)

    top_rank = max(board_rank_list, key=lambda r: RANK_VAL.get(r, 0)) if board_rank_list else None

    # ── Individual blocker flags ──────────────────────────────────────────────
    blocks_top_pair    = bool(top_rank and top_rank in hero_ranks)
    blocks_broadway    = bool(hero_ranks & _BROADWAY)
    blocks_flush_draw  = _check_flush_block(hero_suits, board_suit_list, board)
    blocks_straight_draw = _check_straight_block(hero_ranks, board_rank_list, board)
    blocks_nuts        = _check_nut_block(
        hero_ranks, hero_suits, board_rank_list, board_suit_list,
        board, board_class.value
    )

    # Blocking calls: hero holds a card overlapping with boards or top broadways
    blocks_calls = bool(hero_ranks & board_rank_set) or (
        blocks_broadway and bool(hero_ranks & board_rank_set)
    )

    # Blocking folds: hero's hand is unrelated to villain's call range
    # True when hero doesn't hold the board-rank blockers
    blocks_folds = not (bool(hero_ranks & board_rank_set) or blocks_top_pair)

    # ── Quality assessments ───────────────────────────────────────────────────
    nut_quality = _nut_blocker_quality(
        hero_ranks, hero_suits, board_rank_list, board_suit_list,
        board, board_class.value, blocks_nuts
    )
    bluff_viability = _bluff_viability(
        nut_quality, blocks_calls, blocks_folds, blocks_nuts, board_class.value
    )

    reasoning = _build_reasoning(
        hero_hand, board_cards, board_class.value,
        blocks_nuts, blocks_top_pair, blocks_flush_draw,
        blocks_broadway, nut_quality, bluff_viability
    )

    return BlockerProfile(
        hand=hero_hand,
        blocks_nuts=blocks_nuts,
        blocks_top_pair=blocks_top_pair,
        blocks_flush_draw=blocks_flush_draw,
        blocks_straight_draw=blocks_straight_draw,
        blocks_broadway=blocks_broadway,
        blocks_calls=blocks_calls,
        blocks_folds=blocks_folds,
        nut_blocker_quality=nut_quality,
        bluff_viability=bluff_viability,
        reasoning=reasoning,
    )


# ── Individual blocker checks ──────────────────────────────────────────────────

def _check_flush_block(
    hero_suits: set[str],
    board_suits: list[str],
    board: Optional[BoardFeatures],
) -> bool:
    """Hero holds ≥1 card in the dominant board suit."""
    if not board_suits:
        return False
    suit_counts = Counter(board_suits)
    dominant = suit_counts.most_common(1)[0][0]
    return dominant in hero_suits


def _check_straight_block(
    hero_ranks: set[str],
    board_ranks: list[str],
    board: Optional[BoardFeatures],
) -> bool:
    """Hero's ranks fall within an open straight window with board ranks."""
    if not board or not board.straight_draw_possible:
        return False
    hero_vals  = {RANK_VAL.get(r, 0) for r in hero_ranks}
    board_vals = [RANK_VAL.get(r, 0) for r in board_ranks]
    for hv in hero_vals:
        for bv in board_vals:
            if abs(hv - bv) <= 4:
                return True
    return False


def _check_nut_block(
    hero_ranks: set[str],
    hero_suits: set[str],
    board_ranks: list[str],
    board_suits: list[str],
    board: Optional[BoardFeatures],
    board_class: str,
) -> bool:
    """
    Determine whether hero's hand blocks any nut-category combos.

    Nut blockers:
      - Holds a board-rank card → blocks sets of that rank
      - Holds the ace of the dominant suit on flush boards → blocks nut flush
      - Holds a rank completing the nut straight window
    """
    board_rank_set = set(board_ranks)

    # Block sets: hero holds a card matching a board rank
    if hero_ranks & board_rank_set:
        return True

    # Block nut flush: hero holds broadway card of dominant suit
    if board and board.flush_draw_possible and board_suits:
        suit_counts = Counter(board_suits)
        dominant = suit_counts.most_common(1)[0][0]
        if dominant in hero_suits and bool(hero_ranks & _BROADWAY):
            return True
        # Even non-broadway blocks flush combos if suit matches
        if dominant in hero_suits:
            return True

    # Block nut straight on connected boards
    if board_class in ("LOW_CONNECTED", "LOW_DYNAMIC", "MIDDLE_CONNECTED"):
        if board and board.straight_draw_possible:
            hero_vals  = {RANK_VAL.get(r, 0) for r in hero_ranks}
            board_vals = [RANK_VAL.get(r, 0) for r in board_ranks]
            min_bv = min(board_vals) if board_vals else 0
            max_bv = max(board_vals) if board_vals else 0
            for hv in hero_vals:
                # Hero rank completes or blocks the straight draw window
                if min_bv - 4 <= hv <= max_bv + 4:
                    return True

    return False


def _nut_blocker_quality(
    hero_ranks: set[str],
    hero_suits: set[str],
    board_ranks: list[str],
    board_suits: list[str],
    board: Optional[BoardFeatures],
    board_class: str,
    blocks_nuts: bool,
) -> Literal["strong", "moderate", "weak", "none"]:
    """Grade the quality of the nut block."""
    if not blocks_nuts:
        return "none"

    board_rank_set = set(board_ranks)

    # Strong: holds the ace of the dominant suit on a completed flush board
    if board and board.flush_completed and board_suits:
        suit_counts = Counter(board_suits)
        dominant = suit_counts.most_common(1)[0][0]
        if dominant in hero_suits and "A" in hero_ranks:
            return "strong"

    # Strong: holds the top-board rank (blocks top set)
    if board_ranks:
        top = max(board_ranks, key=lambda r: RANK_VAL.get(r, 0))
        if top in hero_ranks:
            return "strong"

    # Moderate: holds a non-top board rank (blocks middle/bottom set)
    if hero_ranks & board_rank_set:
        return "moderate"

    # Moderate: holds a flush-suit card (not nut flush specifically)
    if board and board.flush_draw_possible and board_suits:
        suit_counts = Counter(board_suits)
        dominant = suit_counts.most_common(1)[0][0]
        if dominant in hero_suits:
            return "moderate"

    return "weak"


def _bluff_viability(
    nut_quality: str,
    blocks_calls: bool,
    blocks_folds: bool,
    blocks_nuts: bool,
    board_class: str,
) -> Literal["high", "moderate", "low"]:
    """
    Assess how viable this hand is as a bluff.

    Ideal bluff hand:
      + Blocks villain's nut calling range  → villain calls less often
      + Does NOT block villain's fold range → villain folds more often
      - Does NOT block weak hands that anyway fold (neutral)

    On dynamic boards, nut blockers are especially valuable because villain
    has more nutted combinations to call with.
    """
    score = 0

    if nut_quality == "strong":
        score += 3
    elif nut_quality == "moderate":
        score += 2
    elif nut_quality == "weak":
        score += 1

    # Blocking folds is good — villain keeps their fold hands
    if blocks_folds:
        score += 1

    # Blocking calls on dynamic boards penalizes bluffs slightly
    # (villain has fewer strong calls, which is good, but their weak calls also disappear)
    if board_class in ("LOW_CONNECTED", "LOW_DYNAMIC") and not blocks_nuts:
        score -= 1

    if score >= 4:
        return "high"
    if score >= 2:
        return "moderate"
    return "low"


def _build_reasoning(
    hand: list[str],
    board: list[str],
    board_class: str,
    blocks_nuts: bool,
    blocks_top_pair: bool,
    blocks_flush: bool,
    blocks_broadway: bool,
    nut_quality: str,
    bluff_viability: str,
) -> str:
    """Build a concise qualitative reasoning string."""
    hand_str  = " ".join(hand)
    board_str = " ".join(board)
    parts: list[str] = []

    if blocks_nuts:
        parts.append(f"blocks nut combinations ({nut_quality} quality)")
    else:
        parts.append("does not reduce villain's nut range")

    if blocks_top_pair:
        parts.append("holds top-board-rank card (blocks top-pair combos)")
    if blocks_flush:
        parts.append("holds dominant-suit card (blocks flush combos)")
    if blocks_broadway:
        parts.append("broadway card reduces villain broadway density")

    blocker_desc = "; ".join(parts) if parts else "minimal blocker impact"

    return (
        f"{hand_str} on {board_str} ({board_class}): "
        f"{blocker_desc}. Bluff viability: {bluff_viability}."
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse(card: str) -> tuple[str, str]:
    """Parse a card string like 'Ah' → ('A', 'h')."""
    if len(card) < 2:
        return card.upper(), "?"
    return card[0].upper(), card[1].lower()


def _invalid_profile(hand: list[str]) -> BlockerProfile:
    """Return a neutral profile for invalid hand input."""
    return BlockerProfile(
        hand=hand,
        blocks_nuts=False,
        blocks_top_pair=False,
        blocks_flush_draw=False,
        blocks_straight_draw=False,
        blocks_broadway=False,
        blocks_calls=False,
        blocks_folds=True,
        nut_blocker_quality="none",
        bluff_viability="low",
        reasoning="Invalid hand — blocker analysis unavailable.",
    )
