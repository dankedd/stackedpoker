from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from .enums import BoardClassEnum


class BoardFeatures(BaseModel):
    """
    Deterministic strategic texture profile for a poker board.

    All fields are derived from pure rank/suit logic — no GPT, no EV,
    no frequency outputs.  This is the canonical data contract that
    future solver retrieval, reasoning, and coaching layers consume.
    """

    # ── Pairedness ────────────────────────────────────────────────────
    paired: bool
    """True if any rank appears at least twice."""

    trips: bool
    """True if any rank appears at least three times."""

    # ── Suit texture ──────────────────────────────────────────────────
    monotone: bool
    """All board cards share the same suit."""

    two_tone: bool
    """Exactly two distinct suits on the board."""

    rainbow: bool
    """All board cards have different suits (no suit repeated)."""

    # ── Connectedness ─────────────────────────────────────────────────
    connectedness_score: int
    """0–10 scalar.  10 = extremely connected (QJT), 0 = disconnected (A-K-2)."""

    connectedness_label: str
    """Human-readable label from ConnectednessLabel enum values."""

    # ── Broadway density ──────────────────────────────────────────────
    broadway_count: int
    """Number of broadway cards (T, J, Q, K, A) on the board."""

    high_card_rank: Optional[str]
    """Rank string of the highest card, or None for an empty board."""

    # ── Dynamic / static classification ───────────────────────────────
    dynamic: bool
    """Board has many changing runouts (connected, wet, draw-heavy)."""

    static: bool
    """Board has few changing runouts (dry, disconnected, rainbow)."""

    # ── Flush potential ───────────────────────────────────────────────
    flush_draw_possible: bool
    """≥2 board cards share a suit (flush draw realizable with 2 suited hole cards)."""

    flush_completed: bool
    """≥3 board cards share a suit (a made flush is possible with 1 suited hole card)."""

    # ── Straight potential ────────────────────────────────────────────
    straight_draw_possible: bool
    """≥2 board ranks fall within some 5-consecutive rank window."""

    straight_completed: bool
    """
    On flop: always False.
    On turn/river: True when the new card elevated the 5-window count
    from ≤2 to ≥3, indicating a previously open draw got there.
    """

    # ── Wheel interaction ─────────────────────────────────────────────
    wheel_possible: bool
    """≥2 board cards belong to {A, 2, 3, 4, 5} (wheel-draw interaction present)."""

    # ── Street-specific pairing flags ────────────────────────────────
    paired_turn: bool
    """Turn card paired the board (new rank matched an existing flop rank)."""

    paired_river: bool
    """River card paired the board (new rank matched an existing turn-board rank)."""

    # ── Scare cards ───────────────────────────────────────────────────
    scare_card: bool
    """
    The most recent card is a scare card: overcard, flush/straight completion,
    or high broadway arriving on a non-broadway board.
    Always False for flop features.
    """

    # ── Top-level classification ──────────────────────────────────────
    board_class: BoardClassEnum
    """Primary strategic texture classification of this board."""
