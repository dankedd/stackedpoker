"""
StrategyCache — in-memory LRU cache for strategy node lookups.

Design goals:
  - Sub-millisecond retrieval on cache hit (pure dict operations)
  - LRU eviction when maxsize is reached
  - Version-aware: bump version string to invalidate all entries
  - Thread-safe via simple lock (single process; async app)
  - Stats tracking for observability
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import StrategyNode


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    invalidations: int = 0
    current_size: int = 0
    maxsize: int = 0
    version: str = "1.0"

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


@dataclass
class _CacheEntry:
    node: "StrategyNode"
    version: str


class StrategyCache:
    """
    LRU in-memory cache for StrategyNode lookups.

    Keys are extended node key strings (node_key::ip|oop).
    Version mismatch causes a cache miss — entries from older versions
    are lazily replaced on next put().

    Example
    -------
    cache = StrategyCache(maxsize=2048, version="1.0")
    cache.put("SRP::BTN_vs_BB::...::ip", node)
    node = cache.get("SRP::BTN_vs_BB::...::ip")
    """

    def __init__(self, maxsize: int = 1024, version: str = "1.0") -> None:
        self._cache: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._maxsize = maxsize
        self._version = version
        self._lock = threading.Lock()
        self._stats = CacheStats(maxsize=maxsize, version=version)

    # ── Public interface ───────────────────────────────────────────────────

    def get(self, key: str) -> "StrategyNode | None":
        """
        Return the cached StrategyNode for *key*, or None on miss.

        Moves the key to the end (most-recently-used) on hit.
        Version mismatch is treated as a miss.
        """
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats.misses += 1
                return None
            if entry.version != self._version:
                # Stale entry — remove and treat as miss
                del self._cache[key]
                self._stats.misses += 1
                self._stats.current_size = len(self._cache)
                return None
            # LRU: move to end
            self._cache.move_to_end(key)
            self._stats.hits += 1
            return entry.node

    def put(self, key: str, node: "StrategyNode") -> None:
        """
        Store *node* under *key*.

        Evicts the least-recently-used entry when maxsize is exceeded.
        """
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._cache[key] = _CacheEntry(node=node, version=self._version)
            else:
                if len(self._cache) >= self._maxsize:
                    self._cache.popitem(last=False)  # evict LRU
                    self._stats.evictions += 1
                self._cache[key] = _CacheEntry(node=node, version=self._version)
            self._stats.current_size = len(self._cache)

    def invalidate(self, key: str | None = None) -> int:
        """
        Remove *key* from cache, or clear all entries if key is None.
        Returns the number of entries removed.
        """
        with self._lock:
            if key is None:
                count = len(self._cache)
                self._cache.clear()
                self._stats.invalidations += count
                self._stats.current_size = 0
                return count
            if key in self._cache:
                del self._cache[key]
                self._stats.invalidations += 1
                self._stats.current_size = len(self._cache)
                return 1
            return 0

    def bump_version(self, version: str) -> None:
        """
        Bump the cache version string.

        All existing entries will be treated as stale on their next access
        (lazy invalidation — no immediate eviction).
        """
        with self._lock:
            self._version = version
            self._stats.version = version

    def stats(self) -> CacheStats:
        with self._lock:
            # Return a shallow copy to avoid race on the dataclass fields
            return CacheStats(
                hits=self._stats.hits,
                misses=self._stats.misses,
                evictions=self._stats.evictions,
                invalidations=self._stats.invalidations,
                current_size=self._stats.current_size,
                maxsize=self._stats.maxsize,
                version=self._version,
            )

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)

    def __contains__(self, key: str) -> bool:
        with self._lock:
            entry = self._cache.get(key)
            return entry is not None and entry.version == self._version
