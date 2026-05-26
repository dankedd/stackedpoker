"""
Nearest-neighbor solve retrieval — the core strategy lookup engine.

Pipeline:
  1. Canonicalize input board
  2. Extract feature vector
  3. Classify board (coarse BoardClassEnum)
  4. Check exact match cache (canonical_key → strategy)
  5. Find nearest cluster within board class
  6. Find nearest representative within cluster
  7. Retrieve strategy for representative board
  8. Score confidence and return

Retrieval tiers (in priority order):
  EXACT         — canonical board key matches a solved board directly
  CLUSTER_REP   — board falls in a cluster; use representative's solve
  CROSS_CLUSTER — no cluster match; search adjacent board classes
  FALLBACK      — heuristic strategy from existing Phase 4 system

Latency targets:
  EXACT:         < 1ms  (cache hit)
  CLUSTER_REP:   < 5ms  (vector distance + cache lookup)
  CROSS_CLUSTER: < 15ms (search multiple clusters)
  FALLBACK:      < 2ms  (deterministic heuristic)
"""

from __future__ import annotations

import logging
import threading
import time
from collections import OrderedDict

from app.solver.board_classifier import BoardClassifier
from app.solver.enums import BoardClassEnum
from app.strategy_db.models import StrategyNode
from app.strategy_db.storage import StrategyStore

from .canonical import canonical_board_key, fast_canonical_key
from .clusters import ClusterIndex
from .features import (
    BoardFeatureVector,
    extract_features,
    feature_similarity,
)
from .models import (
    RetrievalMatch,
    RetrievalQuery,
    RetrievalResponse,
)

logger = logging.getLogger(__name__)

# Similarity thresholds for retrieval tiers
_EXACT_THRESHOLD = 0.999
_CLUSTER_THRESHOLD = 0.45    # Minimum similarity to accept cluster match
_CROSS_CLUSTER_THRESHOLD = 0.35  # Minimum for cross-class search

# Adjacent board class groups (for cross-cluster fallback)
_ADJACENT_CLASSES: dict[str, list[str]] = {
    "A_HIGH_DRY": ["K_HIGH_DRY", "RAINBOW_STATIC", "A_HIGH_WET"],
    "A_HIGH_WET": ["A_HIGH_DRY", "TRIPLE_BROADWAY", "K_HIGH_WET"],
    "K_HIGH_DRY": ["A_HIGH_DRY", "RAINBOW_STATIC", "K_HIGH_WET"],
    "K_HIGH_WET": ["K_HIGH_DRY", "A_HIGH_WET", "DOUBLE_BROADWAY"],
    "LOW_CONNECTED": ["MIDDLE_CONNECTED", "LOW_DYNAMIC", "RAINBOW_DYNAMIC"],
    "LOW_DYNAMIC": ["LOW_CONNECTED", "MIDDLE_CONNECTED"],
    "MIDDLE_CONNECTED": ["LOW_CONNECTED", "RAINBOW_DYNAMIC", "K_HIGH_WET"],
    "DOUBLE_BROADWAY": ["TRIPLE_BROADWAY", "K_HIGH_DRY", "A_HIGH_DRY"],
    "TRIPLE_BROADWAY": ["DOUBLE_BROADWAY", "A_HIGH_WET"],
    "PAIRED_LOW": ["PAIRED_HIGH", "LOW_CONNECTED"],
    "PAIRED_HIGH": ["PAIRED_LOW", "DOUBLE_BROADWAY", "A_HIGH_DRY"],
    "MONOTONE": ["FLUSH_COMPLETING"],
    "RAINBOW_STATIC": ["A_HIGH_DRY", "K_HIGH_DRY", "RAINBOW_DYNAMIC"],
    "RAINBOW_DYNAMIC": ["MIDDLE_CONNECTED", "RAINBOW_STATIC", "LOW_CONNECTED"],
    "FLUSH_COMPLETING": ["MONOTONE", "A_HIGH_WET"],
    "STRAIGHT_COMPLETING": ["MIDDLE_CONNECTED", "LOW_CONNECTED"],
    "NEUTRAL": ["RAINBOW_STATIC", "RAINBOW_DYNAMIC"],
}


class AbstractionRetriever:
    """
    Production retrieval engine combining board abstraction with strategy lookup.

    Thread-safe. Maintains an LRU cache of recent lookups.
    """

    def __init__(
        self,
        cluster_index: ClusterIndex,
        strategy_store: StrategyStore | None = None,
        cache_size: int = 2048,
    ) -> None:
        self._clusters = cluster_index
        self._store = strategy_store
        self._board_classifier = BoardClassifier()

        # LRU cache: canonical_key → (RetrievalMatch, features)
        self._cache: OrderedDict[str, tuple[RetrievalMatch, BoardFeatureVector]] = (
            OrderedDict()
        )
        self._cache_size = cache_size
        self._lock = threading.Lock()

        # Exact solve index: canonical_key → StrategyNode extended_key
        self._exact_index: dict[str, str] = {}

        # Metrics
        self._metrics = {
            "total_queries": 0,
            "exact_hits": 0,
            "cluster_hits": 0,
            "cross_cluster_hits": 0,
            "fallback_hits": 0,
            "cache_hits": 0,
            "total_latency_ms": 0.0,
        }

    def register_exact_solve(
        self,
        canonical_key: str,
        extended_key: str,
    ) -> None:
        """Register a board that has been directly solved."""
        with self._lock:
            self._exact_index[canonical_key] = extended_key

    def retrieve(self, query: RetrievalQuery) -> RetrievalResponse:
        """
        Find the best strategy match for a given board and spot.

        This is the main entry point for the retrieval system.
        """
        start = time.monotonic()
        self._metrics["total_queries"] += 1

        board = query.board
        canonical_key = fast_canonical_key(board)
        features = extract_features(board)

        # Derive street from board length
        street = query.street
        if street is None:
            n = len(board)
            street = "flop" if n == 3 else "turn" if n == 4 else "river"

        # Classify board
        if len(board) == 3:
            bf = self._board_classifier.classify_flop(board)
        elif len(board) == 4:
            bf = self._board_classifier.classify_turn(board[:3], board[3])
        elif len(board) >= 5:
            bf = self._board_classifier.classify_river(board[:4], board[4])
        else:
            bf = self._board_classifier.classify_flop(board)
        board_class = bf.board_class.value if hasattr(bf.board_class, "value") else str(bf.board_class)

        response = RetrievalResponse(
            query_board="_".join(board),
            canonical_key=canonical_key,
            query_features=features.to_list(),
        )

        # ── Check cache ───────────────────────────────────────────────────
        with self._lock:
            if canonical_key in self._cache:
                cached_match, _ = self._cache[canonical_key]
                self._cache.move_to_end(canonical_key)
                self._metrics["cache_hits"] += 1
                response.best_match = cached_match
                response.matches = [cached_match]
                response.retrieval_tier = cached_match.source
                response.cluster_id = cached_match.cluster_id
                response.latency_ms = (time.monotonic() - start) * 1000
                return response

        # ── Tier 1: Exact match ───────────────────────────────────────────
        match = self._try_exact(canonical_key, features, board_class, query)
        if match:
            self._metrics["exact_hits"] += 1
            response.retrieval_tier = "exact"
            response.matches = [match]
            response.best_match = match
            response.cluster_id = match.cluster_id
            self._cache_put(canonical_key, match, features)
            response.latency_ms = (time.monotonic() - start) * 1000
            return response

        # ── Tier 2: Cluster representative ────────────────────────────────
        match = self._try_cluster(features, board_class, query)
        if match and match.board_similarity >= _CLUSTER_THRESHOLD:
            self._metrics["cluster_hits"] += 1
            response.retrieval_tier = "cluster"
            response.matches = [match]
            response.best_match = match
            response.cluster_id = match.cluster_id
            self._cache_put(canonical_key, match, features)
            response.latency_ms = (time.monotonic() - start) * 1000
            return response

        # ── Tier 3: Cross-cluster search ──────────────────────────────────
        matches = self._try_cross_cluster(features, board_class, query)
        if matches:
            best = matches[0]
            if best.board_similarity >= _CROSS_CLUSTER_THRESHOLD:
                self._metrics["cross_cluster_hits"] += 1
                response.retrieval_tier = "cross_cluster"
                response.matches = matches[:5]
                response.best_match = best
                response.cluster_id = best.cluster_id
                self._cache_put(canonical_key, best, features)
                response.latency_ms = (time.monotonic() - start) * 1000
                response.candidates_evaluated = len(matches)
                return response

        # ── Tier 4: Fallback ──────────────────────────────────────────────
        self._metrics["fallback_hits"] += 1
        fallback = RetrievalMatch(
            canonical_key=canonical_key,
            cluster_id="none",
            board_class=board_class,
            board_similarity=0.0,
            overall_similarity=0.0,
            confidence=0.0,
            source="fallback",
        )
        response.retrieval_tier = "fallback"
        response.matches = [fallback]
        response.best_match = fallback
        response.latency_ms = (time.monotonic() - start) * 1000
        return response

    # ── Tier implementations ──────────────────────────────────────────────

    def _try_exact(
        self,
        canonical_key: str,
        features: BoardFeatureVector,
        board_class: str,
        query: RetrievalQuery,
    ) -> RetrievalMatch | None:
        """Check if this exact board has been solved."""
        extended_key = self._exact_index.get(canonical_key)
        if extended_key is None:
            return None

        node = self._lookup_node(extended_key)
        if node is None:
            return None

        cluster_id = self._clusters.cluster_for_representative(canonical_key)

        return RetrievalMatch(
            canonical_key=canonical_key,
            cluster_id=cluster_id or board_class,
            board_class=board_class,
            board_similarity=1.0,
            overall_similarity=1.0,
            confidence=1.0,
            node_key=node.node_key,
            bet_frequency=node.bet_frequency,
            check_frequency=node.check_frequency,
            primary_sizing=node.primary_sizing,
            source="exact",
            solve_source=node.source,
        )

    def _try_cluster(
        self,
        features: BoardFeatureVector,
        board_class: str,
        query: RetrievalQuery,
    ) -> RetrievalMatch | None:
        """Find nearest cluster and return representative's strategy."""
        cluster, cluster_sim = self._clusters.find_nearest_cluster(
            features, board_class,
        )
        if cluster is None:
            return None

        rep_key, rep_sim = self._clusters.find_nearest_representative(
            features, cluster,
        )
        if rep_key is None:
            return None

        # Look up the strategy for the representative board
        node = self._find_strategy_for_board(
            rep_key, query.spot_type, query.positions, query.is_ip,
        )

        overall_sim = rep_sim * 0.7 + cluster_sim * 0.3
        confidence = min(1.0, overall_sim * 1.2)

        match = RetrievalMatch(
            canonical_key=rep_key,
            cluster_id=cluster.cluster_id,
            board_class=board_class,
            board_similarity=rep_sim,
            overall_similarity=overall_sim,
            confidence=confidence,
            source="cluster",
        )

        if node:
            match.node_key = node.node_key
            match.bet_frequency = node.bet_frequency
            match.check_frequency = node.check_frequency
            match.primary_sizing = node.primary_sizing
            match.solve_source = node.source

        return match

    def _try_cross_cluster(
        self,
        features: BoardFeatureVector,
        board_class: str,
        query: RetrievalQuery,
    ) -> list[RetrievalMatch]:
        """Search adjacent board classes for matches."""
        adjacent = _ADJACENT_CLASSES.get(board_class, [])
        all_matches: list[RetrievalMatch] = []

        for adj_class in adjacent:
            cluster, cluster_sim = self._clusters.find_nearest_cluster(
                features, adj_class,
            )
            if cluster is None:
                continue

            rep_key, rep_sim = self._clusters.find_nearest_representative(
                features, cluster,
            )
            if rep_key is None:
                continue

            # Cross-class penalty: reduce similarity by 20%
            cross_penalty = 0.80
            overall_sim = rep_sim * cross_penalty * 0.7 + cluster_sim * cross_penalty * 0.3
            confidence = min(1.0, overall_sim * 1.0)

            node = self._find_strategy_for_board(
                rep_key, query.spot_type, query.positions, query.is_ip,
            )

            match = RetrievalMatch(
                canonical_key=rep_key,
                cluster_id=cluster.cluster_id,
                board_class=adj_class,
                board_similarity=rep_sim * cross_penalty,
                overall_similarity=overall_sim,
                confidence=confidence,
                source="cross_cluster",
            )

            if node:
                match.node_key = node.node_key
                match.bet_frequency = node.bet_frequency
                match.check_frequency = node.check_frequency
                match.primary_sizing = node.primary_sizing
                match.solve_source = node.source

            all_matches.append(match)

        all_matches.sort(key=lambda m: m.overall_similarity, reverse=True)
        return all_matches

    # ── Strategy lookup helpers ───────────────────────────────────────────

    def _lookup_node(self, extended_key: str) -> StrategyNode | None:
        """Direct lookup in the strategy store by extended key."""
        if self._store is None:
            return None
        # Parse extended_key → node_key_str + is_ip
        if "::ip" in extended_key:
            node_key = extended_key.replace("::ip", "")
            return self._store.get_by_node_key(node_key, is_ip=True)
        elif "::oop" in extended_key:
            node_key = extended_key.replace("::oop", "")
            return self._store.get_by_node_key(node_key, is_ip=False)
        return None

    def _find_strategy_for_board(
        self,
        canonical_key: str,
        spot_type: str,
        positions: str,
        is_ip: bool,
    ) -> StrategyNode | None:
        """
        Find strategy node for a representative board.

        Constructs potential node keys and tries exact + similar lookup.
        """
        if self._store is None:
            return None

        # Try exact lookup with the board's features
        rep_board = canonical_key.split("_")
        if len(rep_board) >= 3:
            bf = self._board_classifier.classify_flop(rep_board[:3])
            bc_val = bf.board_class.value if hasattr(bf.board_class, "value") else str(bf.board_class)
        else:
            bc_val = "NEUTRAL"

        from app.solver.utils import bucket_spr, bucket_stack_depth

        # Try common stack depths
        for stack_bucket in ["100bb", "60bb", "40bb"]:
            for spr_bucket in ["4_8", "8_PLUS", "2_4"]:
                node_key = (
                    f"{spot_type}::{positions}::{stack_bucket}::"
                    f"{spr_bucket}::{bc_val}::flop::2p"
                )
                node = self._store.get_by_node_key(node_key, is_ip)
                if node:
                    return node

        # Try similar search
        node_key = f"{spot_type}::{positions}::100bb::4_8::{bc_val}::flop::2p"
        results = self._store.search_similar(node_key, is_ip, top_k=1, min_score=0.50)
        if results:
            return results[0][0]

        return None

    # ── Cache management ──────────────────────────────────────────────────

    def _cache_put(
        self,
        canonical_key: str,
        match: RetrievalMatch,
        features: BoardFeatureVector,
    ) -> None:
        with self._lock:
            if canonical_key in self._cache:
                self._cache.move_to_end(canonical_key)
            else:
                self._cache[canonical_key] = (match, features)
                if len(self._cache) > self._cache_size:
                    self._cache.popitem(last=False)

    def invalidate_cache(self, canonical_key: str | None = None) -> int:
        with self._lock:
            if canonical_key is None:
                count = len(self._cache)
                self._cache.clear()
                return count
            if canonical_key in self._cache:
                del self._cache[canonical_key]
                return 1
            return 0

    # ── Metrics ───────────────────────────────────────────────────────────

    def metrics(self) -> dict:
        total = self._metrics["total_queries"] or 1
        return {
            **self._metrics,
            "exact_rate": self._metrics["exact_hits"] / total,
            "cluster_rate": self._metrics["cluster_hits"] / total,
            "cross_cluster_rate": self._metrics["cross_cluster_hits"] / total,
            "fallback_rate": self._metrics["fallback_hits"] / total,
            "cache_hit_rate": self._metrics["cache_hits"] / total,
            "avg_latency_ms": self._metrics["total_latency_ms"] / total,
            "cache_size": len(self._cache),
            "exact_index_size": len(self._exact_index),
        }
