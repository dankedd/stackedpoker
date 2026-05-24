"""
Core range models.

Strongly typed, deterministic, no solver frequencies.
All combo counts are structurally derived from hand notation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ── Rank constants ─────────────────────────────────────────────────────────────

RANK_ORDER = "23456789TJQKA"
RANK_VAL: dict[str, int] = {r: i for i, r in enumerate(RANK_ORDER)}


# ── Hand bucket taxonomy ───────────────────────────────────────────────────────

class HandBucket(str, Enum):
    """Simplified strategic hand categories for range analysis."""
    PREMIUM          = "PREMIUM"           # AA KK QQ AKs — pure value
    STRONG_BROADWAY  = "STRONG_BROADWAY"   # JJ TT AKo AQs AQo KQs
    MEDIUM_PAIR      = "MEDIUM_PAIR"       # 99 88 77
    SUITED_CONNECTOR = "SUITED_CONNECTOR"  # JTs T9s 98s 87s 76s 65s 54s
    SUITED_ACE       = "SUITED_ACE"        # A2s–A9s (wheel/blocker equity)
    BROADWAY_OFFSUIT = "BROADWAY_OFFSUIT"  # KQo KJo QJo JTo KTo
    SMALL_PAIR       = "SMALL_PAIR"        # 66 55 44 33 22
    WEAK_SUITED      = "WEAK_SUITED"       # K9s Q9s J9s T8s 97s 86s 75s
    WEAK_OFFSUIT     = "WEAK_OFFSUIT"      # J9o T8o Q8o K8o — borderline
    TRASH            = "TRASH"             # 72o 83o J4o — fold territory


# ── RangeCombo ────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RangeCombo:
    """
    A single hand entry in a preflop range.

    hand:        Normalized notation — "AA", "AKs", "AKo", "AK" (both)
    weight:      Action frequency 0.0–1.0 (1.0 = always, 0.5 = half)
    suited:      True if this entry is exclusively suited
    offsuit:     True if this entry is exclusively offsuit
    pocket_pair: True if both ranks are identical
    raw_combos:  Total combos ignoring weight (6 / 4 / 12 depending on type)
    """
    hand: str
    weight: float
    suited: bool
    offsuit: bool
    pocket_pair: bool
    raw_combos: int

    @property
    def combo_count(self) -> float:
        """Effective combos after applying frequency weight."""
        return self.raw_combos * self.weight

    def __str__(self) -> str:
        w = f":{self.weight}" if self.weight < 1.0 else ""
        return f"{self.hand}{w}"


# ── PreflopRange ──────────────────────────────────────────────────────────────

@dataclass
class PreflopRange:
    """
    A complete preflop range for a specific position, action, and stack depth.

    Supports structural queries — combo counting, bucket density,
    board interaction estimates.
    """
    name: str
    position: str           # "UTG", "BTN", "BB", etc.
    action: str             # "open", "defend", "3bet", "4bet"
    stack_depth: str        # "100bb"
    combos: list[RangeCombo] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    # ── Containment ────────────────────────────────────────────────────────

    def contains(self, hand: str) -> bool:
        """Return True if the hand appears in this range with weight > 0."""
        from app.ranges.utils import normalize_hand
        norm = normalize_hand(hand)
        for combo in self.combos:
            if _hand_matches(combo.hand, norm) and combo.weight > 0:
                return True
        return False

    def get_weight(self, hand: str) -> float:
        """Return the action weight for a hand, or 0.0 if absent."""
        from app.ranges.utils import normalize_hand
        norm = normalize_hand(hand)
        for combo in self.combos:
            if _hand_matches(combo.hand, norm):
                return combo.weight
        return 0.0

    # ── Combo counting ─────────────────────────────────────────────────────

    def total_combos(self) -> float:
        """Total weighted combo count across all entries."""
        return sum(c.combo_count for c in self.combos)

    def suited_combos(self) -> float:
        return sum(c.combo_count for c in self.combos if c.suited)

    def offsuit_combos(self) -> float:
        return sum(c.combo_count for c in self.combos if c.offsuit)

    def pair_combos(self) -> float:
        return sum(c.combo_count for c in self.combos if c.pocket_pair)

    # ── Bucket density ─────────────────────────────────────────────────────

    def bucket_density(self, bucket: HandBucket) -> float:
        """Return weighted combo count for a strategic bucket."""
        from app.ranges.abstractions import combos_in_bucket
        return combos_in_bucket(self, bucket)

    # ── Board interaction estimate ─────────────────────────────────────────

    def estimate_top_pair_density(self, board: list[str]) -> str:
        """
        Heuristic label for how many combos pair the top board card.
        Returns: "none" | "low" | "medium" | "high" | "very_high"
        """
        from app.ranges.interactions import _density_label, _board_rank_metrics
        metrics = _board_rank_metrics(self, board)
        return _density_label(metrics.top_pair_combos)

    def __repr__(self) -> str:
        return (
            f"PreflopRange({self.name!r}, pos={self.position!r}, "
            f"action={self.action!r}, combos={self.total_combos():.1f})"
        )


# ── Internal helpers ───────────────────────────────────────────────────────────

def _hand_matches(range_hand: str, query_hand: str) -> bool:
    """
    Check if query_hand is covered by range_hand.

    "AK" (both) covers "AKs" and "AKo".
    Exact matches always succeed.
    """
    if range_hand == query_hand:
        return True
    # "AK" (no suffix) covers "AKs" and "AKo"
    r_base = range_hand[:2]
    q_base = query_hand[:2]
    if r_base == q_base and len(range_hand) == 2 and len(query_hand) == 3:
        return True
    return False
