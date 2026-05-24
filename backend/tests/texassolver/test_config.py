"""Tests for SolverConfig model."""

import pytest

from app.texassolver.config import SolverConfig


class TestSolverConfigDefaults:
    def test_default_values(self):
        config = SolverConfig()
        assert config.spot_type == "SRP"
        assert config.positions == "BTN_vs_BB"
        assert config.stack_depth == 100
        assert config.board == ["Ah", "7d", "2c"]
        assert config.iterations == 1000
        assert config.accuracy_target == 0.5
        assert config.rake is None
        assert config.solver_path is None

    def test_default_validates(self):
        config = SolverConfig()
        assert config.validate() == []


class TestSolverConfigDerived:
    def test_pot_size_srp(self):
        config = SolverConfig(spot_type="SRP")
        assert config.pot_size_bb() == 6.5

    def test_pot_size_3bet(self):
        config = SolverConfig(spot_type="3BET")
        assert config.pot_size_bb() == 22.0

    def test_pot_size_4bet(self):
        config = SolverConfig(spot_type="4BET")
        assert config.pot_size_bb() == 48.0

    def test_effective_stack(self):
        config = SolverConfig(spot_type="SRP", stack_depth=100)
        # 100 - 6.5/2 = 96.75
        assert config.effective_stack_chips() == 96.75

    def test_spr(self):
        config = SolverConfig(spot_type="SRP", stack_depth=100)
        spr = config.spr()
        # 96.75 / 6.5 ≈ 14.88
        assert spr > 14.0
        assert spr < 16.0

    def test_ip_position(self):
        config = SolverConfig(positions="BTN_vs_BB")
        assert config.ip_position() == "BTN"

    def test_oop_position(self):
        config = SolverConfig(positions="BTN_vs_BB")
        assert config.oop_position() == "BB"

    def test_board_string(self):
        config = SolverConfig(board=["Ah", "7d", "2c"])
        assert config.board_string() == "Ah 7d 2c"


class TestSolverConfigValidation:
    def test_valid_config(self):
        config = SolverConfig()
        assert config.validate() == []

    def test_invalid_board_size(self):
        config = SolverConfig(board=["Ah", "7d"])
        errors = config.validate()
        assert len(errors) == 1
        assert "Board must have 3-5 cards" in errors[0]

    def test_invalid_stack_depth(self):
        config = SolverConfig(stack_depth=5)
        errors = config.validate()
        assert any("Stack depth" in e for e in errors)

    def test_invalid_iterations(self):
        config = SolverConfig(iterations=0)
        errors = config.validate()
        assert any("Iterations" in e for e in errors)

    def test_invalid_accuracy(self):
        config = SolverConfig(accuracy_target=-1.0)
        errors = config.validate()
        assert any("Accuracy" in e for e in errors)

    def test_invalid_positions_format(self):
        config = SolverConfig(positions="BTNBB")
        errors = config.validate()
        assert any("IP_vs_OOP" in e for e in errors)

    def test_empty_bet_sizes(self):
        config = SolverConfig(bet_sizes=[])
        errors = config.validate()
        assert any("bet size" in e for e in errors)

    def test_multiple_errors(self):
        config = SolverConfig(board=["Ah"], stack_depth=1, iterations=0)
        errors = config.validate()
        assert len(errors) >= 3
