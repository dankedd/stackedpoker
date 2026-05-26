"""
FastAPI endpoints for the board abstraction and retrieval system.

Endpoints:
  POST /api/abstraction/lookup         — find nearest strategy for a board
  GET  /api/abstraction/board/{key}    — get abstraction details for a board
  GET  /api/abstraction/cluster/{id}   — get cluster details
  GET  /api/abstraction/clusters       — list all clusters (with stats)
  POST /api/abstraction/features       — extract feature vector for a board
  GET  /api/abstraction/metrics        — retrieval system metrics
  POST /api/abstraction/similarity     — compare two boards
  GET  /api/abstraction/coverage       — solve coverage statistics
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.abstraction.canonical import (
    canonical_board_key,
    canonicalize_board,
    suit_signature,
    rank_signature,
    count_isomorphic_classes,
)
from app.abstraction.features import (
    extract_features,
    feature_similarity,
    weighted_euclidean_distance,
)
from app.abstraction.models import (
    ClusterStats,
    RetrievalQuery,
    RetrievalResponse,
)
from app.abstraction.clusters import ClusterIndex
from app.abstraction.retrieval import AbstractionRetriever

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/abstraction", tags=["abstraction"])

# ── Shared state (initialized on first request) ──────────────────────────

_cluster_index: ClusterIndex | None = None
_retriever: AbstractionRetriever | None = None


def _get_cluster_index() -> ClusterIndex:
    global _cluster_index
    if _cluster_index is None:
        _cluster_index = ClusterIndex()
    return _cluster_index


def _get_retriever() -> AbstractionRetriever:
    global _retriever
    if _retriever is None:
        _retriever = AbstractionRetriever(
            cluster_index=_get_cluster_index(),
        )
    return _retriever


# ── Request/Response models ───────────────────────────────────────────────

class BoardInput(BaseModel):
    board: list[str] = Field(min_length=3, max_length=5)


class FeatureResponse(BaseModel):
    board: list[str]
    canonical_key: str
    suit_signature: str
    rank_signature: str
    features: list[float]
    feature_labels: list[str]


class SimilarityRequest(BaseModel):
    board_a: list[str] = Field(min_length=3, max_length=5)
    board_b: list[str] = Field(min_length=3, max_length=5)


class SimilarityResponse(BaseModel):
    board_a_canonical: str
    board_b_canonical: str
    feature_similarity: float
    euclidean_distance: float
    same_isomorphism_class: bool
    same_board_class: bool
    feature_comparison: dict


class CoverageResponse(BaseModel):
    total_clusters: int
    total_representatives: int
    clusters_by_class: dict[str, int]
    isomorphism_reference: dict


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/lookup", response_model=RetrievalResponse)
async def lookup_strategy(query: RetrievalQuery) -> RetrievalResponse:
    """
    Find the nearest strategy for a given board and spot.

    This is the primary entry point for the abstraction-based retrieval system.
    Returns the best matching strategy with confidence scoring.
    """
    retriever = _get_retriever()
    return retriever.retrieve(query)


@router.post("/features", response_model=FeatureResponse)
async def extract_board_features(request: BoardInput) -> FeatureResponse:
    """
    Extract the 14-dimensional feature vector for a board.

    Useful for debugging, ML feature engineering, and understanding
    how the system perceives board texture.
    """
    board = request.board
    features = extract_features(board)
    canonical = canonicalize_board(board)
    key = canonical_board_key(board)

    return FeatureResponse(
        board=canonical,
        canonical_key=key,
        suit_signature=suit_signature(board),
        rank_signature=rank_signature(board),
        features=features.to_list(),
        feature_labels=[
            "high_card", "mid_card", "low_card", "rank_span",
            "connectedness", "broadway_count", "paired", "trips",
            "monotone", "two_tone", "flush_draw", "straight_draw",
            "dynamic_score", "scare_potential",
        ],
    )


@router.post("/similarity", response_model=SimilarityResponse)
async def compare_boards(request: SimilarityRequest) -> SimilarityResponse:
    """
    Compare two boards — returns feature similarity and distance metrics.

    Useful for understanding how the system measures board similarity.
    """
    fa = extract_features(request.board_a)
    fb = extract_features(request.board_b)

    key_a = canonical_board_key(request.board_a)
    key_b = canonical_board_key(request.board_b)

    sim = feature_similarity(fa, fb)
    dist = weighted_euclidean_distance(fa, fb)

    # Classify both boards
    from app.solver.board_classifier import BoardClassifier
    classifier = BoardClassifier()
    class_a = classifier.classify_flop(request.board_a[:3]).board_class
    class_b = classifier.classify_flop(request.board_b[:3]).board_class

    # Per-feature comparison
    labels = [
        "high_card", "mid_card", "low_card", "rank_span",
        "connectedness", "broadway_count", "paired", "trips",
        "monotone", "two_tone", "flush_draw", "straight_draw",
        "dynamic_score", "scare_potential",
    ]
    comparison = {}
    for i, label in enumerate(labels):
        comparison[label] = {
            "board_a": round(fa.values[i], 3),
            "board_b": round(fb.values[i], 3),
            "diff": round(abs(fa.values[i] - fb.values[i]), 3),
        }

    return SimilarityResponse(
        board_a_canonical=key_a,
        board_b_canonical=key_b,
        feature_similarity=round(sim, 4),
        euclidean_distance=round(dist, 4),
        same_isomorphism_class=(key_a == key_b),
        same_board_class=(class_a == class_b),
        feature_comparison=comparison,
    )


@router.get("/clusters", response_model=ClusterStats)
async def list_clusters() -> ClusterStats:
    """Get statistics about the clustering system."""
    index = _get_cluster_index()
    stats = index.stats()
    return ClusterStats(
        total_clusters=stats["total_clusters"],
        total_representatives=stats["total_representatives"],
        clusters_by_class=stats["clusters_by_class"],
        total_boards_indexed=0,
        avg_cluster_size=stats["avg_cluster_size"],
    )


@router.get("/cluster/{cluster_id}")
async def get_cluster(cluster_id: str) -> dict:
    """Get details for a specific cluster."""
    index = _get_cluster_index()
    cluster = index.get_cluster(cluster_id)
    if cluster is None:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")
    return cluster.model_dump()


@router.get("/metrics")
async def abstraction_metrics() -> dict:
    """Get retrieval system performance metrics."""
    retriever = _get_retriever()
    return retriever.metrics()


@router.get("/coverage")
async def solve_coverage() -> CoverageResponse:
    """Get solve coverage statistics."""
    index = _get_cluster_index()
    stats = index.stats()
    return CoverageResponse(
        total_clusters=stats["total_clusters"],
        total_representatives=stats["total_representatives"],
        clusters_by_class=stats["clusters_by_class"],
        isomorphism_reference={
            "flop": count_isomorphic_classes(3),
            "turn": count_isomorphic_classes(4),
            "river": count_isomorphic_classes(5),
        },
    )
