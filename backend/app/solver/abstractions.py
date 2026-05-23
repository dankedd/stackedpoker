"""
Solver abstraction layer — NodeKey and SpotAbstraction.

These types form the bridge between a classified SolverSpot and the future
solver node retrieval infrastructure (PioSolver databases, GTO caches, etc.).

The full pipeline:

    CanonicalHand
        → SolverSpotClassifier.classify()
            → SolverSpot
                → NodeKey.from_solver_spot()
                    → NodeKey  (hashable, storable, comparable)
                        → node_key_string  (database / cache key)

NodeKey is immutable and hashable so it can be used directly as a dict key,
set member, or cache key without any serialisation step.

SpotAbstraction bundles the full spot with its key for convenience when
all three representations are needed together.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.canonical import CanonicalHand

from .models import SolverSpot
from .spot_classifier import SolverSpotClassifier

# Module-level classifier — stateless, safe to reuse
_classifier = SolverSpotClassifier()

# Separator used in the node key string representation
_KEY_SEP = "::"


@dataclass(frozen=True)
class NodeKey:
    """
    Immutable, hashable identifier for a strategic solver node.

    Every dimension here must be a stable string so the key survives
    serialisation to a database column, cache key, or filename.

    Fields map 1-to-1 to SolverSpot dimensions that are stable across
    hands (i.e., not hand-specific like pot_bb or effective_stack_bb raw
    values — those are bucketed first).
    """

    spot_type: str
    """SpotType enum value string, e.g. 'SRP', '3BET'."""

    position_matchup: str
    """PositionMatchup enum value string, e.g. 'BTN_vs_BB'."""

    stack_depth_bucket: str
    """StackDepthBucket enum value string, e.g. '100bb'."""

    spr_bucket: str
    """SPRBucket enum value string, e.g. '4_8'."""

    board_class: str
    """BoardClassEnum enum value string, e.g. 'A_HIGH_DRY'."""

    street: str
    """SolverStreet enum value string, e.g. 'flop'."""

    player_count: int
    """Number of active players (2 for HU, 3+ for multiway)."""

    # ── String representation ─────────────────────────────────────────────────

    def to_string(self) -> str:
        """
        Produce a stable, human-readable key string suitable for use as a
        database key, cache key, or lookup index.

        Example::

            'SRP::BTN_vs_BB::100bb::4_8::A_HIGH_DRY::flop::2p'
        """
        return _KEY_SEP.join([
            self.spot_type,
            self.position_matchup,
            self.stack_depth_bucket,
            self.spr_bucket,
            self.board_class,
            self.street,
            f"{self.player_count}p",
        ])

    def __str__(self) -> str:
        return self.to_string()

    # ── Construction helpers ──────────────────────────────────────────────────

    @classmethod
    def from_solver_spot(cls, spot: SolverSpot) -> NodeKey:
        """Build a NodeKey from a fully classified SolverSpot."""
        return cls(
            spot_type=spot.spot_type.value,
            position_matchup=spot.position_matchup.value,
            stack_depth_bucket=spot.stack_depth_bucket.value,
            spr_bucket=spot.spr_bucket.value,
            board_class=spot.board_class.value,
            street=spot.street.value,
            player_count=spot.player_count,
        )

    @classmethod
    def from_canonical_hand(cls, hand: CanonicalHand) -> NodeKey:
        """Classify a CanonicalHand and return its NodeKey directly."""
        spot = _classifier.classify(hand)
        return cls.from_solver_spot(spot)

    # ── Partial key helpers (for range/prefix lookups) ────────────────────────

    def street_prefix(self) -> str:
        """
        Key prefix scoped to spot_type + position_matchup + stack + street.

        Useful for retrieving all SPR variants of the same spot structure.

        Example::

            'SRP::BTN_vs_BB::100bb::flop'
        """
        return _KEY_SEP.join([
            self.spot_type,
            self.position_matchup,
            self.stack_depth_bucket,
            self.street,
        ])

    def positional_prefix(self) -> str:
        """
        Key prefix scoped to spot_type + position_matchup.

        Useful for retrieving all stack/SPR/board variants of one matchup.

        Example::

            'SRP::BTN_vs_BB'
        """
        return _KEY_SEP.join([self.spot_type, self.position_matchup])


@dataclass
class SpotAbstraction:
    """
    Complete abstraction bundle: SolverSpot + NodeKey + key string.

    This is the primary output type of the solver abstraction pipeline.
    Downstream consumers can access any level of detail without re-computing.
    """

    solver_spot: SolverSpot
    """Fully classified spot with all strategic dimensions."""

    node_key: NodeKey
    """Hashable, immutable key for solver database lookup."""

    node_key_string: str
    """
    Stable string representation of the node key.
    Ready for use as a database primary key, cache key, or log label.
    """

    # ── Construction ──────────────────────────────────────────────────────────

    @classmethod
    def from_solver_spot(cls, spot: SolverSpot) -> SpotAbstraction:
        """Build a SpotAbstraction from an already-classified SolverSpot."""
        key = NodeKey.from_solver_spot(spot)
        return cls(
            solver_spot=spot,
            node_key=key,
            node_key_string=key.to_string(),
        )

    @classmethod
    def from_canonical_hand(cls, hand: CanonicalHand) -> SpotAbstraction:
        """
        Full pipeline entry point.

        Runs the complete abstraction chain:
            CanonicalHand → SolverSpot → NodeKey → SpotAbstraction
        """
        spot = _classifier.classify(hand)
        return cls.from_solver_spot(spot)

    # ── Convenience accessors ─────────────────────────────────────────────────

    @property
    def spot_type(self) -> str:
        return self.solver_spot.spot_type.value

    @property
    def board_class(self) -> str:
        return self.solver_spot.board_class.value

    @property
    def position_matchup(self) -> str:
        return self.solver_spot.position_matchup.value

    @property
    def street(self) -> str:
        return self.solver_spot.street.value

    def __repr__(self) -> str:
        return f"SpotAbstraction(key={self.node_key_string!r})"
