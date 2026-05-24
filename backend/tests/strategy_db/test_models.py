"""Tests for StrategyNode serialisation, equality, and hashing."""

from __future__ import annotations

import json

import pytest

from app.strategy_db.models import StrategyNode, _extended_key


def _make_node(**overrides) -> StrategyNode:
    defaults = dict(
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p",
        spot_type="SRP",
        board_class="A_HIGH_DRY",
        spr_bucket="8_PLUS",
        stack_depth_bucket="100bb",
        position_matchup="BTN_vs_BB",
        street="flop",
        player_count=2,
        is_ip=True,
        bet_frequency=0.80,
        check_frequency=0.20,
        primary_sizing="33pct",
        range_advantage=0.78,
        nut_advantage=0.70,
        pressure_score=0.60,
        volatility_score=0.20,
        equity_realization=0.82,
        rationale="Test rationale",
        source="handcrafted",
        version="1.0",
    )
    defaults.update(overrides)
    return StrategyNode(**defaults)


class TestExtendedKey:
    def test_ip_suffix(self):
        assert _extended_key("SRP::BTN_vs_BB::100bb::8_PLUS::A::flop::2p", True).endswith("::ip")

    def test_oop_suffix(self):
        assert _extended_key("SRP::BTN_vs_BB::100bb::8_PLUS::A::flop::2p", False).endswith("::oop")

    def test_prefix_preserved(self):
        k = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
        assert _extended_key(k, True).startswith(k)


class TestStrategyNodeProperty:
    def test_extended_key_ip(self):
        node = _make_node(is_ip=True)
        assert node.extended_key.endswith("::ip")

    def test_extended_key_oop(self):
        node = _make_node(is_ip=False)
        assert node.extended_key.endswith("::oop")


class TestSerialisation:
    def test_to_dict_round_trip(self):
        node = _make_node()
        d = node.to_dict()
        restored = StrategyNode.from_dict(d)
        assert restored == node

    def test_to_json_round_trip(self):
        node = _make_node()
        s = node.to_json()
        restored = StrategyNode.from_json(s)
        assert restored.node_key == node.node_key
        assert restored.bet_frequency == node.bet_frequency

    def test_from_dict_ignores_extra_keys(self):
        node = _make_node()
        d = node.to_dict()
        d["future_field"] = "should be ignored"
        # should not raise
        restored = StrategyNode.from_dict(d)
        assert restored.node_key == node.node_key

    def test_json_is_valid_json(self):
        node = _make_node()
        parsed = json.loads(node.to_json())
        assert isinstance(parsed, dict)
        assert parsed["node_key"] == node.node_key

    def test_primary_sizing_none_serialises(self):
        node = _make_node(primary_sizing=None)
        d = node.to_dict()
        assert d["primary_sizing"] is None
        restored = StrategyNode.from_dict(d)
        assert restored.primary_sizing is None


class TestEqualityAndHashing:
    def test_equal_nodes(self):
        a = _make_node()
        b = _make_node()
        assert a == b

    def test_different_is_ip_not_equal(self):
        a = _make_node(is_ip=True)
        b = _make_node(is_ip=False)
        assert a != b

    def test_different_node_key_not_equal(self):
        a = _make_node(node_key="SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p")
        b = _make_node(node_key="SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p",
                       board_class="K_HIGH_DRY")
        assert a != b

    def test_hashable_in_set(self):
        a = _make_node()
        b = _make_node()
        s = {a, b}
        assert len(s) == 1

    def test_hashable_as_dict_key(self):
        node = _make_node()
        d = {node: "value"}
        assert d[node] == "value"

    def test_repr(self):
        node = _make_node()
        r = repr(node)
        assert "StrategyNode" in r
        assert "ip" in r
