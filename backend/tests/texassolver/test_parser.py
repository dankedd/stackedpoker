"""Tests for TexasSolver output parser."""

import json
import pytest
from pathlib import Path

from app.solver_import.models import RawSolverNode
from app.texassolver.config import SolverConfig
from app.texassolver.parser import (
    _normalize_action_name,
    parse_texassolver_output,
)


class TestActionNormalization:
    def test_check(self):
        assert _normalize_action_name("CHECK") == "check"

    def test_call(self):
        assert _normalize_action_name("CALL") == "call"

    def test_fold(self):
        assert _normalize_action_name("FOLD") == "fold"

    def test_allin(self):
        assert _normalize_action_name("ALLIN") == "bet_allin"

    def test_bet_33(self):
        assert _normalize_action_name("BET 33") == "bet_33pct"

    def test_bet_50(self):
        assert _normalize_action_name("BET 50") == "bet_50pct"

    def test_bet_75(self):
        assert _normalize_action_name("BET 75") == "bet_75pct"

    def test_bet_100(self):
        assert _normalize_action_name("BET 100") == "bet_100pct"

    def test_raise_50(self):
        assert _normalize_action_name("RAISE 50") == "raise_50pct"

    def test_case_insensitive(self):
        assert _normalize_action_name("check") == "check"
        assert _normalize_action_name("Check") == "check"

    def test_whitespace_handling(self):
        assert _normalize_action_name("  BET 33  ") == "bet_33pct"

    def test_bet_with_decimal(self):
        """v0.2.0 uses decimal bet sizes like BET 96.000000."""
        assert _normalize_action_name("BET 96.000000") == "bet_96pct"

    def test_bet_with_small_decimal(self):
        assert _normalize_action_name("BET 3.250000") == "bet_3pct"


# ── v0.2.0 game tree format tests ────────────────────────────────────────


class TestParseV020GameTree:
    """Tests for TexasSolver v0.2.0 game tree output format."""

    @pytest.fixture
    def config(self):
        return SolverConfig(
            spot_type="SRP",
            positions="BTN_vs_BB",
            stack_depth=100,
            board=["Ah", "7d", "2c"],
        )

    @pytest.fixture
    def v020_output(self, tmp_path):
        """Create a v0.2.0 game tree output file."""
        data = {
            "actions": ["CHECK", "BET 96.000000"],
            "childrens": {
                "BET 96.000000": {
                    "actions": ["CALL", "FOLD"],
                    "childrens": {"CALL": {"deal_number": 0, "node_type": "chance_node"}},
                    "node_type": "action_node",
                    "player": 0,
                    "strategy": {
                        "actions": ["CALL", "FOLD"],
                        "strategy": {
                            "AhKs": [0.5, 0.5],
                            "QdQc": [1.0, 0.0],
                        },
                    },
                },
                "CHECK": {
                    "actions": ["CHECK", "BET 96.000000"],
                    "childrens": {
                        "BET 96.000000": {
                            "actions": ["CALL", "FOLD"],
                            "childrens": {},
                            "node_type": "action_node",
                            "player": 1,
                            "strategy": {
                                "actions": ["CALL", "FOLD"],
                                "strategy": {"AhKs": [0.8, 0.2]},
                            },
                        },
                        "CHECK": {"deal_number": 0, "node_type": "chance_node"},
                    },
                    "node_type": "action_node",
                    "player": 0,
                    "strategy": {
                        "actions": ["CHECK", "BET 96.000000"],
                        "strategy": {
                            "AhKs": [0.3, 0.7],
                            "QdQc": [0.9, 0.1],
                            "JdTd": [0.6, 0.4],
                        },
                    },
                },
            },
            "node_type": "action_node",
            "player": 1,
            "strategy": {
                "actions": ["CHECK", "BET 96.000000"],
                "strategy": {
                    "AhKs": [0.8, 0.2],
                    "QdQc": [0.95, 0.05],
                    "JdTd": [0.7, 0.3],
                    "2h2d": [0.99, 0.01],
                },
            },
        }
        path = tmp_path / "v020_output.json"
        path.write_text(json.dumps(data))
        return path

    def test_parses_two_nodes(self, v020_output, config):
        nodes = parse_texassolver_output(v020_output, config)
        assert len(nodes) == 2

    def test_oop_node_is_root(self, v020_output, config):
        """OOP (player=1) is the root decision node."""
        nodes = parse_texassolver_output(v020_output, config)
        oop = [n for n in nodes if n.position == "BB"][0]
        assert oop.position == "BB"
        assert len(oop.combos) == 4
        assert len(oop.actions) == 2

    def test_ip_node_is_check_child(self, v020_output, config):
        """IP (player=0) should be the CHECK child (main decision), not BET child."""
        nodes = parse_texassolver_output(v020_output, config)
        ip = [n for n in nodes if n.position == "BTN"][0]
        assert ip.position == "BTN"
        # The CHECK child has 3 combos; the BET child has only 2
        assert len(ip.combos) == 3
        action_names = [a.action_name for a in ip.actions]
        assert "check" in action_names
        assert "bet_96pct" in action_names

    def test_aggregate_frequencies_computed(self, v020_output, config):
        """Aggregate frequencies are averages across all combos."""
        nodes = parse_texassolver_output(v020_output, config)
        oop = [n for n in nodes if n.position == "BB"][0]
        # Average of [0.8, 0.95, 0.7, 0.99] = 0.86
        check_freq = [a for a in oop.actions if a.action_name == "check"][0].frequency
        assert abs(check_freq - 0.86) < 0.01

    def test_frequencies_sum_to_one(self, v020_output, config):
        nodes = parse_texassolver_output(v020_output, config)
        for node in nodes:
            total = sum(a.frequency for a in node.actions)
            assert abs(total - 1.0) < 0.01

    def test_nodes_are_valid(self, v020_output, config):
        nodes = parse_texassolver_output(v020_output, config)
        for node in nodes:
            assert node.is_valid()

    def test_pot_and_stack(self, v020_output, config):
        nodes = parse_texassolver_output(v020_output, config)
        for node in nodes:
            assert node.pot_chips == config.pot_size_bb()
            assert node.stack_chips == config.effective_stack_chips()

    def test_combo_actions_preserved(self, v020_output, config):
        nodes = parse_texassolver_output(v020_output, config)
        oop = [n for n in nodes if n.position == "BB"][0]
        ak = [c for c in oop.combos if c.combo == "AhKs"][0]
        assert len(ak.actions) == 2
        assert ak.actions[0].action_name == "check"
        assert ak.actions[0].frequency == 0.8
        assert ak.actions[1].action_name == "bet_96pct"
        assert ak.actions[1].frequency == 0.2


# ── Legacy format tests ──────────────────────────────────────────────────


class TestParseLegacyFormat:
    """Tests for legacy ip_strategy/oop_strategy output format."""

    @pytest.fixture
    def config(self):
        return SolverConfig(
            spot_type="SRP",
            positions="BTN_vs_BB",
            stack_depth=100,
            board=["Ah", "7d", "2c"],
        )

    @pytest.fixture
    def valid_output(self, tmp_path):
        data = {
            "ip_strategy": {
                "actions": ["CHECK", "BET 33", "BET 75"],
                "strategy": [0.30, 0.45, 0.25],
            },
            "oop_strategy": {
                "actions": ["CHECK", "BET 33"],
                "strategy": [0.60, 0.40],
            },
        }
        path = tmp_path / "output.json"
        path.write_text(json.dumps(data))
        return path

    def test_parses_two_nodes(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        assert len(nodes) == 2

    def test_ip_node_properties(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        ip_node = [n for n in nodes if n.position == "BTN"][0]
        assert ip_node.board == "Ah 7d 2c"
        assert ip_node.spot_type == "SRP"
        assert ip_node.street == "flop"
        assert len(ip_node.actions) == 3

    def test_oop_node_properties(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        oop_node = [n for n in nodes if n.position == "BB"][0]
        assert oop_node.position == "BB"
        assert len(oop_node.actions) == 2

    def test_action_names_normalized(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        ip_node = [n for n in nodes if n.position == "BTN"][0]
        action_names = [a.action_name for a in ip_node.actions]
        assert "check" in action_names
        assert "bet_33pct" in action_names
        assert "bet_75pct" in action_names

    def test_frequencies_preserved(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        ip_node = [n for n in nodes if n.position == "BTN"][0]
        check_action = [a for a in ip_node.actions if a.action_name == "check"][0]
        assert check_action.frequency == 0.30

    def test_frequencies_sum_to_one(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        for node in nodes:
            total = sum(a.frequency for a in node.actions)
            assert abs(total - 1.0) < 0.01


# ── Error handling tests ─────────────────────────────────────────────────


class TestParseErrors:
    @pytest.fixture
    def config(self):
        return SolverConfig(board=["Ah", "7d", "2c"])

    def test_file_not_found(self, config):
        with pytest.raises(FileNotFoundError):
            parse_texassolver_output("/nonexistent/file.json", config)

    def test_invalid_json(self, tmp_path, config):
        path = tmp_path / "bad.json"
        path.write_text("not json")
        with pytest.raises(ValueError, match="Invalid JSON"):
            parse_texassolver_output(path, config)

    def test_invalid_root_type(self, tmp_path, config):
        path = tmp_path / "bad_root.json"
        path.write_text(json.dumps([1, 2, 3]))
        with pytest.raises(ValueError, match="Expected JSON object"):
            parse_texassolver_output(path, config)

    def test_unrecognized_format_returns_empty(self, tmp_path, config):
        path = tmp_path / "empty.json"
        path.write_text(json.dumps({"meta": {}}))
        nodes = parse_texassolver_output(path, config)
        assert nodes == []
