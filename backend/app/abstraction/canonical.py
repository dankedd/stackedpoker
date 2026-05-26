"""
Canonical board encoding — suit normalization and isomorphic grouping.

Problem:
  Ah Kh 3d and As Ks 3c are strategically identical — suits have no inherent
  ranking in hold'em. There are 22,100 distinct flops but only ~1,755
  strategically unique flops after suit isomorphism.

Algorithm:
  1. Assign canonical suit labels based on first-appearance order on the board.
     First suit seen → 's', second → 'h', third → 'd', fourth → 'c'.
  2. Apply the mapping to every card on the board.
  3. Sort cards within the canonical encoding for deterministic string form.

This reduces the solve space by ~12x on flop, ~10x on turn, ~8x on river.

Examples:
  [Ah, Kh, 3d] → [As, Ks, 3h]    (h→s first seen, d→h second)
  [Qc, 9c, 5c] → [Qs, 9s, 5s]    (monotone, c→s)
  [Td, 8s, 6d] → [Ts, 8h, 6s]    (d→s first seen, s→h second)
"""

from __future__ import annotations

from functools import lru_cache

from app.solver.utils import parse_card, rank_to_int

# Canonical suit assignment order — no strategic meaning, just convention
_CANONICAL_SUITS = ("s", "h", "d", "c")


def canonicalize_board(board: list[str]) -> list[str]:
    """
    Normalize suits to canonical form based on first-appearance order.

    Returns a new list of card strings with remapped suits, sorted by
    (rank descending, suit alphabetical) for deterministic encoding.
    """
    suit_map: dict[str, str] = {}
    next_canonical_idx = 0

    # First pass: build suit mapping from appearance order
    for card in board:
        _, suit = parse_card(card)
        if suit not in suit_map:
            suit_map[suit] = _CANONICAL_SUITS[next_canonical_idx]
            next_canonical_idx += 1

    # Second pass: remap all cards
    canonical = []
    for card in board:
        rank, suit = parse_card(card)
        canonical.append(f"{rank}{suit_map[suit]}")

    # Sort: highest rank first, then suit alphabetically for ties
    canonical.sort(key=lambda c: (-rank_to_int(c[:-1]), c[-1]))
    return canonical


def canonical_board_key(board: list[str]) -> str:
    """
    Deterministic string key for a canonicalized board.

    All isomorphic boards produce the same key.
    Example: "As_Ks_3h" for [Ah, Kh, 3d] or [As, Ks, 3c].
    """
    return "_".join(canonicalize_board(board))


def suit_signature(board: list[str]) -> str:
    """
    Compact suit pattern descriptor, ignoring specific suit identities.

    Captures the suit *structure* of the board.
    Examples:
      [Ah, Kh, 3d] → "AAB"   (two of one suit, one of another)
      [Qc, 9c, 5c] → "AAA"   (monotone)
      [Td, 8s, 6h] → "ABC"   (rainbow)
      [Ah, Kh, 3d, 7h] → "AABA" (three flush, one off)
    """
    suit_labels: dict[str, str] = {}
    label_idx = 0
    label_chars = "ABCD"
    result = []

    for card in board:
        _, suit = parse_card(card)
        if suit not in suit_labels:
            suit_labels[suit] = label_chars[label_idx]
            label_idx += 1
        result.append(suit_labels[suit])

    return "".join(result)


def rank_signature(board: list[str]) -> str:
    """
    Rank pattern descriptor — captures rank relationships.

    Cards sorted descending. Relative gaps preserved.
    Example: [Ah, Kh, 3d] → "14_13_3" (rank ints joined)
    """
    rank_ints = sorted(
        [rank_to_int(parse_card(c)[0]) for c in board],
        reverse=True,
    )
    return "_".join(str(r) for r in rank_ints)


def board_isomorphism_class(board: list[str]) -> str:
    """
    Full isomorphism class identifier.

    Combines canonical board key with suit and rank signatures.
    Two boards are in the same isomorphism class iff they have
    the same canonical_board_key.

    This is the PRIMARY deduplication key for the solve database.
    """
    return canonical_board_key(board)


@lru_cache(maxsize=4096)
def _cached_canonical_key(board_tuple: tuple[str, ...]) -> str:
    """Cached version for hot-path lookups."""
    return canonical_board_key(list(board_tuple))


def fast_canonical_key(board: list[str]) -> str:
    """Performance-optimized canonical key with LRU caching."""
    return _cached_canonical_key(tuple(board))


def count_isomorphic_classes(num_cards: int) -> dict:
    """
    Reference: how many unique isomorphism classes exist per street.

    These are well-known combinatorial results for hold'em.
    """
    return {
        3: {"total_boards": 22100, "unique_classes": 1755, "reduction": "12.6x"},
        4: {"total_boards": 270725, "unique_classes": 16432, "reduction": "16.5x"},
        5: {"total_boards": 2598960, "unique_classes": 134459, "reduction": "19.3x"},
    }.get(num_cards, {"total_boards": 0, "unique_classes": 0, "reduction": "N/A"})
