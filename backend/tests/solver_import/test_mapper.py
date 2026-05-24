"""Tests for the mapper — RawSolverNode → (node_key_str, is_ip)."""

from __future__ import annotations

import pytest

from app.solver_import.models import RawSolverNode, RawAction
from app.solver_import.mapper import map_solver_node, _spr_to_bucket, _is_ip


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_node(
    position="BTN",
    board="Ah Kc 7d",
    street="flop",
    pot_chips=6.5,
    stack_chips=96.75,
    spot_type="SRP",
) -> RawSolverNode:
    node = RawSolverNode(
        node_id="test",
        board=board,
        position=position,
        pot_chips=pot_chips,
        stack_chips=stack_chips,
        street=street,
        spot_type=spot_type,
    )
    node.actions = [RawAction("bet_33pct", 0.70), RawAction("check", 0.30)]
    return node


# ── SPR bucketing ─────────────────────────────────────────────────────────────

class TestSPRBucket:
    def test_under_2_is_0_2(self):
        assert _spr_to_bucket(1.5) == "0_2"
        assert _spr_to_bucket(0.5) == "0_2"

    def test_2_to_4_is_2_4(self):
        assert _spr_to_bucket(2.0) == "2_4"
        assert _spr_to_bucket(3.9) == "2_4"

    def test_4_to_8_is_4_8(self):
        assert _spr_to_bucket(4.0) == "4_8"
        assert _spr_to_bucket(7.9) == "4_8"

    def test_8_plus_is_8_plus(self):
        assert _spr_to_bucket(8.0) == "8_PLUS"
        assert _spr_to_bucket(14.9) == "8_PLUS"
        assert _spr_to_bucket(96.75 / 6.5) == "8_PLUS"  # fixture SPR ~14.9


# ── IP/OOP detection ──────────────────────────────────────────────────────────

class TestIsIP:
    def test_btn_is_ip(self):
        assert _is_ip("BTN") is True

    def test_co_is_ip(self):
        assert _is_ip("CO") is True

    def test_bb_is_oop(self):
        assert _is_ip("BB") is False

    def test_sb_is_oop(self):
        assert _is_ip("SB") is False

    def test_unknown_returns_none(self):
        assert _is_ip("UNKNOWN_POS") is None


# ── map_solver_node ───────────────────────────────────────────────────────────

class TestMapSolverNode:
    def test_btn_node_maps_to_ip_true(self):
        node = _make_node(position="BTN")
        result = map_solver_node(node)
        assert result is not None
        _, is_ip = result
        assert is_ip is True

    def test_bb_node_maps_to_ip_false(self):
        node = _make_node(position="BB")
        result = map_solver_node(node)
        assert result is not None
        _, is_ip = result
        assert is_ip is False

    def test_node_key_format(self):
        node = _make_node(position="BTN", board="Ah Kc 7d")
        result = map_solver_node(node)
        assert result is not None
        node_key, _ = result
        parts = node_key.split("::")
        assert len(parts) == 7, f"Expected 7 segments, got {len(parts)}: {node_key}"

    def test_btn_matchup_in_key(self):
        node = _make_node(position="BTN")
        node_key, _ = map_solver_node(node)
        assert "BTN_vs_BB" in node_key

    def test_bb_matchup_in_key(self):
        node = _make_node(position="BB")
        node_key, _ = map_solver_node(node)
        assert "BTN_vs_BB" in node_key  # BB is OOP in BTN_vs_BB

    def test_spot_type_in_key(self):
        node = _make_node(spot_type="SRP")
        node_key, _ = map_solver_node(node)
        assert node_key.startswith("SRP::")

    def test_street_in_key(self):
        node = _make_node(street="flop")
        node_key, _ = map_solver_node(node)
        assert "::flop::" in node_key

    def test_player_count_in_key(self):
        node = _make_node()
        node_key, _ = map_solver_node(node)
        assert node_key.endswith("::2p")

    def test_board_class_in_key_for_ace_high_dry(self):
        node = _make_node(board="Ah Kc 7d")
        node_key, _ = map_solver_node(node)
        # Ah Kc 7d should classify as A_HIGH_DRY or similar ace-high class
        assert "A_HIGH" in node_key or "RAINBOW" in node_key or "DRY" in node_key

    def test_spr_bucket_in_key_fixture_spr(self):
        # pot=6.5, stack=96.75 → SPR≈14.9 → 8_PLUS
        node = _make_node(pot_chips=6.5, stack_chips=96.75)
        node_key, _ = map_solver_node(node)
        assert "8_PLUS" in node_key

    def test_low_spr_bucket(self):
        # pot=10.0, stack=15.0 → SPR=1.5 → 0_2
        node = _make_node(pot_chips=10.0, stack_chips=15.0)
        node_key, _ = map_solver_node(node)
        assert "0_2" in node_key

    def test_unknown_position_returns_none(self):
        node = _make_node(position="HERO")
        result = map_solver_node(node)
        assert result is None

    def test_invalid_board_returns_none(self):
        node = _make_node(board="XX YY ZZ")
        result = map_solver_node(node)
        assert result is None

    def test_connected_board_maps(self):
        node = _make_node(board="9h 8c 7d")
        result = map_solver_node(node)
        assert result is not None
        node_key, _ = result
        assert "LOW" in node_key or "CONNECTED" in node_key or "DYNAMIC" in node_key

    def test_monotone_board_maps(self):
        node = _make_node(board="Ah 8h 2h")
        result = map_solver_node(node)
        assert result is not None
        node_key, _ = result
        assert "MONOTONE" in node_key or "A_HIGH" in node_key
