"""Tests for the normalizer — validation, action normalization, scope filtering."""

from __future__ import annotations

from app.solver_import.models import RawSolverNode, RawAction, RawComboEntry
from app.solver_import.normalizer import (
    normalize,
    normalize_action_name,
    _in_mvp_scope,
    _validate_node,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_node(
    node_id="1",
    board="Ah Kc 7d",
    position="BTN",
    pot_chips=6.5,
    stack_chips=96.75,
    street="flop",
    spot_type="SRP",
    actions=None,
) -> RawSolverNode:
    node = RawSolverNode(
        node_id=node_id,
        board=board,
        position=position,
        pot_chips=pot_chips,
        stack_chips=stack_chips,
        street=street,
        spot_type=spot_type,
    )
    node.actions = actions if actions is not None else [
        RawAction("Bet 33%", 0.70),
        RawAction("Check", 0.30),
    ]
    return node


# ── Action name normalization ─────────────────────────────────────────────────

class TestNormalizeActionName:
    def test_bet_percent(self):
        assert normalize_action_name("Bet 33%") == "bet_33pct"
        assert normalize_action_name("Bet 50%") == "bet_50pct"
        assert normalize_action_name("Bet 100%") == "bet_100pct"

    def test_bet_percent_lowercase(self):
        assert normalize_action_name("bet 75%") == "bet_75pct"

    def test_check(self):
        assert normalize_action_name("Check") == "check"

    def test_fold(self):
        assert normalize_action_name("Fold") == "fold"

    def test_call(self):
        assert normalize_action_name("Call") == "call"

    def test_raise_x(self):
        assert normalize_action_name("Raise 2.5x") == "raise_2.5x"
        assert normalize_action_name("Raise 3x") == "raise_3x"

    def test_bet_chips(self):
        result = normalize_action_name("Bet 4.5")
        assert result == "bet_4.5chips"

    def test_strip_whitespace(self):
        assert normalize_action_name("  Bet 33%  ") == "bet_33pct"


# ── Scope filtering ───────────────────────────────────────────────────────────

class TestMVPScope:
    def test_btn_srp_flop_in_scope(self):
        node = _make_node(position="BTN", spot_type="SRP", street="flop")
        assert _in_mvp_scope(node) is True

    def test_bb_srp_flop_in_scope(self):
        node = _make_node(position="BB", spot_type="SRP", street="flop")
        assert _in_mvp_scope(node) is True

    def test_3bet_out_of_scope(self):
        node = _make_node(spot_type="3BET")
        assert _in_mvp_scope(node) is False

    def test_turn_out_of_scope(self):
        node = _make_node(street="turn")
        assert _in_mvp_scope(node) is False

    def test_co_position_out_of_scope(self):
        node = _make_node(position="CO")
        assert _in_mvp_scope(node) is False

    def test_unknown_position_out_of_scope(self):
        node = _make_node(position="UTG")
        assert _in_mvp_scope(node) is False


# ── Validation ────────────────────────────────────────────────────────────────

class TestValidateNode:
    def test_valid_node_returns_none(self):
        node = _make_node()
        assert _validate_node(node) is None

    def test_empty_board_error(self):
        node = _make_node(board="")
        err = _validate_node(node)
        assert err is not None
        assert "board" in err

    def test_no_actions_error(self):
        node = _make_node(actions=[])
        err = _validate_node(node)
        assert err is not None

    def test_bad_frequency_sum_error(self):
        node = _make_node(actions=[
            RawAction("Bet 33%", 0.50),
            RawAction("Check", 0.10),  # sum = 0.60, too far from 1.0
        ])
        err = _validate_node(node)
        assert err is not None
        assert "frequenc" in err.lower()

    def test_zero_pot_error(self):
        node = _make_node(pot_chips=0.0)
        err = _validate_node(node)
        assert err is not None

    def test_frequency_tolerance_accepted(self):
        # Frequencies summing to 0.99 (within 2% tolerance) should be ok
        node = _make_node(actions=[
            RawAction("Bet 33%", 0.70),
            RawAction("Check", 0.295),  # sum = 0.995
        ])
        assert _validate_node(node) is None


# ── normalize() integration ───────────────────────────────────────────────────

class TestNormalize:
    def test_valid_nodes_returned(self):
        nodes = [_make_node("1"), _make_node("2", board="9h 8c 7d")]
        valid, errors = normalize(nodes)
        assert len(valid) == 2
        assert errors == []

    def test_out_of_scope_nodes_silently_dropped(self):
        in_scope  = _make_node("1")
        out_scope = _make_node("2", spot_type="3BET")  # not SRP
        valid, errors = normalize([in_scope, out_scope])
        assert len(valid) == 1
        assert errors == []   # not an error, just filtered

    def test_invalid_nodes_produce_errors(self):
        bad_node = _make_node("bad", actions=[])
        valid, errors = normalize([bad_node])
        assert len(valid) == 0
        assert len(errors) == 1
        assert errors[0][0] == "bad"

    def test_action_names_normalized(self):
        node = _make_node("1", actions=[
            RawAction("Bet 33%", 0.70),
            RawAction("Check", 0.30),
        ])
        valid, _ = normalize([node])
        action_names = {a.action_name for a in valid[0].actions}
        assert "bet_33pct" in action_names
        assert "check" in action_names

    def test_combo_action_names_normalized(self):
        node = _make_node("1")
        node.combos = [
            RawComboEntry("AsKs", actions=[
                RawAction("Bet 33%", 1.0),
                RawAction("Check", 0.0),
            ])
        ]
        valid, _ = normalize([node])
        combo = valid[0].combos[0]
        assert any(a.action_name == "bet_33pct" for a in combo.actions)

    def test_deduplication_last_wins(self):
        node1 = _make_node("1", actions=[RawAction("Bet 33%", 0.70), RawAction("Check", 0.30)])
        node2 = _make_node("1", actions=[RawAction("Bet 50%", 0.60), RawAction("Check", 0.40)])
        valid, _ = normalize([node1, node2])
        assert len(valid) == 1
        # Last node (node2) wins
        assert any(a.action_name == "bet_50pct" for a in valid[0].actions)

    def test_multiple_errors_accumulated(self):
        bad1 = _make_node("b1", actions=[])
        bad2 = _make_node("b2", pot_chips=0.0)
        _, errors = normalize([bad1, bad2])
        assert len(errors) == 2
        node_ids = {e[0] for e in errors}
        assert "b1" in node_ids
        assert "b2" in node_ids
