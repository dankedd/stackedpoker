"""
Tests for StrategyStore — register, exact lookup, similarity search,
JSON persistence, and seed loading.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from app.strategy_db.models import StrategyNode
from app.strategy_db.storage import StrategyStore


def _make_node(
    spot_type="SRP",
    board_class="A_HIGH_DRY",
    spr="8_PLUS",
    matchup="BTN_vs_BB",
    is_ip=True,
    street="flop",
) -> StrategyNode:
    key = f"{spot_type}::{matchup}::100bb::{spr}::{board_class}::{street}::2p"
    return StrategyNode(
        node_key=key,
        spot_type=spot_type,
        board_class=board_class,
        spr_bucket=spr,
        stack_depth_bucket="100bb",
        position_matchup=matchup,
        street=street,
        player_count=2,
        is_ip=is_ip,
        bet_frequency=0.80,
        check_frequency=0.20,
        primary_sizing="33pct",
        range_advantage=0.78,
        nut_advantage=0.70,
        pressure_score=0.60,
        volatility_score=0.20,
        equity_realization=0.82,
        rationale="test",
        source="handcrafted",
        version="1.0",
    )


@pytest.fixture
def empty_store():
    """StrategyStore with seeding disabled for controlled testing."""
    return StrategyStore(seed_on_init=False)


class TestRegisterAndGet:
    def test_register_and_exact_get(self, empty_store):
        node = _make_node()
        empty_store.register_strategy(node)
        retrieved = empty_store.get_by_node_key(node.node_key, is_ip=True)
        assert retrieved is not None
        assert retrieved.node_key == node.node_key

    def test_wrong_is_ip_returns_none(self, empty_store):
        node = _make_node(is_ip=True)
        empty_store.register_strategy(node)
        assert empty_store.get_by_node_key(node.node_key, is_ip=False) is None

    def test_overwrite_same_key(self, empty_store):
        node1 = _make_node(board_class="A_HIGH_DRY")
        node2 = _make_node(board_class="A_HIGH_DRY")
        node2.bet_frequency = 0.50  # changed value
        empty_store.register_strategy(node1)
        empty_store.register_strategy(node2)
        assert empty_store.count() == 1  # no duplicate
        result = empty_store.get_by_node_key(node1.node_key, is_ip=True)
        assert result.bet_frequency == 0.50

    def test_count_increments(self, empty_store):
        assert empty_store.count() == 0
        empty_store.register_strategy(_make_node())
        assert empty_store.count() == 1
        empty_store.register_strategy(_make_node(board_class="K_HIGH_DRY"))
        assert empty_store.count() == 2

    def test_ip_and_oop_stored_separately(self, empty_store):
        node_ip  = _make_node(is_ip=True)
        node_oop = _make_node(is_ip=False)
        empty_store.register_strategy(node_ip)
        empty_store.register_strategy(node_oop)
        assert empty_store.count() == 2
        assert empty_store.get_by_node_key(node_ip.node_key, is_ip=True) is not None
        assert empty_store.get_by_node_key(node_oop.node_key, is_ip=False) is not None


class TestSearchSimilar:
    def _populated_store(self) -> StrategyStore:
        store = StrategyStore(seed_on_init=False)
        for board in ["A_HIGH_DRY", "K_HIGH_DRY", "LOW_DYNAMIC", "MONOTONE"]:
            store.register_strategy(_make_node(board_class=board))
        return store

    def test_returns_list(self):
        store = self._populated_store()
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_WET::flop::2p"
        results = store.search_similar(key, is_ip=True)
        assert isinstance(results, list)

    def test_scores_in_range(self):
        store = self._populated_store()
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_WET::flop::2p"
        results = store.search_similar(key, is_ip=True)
        for node, score in results:
            assert 0.0 <= score <= 1.0

    def test_results_sorted_descending(self):
        store = self._populated_store()
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_WET::flop::2p"
        results = store.search_similar(key, is_ip=True)
        scores = [s for _, s in results]
        assert scores == sorted(scores, reverse=True)

    def test_dry_boards_rank_above_low_dynamic(self):
        store = self._populated_store()
        # Searching for A_HIGH_DRY equivalent: dry boards should rank higher
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::RAINBOW_STATIC::flop::2p"
        results = store.search_similar(key, is_ip=True, top_k=4)
        board_classes = [n.board_class for n, _ in results]
        # A_HIGH_DRY and K_HIGH_DRY (same group as RAINBOW_STATIC) should come first
        assert board_classes[0] in ("A_HIGH_DRY", "K_HIGH_DRY")

    def test_min_score_filter(self):
        store = self._populated_store()
        key = "3BET::CO_vs_BB::100bb::0_2::LOW_DYNAMIC::turn::2p"  # very different
        results = store.search_similar(key, is_ip=True, min_score=0.99)
        assert results == []  # nothing that close

    def test_top_k_limits_results(self):
        store = self._populated_store()
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
        results = store.search_similar(key, is_ip=True, top_k=2)
        assert len(results) <= 2

    def test_invalid_key_returns_empty(self):
        store = self._populated_store()
        results = store.search_similar("invalid", is_ip=True)
        assert results == []


class TestSeedLoading:
    def test_seeded_store_has_nodes(self):
        store = StrategyStore(seed_on_init=True)
        assert store.count() >= 500  # expect 1632 seeds

    def test_seeded_store_can_exact_lookup(self):
        store = StrategyStore(seed_on_init=True)
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
        node = store.get_by_node_key(key, is_ip=True)
        assert node is not None
        assert node.spot_type == "SRP"
        assert node.board_class == "A_HIGH_DRY"

    def test_preload_is_idempotent(self):
        store = StrategyStore(seed_on_init=False)
        n1 = store.preload_seed_profiles()
        n2 = store.preload_seed_profiles()
        # Node count doesn't double (overwrite semantics)
        assert store.count() == n1

    def test_index_stats_populated(self):
        store = StrategyStore(seed_on_init=True)
        stats = store.index_stats()
        assert stats["total"] >= 500
        assert "SRP" in stats["by_spot_type"]


class TestJSONPersistence:
    def test_save_and_reload(self, empty_store, tmp_path):
        for board in ["A_HIGH_DRY", "K_HIGH_DRY", "LOW_DYNAMIC"]:
            empty_store.register_strategy(_make_node(board_class=board))

        path = tmp_path / "strategy.json"
        saved = empty_store.save_to_json(path)
        assert saved == 3

        store2 = StrategyStore(seed_on_init=False)
        loaded = store2.load_from_json(path)
        assert loaded == 3

        for board in ["A_HIGH_DRY", "K_HIGH_DRY", "LOW_DYNAMIC"]:
            node = store2.get_by_node_key(
                f"SRP::BTN_vs_BB::100bb::8_PLUS::{board}::flop::2p", is_ip=True
            )
            assert node is not None

    def test_json_file_is_valid_json(self, empty_store, tmp_path):
        empty_store.register_strategy(_make_node())
        path = tmp_path / "strategy.json"
        empty_store.save_to_json(path)
        with open(path) as f:
            data = json.load(f)
        assert "nodes" in data
        assert len(data["nodes"]) == 1

    def test_load_ignores_bad_nodes(self, tmp_path):
        payload = {
            "version": "1.0",
            "nodes": [
                {"bad": "data"},  # missing required fields
                _make_node().to_dict(),
            ],
        }
        path = tmp_path / "mixed.json"
        with open(path, "w") as f:
            json.dump(payload, f)

        store = StrategyStore(seed_on_init=False)
        loaded = store.load_from_json(path)
        assert loaded == 1  # only the valid node

    def test_all_keys_sorted(self, empty_store):
        for board in ["K_HIGH_DRY", "A_HIGH_DRY", "LOW_DYNAMIC"]:
            empty_store.register_strategy(_make_node(board_class=board))
        keys = empty_store.all_keys()
        assert keys == sorted(keys)
