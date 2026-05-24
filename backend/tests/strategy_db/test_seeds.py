"""Tests for the seed generator — coverage, validity, and determinism."""

from __future__ import annotations

import pytest

from app.strategy_db.models import StrategyNode
from app.strategy_db.seeds import generate_all_seed_nodes, SEED_VERSION


class TestSeedGeneration:

    @pytest.fixture(scope="class")
    def seeds(self) -> list[StrategyNode]:
        return generate_all_seed_nodes()

    def test_returns_list(self, seeds):
        assert isinstance(seeds, list)

    def test_minimum_count(self, seeds):
        # 6 spot_types × 2 is_ip × 4 SPRs × 17 boards × 2 streets = 1632
        assert len(seeds) >= 1000, f"Expected ≥1000 seeds, got {len(seeds)}"

    def test_exact_count(self, seeds):
        # 6 × 2 × 4 × 17 × 2 = 1632
        assert len(seeds) == 1632

    def test_all_are_strategy_nodes(self, seeds):
        for node in seeds:
            assert isinstance(node, StrategyNode)

    def test_all_have_source_handcrafted(self, seeds):
        for node in seeds:
            assert node.source == "handcrafted"

    def test_all_have_version(self, seeds):
        for node in seeds:
            assert node.version == SEED_VERSION

    def test_all_frequencies_valid(self, seeds):
        for node in seeds:
            assert 0.0 <= node.bet_frequency <= 1.0
            assert 0.0 <= node.check_frequency <= 1.0
            assert abs(node.bet_frequency + node.check_frequency - 1.0) < 1e-9, \
                f"Frequencies don't sum to 1 for {node.node_key}"

    def test_all_signals_in_range(self, seeds):
        fields = [
            "range_advantage", "nut_advantage",
            "pressure_score", "volatility_score", "equity_realization",
        ]
        for node in seeds:
            for f in fields:
                v = getattr(node, f)
                assert 0.0 <= v <= 1.0, \
                    f"{f}={v} out of range for {node.node_key}"

    def test_all_node_keys_have_correct_format(self, seeds):
        from app.strategy_db.similarity import parse_node_key
        for node in seeds:
            dims = parse_node_key(node.node_key)
            assert dims["spot_type"] == node.spot_type
            assert dims["board_class"] == node.board_class
            assert dims["spr_bucket"] == node.spr_bucket

    def test_no_duplicate_extended_keys(self, seeds):
        ek_set = {node.extended_key for node in seeds}
        assert len(ek_set) == len(seeds), "Duplicate extended_keys in seed set"

    def test_all_board_classes_covered(self, seeds):
        from app.solver.enums import BoardClassEnum
        board_classes = {node.board_class for node in seeds}
        for bc in BoardClassEnum:
            assert bc.value in board_classes, f"{bc.value} missing from seeds"

    def test_all_spot_types_covered(self, seeds):
        expected = {"SRP", "3BET", "4BET", "LIMPED", "SQUEEZE", "ISO_RAISE"}
        actual = {node.spot_type for node in seeds}
        assert expected.issubset(actual)

    def test_both_ip_and_oop_covered(self, seeds):
        ip_nodes  = [n for n in seeds if n.is_ip is True]
        oop_nodes = [n for n in seeds if n.is_ip is False]
        assert len(ip_nodes) > 0
        assert len(oop_nodes) > 0
        assert len(ip_nodes) == len(oop_nodes)

    def test_all_spr_buckets_covered(self, seeds):
        expected = {"0_2", "2_4", "4_8", "8_PLUS"}
        actual = {node.spr_bucket for node in seeds}
        assert expected == actual

    def test_flop_and_turn_covered(self, seeds):
        streets = {node.street for node in seeds}
        assert "flop" in streets
        assert "turn" in streets

    def test_deterministic(self):
        seeds1 = generate_all_seed_nodes()
        seeds2 = generate_all_seed_nodes()
        assert len(seeds1) == len(seeds2)
        for n1, n2 in zip(seeds1, seeds2):
            assert n1.node_key == n2.node_key
            assert n1.bet_frequency == n2.bet_frequency

    def test_srp_ip_dry_has_high_bet_freq(self, seeds):
        srp_ip_dry = [
            n for n in seeds
            if n.spot_type == "SRP" and n.is_ip
            and n.board_class == "A_HIGH_DRY" and n.spr_bucket == "8_PLUS"
        ]
        assert srp_ip_dry
        node = srp_ip_dry[0]
        assert node.bet_frequency >= 0.70, \
            f"SRP IP A_HIGH_DRY bet_freq too low: {node.bet_frequency}"

    def test_srp_ip_low_dynamic_has_low_bet_freq(self, seeds):
        srp_ip_low = [
            n for n in seeds
            if n.spot_type == "SRP" and n.is_ip
            and n.board_class == "LOW_DYNAMIC" and n.spr_bucket == "8_PLUS"
        ]
        assert srp_ip_low
        node = srp_ip_low[0]
        assert node.bet_frequency <= 0.45, \
            f"SRP IP LOW_DYNAMIC bet_freq too high: {node.bet_frequency}"

    def test_3bet_higher_bet_freq_than_srp(self, seeds):
        def _avg(spot, board="A_HIGH_DRY", spr="8_PLUS", street="flop"):
            ns = [
                n for n in seeds
                if n.spot_type == spot and n.is_ip
                and n.board_class == board and n.spr_bucket == spr and n.street == street
            ]
            return sum(n.bet_frequency for n in ns) / len(ns) if ns else 0.0

        assert _avg("3BET") > _avg("SRP")

    def test_low_spr_higher_pressure_than_high_spr(self, seeds):
        def _pressure(spot, spr, board="A_HIGH_DRY", street="flop"):
            ns = [
                n for n in seeds
                if n.spot_type == spot and n.is_ip
                and n.board_class == board and n.spr_bucket == spr and n.street == street
            ]
            return ns[0].pressure_score if ns else 0.0

        p_low  = _pressure("SRP", "0_2")
        p_high = _pressure("SRP", "8_PLUS")
        assert p_low > p_high

    def test_rationale_nonempty(self, seeds):
        for node in seeds:
            assert len(node.rationale) > 5, \
                f"Empty rationale for {node.node_key}"
