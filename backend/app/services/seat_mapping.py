"""
seat_mapping.py — Canonical poker seat/position engine.

Single source of truth for ALL seat-related logic used by:
  - parsers (via POSITIONS_BY_SIZE alias)
  - hand_reconstructor
  - spot_classifier
  - coaching pipeline
  - any future consumer

Three concepts kept strictly separate:
  1. PHYSICAL SEAT    — raw table seat number (1–9 from hand history)
  2. LOGICAL POSITION — canonical poker label (BTN / SB / BB / UTG / HJ / CO …)
  3. VISUAL INDEX     — render offset relative to hero (0 = hero/bottom-center)

Entry points:
  build_canonical_seats(players, hero_pos, n) → list[CanonicalSeat]
  validate_canonical_seats(seats)             → list[str]  (error strings)
  visual_seat_index(pos, hero_pos, n)         → int        (re-exported from position_engine)
  preflop_action_order(n)                     → list[str]  (re-exported)
  postflop_action_rank(pos, n)                → int        (0 = OOP/acts first)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from app.services.position_engine import (
    POSITIONS_BY_COUNT,
    get_positions_for_count,
    normalize_position,
    preflop_action_order,
    visual_seat_index,
)

# Re-export so callers only need one import
__all__ = [
    "CanonicalSeat",
    "build_canonical_seats",
    "validate_canonical_seats",
    "visual_seat_index",
    "preflop_action_order",
    "postflop_action_rank",
    "POSITIONS_BY_COUNT",
]

# ── Postflop position order (OOP = 0, IP = highest) ───────────────────────────
# SB acts first postflop (most OOP), BTN acts last (most IP).
# This list must stay in sync with POSITIONS_BY_COUNT row for 9-max.

_POSTFLOP_ORDER: list[str] = [
    "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN",
]


def postflop_action_rank(position: str, n_players: int) -> int:
    """
    Return the postflop action rank for a position (0 = first to act / OOP).

    Rank is based on _POSTFLOP_ORDER but filtered to only positions present
    at the given table size, so the returned int is always in range [0, n-1].
    """
    canonical = get_positions_for_count(n_players)
    active = [p for p in _POSTFLOP_ORDER if p in canonical]
    pos = normalize_position(position)
    try:
        return active.index(pos)
    except ValueError:
        return len(active) - 1  # unknown → assume IP (last)


# ── CanonicalSeat dataclass ────────────────────────────────────────────────────

@dataclass
class CanonicalSeat:
    """
    Complete, self-contained description of one seat at the table.

    Consumers should read ALL position/order information from this object
    and never re-derive it from raw seat numbers or ad-hoc logic.
    """

    # ── Physical identity ─────────────────────────────────────────────────────
    physical_seat: int | None     # raw seat number from hand history (1–9); None for vision

    # ── Logical position ──────────────────────────────────────────────────────
    logical_position: str         # canonical: "BTN" / "SB" / "BB" / "UTG" / "HJ" / "CO" …
    is_button: bool
    is_sb: bool
    is_bb: bool

    # ── Action order ──────────────────────────────────────────────────────────
    preflop_order: int            # 0 = first to act preflop (UTG / BTN in HU)
    postflop_order: int           # 0 = first to act postflop (SB/OOP)

    # ── Visual render ─────────────────────────────────────────────────────────
    visual_index: int             # 0 = hero (bottom-center), 1..N-1 clockwise

    # ── Player info ───────────────────────────────────────────────────────────
    player_name: str | None
    is_hero: bool
    stack_bb: float | None = None
    hole_cards: list[str] = field(default_factory=list)


# ── Factory ────────────────────────────────────────────────────────────────────

def build_canonical_seats(
    players: Sequence[tuple[
        str | None,   # player_name (None = empty seat)
        str,          # logical_position (canonical)
        bool,         # is_hero
        float | None, # stack_bb
        list[str],    # hole_cards
        int | None,   # physical_seat number (None for vision)
    ]],
    hero_position: str,
    n_players: int,
) -> list[CanonicalSeat]:
    """
    Build a fully-populated list of CanonicalSeat objects.

    hero_position: canonical position of the hero (e.g. "BTN").
    n_players:     total seat count at this table.
    players:       sequence of (name, pos, is_hero, stack, cards, seat_num) tuples.
    """
    canonical = get_positions_for_count(n_players)
    pforder   = preflop_action_order(n_players)

    hero_pos = normalize_position(hero_position)

    seats: list[CanonicalSeat] = []
    for (name, raw_pos, is_hero, stack, cards, phys_seat) in players:
        pos = normalize_position(raw_pos)

        # Preflop action order: index in pforder list (UTG=0, …, BB=last)
        pf_ord = pforder.index(pos) if pos in pforder else len(pforder) - 1

        seats.append(CanonicalSeat(
            physical_seat    = phys_seat,
            logical_position = pos,
            is_button        = pos == "BTN",
            is_sb            = pos == "SB",
            is_bb            = pos == "BB",
            preflop_order    = pf_ord,
            postflop_order   = postflop_action_rank(pos, n_players),
            visual_index     = visual_seat_index(pos, hero_pos, n_players),
            player_name      = name,
            is_hero          = is_hero,
            stack_bb         = stack,
            hole_cards       = cards,
        ))

    # Sort by visual_index so hero is always first
    seats.sort(key=lambda s: s.visual_index)
    return seats


# ── Validation ─────────────────────────────────────────────────────────────────

def validate_canonical_seats(seats: list[CanonicalSeat]) -> list[str]:
    """
    Validate a list of CanonicalSeat objects for poker-rule correctness.

    Returns a list of error strings. Empty list = valid.
    """
    errors: list[str] = []
    n = len(seats)
    if n < 2:
        errors.append(f"Table must have at least 2 seats, got {n}")
        return errors

    positions = [s.logical_position for s in seats]
    valid_positions = set(get_positions_for_count(n))

    # 1. Exactly one BTN
    btn_count = sum(1 for s in seats if s.is_button)
    if btn_count != 1:
        errors.append(f"Expected exactly 1 BTN, found {btn_count}")

    # 2. At most one SB, one BB
    for role, attr in (("SB", "is_sb"), ("BB", "is_bb")):
        count = sum(1 for s in seats if getattr(s, attr))
        if count > 1:
            errors.append(f"Duplicate {role}: found {count}")

    # 3. No duplicate positions
    seen: set[str] = set()
    for p in positions:
        if p in seen:
            errors.append(f"Duplicate logical position: {p}")
        seen.add(p)

    # 4. All positions valid for this table size
    for p in positions:
        if p not in valid_positions:
            errors.append(f"Position '{p}' is not valid for {n}-player table")

    # 5. Exactly one hero
    hero_count = sum(1 for s in seats if s.is_hero)
    if hero_count != 1:
        errors.append(f"Expected exactly 1 hero, found {hero_count}")

    # 6. Hero must have visual_index == 0
    hero_seats = [s for s in seats if s.is_hero]
    if hero_seats and hero_seats[0].visual_index != 0:
        errors.append(
            f"Hero visual_index must be 0 (bottom-center), got {hero_seats[0].visual_index}"
        )

    # 7. Visual indices are unique and cover 0..N-1
    visual_indices = [s.visual_index for s in seats]
    if sorted(visual_indices) != list(range(n)):
        errors.append(
            f"Visual indices must be 0..{n-1} with no gaps, got {sorted(visual_indices)}"
        )

    # 8. Preflop action order is a permutation of 0..N-1
    pf_orders = sorted(s.preflop_order for s in seats)
    if pf_orders != list(range(n)):
        errors.append(
            f"Preflop orders must be 0..{n-1} with no gaps, got {pf_orders}"
        )

    # 9. Postflop action order is a permutation of 0..N-1
    po_orders = sorted(s.postflop_order for s in seats)
    if po_orders != list(range(n)):
        errors.append(
            f"Postflop orders must be 0..{n-1} with no gaps, got {po_orders}"
        )

    return errors
