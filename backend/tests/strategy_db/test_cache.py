"""Tests for StrategyCache — LRU eviction, version invalidation, stats."""

from __future__ import annotations

import pytest

from app.strategy_db.cache import StrategyCache
from app.strategy_db.models import StrategyNode


def _make_node(key: str, is_ip: bool = True) -> StrategyNode:
    return StrategyNode(
        node_key=key,
        spot_type="SRP", board_class="A_HIGH_DRY",
        spr_bucket="8_PLUS", stack_depth_bucket="100bb",
        position_matchup="BTN_vs_BB", street="flop",
        player_count=2, is_ip=is_ip,
        bet_frequency=0.80, check_frequency=0.20,
        primary_sizing="33pct",
        range_advantage=0.78, nut_advantage=0.70,
        pressure_score=0.60, volatility_score=0.20,
        equity_realization=0.82,
        rationale="test",
        source="handcrafted", version="1.0",
    )


_KEY_A = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p::ip"
_KEY_B = "SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p::ip"
_KEY_C = "SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p::ip"


class TestBasicOperations:
    def test_miss_on_empty_cache(self):
        c = StrategyCache()
        assert c.get(_KEY_A) is None

    def test_put_then_get(self):
        c = StrategyCache()
        node = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p")
        c.put(_KEY_A, node)
        result = c.get(_KEY_A)
        assert result is node

    def test_miss_returns_none(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"))
        assert c.get(_KEY_B) is None

    def test_overwrite_same_key(self):
        c = StrategyCache()
        n1 = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p")
        n2 = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p")
        c.put(_KEY_A, n1)
        c.put(_KEY_A, n2)
        assert c.get(_KEY_A) is n2


class TestLRUEviction:
    def test_lru_eviction(self):
        c = StrategyCache(maxsize=2)
        na = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p")
        nb = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p")
        nc = _make_node("SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p")
        c.put(_KEY_A, na)
        c.put(_KEY_B, nb)
        # Access _KEY_A to make it most recently used
        c.get(_KEY_A)
        # Add _KEY_C → should evict _KEY_B (LRU)
        c.put(_KEY_C, nc)
        assert c.get(_KEY_A) is na   # still present
        assert c.get(_KEY_B) is None # evicted
        assert c.get(_KEY_C) is nc   # newly added

    def test_eviction_stats_tracked(self):
        c = StrategyCache(maxsize=1)
        c.put(_KEY_A, _make_node("k1"))
        c.put(_KEY_B, _make_node("k2"))  # evicts KEY_A
        assert c.stats().evictions == 1

    def test_maxsize_respected(self):
        c = StrategyCache(maxsize=3)
        keys = [_KEY_A, _KEY_B, _KEY_C]
        for k in keys:
            c.put(k, _make_node("k"))
        assert len(c) == 3
        c.put("extra::key", _make_node("k"))
        assert len(c) == 3


class TestVersionInvalidation:
    def test_version_mismatch_is_miss(self):
        c = StrategyCache(version="1.0")
        c.put(_KEY_A, _make_node("k"))
        c.bump_version("2.0")
        assert c.get(_KEY_A) is None

    def test_new_puts_after_bump_are_valid(self):
        c = StrategyCache(version="1.0")
        c.bump_version("2.0")
        node = _make_node("k")
        c.put(_KEY_A, node)
        assert c.get(_KEY_A) is node

    def test_version_in_stats(self):
        c = StrategyCache(version="1.0")
        c.bump_version("3.0")
        assert c.stats().version == "3.0"


class TestInvalidate:
    def test_invalidate_specific_key(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        removed = c.invalidate(_KEY_A)
        assert removed == 1
        assert c.get(_KEY_A) is None

    def test_invalidate_missing_key_returns_zero(self):
        c = StrategyCache()
        assert c.invalidate(_KEY_B) == 0

    def test_invalidate_all(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        c.put(_KEY_B, _make_node("k"))
        removed = c.invalidate(None)
        assert removed == 2
        assert len(c) == 0

    def test_invalidation_stats_tracked(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        c.invalidate(_KEY_A)
        assert c.stats().invalidations == 1


class TestStats:
    def test_hit_rate_zero_on_empty(self):
        c = StrategyCache()
        assert c.stats().hit_rate == 0.0

    def test_hit_rate_one_on_all_hits(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        c.get(_KEY_A)
        c.get(_KEY_A)
        s = c.stats()
        assert s.hit_rate == pytest.approx(1.0)

    def test_hit_miss_counts(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        c.get(_KEY_A)   # hit
        c.get(_KEY_B)   # miss
        c.get(_KEY_C)   # miss
        s = c.stats()
        assert s.hits == 1
        assert s.misses == 2

    def test_contains(self):
        c = StrategyCache()
        c.put(_KEY_A, _make_node("k"))
        assert _KEY_A in c
        assert _KEY_B not in c
