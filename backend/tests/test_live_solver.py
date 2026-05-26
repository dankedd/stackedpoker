"""Tests for the live solver service."""

import pytest

from app.models.canonical import CanonicalHand
from app.solver.live_solver import (
    SolverResult,
    _extract_river_node,
    _river_node_cache_key,
    solve_river_synthetic,
)
from app.engines.pipeline import run_text_pipeline


HAND_TEXT = """PokerStars Hand #991133772: Hold'em No Limit ($1.00/$2.00 USD) - 2024/01/15 19:45:00 ET
Table 'TestTable' 6-max Seat #1 is the Button
Seat 1: Hero ($200.00 in chips)
Seat 2: Villain ($200.00 in chips)
Villain: posts small blind $1.00
Hero: posts big blind $2.00
*** HOLE CARDS ***
Dealt to Hero [Qh Jd]
Hero: raises $3.00 to $5.00
Villain: calls $4.00
*** FLOP *** [Ks 8c 3h]
Villain: checks
Hero: bets $4.00
Villain: calls $4.00
*** TURN *** [Ks 8c 3h] [2d]
Villain: checks
Hero: checks
*** RIVER *** [Ks 8c 3h 2d] [7s]
Villain: raises $186.00 to $191.00
Hero: calls $191.00
*** SUMMARY ***
Total pot $400.00
"""


@pytest.fixture
def canonical():
    result = run_text_pipeline(HAND_TEXT)
    return result.canonical


@pytest.fixture
def solver_spot(canonical):
    from app.solver.abstractions import SpotAbstraction
    return SpotAbstraction.from_canonical_hand(canonical).solver_spot


class TestNodeExtraction:
    def test_extracts_river_node(self, canonical, solver_spot):
        config = _extract_river_node(canonical, solver_spot)
        assert config is not None
        assert len(config.board) == 5
        assert config.board == ["Ks", "8c", "3h", "2d", "7s"]

    def test_river_node_has_valid_pot(self, canonical, solver_spot):
        config = _extract_river_node(canonical, solver_spot)
        assert config is not None
        assert config.pot_size_bb() > 0

    def test_river_node_has_bet_sizes(self, canonical, solver_spot):
        config = _extract_river_node(canonical, solver_spot)
        assert config is not None
        assert len(config.bet_sizes) > 0

    def test_no_extraction_without_river(self):
        hand_text = """PokerStars Hand #111: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/15 19:45:00 ET
Table 'TestTable' 6-max Seat #1 is the Button
Seat 1: Hero ($100.00 in chips)
Seat 2: Villain ($100.00 in chips)
Villain: posts small blind $0.50
Hero: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [As Kh]
Hero: raises $1.50 to $2.50
Villain: folds
*** SUMMARY ***
Total pot $3.50
"""
        result = run_text_pipeline(hand_text)
        from app.solver.abstractions import SpotAbstraction
        spot = SpotAbstraction.from_canonical_hand(result.canonical).solver_spot
        config = _extract_river_node(result.canonical, spot)
        assert config is None  # no river street


class TestCacheKey:
    def test_deterministic(self, canonical, solver_spot):
        config = _extract_river_node(canonical, solver_spot)
        k1 = _river_node_cache_key(config)
        k2 = _river_node_cache_key(config)
        assert k1 == k2

    def test_different_boards_different_keys(self, canonical, solver_spot):
        config1 = _extract_river_node(canonical, solver_spot)
        config2 = _extract_river_node(canonical, solver_spot)
        config2.board = ["As", "Kh", "7d", "2c", "9s"]
        assert _river_node_cache_key(config1) != _river_node_cache_key(config2)


class TestSyntheticSolver:
    def test_returns_ready_status(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot, hero_action="call")
        assert result.status == "ready"

    def test_has_frequencies(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot)
        assert len(result.frequencies) > 0
        assert sum(result.frequencies.values()) == pytest.approx(1.0, abs=0.02)

    def test_has_preferred_action(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot)
        assert result.preferred_action in result.frequencies

    def test_source_is_synthetic(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot)
        assert "synthetic" in result.source

    def test_to_dict(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot, hero_action="call")
        d = result.to_dict()
        assert "status" in d
        assert "frequencies" in d
        assert "preferred_action" in d
        assert "hero_action_ev_loss" in d

    def test_ev_loss_when_deviating(self, canonical, solver_spot):
        result = solve_river_synthetic(canonical, solver_spot, hero_action="call")
        if result.preferred_action != "call":
            assert result.hero_action_ev_loss <= 0

    def test_frequencies_facing_bet(self, canonical, solver_spot):
        """When facing a river bet, frequencies should include fold/call."""
        result = solve_river_synthetic(canonical, solver_spot)
        # This hand has a river bet from villain
        assert "fold" in result.frequencies or "call" in result.frequencies


class TestSolverResult:
    def test_to_dict_complete(self):
        r = SolverResult(
            status="ready",
            frequencies={"fold": 0.72, "call": 0.28},
            ev={"fold": 0.0, "call": -0.42},
            preferred_action="fold",
            hero_action_ev_loss=-0.42,
            iterations=200,
            exploitability=1.0,
            solve_time_ms=3200,
        )
        d = r.to_dict()
        assert d["status"] == "ready"
        assert d["frequencies"]["fold"] == 0.72
        assert d["preferred_action"] == "fold"
        assert d["hero_action_ev_loss"] == -0.42
