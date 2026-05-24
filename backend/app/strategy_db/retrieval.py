"""
retrieve_strategy — 4-tier deterministic strategy retrieval engine.

Resolution order (never raises, never returns None):

  Tier 1 — Cache hit
    Check the LRU cache first. Sub-millisecond on hit.

  Tier 2 — Exact DB lookup
    Look up the extended_key in StrategyStore.  O(1).

  Tier 3 — Nearest-neighbour match
    Search the store for the most similar stored node.
    Only accepted if similarity ≥ SIMILAR_THRESHOLD (0.60).

  Tier 4 — Phase 4 heuristic fallback
    Call app.strategy.retrieval.resolve_strategy(spot).
    Always succeeds; returns a freshly computed StrategyProfile.

  Default — Safe baseline
    Ultra-conservative profile returned if even the fallback raises.

Public API
----------
retrieve_strategy(node_key, spot) → RetrievalResult
  node_key  NodeKey (from abstractions.py)
  spot      SolverSpot (from spot_classifier.py)

RetrievalResult carries the StrategyProfile plus full debug metadata
suitable for the /api/debug/spot endpoint.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field

from app.solver.abstractions import NodeKey
from app.solver.models import SolverSpot
from app.strategy.profiles import ActionFrequency, StrategyProfile

from .cache import StrategyCache
from .models import StrategyNode
from .storage import StrategyStore

logger = logging.getLogger(__name__)

# Minimum similarity for a nearest-neighbour match to be accepted
SIMILAR_THRESHOLD = 0.60

# ── Module-level singletons ───────────────────────────────────────────────────
# Seeded lazily on first call.  Reset via _reset_singletons() in tests.

_store: StrategyStore | None = None
_cache: StrategyCache | None = None

# ── Observability metrics ─────────────────────────────────────────────────────
# Thread-safe in-memory counters. Reset on process restart. Exposed via
# get_metrics() for debug endpoints and health checks.

_metrics_lock = threading.Lock()
_metrics: dict[str, float] = {
    "total_calls":          0,
    "exact_hits":           0,
    "similar_hits":         0,
    "fallback_hits":        0,
    "default_hits":         0,
    "cache_hits":           0,
    "total_latency_ms":     0.0,
    "sum_similarity_score": 0.0,
    "similar_calls":        0,  # denominator for avg similarity
}


def _record(retrieval_type: str, cache_hit: bool, latency_ms: float, similarity: float) -> None:
    """Thread-safe metrics update."""
    with _metrics_lock:
        _metrics["total_calls"] += 1
        _metrics["total_latency_ms"] += latency_ms
        if cache_hit:
            _metrics["cache_hits"] += 1
        if retrieval_type == "exact":
            _metrics["exact_hits"] += 1
        elif retrieval_type == "similar":
            _metrics["similar_hits"] += 1
            _metrics["sum_similarity_score"] += similarity
            _metrics["similar_calls"] += 1
        elif retrieval_type == "fallback":
            _metrics["fallback_hits"] += 1
        else:
            _metrics["default_hits"] += 1


def get_metrics() -> dict:
    """Return a copy of the observability metrics dict with derived rates."""
    with _metrics_lock:
        m = dict(_metrics)
    total = m["total_calls"]
    return {
        "total_calls":       int(m["total_calls"]),
        "exact_hits":        int(m["exact_hits"]),
        "similar_hits":      int(m["similar_hits"]),
        "fallback_hits":     int(m["fallback_hits"]),
        "default_hits":      int(m["default_hits"]),
        "cache_hits":        int(m["cache_hits"]),
        "cache_hit_rate":    round(m["cache_hits"] / total, 4) if total else 0.0,
        "fallback_rate":     round((m["fallback_hits"] + m["default_hits"]) / total, 4) if total else 0.0,
        "avg_latency_ms":    round(m["total_latency_ms"] / total, 2) if total else 0.0,
        "avg_similarity":    round(m["sum_similarity_score"] / m["similar_calls"], 4)
                             if m["similar_calls"] else None,
    }


def _get_store() -> StrategyStore:
    global _store
    if _store is None:
        _store = StrategyStore(seed_on_init=True)
    return _store


def _get_cache() -> StrategyCache:
    global _cache
    if _cache is None:
        _cache = StrategyCache(maxsize=2048, version="1.0")
    return _cache


def _reset_singletons() -> None:
    """For tests only — force fresh store + cache on next call."""
    global _store, _cache
    _store = None
    _cache = None


# ── RetrievalResult ───────────────────────────────────────────────────────────


@dataclass
class RetrievalResult:
    """
    Full output of retrieve_strategy().

    profile          the resolved StrategyProfile (never None)
    retrieval_type   "exact" | "similar" | "fallback" | "default"
    matched_node_key the extended_key of the store entry used (or the
                     query key for fallback/default)
    similarity_score 1.0 for exact, <1 for similar, 0.0 for fallback/default
    cache_hit        True if the result came from the LRU cache
    debug            dict for /api/debug/spot — safe to serialise to JSON
    """

    profile: StrategyProfile
    retrieval_type: str
    matched_node_key: str
    similarity_score: float
    cache_hit: bool
    debug: dict = field(default_factory=dict)

    def to_debug_dict(self) -> dict:
        """JSON-serialisable debug payload for API endpoints."""
        return {
            "node_key": self.matched_node_key,
            "retrieval_type": self.retrieval_type,
            "similarity_score": round(self.similarity_score, 4),
            "cache_hit": self.cache_hit,
            **self.debug,
        }


# ── Node → Profile conversion ─────────────────────────────────────────────────


def _node_to_profile(node: StrategyNode, node_key_str: str) -> StrategyProfile:
    """Convert a flat StrategyNode back into a StrategyProfile."""
    af_bet   = ActionFrequency("bet",   node.bet_frequency,   node.primary_sizing)
    af_check = ActionFrequency("check", node.check_frequency, None)

    action_frequencies = sorted(
        [af_bet, af_check], key=lambda af: af.frequency, reverse=True
    )

    caveats: list[str] = []
    if node.player_count >= 3:
        caveats.append(
            "Multiway pot: all signals reflect heads-up theory — "
            "apply with reduced confidence"
        )
    if node.board_class == "NEUTRAL":
        caveats.append(
            "Board class is NEUTRAL — classification may be incomplete"
        )

    return StrategyProfile(
        node_key=node_key_str,
        bet_frequency=node.bet_frequency,
        check_frequency=node.check_frequency,
        primary_sizing=node.primary_sizing,
        range_advantage=node.range_advantage,
        nut_advantage=node.nut_advantage,
        pressure_score=node.pressure_score,
        volatility_score=node.volatility_score,
        equity_realization=node.equity_realization,
        action_frequencies=action_frequencies,
        rationale=node.rationale,
        caveats=caveats,
        source="registry",
    )


# ── Safe default profile (Tier 4 hard-stop) ───────────────────────────────────


def _default_profile(node_key_str: str) -> StrategyProfile:
    """Ultra-conservative profile used only when everything else fails."""
    return StrategyProfile(
        node_key=node_key_str,
        bet_frequency=0.50,
        check_frequency=0.50,
        primary_sizing="50pct",
        range_advantage=0.50,
        nut_advantage=0.50,
        pressure_score=0.45,
        volatility_score=0.50,
        equity_realization=0.60,
        action_frequencies=[
            ActionFrequency("bet",   0.50, "50pct"),
            ActionFrequency("check", 0.50, None),
        ],
        rationale="Default safe profile — all other retrieval tiers failed",
        caveats=["All retrieval tiers failed; strategy signals are unreliable"],
        source="fallback",
    )


# ── Public entry point ────────────────────────────────────────────────────────


def retrieve_strategy(node_key: NodeKey, spot: SolverSpot) -> RetrievalResult:
    """
    Resolve a StrategyProfile for the given NodeKey + SolverSpot.

    Resolution order:
      1. LRU cache hit
      2. Exact StrategyStore lookup
      3. Nearest-neighbour store lookup (similarity ≥ SIMILAR_THRESHOLD)
      4. Phase 4 heuristic fallback (resolve_strategy)
      5. Default safe profile (should never be reached)

    Never raises.
    """
    import time as _time
    _t0 = _time.perf_counter()

    store = _get_store()
    cache = _get_cache()

    key_str = node_key.to_string()
    is_ip   = spot.is_ip

    # ── Tier 1: cache hit ─────────────────────────────────────────────────
    cached_node = cache.get(f"{key_str}::{'ip' if is_ip else 'oop'}")
    if cached_node is not None:
        profile = _node_to_profile(cached_node, key_str)
        _record("exact", True, (_time.perf_counter() - _t0) * 1000, 1.0)
        return RetrievalResult(
            profile=profile,
            retrieval_type="exact",
            matched_node_key=cached_node.extended_key,
            similarity_score=1.0,
            cache_hit=True,
            debug={"store_source": cached_node.source},
        )

    # ── Tier 2: exact DB lookup ───────────────────────────────────────────
    node = store.get_by_node_key(key_str, is_ip)
    if node is not None:
        cache.put(node.extended_key, node)
        profile = _node_to_profile(node, key_str)
        logger.debug("[retrieve_strategy] exact hit: %s", node.extended_key)
        _record("exact", False, (_time.perf_counter() - _t0) * 1000, 1.0)
        return RetrievalResult(
            profile=profile,
            retrieval_type="exact",
            matched_node_key=node.extended_key,
            similarity_score=1.0,
            cache_hit=False,
            debug={"store_source": node.source},
        )

    # ── Tier 3: nearest-neighbour ─────────────────────────────────────────
    try:
        similar = store.search_similar(
            key_str, is_ip, top_k=1, min_score=SIMILAR_THRESHOLD
        )
        if similar:
            best_node, score = similar[0]
            cache.put(f"{key_str}::{'ip' if is_ip else 'oop'}", best_node)
            profile = _node_to_profile(best_node, key_str)
            logger.debug(
                "[retrieve_strategy] similar hit: %s (score=%.3f)",
                best_node.extended_key, score,
            )
            _record("similar", False, (_time.perf_counter() - _t0) * 1000, score)
            return RetrievalResult(
                profile=profile,
                retrieval_type="similar",
                matched_node_key=best_node.extended_key,
                similarity_score=round(score, 4),
                cache_hit=False,
                debug={
                    "store_source": best_node.source,
                    "matched_board_class": best_node.board_class,
                    "matched_position": best_node.position_matchup,
                },
            )
    except Exception:
        logger.warning(
            "[retrieve_strategy] nearest-neighbour search failed",
            exc_info=True,
        )

    # ── Tier 4: Phase 4 heuristic fallback ───────────────────────────────
    try:
        from app.strategy.retrieval import resolve_strategy as _resolve
        profile = _resolve(spot)
        logger.debug("[retrieve_strategy] heuristic fallback for %s", key_str)
        _record("fallback", False, (_time.perf_counter() - _t0) * 1000, 0.0)
        return RetrievalResult(
            profile=profile,
            retrieval_type="fallback",
            matched_node_key=key_str,
            similarity_score=0.0,
            cache_hit=False,
            debug={"fallback_reason": "no similar node above threshold"},
        )
    except Exception:
        logger.error(
            "[retrieve_strategy] Phase 4 fallback also failed",
            exc_info=True,
        )

    # ── Default (should never be reached) ────────────────────────────────
    _record("default", False, (_time.perf_counter() - _t0) * 1000, 0.0)
    logger.critical(
        "[retrieve_strategy] ALL tiers failed for %s — returning default",
        key_str,
    )
    return RetrievalResult(
        profile=_default_profile(key_str),
        retrieval_type="default",
        matched_node_key=key_str,
        similarity_score=0.0,
        cache_hit=False,
        debug={"fallback_reason": "all retrieval tiers failed"},
    )


# ── Convenience helpers ────────────────────────────────────────────────────────


def store_stats() -> dict:
    """Return store + cache stats for /health-debug or admin endpoints."""
    return {
        "store": {
            "node_count": _get_store().count(),
            "index": _get_store().index_stats(),
        },
        "cache": {
            "size": len(_get_cache()),
            "stats": vars(_get_cache().stats()),
        },
        "retrieval_metrics": get_metrics(),
    }
