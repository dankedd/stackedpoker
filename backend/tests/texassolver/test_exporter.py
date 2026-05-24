"""Tests for TexasSolver exporter — synthetic output and end-to-end."""

import json
import pytest

from app.texassolver.config import SolverConfig
from app.texassolver.exporter import (
    _build_action_distribution,
    _synthetic_frequencies,
    generate_synthetic_output,
)


class TestSyntheticFrequencies:
    def test_a_high_dry_ip_bets_more(self):
        bet, check = _synthetic_frequencies("A_HIGH_DRY", is_ip=True)
        assert bet > 0.60  # IP should bet heavily on A-high dry
        assert bet + check == pytest.approx(1.0, abs=0.01)

    def test_monotone_checks_more(self):
        bet, check = _synthetic_frequencies("MONOTONE", is_ip=True)
        assert check > bet  # monotone → check more

    def test_oop_bets_less_than_ip(self):
        ip_bet, _ = _synthetic_frequencies("A_HIGH_DRY", is_ip=True)
        oop_bet, _ = _synthetic_frequencies("A_HIGH_DRY", is_ip=False)
        assert oop_bet < ip_bet

    def test_all_board_classes_sum_to_one(self):
        board_classes = [
            "A_HIGH_DRY", "A_HIGH_WET", "K_HIGH_DRY", "K_HIGH_WET",
            "LOW_CONNECTED", "LOW_DYNAMIC", "MIDDLE_CONNECTED",
            "DOUBLE_BROADWAY", "TRIPLE_BROADWAY", "PAIRED_LOW",
            "PAIRED_HIGH", "MONOTONE", "RAINBOW_STATIC",
            "RAINBOW_DYNAMIC", "NEUTRAL",
        ]
        for bc in board_classes:
            for is_ip in (True, False):
                bet, check = _synthetic_frequencies(bc, is_ip=is_ip)
                assert bet + check == pytest.approx(1.0, abs=0.01), f"{bc} ip={is_ip}"

    def test_unknown_board_class_defaults(self):
        bet, check = _synthetic_frequencies("NONEXISTENT", is_ip=True)
        assert bet == 0.50
        assert check == 0.50


class TestBuildActionDistribution:
    def test_basic_distribution(self):
        actions, strategy = _build_action_distribution([0.33, 0.75], 0.60, 0.40)
        assert actions[0] == "CHECK"
        assert len(actions) == 3  # CHECK + 2 bets
        assert sum(strategy) == pytest.approx(1.0, abs=0.01)

    def test_empty_bet_sizes(self):
        actions, strategy = _build_action_distribution([], 0.60, 0.40)
        assert actions == ["CHECK"]
        assert strategy == [0.40]

    def test_action_names_format(self):
        actions, _ = _build_action_distribution([0.33, 0.5, 1.0], 0.50, 0.50)
        assert "BET 33" in actions
        assert "BET 50" in actions
        assert "BET 100" in actions


class TestGenerateSyntheticOutput:
    def test_creates_file(self, tmp_path):
        config = SolverConfig(board=["Ah", "7d", "2c"])
        path = generate_synthetic_output(config, tmp_path / "output.json")
        assert path.exists()

    def test_valid_json(self, tmp_path):
        config = SolverConfig(board=["Ah", "7d", "2c"])
        path = generate_synthetic_output(config, tmp_path / "output.json")
        data = json.loads(path.read_text())
        assert "ip_strategy" in data
        assert "oop_strategy" in data
        assert "meta" in data

    def test_ip_strategy_structure(self, tmp_path):
        config = SolverConfig()
        path = generate_synthetic_output(config, tmp_path / "output.json")
        data = json.loads(path.read_text())

        ip = data["ip_strategy"]
        assert "actions" in ip
        assert "strategy" in ip
        assert len(ip["actions"]) == len(ip["strategy"])

    def test_frequencies_sum_to_one(self, tmp_path):
        config = SolverConfig()
        path = generate_synthetic_output(config, tmp_path / "output.json")
        data = json.loads(path.read_text())

        for key in ("ip_strategy", "oop_strategy"):
            total = sum(data[key]["strategy"])
            assert total == pytest.approx(1.0, abs=0.01), f"{key} sums to {total}"

    def test_meta_contains_board(self, tmp_path):
        config = SolverConfig(board=["Kh", "Qd", "3c"])
        path = generate_synthetic_output(config, tmp_path / "output.json")
        data = json.loads(path.read_text())
        assert data["meta"]["board"] == "Kh Qd 3c"

    def test_creates_parent_dirs(self, tmp_path):
        config = SolverConfig()
        path = generate_synthetic_output(
            config, tmp_path / "deep" / "nested" / "output.json",
        )
        assert path.exists()
