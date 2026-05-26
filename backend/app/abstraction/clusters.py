"""
Board clustering engine — groups strategically similar boards.

Approach:
  We use a two-level hierarchy:
    Level 1: Coarse — 17 BoardClassEnum groups (existing system)
    Level 2: Fine — feature-vector-based sub-clusters within each coarse group

  Within each coarse group, boards are clustered by feature vector similarity
  using a lightweight k-medoids approach. Each resulting cluster gets 1-3
  representative boards that will have precomputed solves.

Why not k-means?
  Board feature space is bounded [0,1]^14 with many binary dimensions.
  K-medoids picks actual boards as centroids, which is more meaningful
  for poker (we need real boards to solve, not interpolated feature averages).

Cluster count targets:
  - A_HIGH_DRY: ~12 sub-clusters (most common, needs granularity)
  - MONOTONE: ~6 sub-clusters (suit pattern dominates; ranks vary less)
  - PAIRED_*: ~8 sub-clusters each
  - Total: ~150-200 clusters

Storage: ~200 clusters × 2 representatives × {flop,turn,river}
       = ~1,200 representative boards to solve
       = ~2,400 solve jobs (IP + OOP per board per spot type)
"""

from __future__ import annotations

import logging
import random
from collections import defaultdict

from app.solver.enums import BoardClassEnum

from .canonical import canonical_board_key, canonicalize_board
from .features import (
    BoardFeatureVector,
    extract_features,
    feature_similarity,
    weighted_euclidean_distance,
)
from .models import BoardCluster

logger = logging.getLogger(__name__)

# Target sub-cluster count per coarse board class.
# Higher for classes with more strategic variance.
_TARGET_SUBCLUSTERS: dict[str, int] = {
    "A_HIGH_DRY": 12,
    "A_HIGH_WET": 10,
    "K_HIGH_DRY": 10,
    "K_HIGH_WET": 8,
    "LOW_CONNECTED": 8,
    "LOW_DYNAMIC": 6,
    "MIDDLE_CONNECTED": 8,
    "DOUBLE_BROADWAY": 8,
    "TRIPLE_BROADWAY": 6,
    "PAIRED_LOW": 8,
    "PAIRED_HIGH": 8,
    "MONOTONE": 6,
    "RAINBOW_STATIC": 8,
    "RAINBOW_DYNAMIC": 8,
    "FLUSH_COMPLETING": 6,
    "STRAIGHT_COMPLETING": 6,
    "NEUTRAL": 8,
}


def _pick_initial_medoids(
    features: list[BoardFeatureVector],
    k: int,
) -> list[int]:
    """
    K-medoids++ initialization — spread initial medoids for better convergence.

    Picks first medoid randomly, then each subsequent medoid is chosen
    with probability proportional to squared distance from nearest existing medoid.
    """
    n = len(features)
    if k >= n:
        return list(range(n))

    medoids = [random.randint(0, n - 1)]
    min_dists = [
        weighted_euclidean_distance(features[i], features[medoids[0]])
        for i in range(n)
    ]

    for _ in range(1, k):
        # Probability proportional to squared distance
        total = sum(d * d for d in min_dists)
        if total < 1e-12:
            # All remaining points are identical to a medoid
            remaining = [i for i in range(n) if i not in medoids]
            if remaining:
                medoids.append(random.choice(remaining))
            continue

        threshold = random.random() * total
        cumulative = 0.0
        chosen = 0
        for i in range(n):
            if i in medoids:
                continue
            cumulative += min_dists[i] * min_dists[i]
            if cumulative >= threshold:
                chosen = i
                break
        medoids.append(chosen)

        # Update minimum distances
        for i in range(n):
            d = weighted_euclidean_distance(features[i], features[chosen])
            min_dists[i] = min(min_dists[i], d)

    return medoids


def cluster_boards(
    boards: list[list[str]],
    board_class: str,
    k: int | None = None,
    max_iterations: int = 20,
    seed: int = 42,
) -> list[BoardCluster]:
    """
    Cluster a set of boards from the same coarse BoardClassEnum.

    Args:
        boards: List of board card lists, all classified under the same board_class.
        board_class: The coarse BoardClassEnum value.
        k: Number of sub-clusters (None = use default for this board class).
        max_iterations: K-medoids iteration limit.
        seed: Random seed for reproducibility.

    Returns:
        List of BoardCluster objects with centroids and representative boards.
    """
    random.seed(seed)

    if k is None:
        k = _TARGET_SUBCLUSTERS.get(board_class, 8)

    # Extract features and deduplicate by canonical key
    seen_keys: set[str] = set()
    unique_boards: list[list[str]] = []
    unique_features: list[BoardFeatureVector] = []

    for board in boards:
        key = canonical_board_key(board)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        unique_boards.append(canonicalize_board(board))
        unique_features.append(extract_features(board))

    n = len(unique_boards)
    if n == 0:
        return []

    k = min(k, n)

    # ── K-medoids clustering ──────────────────────────────────────────────
    medoid_indices = _pick_initial_medoids(unique_features, k)
    assignments = [0] * n

    for iteration in range(max_iterations):
        # Assign each point to nearest medoid
        changed = 0
        for i in range(n):
            best_medoid = 0
            best_dist = float("inf")
            for m_idx, m in enumerate(medoid_indices):
                d = weighted_euclidean_distance(unique_features[i], unique_features[m])
                if d < best_dist:
                    best_dist = d
                    best_medoid = m_idx
            if assignments[i] != best_medoid:
                changed += 1
            assignments[i] = best_medoid

        if changed == 0:
            break

        # Update medoids: for each cluster, pick the point that minimizes
        # total distance to all other points in the cluster
        for m_idx in range(k):
            cluster_members = [i for i in range(n) if assignments[i] == m_idx]
            if not cluster_members:
                continue

            best_total = float("inf")
            best_member = cluster_members[0]
            for candidate in cluster_members:
                total_dist = sum(
                    weighted_euclidean_distance(
                        unique_features[candidate], unique_features[j],
                    )
                    for j in cluster_members
                )
                if total_dist < best_total:
                    best_total = total_dist
                    best_member = candidate

            medoid_indices[m_idx] = best_member

    # ── Build BoardCluster objects ────────────────────────────────────────
    clusters: list[BoardCluster] = []

    for m_idx in range(k):
        cluster_members = [i for i in range(n) if assignments[i] == m_idx]
        if not cluster_members:
            continue

        medoid = medoid_indices[m_idx]
        medoid_features = unique_features[medoid]

        # Compute centroid (average of member features)
        centroid = [0.0] * len(medoid_features)
        for i in cluster_members:
            for d in range(len(centroid)):
                centroid[d] += unique_features[i].values[d]
        centroid = [v / len(cluster_members) for v in centroid]

        # Pick 1-2 representative boards (medoid + most distant from medoid)
        representatives = [canonical_board_key(unique_boards[medoid])]
        if len(cluster_members) > 3:
            # Add the board most distant from the medoid as second representative
            farthest_idx = max(
                cluster_members,
                key=lambda i: weighted_euclidean_distance(
                    unique_features[i], medoid_features,
                ),
            )
            if farthest_idx != medoid:
                representatives.append(
                    canonical_board_key(unique_boards[farthest_idx])
                )

        # Feature bounds
        high_cards = [unique_features[i].values[0] for i in cluster_members]
        conn_scores = [unique_features[i].values[4] for i in cluster_members]

        # Average intra-cluster similarity
        avg_sim = 0.0
        if len(cluster_members) > 1:
            sim_sum = 0.0
            sim_count = 0
            for i in cluster_members:
                sim = feature_similarity(unique_features[i], medoid_features)
                sim_sum += sim
                sim_count += 1
            avg_sim = sim_sum / sim_count

        cluster_idx = len(clusters)
        cluster = BoardCluster(
            cluster_id=f"{board_class}:c{cluster_idx:02d}",
            board_class=board_class,
            centroid=centroid,
            representatives=representatives,
            member_count=len(cluster_members),
            avg_similarity=round(avg_sim, 4),
            high_card_range=(min(high_cards), max(high_cards)),
            connectedness_range=(min(conn_scores), max(conn_scores)),
        )
        clusters.append(cluster)

    logger.info(
        "[Clustering] %s: %d boards → %d clusters (avg size %.1f)",
        board_class, n, len(clusters),
        n / max(len(clusters), 1),
    )
    return clusters


class ClusterIndex:
    """
    In-memory index for fast cluster lookup.

    Maintains:
      - All clusters organized by board_class
      - Feature vectors for all cluster centroids
      - Representative board → cluster mapping
    """

    def __init__(self) -> None:
        self._clusters: dict[str, BoardCluster] = {}  # cluster_id → cluster
        self._by_class: dict[str, list[str]] = defaultdict(list)  # board_class → [cluster_ids]
        self._representative_to_cluster: dict[str, str] = {}  # canonical_key → cluster_id

    def add_cluster(self, cluster: BoardCluster) -> None:
        self._clusters[cluster.cluster_id] = cluster
        self._by_class[cluster.board_class].append(cluster.cluster_id)
        for rep in cluster.representatives:
            self._representative_to_cluster[rep] = cluster.cluster_id

    def get_cluster(self, cluster_id: str) -> BoardCluster | None:
        return self._clusters.get(cluster_id)

    def clusters_for_class(self, board_class: str) -> list[BoardCluster]:
        ids = self._by_class.get(board_class, [])
        return [self._clusters[cid] for cid in ids if cid in self._clusters]

    def find_nearest_cluster(
        self,
        features: BoardFeatureVector,
        board_class: str,
    ) -> tuple[BoardCluster | None, float]:
        """
        Find the nearest cluster within a board class.

        Returns (cluster, similarity_score).
        """
        candidates = self.clusters_for_class(board_class)
        if not candidates:
            return None, 0.0

        best_cluster = None
        best_sim = -1.0

        for cluster in candidates:
            if not cluster.centroid:
                continue
            centroid_vec = BoardFeatureVector(
                values=tuple(cluster.centroid),
                board_key=f"centroid:{cluster.cluster_id}",
            )
            sim = feature_similarity(features, centroid_vec)
            if sim > best_sim:
                best_sim = sim
                best_cluster = cluster

        return best_cluster, best_sim

    def find_nearest_representative(
        self,
        features: BoardFeatureVector,
        cluster: BoardCluster,
    ) -> tuple[str | None, float]:
        """
        Find the nearest representative board within a cluster.

        Returns (canonical_key, similarity_score).
        """
        best_key = None
        best_sim = -1.0

        for rep_key in cluster.representatives:
            # Parse representative board from key and compute features
            rep_board = rep_key.split("_")
            rep_features = extract_features(rep_board)
            sim = feature_similarity(features, rep_features)
            if sim > best_sim:
                best_sim = sim
                best_key = rep_key

        return best_key, best_sim

    def cluster_for_representative(self, canonical_key: str) -> str | None:
        return self._representative_to_cluster.get(canonical_key)

    @property
    def total_clusters(self) -> int:
        return len(self._clusters)

    @property
    def total_representatives(self) -> int:
        return len(self._representative_to_cluster)

    def stats(self) -> dict:
        return {
            "total_clusters": self.total_clusters,
            "total_representatives": self.total_representatives,
            "clusters_by_class": {
                bc: len(ids) for bc, ids in self._by_class.items()
            },
            "avg_cluster_size": (
                sum(c.member_count for c in self._clusters.values())
                / max(len(self._clusters), 1)
            ),
        }
