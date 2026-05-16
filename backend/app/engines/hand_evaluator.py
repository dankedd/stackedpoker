"""
Hand Evaluator — 5-card hand rank detection for Texas Hold'em.

Evaluates the best 5-card hand from any number of cards (hole + board).
Returns a HandRank with category, description, and rank for comparison.

Categories (ascending strength):
  0 = high_card
  1 = pair
  2 = two_pair
  3 = trips
  4 = straight
  5 = flush
  6 = full_house
  7 = quads
  8 = straight_flush

Design:
  - Fully deterministic, no external dependencies
  - Handles Ace-low straights (wheel: A-2-3-4-5)
  - Handles Ace-high straights (Broadway: T-J-Q-K-A)
  - Returns structured HandRank for comparison and description
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from typing import Sequence


# ── Card primitives ────────────────────────────────────────────────────────────

RANK_CHARS = "23456789TJQKA"
RANK_VALUES: dict[str, int] = {r: i + 2 for i, r in enumerate(RANK_CHARS)}  # '2'→2, 'A'→14
SUIT_CHARS = "cdhs"

_CATEGORY_NAMES = [
    "high_card",
    "pair",
    "two_pair",
    "trips",
    "straight",
    "flush",
    "full_house",
    "quads",
    "straight_flush",
]

_CATEGORY_LABELS = [
    "High Card",
    "Pair",
    "Two Pair",
    "Three of a Kind",
    "Straight",
    "Flush",
    "Full House",
    "Four of a Kind",
    "Straight Flush",
]

_RANK_NAMES: dict[int, str] = {
    2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
    7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
    11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
}


@dataclass(frozen=True)
class Card:
    rank: str   # '2'..'A'
    suit: str   # c/d/h/s

    @property
    def rank_value(self) -> int:
        return RANK_VALUES[self.rank.upper()]

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"


@dataclass
class HandRank:
    """Comparable hand evaluation result."""
    category: int          # 0 (high_card) .. 8 (straight_flush)
    category_name: str     # e.g. "two_pair"
    category_label: str    # e.g. "Two Pair"
    tiebreak: tuple        # for sorting: (category, primary_rank, kicker_ranks...)
    description: str       # human-readable, e.g. "Two Pair — Aces and Kings"
    best_five: list[Card]  # the 5 cards making this hand

    def __lt__(self, other: "HandRank") -> bool:
        return self.tiebreak < other.tiebreak

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, HandRank):
            return NotImplemented
        return self.tiebreak == other.tiebreak

    def __le__(self, other: "HandRank") -> bool:
        return self.tiebreak <= other.tiebreak

    def __gt__(self, other: "HandRank") -> bool:
        return self.tiebreak > other.tiebreak

    def __ge__(self, other: "HandRank") -> bool:
        return self.tiebreak >= other.tiebreak


# ── Public API ─────────────────────────────────────────────────────────────────

def parse_card(s: str) -> Card:
    """Parse a card string like 'Ah', '9s', 'Tc'."""
    if len(s) != 2:
        raise ValueError(f"Invalid card: {s!r}")
    rank = s[0].upper()
    suit = s[1].lower()
    if rank not in RANK_VALUES:
        raise ValueError(f"Invalid rank: {rank!r}")
    if suit not in SUIT_CHARS:
        raise ValueError(f"Invalid suit: {suit!r}")
    return Card(rank=rank, suit=suit)


def parse_cards(cards: Sequence[str]) -> list[Card]:
    return [parse_card(c) for c in cards]


def best_hand(cards: Sequence[str | Card]) -> HandRank:
    """Return the best 5-card HandRank from any number of cards (2-7+)."""
    card_objs = [c if isinstance(c, Card) else parse_card(c) for c in cards]
    if len(card_objs) < 5:
        raise ValueError(f"Need at least 5 cards, got {len(card_objs)}")

    best: HandRank | None = None
    for combo in combinations(card_objs, 5):
        rank = _evaluate_five(list(combo))
        if best is None or rank > best:
            best = rank
    assert best is not None
    return best


def evaluate_hole_and_board(hole_cards: Sequence[str], board: Sequence[str]) -> HandRank:
    """Evaluate hero's best hand from hole cards + board."""
    all_cards = list(hole_cards) + list(board)
    return best_hand(all_cards)


# ── Five-card evaluator ────────────────────────────────────────────────────────

def _evaluate_five(cards: list[Card]) -> HandRank:
    """Evaluate exactly 5 cards."""
    assert len(cards) == 5

    ranks = sorted([c.rank_value for c in cards], reverse=True)
    suits = [c.suit for c in cards]

    is_flush = len(set(suits)) == 1
    is_straight, straight_high = _check_straight(ranks)

    rank_counts: dict[int, int] = {}
    for r in ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1

    groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
    # groups: [(rank, count), ...] sorted by count desc, then rank desc

    if is_straight and is_flush:
        cat = 8
        tb = (8, straight_high)
        desc = (
            "Royal Flush" if straight_high == 14
            else f"Straight Flush — {_rank_name(straight_high)}-high"
        )
    elif groups[0][1] == 4:
        # Quads
        quad_rank = groups[0][0]
        kicker = groups[1][0]
        cat = 7
        tb = (7, quad_rank, kicker)
        desc = f"Four of a Kind — {_rank_name(quad_rank)}s"
    elif groups[0][1] == 3 and groups[1][1] == 2:
        # Full house
        trip_rank = groups[0][0]
        pair_rank = groups[1][0]
        cat = 6
        tb = (6, trip_rank, pair_rank)
        desc = f"Full House — {_rank_name(trip_rank)}s full of {_rank_name(pair_rank)}s"
    elif is_flush:
        cat = 5
        tb = (5,) + tuple(ranks)
        desc = f"Flush — {_rank_name(ranks[0])}-high"
    elif is_straight:
        cat = 4
        tb = (4, straight_high)
        desc = f"Straight — {_rank_name(straight_high)}-high"
    elif groups[0][1] == 3:
        # Trips
        trip_rank = groups[0][0]
        kickers = sorted([r for r in ranks if r != trip_rank], reverse=True)
        cat = 3
        tb = (3, trip_rank) + tuple(kickers)
        desc = f"Three of a Kind — {_rank_name(trip_rank)}s"
    elif groups[0][1] == 2 and groups[1][1] == 2:
        # Two pair
        high_pair = max(groups[0][0], groups[1][0])
        low_pair = min(groups[0][0], groups[1][0])
        kicker = next(r for r in ranks if r != high_pair and r != low_pair)
        cat = 2
        tb = (2, high_pair, low_pair, kicker)
        desc = f"Two Pair — {_rank_name(high_pair)}s and {_rank_name(low_pair)}s"
    elif groups[0][1] == 2:
        # Pair
        pair_rank = groups[0][0]
        kickers = sorted([r for r in ranks if r != pair_rank], reverse=True)
        cat = 1
        tb = (1, pair_rank) + tuple(kickers)
        desc = f"Pair of {_rank_name(pair_rank)}s"
    else:
        # High card
        cat = 0
        tb = (0,) + tuple(ranks)
        desc = f"High Card — {_rank_name(ranks[0])}"

    return HandRank(
        category=cat,
        category_name=_CATEGORY_NAMES[cat],
        category_label=_CATEGORY_LABELS[cat],
        tiebreak=tb,
        description=desc,
        best_five=cards,
    )


def _check_straight(ranks: list[int]) -> tuple[bool, int]:
    """
    Returns (is_straight, high_card_rank).
    Handles Ace-low (wheel: A-2-3-4-5, high=5).
    """
    unique = sorted(set(ranks), reverse=True)
    if len(unique) < 5:
        return False, 0

    # Standard straight
    if unique[0] - unique[4] == 4:
        return True, unique[0]

    # Ace-low wheel: A-2-3-4-5
    if set(unique) >= {14, 2, 3, 4, 5}:
        return True, 5  # high card of wheel is 5

    return False, 0


def _rank_name(rv: int) -> str:
    return _RANK_NAMES.get(rv, str(rv))


# ── Made hand detection (for draw analysis context) ───────────────────────────

def classify_made_hand_category(hole_cards: Sequence[str], board: Sequence[str]) -> str:
    """Return the category_name of hero's current best hand."""
    if not board:
        return "high_card"
    try:
        result = evaluate_hole_and_board(hole_cards, board)
        return result.category_name
    except Exception:
        return "high_card"


def has_pair_or_better(hole_cards: Sequence[str], board: Sequence[str]) -> bool:
    """True if hero currently has at least a pair."""
    cat = classify_made_hand_category(hole_cards, board)
    return cat in {
        "pair", "two_pair", "trips", "straight",
        "flush", "full_house", "quads", "straight_flush"
    }
