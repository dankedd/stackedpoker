"""
Board Texture Classifier — Complete board texture analysis for Texas Hold'em.

Classifies boards across multiple orthogonal dimensions:
  - Suitedness: rainbow, two_tone, monotone
  - Connectivity: disconnected, one_gap, oesd, connected (board-level, not hero-specific)
  - Pairing: unpaired, paired, trips_on_board
  - High card: low (2-9), broadway (T-A), ace_high, king_high, etc.
  - Wetness: dry, semi_wet, wet (composite metric)
  - Range advantage: pfr, caller, neutral

NOTE: Board connectivity is a BOARD PROPERTY (how connected the board cards are).
It does NOT classify the hero's draws — that is draw_evaluator.py's job.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from app.models.schemas import BoardTexture


RANK_ORDER = {r: i for i, r in enumerate("23456789TJQKA", 2)}

_RANK_NAMES = {
    2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
    7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
    11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
}


# ── Full board analysis (extended) ────────────────────────────────────────────

@dataclass
class ExtendedBoardTexture:
    """Richer board texture analysis beyond the basic BoardTexture schema."""
    # Base schema fields
    bucket: str
    high_card_rank: str
    connectivity: str
    wetness: str
    suitedness: str
    is_paired: bool
    description: str
    range_advantage: str

    # Extended fields
    low_card: str = ""           # rank of lowest board card
    has_ace: bool = False        # ace on board
    has_broadway: bool = False   # T/J/Q/K/A on board
    is_monotone: bool = False
    is_two_tone: bool = False
    is_rainbow: bool = False
    is_disconnected: bool = False
    is_coordinated: bool = False  # connected + suitedness wet
    board_straight_possible: bool = False  # board already has a straight
    board_flush_possible: bool = False     # board already has 3+ of same suit
    is_dynamic: bool = False    # many draws possible
    is_static: bool = False     # few draws possible
    texture_tags: list[str] = field(default_factory=list)


def classify_board(
    flop: Sequence[str],
    turn: Sequence[str] | None = None,
    river: Sequence[str] | None = None,
) -> BoardTexture:
    """Classify board texture. Returns schema-compatible BoardTexture."""
    if not flop or len(flop) < 3:
        return _unknown_texture()

    all_cards = list(flop) + list(turn or []) + list(river or [])
    flop_cards = list(flop[:3])

    flop_ranks = [c[0].upper() for c in flop_cards]
    flop_suits = [c[1].lower() for c in flop_cards]
    flop_rvs = sorted([RANK_ORDER.get(r, 0) for r in flop_ranks], reverse=True)

    suitedness = _classify_suitedness(flop_suits)
    is_paired = len(set(flop_ranks)) < 3
    connectivity = _classify_connectivity(flop_rvs)
    wetness = _classify_wetness(suitedness, connectivity, is_paired)
    high_rank_val = flop_rvs[0] if flop_rvs else 2
    high_card = _rv_to_char(high_rank_val)
    bucket = _classify_bucket(flop_rvs, suitedness, is_paired, connectivity)
    range_adv = _classify_range_advantage(flop_rvs, bucket)
    description = _build_description(bucket, suitedness, connectivity, is_paired, high_card)

    return BoardTexture(
        bucket=bucket,
        high_card_rank=high_card,
        connectivity=connectivity,
        wetness=wetness,
        suitedness=suitedness,
        is_paired=is_paired,
        description=description,
        range_advantage=range_adv,
    )


def classify_board_extended(
    flop: Sequence[str],
    turn: Sequence[str] | None = None,
    river: Sequence[str] | None = None,
) -> ExtendedBoardTexture:
    """
    Extended board texture analysis with all dimensions.
    Returns ExtendedBoardTexture with full metadata.
    """
    base = classify_board(flop, turn, river)
    all_cards = list(flop) + list(turn or []) + list(river or [])

    all_ranks = [c[0].upper() for c in all_cards]
    all_suits = [c[1].lower() for c in all_cards]
    all_rvs = [RANK_ORDER.get(r, 0) for r in all_ranks]

    has_ace = 14 in [RANK_ORDER.get(r, 0) for r in all_ranks]
    has_broadway = any(RANK_ORDER.get(r, 0) >= 10 for r in all_ranks)
    low_card_val = min(all_rvs) if all_rvs else 2
    low_card = _rv_to_char(low_card_val)

    suit_counts = {s: all_suits.count(s) for s in set(all_suits)}
    board_flush_possible = max(suit_counts.values(), default=0) >= 3

    board_straight_possible = _check_board_straight(all_rvs)

    is_coordinated = (
        base.connectivity in ("connected", "oesd")
        and base.suitedness in ("two_tone", "monotone")
    )
    is_dynamic = (
        base.wetness == "wet"
        or is_coordinated
        or (board_flush_possible and base.connectivity in ("oesd", "connected"))
    )
    is_static = (
        base.wetness == "dry"
        and base.suitedness == "rainbow"
        and not board_straight_possible
    )

    texture_tags = _build_texture_tags(
        base, has_ace, has_broadway, board_flush_possible,
        board_straight_possible, is_coordinated, is_dynamic, is_static
    )

    return ExtendedBoardTexture(
        bucket=base.bucket,
        high_card_rank=base.high_card_rank,
        connectivity=base.connectivity,
        wetness=base.wetness,
        suitedness=base.suitedness,
        is_paired=base.is_paired,
        description=base.description,
        range_advantage=base.range_advantage,
        low_card=low_card,
        has_ace=has_ace,
        has_broadway=has_broadway,
        is_monotone=(base.suitedness == "monotone"),
        is_two_tone=(base.suitedness == "two_tone"),
        is_rainbow=(base.suitedness == "rainbow"),
        is_disconnected=(base.connectivity == "disconnected"),
        is_coordinated=is_coordinated,
        board_straight_possible=board_straight_possible,
        board_flush_possible=board_flush_possible,
        is_dynamic=is_dynamic,
        is_static=is_static,
        texture_tags=texture_tags,
    )


# ── Classifiers ────────────────────────────────────────────────────────────────

def _classify_suitedness(suits: list[str]) -> str:
    unique = len(set(suits))
    if unique == 1:
        return "monotone"
    if unique == 2:
        return "two_tone"
    return "rainbow"


def _classify_connectivity(rv: list[int]) -> str:
    """
    rv = sorted descending list of rank values (flop only).
    Classifies how connected the BOARD CARDS are to each other.

    NOT a hero draw classification — board connectivity is about
    how many possible straight combinations the board enables.
    """
    if len(rv) < 3:
        return "disconnected"

    hi, mid, lo = rv[0], rv[1], rv[2]
    total_span = hi - lo

    # Paired boards: connectivity measured on the unique ranks
    unique_rv = sorted(set(rv), reverse=True)
    if len(unique_rv) < 3:
        # Paired — use unique ranks only
        if len(unique_rv) >= 2:
            span = unique_rv[0] - unique_rv[-1]
            return "connected" if span <= 2 else "gutshot" if span <= 4 else "disconnected"
        return "disconnected"

    gaps = [hi - mid - 1, mid - lo - 1]
    max_gap = max(gaps)

    if total_span <= 2:
        return "connected"          # e.g., 7-8-9, 9-T-J
    if total_span <= 4 and max_gap <= 1:
        return "oesd"               # e.g., 6-8-9, 7-9-T (board allows OESD draws)
    if total_span <= 6 and max_gap <= 2:
        return "gutshot"            # e.g., 5-7-9, 6-8-T
    return "disconnected"


def _classify_wetness(suitedness: str, connectivity: str, is_paired: bool) -> str:
    if is_paired:
        return "dry"
    wet_score = 0
    if suitedness == "monotone":
        wet_score += 2
    elif suitedness == "two_tone":
        wet_score += 1
    if connectivity == "connected":
        wet_score += 2
    elif connectivity in ("oesd", "gutshot"):
        wet_score += 1
    if wet_score >= 3:
        return "wet"
    if wet_score >= 1:
        return "semi_wet"
    return "dry"


def _classify_bucket(
    rv: list[int],
    suitedness: str,
    is_paired: bool,
    connectivity: str,
) -> str:
    hi = rv[0] if rv else 0

    if is_paired:
        return "paired_board"

    if suitedness == "monotone":
        return "monotone"

    if hi >= 14:  # Ace
        if connectivity == "disconnected" and suitedness == "rainbow":
            return "A_high_dry"
        return "A_high_wet"

    if hi >= 13:  # King
        if connectivity in ("connected", "oesd") or suitedness in ("two_tone", "monotone"):
            return "wet_broadway"
        return "K_high_dry"

    if hi >= 12:  # Queen
        if connectivity in ("connected", "oesd"):
            return "wet_broadway"
        return "Q_high_semi"

    if hi >= 11:  # Jack
        if connectivity in ("connected", "oesd"):
            return "wet_broadway"
        return "J_high"

    if hi >= 10:  # Ten
        if connectivity in ("connected", "oesd"):
            return "low_connected"
        return "T_high"

    # Low boards (2-9)
    if connectivity in ("connected", "oesd"):
        return "low_connected"
    return "low_dry"


def _classify_range_advantage(rv: list[int], bucket: str) -> str:
    """
    Range advantage heuristic — based on which range (PFR vs caller) benefits most.

    Ace/king-high dry boards → PFR has strong range advantage
    Low connected boards → caller's range benefits (more sets/two-pairs/straights)
    Monotone boards → depends on position
    """
    if bucket in ("A_high_dry", "K_high_dry", "A_high_wet", "Q_high_semi"):
        return "pfr"
    if bucket in ("low_connected", "wet_broadway", "monotone"):
        return "caller"
    if bucket in ("J_high", "T_high"):
        return "neutral"
    return "neutral"


def _build_description(
    bucket: str,
    suitedness: str,
    connectivity: str,
    is_paired: bool,
    high_card: str,
) -> str:
    suit_desc = {
        "rainbow": "rainbow",
        "two_tone": "two-tone",
        "monotone": "monotone (flush possible)",
    }.get(suitedness, suitedness)

    conn_desc = {
        "disconnected": "disconnected",
        "gutshot": "gutshot-connected",
        "oesd": "straight-draw-heavy",
        "connected": "heavily connected",
    }.get(connectivity, connectivity)

    if is_paired:
        return f"Paired board — {suit_desc}, {conn_desc}"

    bucket_labels = {
        "A_high_dry":   f"Ace-high dry board ({suit_desc})",
        "A_high_wet":   f"Ace-high wet board ({suit_desc}, {conn_desc})",
        "K_high_dry":   f"King-high dry board ({suit_desc})",
        "wet_broadway": f"Broadway wet board ({suit_desc}, {conn_desc})",
        "Q_high_semi":  f"Queen-high semi-wet board ({suit_desc})",
        "J_high":       f"Jack-high board ({suit_desc})",
        "T_high":       f"Ten-high board ({suit_desc})",
        "low_connected":f"Low connected board ({suit_desc}, {conn_desc})",
        "low_dry":      f"Low dry board ({suit_desc})",
        "monotone":     f"Monotone board — three-flush",
        "paired_board": f"Paired board ({suit_desc})",
    }
    return bucket_labels.get(bucket, f"{high_card}-high board ({suit_desc})")


def _check_board_straight(all_rvs: list[int]) -> bool:
    """True if the board cards themselves already form a straight (for full board)."""
    from itertools import combinations as _combinations
    unique = sorted(set(all_rvs))
    # Also add Ace=1 for wheel
    if 14 in unique:
        unique = [1] + unique
    if len(unique) < 5:
        return False
    for combo in _combinations(unique, 5):
        lo, hi = min(combo), max(combo)
        if hi - lo == 4 and len(set(combo)) == 5:
            return True
    return False


def _build_texture_tags(
    base: "BoardTexture",
    has_ace: bool,
    has_broadway: bool,
    board_flush_possible: bool,
    board_straight_possible: bool,
    is_coordinated: bool,
    is_dynamic: bool,
    is_static: bool,
) -> list[str]:
    tags = []
    if base.suitedness == "monotone":
        tags.append("monotone")
    elif base.suitedness == "two_tone":
        tags.append("two-tone")
    else:
        tags.append("rainbow")

    if base.is_paired:
        tags.append("paired")

    if base.connectivity == "connected":
        tags.append("connected")
    elif base.connectivity == "oesd":
        tags.append("semi-connected")
    elif base.connectivity == "disconnected":
        tags.append("disconnected")

    if has_ace:
        tags.append("ace-high")
    if has_broadway and not has_ace:
        tags.append("broadway-heavy")

    rv_lo = RANK_ORDER.get(base.high_card_rank, 14)
    if rv_lo <= 9:
        tags.append("low-board")
    elif rv_lo >= 13:
        tags.append("high-board")

    if board_flush_possible:
        tags.append("flush-possible")
    if board_straight_possible:
        tags.append("straight-possible")
    if is_coordinated:
        tags.append("coordinated")
    if is_dynamic:
        tags.append("dynamic")
    if is_static:
        tags.append("static")

    return tags


# ── Fallbacks ─────────────────────────────────────────────────────────────────

def _unknown_texture() -> BoardTexture:
    return BoardTexture(
        bucket="unknown",
        high_card_rank="?",
        connectivity="disconnected",
        wetness="dry",
        suitedness="rainbow",
        is_paired=False,
        description="Unable to classify board",
        range_advantage="neutral",
    )


def _rv_to_char(rv: int) -> str:
    mapping = {v: k for k, v in RANK_ORDER.items()}
    return mapping.get(rv, "?")
