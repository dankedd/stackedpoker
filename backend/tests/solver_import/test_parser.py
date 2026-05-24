"""Tests for the GTO+ CSV parser."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from app.solver_import.parser import parse_gto_export, parse_gto_export_string
from app.solver_import.models import RawSolverNode, RawAction

# ── Fixture path ──────────────────────────────────────────────────────────────

_FIXTURES = Path(__file__).parent.parent.parent / "app" / "solver_import" / "fixtures"
_NODE_FIXTURE  = _FIXTURES / "btn_bb_srp_100bb_nodes.csv"
_COMBO_FIXTURE = _FIXTURES / "btn_bb_srp_100bb_combos.csv"


# ── Minimal valid CSV content ──────────────────────────────────────────────────

_NODE_CSV = textwrap.dedent("""\
    node_id,board,position,pot_chips,stack_chips,street,spot_type,action_name,frequency,ev_chips
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,Bet 33%,0.72,1.85
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,Check,0.28,1.62
    2,9h 8c 7d,BTN,6.5,96.75,flop,SRP,Bet 33%,0.40,1.50
    2,9h 8c 7d,BTN,6.5,96.75,flop,SRP,Check,0.60,1.40
""")

_COMBO_CSV = textwrap.dedent("""\
    node_id,board,position,pot_chips,stack_chips,street,spot_type,combo,equity,ev_chips,action_name,frequency
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,AsKs,0.92,2.15,Bet 33%,1.00
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,AsKs,0.92,2.15,Check,0.00
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,6s5s,0.28,0.95,Bet 33%,0.20
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,6s5s,0.28,0.95,Check,0.80
""")

_MISSING_COLS_CSV = textwrap.dedent("""\
    node_id,board,action_name,frequency
    1,Ah Kc 7d,Bet 33%,0.72
""")

_COMMENT_CSV = textwrap.dedent("""\
    # This is a comment
    node_id,board,position,pot_chips,stack_chips,street,spot_type,action_name,frequency,ev_chips
    # Another comment
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,Bet 33%,0.72,1.85
    1,Ah Kc 7d,BTN,6.5,96.75,flop,SRP,Check,0.28,1.62
""")


class TestParseNodeLevelCSV:
    def test_returns_list_of_raw_solver_nodes(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        assert isinstance(nodes, list)
        assert all(isinstance(n, RawSolverNode) for n in nodes)

    def test_correct_node_count(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        assert len(nodes) == 2  # 2 unique node_ids

    def test_actions_parsed_per_node(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert len(node1.actions) == 2
        action_names = {a.action_name for a in node1.actions}
        assert "Bet 33%" in action_names
        assert "Check" in action_names

    def test_action_frequencies_parsed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        bet_action = next(a for a in node1.actions if "Bet" in a.action_name)
        assert bet_action.frequency == pytest.approx(0.72)

    def test_ev_chips_parsed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        bet_action = next(a for a in node1.actions if "Bet" in a.action_name)
        assert bet_action.ev_chips == pytest.approx(1.85)

    def test_board_parsed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.board == "Ah Kc 7d"

    def test_position_parsed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.position == "BTN"

    def test_pot_and_stack_parsed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.pot_chips == pytest.approx(6.5)
        assert node1.stack_chips == pytest.approx(96.75)

    def test_street_lowercased(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.street == "flop"

    def test_spot_type_uppercased(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.spot_type == "SRP"

    def test_no_combos_for_node_level(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        for node in nodes:
            assert node.combos == []

    def test_spr_computed(self):
        nodes = parse_gto_export_string(_NODE_CSV)
        node1 = next(n for n in nodes if n.node_id == "1")
        assert node1.spr == pytest.approx(96.75 / 6.5, rel=1e-3)


class TestParseComboLevelCSV:
    def test_returns_nodes_with_combos(self):
        nodes = parse_gto_export_string(_COMBO_CSV)
        assert len(nodes) == 1
        assert len(nodes[0].combos) == 2

    def test_combo_names_parsed(self):
        nodes = parse_gto_export_string(_COMBO_CSV)
        combo_names = {c.combo for c in nodes[0].combos}
        assert "AsKs" in combo_names
        assert "6s5s" in combo_names

    def test_combo_equity_parsed(self):
        nodes = parse_gto_export_string(_COMBO_CSV)
        aks = next(c for c in nodes[0].combos if c.combo == "AsKs")
        assert aks.equity == pytest.approx(0.92)

    def test_combo_actions_parsed(self):
        nodes = parse_gto_export_string(_COMBO_CSV)
        aks = next(c for c in nodes[0].combos if c.combo == "AsKs")
        assert len(aks.actions) == 2

    def test_aggregated_node_actions_populated(self):
        # Combo-level parsing should also populate aggregated node actions
        nodes = parse_gto_export_string(_COMBO_CSV)
        assert len(nodes[0].actions) > 0

    def test_aggregated_frequency_in_range(self):
        nodes = parse_gto_export_string(_COMBO_CSV)
        for action in nodes[0].actions:
            assert 0.0 <= action.frequency <= 1.0


class TestParseEdgeCases:
    def test_comments_stripped(self):
        nodes = parse_gto_export_string(_COMMENT_CSV)
        assert len(nodes) == 1
        assert nodes[0].board == "Ah Kc 7d"

    def test_missing_required_columns_raises(self):
        with pytest.raises(ValueError, match="Missing required columns"):
            parse_gto_export_string(_MISSING_COLS_CSV)

    def test_empty_content_returns_empty(self):
        nodes = parse_gto_export_string("")
        assert nodes == []

    def test_only_comments_returns_empty(self):
        nodes = parse_gto_export_string("# just a comment\n")
        assert nodes == []

    def test_file_not_found_raises(self):
        with pytest.raises(FileNotFoundError):
            parse_gto_export("/nonexistent/path.csv")

    def test_source_file_set(self):
        nodes = parse_gto_export_string(_NODE_CSV, source_file="test.csv")
        assert nodes[0].source_file == "test.csv"


class TestParseFixtureFiles:
    def test_node_fixture_loads(self):
        nodes = parse_gto_export(_NODE_FIXTURE)
        assert len(nodes) >= 10  # fixture has 20 node_ids (10 BTN + 10 BB)

    def test_combo_fixture_loads(self):
        nodes = parse_gto_export(_COMBO_FIXTURE)
        assert len(nodes) >= 3   # fixture has 3 unique node_ids

    def test_node_fixture_all_valid(self):
        nodes = parse_gto_export(_NODE_FIXTURE)
        for node in nodes:
            assert node.board
            assert node.position
            assert node.actions

    def test_combo_fixture_has_combos(self):
        nodes = parse_gto_export(_COMBO_FIXTURE)
        nodes_with_combos = [n for n in nodes if n.combos]
        assert len(nodes_with_combos) > 0
