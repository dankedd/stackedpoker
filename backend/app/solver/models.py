"""
SolverSpot — the canonical data contract for a single abstracted poker spot.

This model is the output of SolverSpotClassifier and the input to:
  — future solver node retrieval (PioSolver / GTO databases)
  — board clustering and strategy abstraction layers
  — solver-informed coaching and analysis

No EV, no frequencies, no solver strategy outputs live here.
This is the pure abstraction layer.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

from .board_features import BoardFeatures
from .enums import (
    BoardClassEnum,
    PositionMatchup,
    SPRBucket,
    SolverStreet,
    SpotType,
    StackDepthBucket,
)


class SolverSpot(BaseModel):
    """
    Fully abstracted representation of a strategic poker spot.

    Derived deterministically from a CanonicalHand.  Every field is either
    a direct measurement (stack_bb, pot_bb, spr) or a deterministic
    classification (bucket, matchup, board_class).

    Downstream systems consume this model to look up pre-computed solver
    nodes without ever inspecting the raw hand again.
    """

    # ── Pot construction ──────────────────────────────────────────────────────
    spot_type: SpotType
    """How the pot was built preflop (SRP, 3BET, 4BET, LIMPED, SQUEEZE, ISO_RAISE)."""

    # ── Positional context ────────────────────────────────────────────────────
    hero_position: str
    """Canonical position string of the hero (e.g. 'BTN', 'CO', 'BB')."""

    villain_position: Optional[str] = None
    """
    Canonical position of the primary villain in heads-up pots.
    None for multiway pots (use player_count instead).
    """

    position_matchup: PositionMatchup
    """
    Standardised IP_vs_OOP matchup key used for solver node lookup.
    Multiway pots use MULTIWAY_3WAY … MULTIWAY_6WAY_PLUS variants.
    """

    is_ip: bool
    """True when hero acts last postflop (is in position)."""

    player_count: int = Field(ge=2)
    """Number of players still active at the start of the classified street."""

    # ── Stack / money ─────────────────────────────────────────────────────────
    effective_stack_bb: float = Field(ge=0.0)
    """Effective stack (min of hero vs all villains) at the start of the postflop street, in BB."""

    pot_bb: float = Field(ge=0.0)
    """
    Pot size at the start of the classified street, in BB.
    For preflop spots this is the pot after all preflop action.
    """

    spr: float = Field(ge=0.0)
    """Stack-to-pot ratio at the start of the postflop street."""

    stack_depth_bucket: StackDepthBucket
    """Bucketed effective stack depth for solver node matching."""

    spr_bucket: SPRBucket
    """Bucketed SPR for solver node matching."""

    # ── Board ─────────────────────────────────────────────────────────────────
    board_class: BoardClassEnum
    """
    Primary strategic board classification.
    UNKNOWN when the hand ended preflop (no board).
    """

    board_texture: Optional[BoardFeatures] = None
    """
    Full deterministic board texture profile.
    None when the hand ended preflop.
    """

    # ── Street ────────────────────────────────────────────────────────────────
    street: SolverStreet
    """The street being classified (flop / turn / river / preflop)."""

    # ── Metadata ─────────────────────────────────────────────────────────────
    metadata: dict[str, Any] = Field(default_factory=dict)
    """
    Passthrough metadata from the source CanonicalHand.
    Populated with hand_id, site, game_type, is_tournament, table_max_seats.
    Never used for classification — reserved for tracing and logging.
    """
