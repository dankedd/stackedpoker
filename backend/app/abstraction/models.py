"""
Pydantic models for the abstraction system.

Hierarchy:
  BoardClass (17 coarse types) → BoardCluster (~150-200 fine-grained)
  → BoardAbstraction (canonical board + features + cluster assignment)

Each cluster has 1-3 representative boards with precomputed solves.
Retrieval maps any input board → nearest cluster → best representative solve.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AbstractionTier(str, Enum):
    """Granularity tiers for board abstraction."""
    COARSE = "coarse"     # 17 BoardClassEnum groups (existing)
    FINE = "fine"         # ~150-200 feature-based clusters (new)
    EXACT = "exact"       # Isomorphism-class level (canonical board key)


class BoardCluster(BaseModel):
    """
    A fine-grained board abstraction bucket.

    Groups strategically similar boards within a coarse BoardClassEnum.
    Each cluster targets 50-150 isomorphic board classes.
    """
    cluster_id: str                     # "A_HIGH_DRY:c01", "MONOTONE:c03"
    board_class: str                    # Parent coarse class (BoardClassEnum value)
    tier: AbstractionTier = AbstractionTier.FINE

    # Cluster centroid (average feature vector)
    centroid: list[float] = Field(default_factory=list)

    # Representative boards (canonical keys) with precomputed solves
    representatives: list[str] = Field(default_factory=list)

    # Cluster metadata
    member_count: int = 0               # Number of isomorphic classes in cluster
    avg_similarity: float = 0.0         # Average intra-cluster similarity

    # Feature bounds for quick range-check filtering
    high_card_range: tuple[float, float] = (0.0, 1.0)
    connectedness_range: tuple[float, float] = (0.0, 1.0)

    def contains_features(self, features: list[float]) -> bool:
        """Quick check: could this board belong to this cluster?"""
        if len(features) < 5:
            return False
        hc = features[0]
        conn = features[4]
        return (
            self.high_card_range[0] - 0.05 <= hc <= self.high_card_range[1] + 0.05
            and self.connectedness_range[0] - 0.05 <= conn <= self.connectedness_range[1] + 0.05
        )


class BoardAbstraction(BaseModel):
    """
    Complete abstraction for a specific board.

    Maps a canonical board to its cluster assignment and feature vector.
    Stored in the abstraction database for fast lookup.
    """
    canonical_key: str                  # "As_Ks_3h" (isomorphism-normalized)
    board_cards: list[str]              # ["As", "Ks", "3h"]
    street: str                         # "flop", "turn", "river"

    # Feature vector (14-dimensional)
    features: list[float]

    # Cluster assignment
    cluster_id: str                     # "A_HIGH_DRY:c01"
    board_class: str                    # "A_HIGH_DRY"

    # Similarity to cluster centroid
    cluster_distance: float = 0.0
    cluster_similarity: float = 1.0

    # Nearest representative board (has a precomputed solve)
    nearest_representative: str | None = None
    representative_similarity: float = 0.0

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class RetrievalQuery(BaseModel):
    """Input to the nearest-neighbor retrieval engine."""
    board: list[str]                    # Exact board cards
    spot_type: str = "SRP"
    positions: str = "BTN_vs_BB"
    stack_depth: int = 100
    street: str | None = None           # Auto-derived from board length if None
    is_ip: bool = True


class RetrievalMatch(BaseModel):
    """A single match from the retrieval engine."""
    # Match identity
    canonical_key: str
    cluster_id: str
    board_class: str

    # Similarity scores
    board_similarity: float             # Feature vector similarity [0, 1]
    overall_similarity: float           # Combined with spot similarity [0, 1]
    confidence: float                   # Retrieval confidence [0, 1]

    # Strategy data
    node_key: str | None = None
    bet_frequency: float = 0.0
    check_frequency: float = 0.0
    primary_sizing: str | None = None

    # Provenance
    source: str = "abstraction"         # "exact", "cluster", "similar", "fallback"
    solve_source: str | None = None     # "texassolver", "gto_plus", etc.


class RetrievalResponse(BaseModel):
    """Full response from the retrieval engine."""
    query_board: str                    # Input board as string
    canonical_key: str                  # Canonicalized key
    cluster_id: str | None = None       # Assigned cluster

    # Matches ordered by overall_similarity descending
    matches: list[RetrievalMatch] = Field(default_factory=list)

    # Best match (convenience — same as matches[0] if any)
    best_match: RetrievalMatch | None = None

    # Retrieval metadata
    retrieval_tier: str = "none"        # "exact", "cluster", "similar", "fallback"
    latency_ms: float = 0.0
    candidates_evaluated: int = 0

    # Feature vector of the query board (for debugging / ML)
    query_features: list[float] = Field(default_factory=list)


class ClusterStats(BaseModel):
    """Statistics about the clustering system."""
    total_clusters: int = 0
    total_boards_indexed: int = 0
    total_representatives: int = 0
    clusters_by_class: dict[str, int] = Field(default_factory=dict)
    avg_cluster_size: float = 0.0
    coverage_pct: float = 0.0           # Fraction of solve space with representatives
