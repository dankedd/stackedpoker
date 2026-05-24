"""
StrategyIndex — inverted indices for fast candidate retrieval.

Stores sets of extended_key strings partitioned by each dimension so that
search_similar() can pre-filter the store before running full similarity
scoring.  The index operates on extended_key (includes ::ip/::oop suffix).

Typical query flow:
  1. caller provides spot_type (and optionally street, spr_bucket, is_ip)
  2. index.candidates_for(...) returns intersection of matching sets
  3. storage calls similarity_score() only on the candidate set
"""

from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import StrategyNode


class StrategyIndex:
    """
    Inverted index over StrategyNode dimensions.

    All sets store extended_key strings.
    Lookups are O(1) set intersections.
    """

    def __init__(self) -> None:
        self._by_spot_type:     defaultdict[str, set[str]] = defaultdict(set)
        self._by_board_class:   defaultdict[str, set[str]] = defaultdict(set)
        self._by_spr_bucket:    defaultdict[str, set[str]] = defaultdict(set)
        self._by_position:      defaultdict[str, set[str]] = defaultdict(set)
        self._by_street:        defaultdict[str, set[str]] = defaultdict(set)
        self._by_is_ip:         defaultdict[bool, set[str]] = defaultdict(set)
        self._all:              set[str] = set()

    # ── Mutation ──────────────────────────────────────────────────────────

    def index(self, node: "StrategyNode") -> None:
        """Add a node to all dimension indices."""
        ek = node.extended_key
        self._by_spot_type[node.spot_type].add(ek)
        self._by_board_class[node.board_class].add(ek)
        self._by_spr_bucket[node.spr_bucket].add(ek)
        self._by_position[node.position_matchup].add(ek)
        self._by_street[node.street].add(ek)
        self._by_is_ip[node.is_ip].add(ek)
        self._all.add(ek)

    def remove(self, node: "StrategyNode") -> None:
        """Remove a node from all dimension indices."""
        ek = node.extended_key
        self._by_spot_type[node.spot_type].discard(ek)
        self._by_board_class[node.board_class].discard(ek)
        self._by_spr_bucket[node.spr_bucket].discard(ek)
        self._by_position[node.position_matchup].discard(ek)
        self._by_street[node.street].discard(ek)
        self._by_is_ip[node.is_ip].discard(ek)
        self._all.discard(ek)

    def clear(self) -> None:
        """Remove all indexed entries."""
        self._by_spot_type.clear()
        self._by_board_class.clear()
        self._by_spr_bucket.clear()
        self._by_position.clear()
        self._by_street.clear()
        self._by_is_ip.clear()
        self._all.clear()

    # ── Query ─────────────────────────────────────────────────────────────

    def candidates_for(
        self,
        spot_type: str | None = None,
        board_class: str | None = None,
        spr_bucket: str | None = None,
        position_matchup: str | None = None,
        street: str | None = None,
        is_ip: bool | None = None,
    ) -> frozenset[str]:
        """
        Return the set of extended_keys matching ALL supplied filters.

        Omitted (None) dimensions are not filtered — they match everything.
        If all dimensions are None, returns the full index.

        Using spot_type as the first filter is recommended because it gives
        the sharpest pre-filter (typically 1/6 of the store).
        """
        sets: list[set[str]] = []

        if spot_type is not None:
            sets.append(self._by_spot_type.get(spot_type, set()))
        if board_class is not None:
            sets.append(self._by_board_class.get(board_class, set()))
        if spr_bucket is not None:
            sets.append(self._by_spr_bucket.get(spr_bucket, set()))
        if position_matchup is not None:
            sets.append(self._by_position.get(position_matchup, set()))
        if street is not None:
            sets.append(self._by_street.get(street, set()))
        if is_ip is not None:
            sets.append(self._by_is_ip.get(is_ip, set()))

        if not sets:
            return frozenset(self._all)

        result = sets[0]
        for s in sets[1:]:
            result = result & s
        return frozenset(result)

    # ── Diagnostics ───────────────────────────────────────────────────────

    def stats(self) -> dict:
        return {
            "total": len(self._all),
            "by_spot_type":   {k: len(v) for k, v in self._by_spot_type.items()},
            "by_board_class": {k: len(v) for k, v in self._by_board_class.items()},
            "by_spr_bucket":  {k: len(v) for k, v in self._by_spr_bucket.items()},
            "by_is_ip":       {str(k): len(v) for k, v in self._by_is_ip.items()},
        }
