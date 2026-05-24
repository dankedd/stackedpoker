"""
StrategyStore — persistent strategy registry with JSON backing.

Responsibilities:
  - register_strategy(node)  — add / overwrite a node
  - get_by_node_key(key)     — exact extended_key lookup
  - search_similar(key, ...)  — nearest-neighbour retrieval
  - preload_seed_profiles()  — populate from seed generator
  - save_to_json / load_from_json — optional persistence

Design
------
All data lives in a dict[extended_key → StrategyNode] backed by a
StrategyIndex for fast candidate pre-filtering.

The store is lazy-seeded: seeds are generated on first access unless
`seed_on_init=False` is passed (for tests that control seeding manually).

Future Pio / GTO Wizard imports register nodes with source="pio" using
the same register_strategy() interface — the retrieval engine picks them
up automatically because they share the same key namespace.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import TYPE_CHECKING

from .indexing import StrategyIndex
from .models import StrategyNode, _extended_key
from .similarity import parse_node_key, similarity_score

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Minimum similarity to be considered a "valid" nearest-neighbour match
DEFAULT_MIN_SCORE = 0.55

# Source priority for tiebreaking in search_similar (higher = preferred)
_SOURCE_PRIORITY: dict[str, int] = {
    "texassolver": 4,
    "gto_plus":    3,
    "pio":         3,
    "gto_wizard":  3,
    "manual":      2,
    "handcrafted": 1,
}


def _source_priority(source: str) -> int:
    return _SOURCE_PRIORITY.get(source, 0)


class StrategyStore:
    """
    In-memory strategy registry with optional JSON persistence.

    Thread-safe via a single RLock (reads + writes are fast; contention
    is negligible in a single-process async app).
    """

    def __init__(self, seed_on_init: bool = True) -> None:
        self._nodes: dict[str, StrategyNode] = {}
        self._index = StrategyIndex()
        self._lock = threading.RLock()
        self._seeded = False

        if seed_on_init:
            self._ensure_seeded()

    # ── Seeding ────────────────────────────────────────────────────────────

    def _ensure_seeded(self) -> None:
        with self._lock:
            if not self._seeded:
                self.preload_seed_profiles()

    def preload_seed_profiles(self) -> int:
        """
        Populate the store from the handcrafted seed generator.

        Returns the number of nodes loaded.
        Idempotent: calling twice does not duplicate nodes (overwrite).
        """
        from .seeds import generate_all_seed_nodes
        nodes = generate_all_seed_nodes()
        loaded = 0
        for node in nodes:
            self.register_strategy(node)
            loaded += 1
        self._seeded = True
        logger.debug("[StrategyStore] seeded %d nodes", loaded)
        return loaded

    # ── Core CRUD ─────────────────────────────────────────────────────────

    def register_strategy(self, node: StrategyNode) -> None:
        """
        Add or overwrite a strategy node.

        Uses the extended_key (node_key + ::ip|oop) so IP and OOP
        strategies for the same position matchup are stored separately.
        """
        with self._lock:
            ek = node.extended_key
            if ek in self._nodes:
                self._index.remove(self._nodes[ek])
            self._nodes[ek] = node
            self._index.index(node)

    def get_by_node_key(self, node_key_str: str, is_ip: bool) -> StrategyNode | None:
        """
        Exact lookup by extended key (node_key_str + is_ip suffix).

        Returns None if no entry exists.
        """
        ek = _extended_key(node_key_str, is_ip)
        with self._lock:
            return self._nodes.get(ek)

    def search_similar(
        self,
        node_key_str: str,
        is_ip: bool,
        top_k: int = 5,
        min_score: float = DEFAULT_MIN_SCORE,
    ) -> list[tuple[StrategyNode, float]]:
        """
        Return up to *top_k* nodes most similar to the query key.

        Only nodes with similarity >= *min_score* are included.
        Results are sorted by score descending.

        Uses the index to pre-filter by spot_type + street + is_ip before
        running full similarity scoring — keeps worst-case < 200 candidates.
        """
        try:
            dims = parse_node_key(node_key_str)
        except ValueError:
            logger.warning("[search_similar] unparseable key: %r", node_key_str)
            return []

        with self._lock:
            # Pre-filter: must match spot_type, street, and is_ip perspective
            candidates = self._index.candidates_for(
                spot_type=dims["spot_type"],
                street=dims["street"],
                is_ip=is_ip,
            )

            if not candidates:
                # Relax: drop street filter
                candidates = self._index.candidates_for(
                    spot_type=dims["spot_type"],
                    is_ip=is_ip,
                )

            if not candidates:
                # Relax: drop is_ip filter too (last resort)
                candidates = self._index.candidates_for(
                    spot_type=dims["spot_type"],
                )

            # Score all candidates
            scored: list[tuple[StrategyNode, float]] = []
            for ek in candidates:
                node = self._nodes.get(ek)
                if node is None:
                    continue
                score = similarity_score(node_key_str, node.node_key)
                if score >= min_score:
                    scored.append((node, score))

            # Sort: primary = score descending; secondary = source priority
            # (real solver data preferred over handcrafted seeds at equal score)
            scored.sort(key=lambda t: (t[1], _source_priority(t[0].source)), reverse=True)
            return scored[:top_k]

    # ── Persistence ────────────────────────────────────────────────────────

    def save_to_json(self, path: str | Path) -> int:
        """
        Serialise all nodes to JSON at *path*.

        Returns the number of nodes written.
        """
        path = Path(path)
        with self._lock:
            data = [node.to_dict() for node in self._nodes.values()]

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"version": "1.0", "nodes": data}, fh, indent=2)

        logger.info("[StrategyStore] saved %d nodes to %s", len(data), path)
        return len(data)

    def load_from_json(self, path: str | Path) -> int:
        """
        Load nodes from a JSON file previously created by save_to_json().

        Existing nodes with the same extended_key are overwritten.
        Returns the number of nodes loaded.
        """
        path = Path(path)
        with open(path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)

        nodes_data = payload.get("nodes", payload)  # tolerate bare list
        loaded = 0
        for d in nodes_data:
            try:
                node = StrategyNode.from_dict(d)
                self.register_strategy(node)
                loaded += 1
            except Exception as exc:
                logger.warning("[load_from_json] skipping bad node: %s", exc)

        logger.info("[StrategyStore] loaded %d nodes from %s", loaded, path)
        return loaded

    # ── Diagnostics ────────────────────────────────────────────────────────

    def count(self) -> int:
        with self._lock:
            return len(self._nodes)

    def index_stats(self) -> dict:
        with self._lock:
            return self._index.stats()

    def all_keys(self) -> list[str]:
        """Return all extended_keys currently in the store (sorted)."""
        with self._lock:
            return sorted(self._nodes.keys())
