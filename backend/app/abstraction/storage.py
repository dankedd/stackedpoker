"""
PostgreSQL models + indexing for the abstraction system.

Tables:
  board_clusters       — cluster definitions with centroids
  board_abstractions   — individual board → cluster mappings
  solve_registry       — tracks which boards have been solved

Design decisions:
  - Feature vectors stored as JSON arrays (PostgreSQL JSON is fast enough
    for our scale; pgvector adds complexity for <10k vectors)
  - Composite indexes on (board_class, cluster_id) for cluster lookups
  - Canonical key is the primary lookup path — unique index on it
  - Solve registry tracks what's been solved to avoid duplicate work

Future ML migration path:
  When vector volume exceeds ~50k, add pgvector extension:
    ALTER TABLE board_abstractions ADD COLUMN embedding vector(14);
    CREATE INDEX ON board_abstractions USING ivfflat (embedding vector_cosine_ops);
  The feature vector JSON can be migrated to pgvector with a one-time script.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    String, Text, Float, Integer, DateTime, Boolean,
    Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BoardClusterRow(Base):
    """
    Persistent storage for board clusters.

    One row per fine-grained cluster (~150-200 total).
    """
    __tablename__ = "board_clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    cluster_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True,
    )
    board_class: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True,
    )

    # Centroid feature vector (14 floats)
    centroid: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    # Representative boards (canonical keys)
    representatives: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    # Cluster metadata
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_similarity: Mapped[float] = mapped_column(Float, default=0.0)

    # Feature bounds for range filtering
    high_card_min: Mapped[float] = mapped_column(Float, default=0.0)
    high_card_max: Mapped[float] = mapped_column(Float, default=1.0)
    connectedness_min: Mapped[float] = mapped_column(Float, default=0.0)
    connectedness_max: Mapped[float] = mapped_column(Float, default=1.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    __table_args__ = (
        Index("ix_cluster_board_class", "board_class"),
    )


class BoardAbstractionRow(Base):
    """
    Individual board → cluster mapping.

    One row per canonical (isomorphism-normalized) board.
    For flop-only MVP: ~1,755 rows. With turn+river: ~150k rows.
    """
    __tablename__ = "board_abstractions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    canonical_key: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, index=True,
    )
    board_cards: Mapped[dict] = mapped_column(JSONB, nullable=False)
    street: Mapped[str] = mapped_column(String(8), nullable=False, index=True)

    # Feature vector (14 floats)
    features: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # Cluster assignment
    cluster_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
    )
    board_class: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True,
    )

    # Similarity metrics
    cluster_distance: Mapped[float] = mapped_column(Float, default=0.0)
    cluster_similarity: Mapped[float] = mapped_column(Float, default=1.0)

    # Nearest representative
    nearest_representative: Mapped[str | None] = mapped_column(
        String(32), nullable=True,
    )
    representative_similarity: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_abstraction_cluster", "cluster_id"),
        Index("ix_abstraction_class_street", "board_class", "street"),
    )


class SolveRegistryRow(Base):
    """
    Tracks which boards/spots have been solved.

    Prevents duplicate solve jobs and enables coverage tracking.
    """
    __tablename__ = "solve_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    canonical_key: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True,
    )
    spot_type: Mapped[str] = mapped_column(String(16), nullable=False)
    positions: Mapped[str] = mapped_column(String(32), nullable=False)
    stack_depth: Mapped[int] = mapped_column(Integer, nullable=False)
    street: Mapped[str] = mapped_column(String(8), nullable=False)

    # Solve quality
    iterations: Mapped[int] = mapped_column(Integer, default=0)
    exploitability: Mapped[float | None] = mapped_column(Float, nullable=True)
    solve_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)

    # Source tracking
    solve_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    solver_source: Mapped[str] = mapped_column(
        String(32), default="texassolver",
    )

    # Node keys produced
    node_keys: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    # Is this a cluster representative?
    is_representative: Mapped[bool] = mapped_column(Boolean, default=False)
    cluster_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True,
    )

    solved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "canonical_key", "spot_type", "positions", "stack_depth", "street",
            name="uq_solve_registry_spot",
        ),
        Index(
            "ix_solve_registry_lookup",
            "canonical_key", "spot_type", "positions",
        ),
    )
