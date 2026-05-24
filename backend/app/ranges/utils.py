"""
Pure utility functions for hand notation and combo counting.

All functions are deterministic and side-effect free.
"""
from __future__ import annotations

from app.ranges.models import RANK_ORDER, RANK_VAL


# ── Normalization ──────────────────────────────────────────────────────────────

def normalize_hand(hand: str) -> str:
    """
    Normalize hand notation to canonical form.

    Examples:
        "ak"   → "AK"
        "aks"  → "AKs"
        "ako"  → "AKo"
        "aAs"  → invalid → raises ValueError
        "97s"  → "97s"
    """
    if not hand or len(hand) < 2:
        raise ValueError(f"Invalid hand notation: {hand!r}")

    h = hand.strip()

    # Handle suffix
    suffix = ""
    if h[-1].lower() in ("s", "o"):
        suffix = h[-1].lower()
        ranks_part = h[:-1]
    else:
        ranks_part = h

    if len(ranks_part) != 2:
        raise ValueError(f"Invalid hand notation: {hand!r}")

    r1 = ranks_part[0].upper()
    r2 = ranks_part[1].upper()

    if r1 not in RANK_VAL or r2 not in RANK_VAL:
        raise ValueError(f"Unknown rank in hand: {hand!r}")

    # Canonical: higher rank first
    if RANK_VAL[r1] < RANK_VAL[r2]:
        r1, r2 = r2, r1

    # Pocket pairs can't have s/o suffix in standard notation
    if r1 == r2 and suffix:
        suffix = ""

    return f"{r1}{r2}{suffix}"


def hand_to_ranks(hand: str) -> tuple[str, str]:
    """
    Return (high_rank, low_rank) for a hand notation.

    Examples:
        "AKs" → ("A", "K")
        "22"  → ("2", "2")
    """
    norm = normalize_hand(hand)
    base = norm[:2] if norm[-1] in ("s", "o") else norm
    return base[0], base[1]


def is_suited(hand: str) -> bool:
    """Return True if hand notation specifies suited ('s' suffix)."""
    norm = normalize_hand(hand)
    return norm.endswith("s")


def is_offsuit(hand: str) -> bool:
    """Return True if hand notation specifies offsuit ('o' suffix)."""
    norm = normalize_hand(hand)
    return norm.endswith("o")


def is_pair(hand: str) -> bool:
    """Return True if hand is a pocket pair (same rank)."""
    r1, r2 = hand_to_ranks(hand)
    return r1 == r2


def is_broadway(rank: str) -> bool:
    """Return True if rank is T, J, Q, K, or A."""
    return rank in ("T", "J", "Q", "K", "A")


# ── Combo counting ─────────────────────────────────────────────────────────────

def raw_combo_count(hand: str) -> int:
    """
    Return the number of combos for a hand notation, ignoring weights.

    Pocket pair (AA):  C(4,2) = 6 combos
    Suited (AKs):      4 combos (one per suit)
    Offsuit (AKo):     4 × 3 = 12 combos
    Both (AK):         4 + 12 = 16 combos
    """
    norm = normalize_hand(hand)
    r1, r2 = norm[0], norm[1]

    if r1 == r2:
        return 6  # pocket pair

    if norm.endswith("s"):
        return 4  # suited

    if norm.endswith("o"):
        return 12  # offsuit

    # No suffix → both suited + offsuit
    return 16


def hand_gap(hand: str) -> int:
    """
    Return the rank gap between the two cards (0 = connector).

    Examples:
        "T9s" → 1
        "JTs" → 1
        "AKs" → 1
        "A5s" → 8
        "72o" → 5
    """
    r1, r2 = hand_to_ranks(hand)
    return RANK_VAL[r1] - RANK_VAL[r2]
