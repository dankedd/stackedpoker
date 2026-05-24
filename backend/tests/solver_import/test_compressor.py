"""Tests for the compressor — RawSolverNode → StrategyNode."""

from __future__ import annotations

import pytest

from app.solver_import.models import RawSolverNode, RawAction, RawComboEntry
from app.solver_import.compressor import compress_solver_node
from app.strategy_db.models import StrategyNode

_NODE_KEY = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_node(actions=None, combos=None) -> RawSolverNode:
    node = RawSolverNode(
        node_id="1",
        board="Ah Kc 7d",
        position="BTN",
        pot_chips=6.5,
        stack_chips=96.75,
        street="flop",
        spot_type="SRP",
    )
    node.actions = actions or [
        RawAction("bet_33pct", 0.72),
        RawAction("check", 0.28),
    ]
    node.combos = combos or []
    return node


def _make_combo(combo: str, equity: float, bet_freq: float, check_freq: float) -> RawComboEntry:
    entry = RawComboEntry(combo=combo, equity=equity)
    entry.actions = [
        RawAction("bet_33pct", bet_freq),
        RawAction("check", check_freq),
    ]
    return entry


# ── Return type and required fields ──────────────────────────────────────────

class TestCompressReturnType:
    def test_returns_strategy_node(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert isinstance(result, StrategyNode)

    def test_source_is_gto_plus(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.source == "gto_plus"

    def test_node_key_set(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.node_key == _NODE_KEY

    def test_is_ip_set(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.is_ip is True
        result2 = compress_solver_node(node, _NODE_KEY, is_ip=False)
        assert result2.is_ip is False

    def test_identity_fields_parsed_from_key(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.spot_type == "SRP"
        assert result.position_matchup == "BTN_vs_BB"
        assert result.stack_depth_bucket == "100bb"
        assert result.spr_bucket == "8_PLUS"
        assert result.board_class == "A_HIGH_DRY"
        assert result.street == "flop"
        assert result.player_count == 2


# ── Frequency computation ─────────────────────────────────────────────────────

class TestFrequencies:
    def test_bet_frequency_extracted(self):
        node = _make_node(actions=[RawAction("bet_33pct", 0.72), RawAction("check", 0.28)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.bet_frequency == pytest.approx(0.72, abs=0.01)

    def test_check_frequency_extracted(self):
        node = _make_node(actions=[RawAction("bet_33pct", 0.72), RawAction("check", 0.28)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.check_frequency == pytest.approx(0.28, abs=0.01)

    def test_frequencies_sum_to_one(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert abs(result.bet_frequency + result.check_frequency - 1.0) < 1e-6

    def test_pure_check_node(self):
        node = _make_node(actions=[RawAction("check", 1.0)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.bet_frequency == pytest.approx(0.0, abs=0.01)
        assert result.check_frequency == pytest.approx(1.0, abs=0.01)

    def test_multiple_bet_sizes_summed(self):
        node = _make_node(actions=[
            RawAction("bet_33pct", 0.40),
            RawAction("bet_75pct", 0.30),
            RawAction("check", 0.30),
        ])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.bet_frequency == pytest.approx(0.70, abs=0.01)

    def test_frequencies_clamped(self):
        node = _make_node(actions=[RawAction("bet_33pct", 1.05), RawAction("check", 0.0)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert 0.0 <= result.bet_frequency <= 1.0
        assert 0.0 <= result.check_frequency <= 1.0


# ── Primary sizing ────────────────────────────────────────────────────────────

class TestPrimarySizing:
    def test_bet_33pct_sizing(self):
        node = _make_node(actions=[RawAction("bet_33pct", 0.72), RawAction("check", 0.28)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.primary_sizing == "bet_33pct"

    def test_largest_bet_wins_when_multiple(self):
        node = _make_node(actions=[
            RawAction("bet_33pct", 0.40),
            RawAction("bet_75pct", 0.50),  # higher frequency
            RawAction("check", 0.10),
        ])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.primary_sizing == "bet_75pct"

    def test_check_only_sizing_is_none(self):
        node = _make_node(actions=[RawAction("check", 1.0)])
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert result.primary_sizing is None


# ── Signal estimation ─────────────────────────────────────────────────────────

class TestSignals:
    def test_all_signals_in_range(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        for field in ["range_advantage", "nut_advantage", "pressure_score",
                      "volatility_score", "equity_realization"]:
            v = getattr(result, field)
            assert 0.0 <= v <= 1.0, f"{field}={v} out of range"

    def test_high_bet_freq_implies_range_advantage(self):
        high_bet = _make_node(actions=[RawAction("bet_33pct", 0.90), RawAction("check", 0.10)])
        low_bet  = _make_node(actions=[RawAction("bet_33pct", 0.20), RawAction("check", 0.80)])
        r_high = compress_solver_node(high_bet, _NODE_KEY, is_ip=True)
        r_low  = compress_solver_node(low_bet, _NODE_KEY, is_ip=True)
        assert r_high.range_advantage > r_low.range_advantage

    def test_combo_equity_improves_range_advantage(self):
        combos = [
            _make_combo("AsKs", equity=0.85, bet_freq=1.0, check_freq=0.0),
            _make_combo("6s5s", equity=0.30, bet_freq=0.2, check_freq=0.8),
        ]
        node_with = _make_node(combos=combos)
        node_without = _make_node()
        r_with    = compress_solver_node(node_with, _NODE_KEY, is_ip=True)
        r_without = compress_solver_node(node_without, _NODE_KEY, is_ip=True)
        # With combo data, range_advantage should reflect actual equity
        assert 0.0 <= r_with.range_advantage <= 1.0
        assert r_with.range_advantage != r_without.range_advantage  # different path

    def test_rationale_nonempty(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert len(result.rationale) > 10

    def test_rationale_mentions_bet_frequency(self):
        node = _make_node()
        result = compress_solver_node(node, _NODE_KEY, is_ip=True)
        assert "bet" in result.rationale.lower()
