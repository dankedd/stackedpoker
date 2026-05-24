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


class TestParseOutput:
    """Test parsing of TexasSolver JSON output."""

    @pytest.fixture
    def config(self):
        return SolverConfig(
            spot_type="SRP",
            positions="BTN_vs_BB",
            stack_depth=100,
            board=["Ah", "7d", "2c"],
        )

    @pytest.fixture
    def valid_output(self, tmp_path, config):
        """Create a valid TexasSolver output file."""
        data = {
            "ip_strategy": {
                "actions": ["CHECK", "BET 33", "BET 75"],
                "strategy": [0.30, 0.45, 0.25],
            },
            "oop_strategy": {
                "actions": ["CHECK", "BET 33"],
                "strategy": [0.60, 0.40],
            },
            "meta": {
                "iterations": 1000,
                "exploitability": 0.3,
            },
        }
        path = tmp_path / "output.json"
        path.write_text(json.dumps(data))
        return path

    @pytest.fixture
    def output_with_combos(self, tmp_path, config):
        """Create output with combo-level data."""
        data = {
            "ip_strategy": {
                "actions": ["CHECK", "BET 33"],
                "strategy": [0.40, 0.60],
                "combos": {
                    "AhKs": {
                        "actions": [0.10, 0.90],
                        "equity": 0.82,
                        "ev": 4.5,
                    },
                    "QdQc": {
                        "actions": [0.50, 0.50],
                        "equity": 0.65,
                        "ev": 2.1,
                    },
                },
            },
            "oop_strategy": {
                "actions": ["CHECK", "BET 33"],
                "strategy": [0.55, 0.45],
            },
        }
        path = tmp_path / "output_combos.json"
        path.write_text(json.dumps(data))
        return path

    def test_parses_two_nodes(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        assert len(nodes) == 2

    def test_ip_node_properties(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        ip_node = [n for n in nodes if n.position == "BTN"][0]

        assert ip_node.board == "Ah 7d 2c"
        assert ip_node.position == "BTN"
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

    def test_pot_and_stack(self, valid_output, config):
        nodes = parse_texassolver_output(valid_output, config)
        ip_node = nodes[0]

        assert ip_node.pot_chips == config.pot_size_bb()
        assert ip_node.stack_chips == config.effective_stack_chips()

    def test_combo_data_parsed(self, output_with_combos, config):
        nodes = parse_texassolver_output(output_with_combos, config)
        ip_node = [n for n in nodes if n.position == "BTN"][0]

        assert len(ip_node.combos) == 2

        ak_combo = [c for c in ip_node.combos if c.combo == "AhKs"][0]
        assert ak_combo.equity == 0.82
        assert ak_combo.ev_chips == 4.5
        assert len(ak_combo.actions) == 2

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

    def test_missing_strategy_data(self, tmp_path, config):
        """Output with no ip/oop strategy returns empty list."""
        path = tmp_path / "empty.json"
        path.write_text(json.dumps({"meta": {}}))
        nodes = parse_texassolver_output(path, config)
        assert nodes == []

    def test_alternative_root_structure(self, tmp_path, config):
        """Support root.ip / root.oop alternative format."""
        data = {
            "root": {
                "ip": {
                    "actions": ["CHECK", "BET 50"],
                    "strategy": [0.45, 0.55],
                },
                "oop": {
                    "actions": ["CHECK"],
                    "strategy": [1.0],
                },
            },
        }
        path = tmp_path / "alt_format.json"
        path.write_text(json.dumps(data))

        nodes = parse_texassolver_output(path, config)
        assert len(nodes) == 2

    def test_malformed_strategy_mismatch(self, tmp_path, config):
        """Mismatched action/strategy lengths should skip the node."""
        data = {
            "ip_strategy": {
                "actions": ["CHECK", "BET 33"],
                "strategy": [0.5],  # mismatch: 2 actions, 1 freq
            },
            "oop_strategy": {
                "actions": ["CHECK"],
                "strategy": [1.0],
            },
        }
        path = tmp_path / "mismatch.json"
        path.write_text(json.dumps(data))

        nodes = parse_texassolver_output(path, config)
        # IP node skipped due to mismatch, OOP node parsed
        assert len(nodes) == 1
        assert nodes[0].position == "BB"
