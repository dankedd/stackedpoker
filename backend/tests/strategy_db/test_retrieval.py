"""
Tests for retrieve_strategy() — 4-tier resolution, determinism, never-fail.
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from app.solver.enums import (
    SpotType, PositionMatchup, SPRBucket, StackDepthBucket,
    SolverStreet, BoardClassEnum,
)
from app.strategy_db.retrieval import (
    RetrievalResult, retrieve_strategy, _reset_singletons,
    SIMILAR_THRESHOLD,
)
from app.strategy.profiles import StrategyProfile


# ── Test fixture helpers ──────────────────────────────────────────────────────

def _make_spot(
    spot_type="SRP",
    is_ip=True,
    spr_bucket="8_PLUS",
    board_class="A_HIGH_DRY",
    position_matchup="BTN_vs_BB",
    stack_depth_bucket="100bb",
    street="flop",
    player_count=2,
) -> MagicMock:
    spot = MagicMock()
    spot.spot_type        = SpotType(spot_type)
    spot.is_ip            = is_ip
    spot.spr_bucket       = SPRBucket(spr_bucket)
    spot.board_class      = BoardClassEnum(board_class)
    spot.position_matchup = PositionMatchup(position_matchup)
    spot.stack_depth_bucket = StackDepthBucket(stack_depth_bucket)
    spot.street           = SolverStreet(street)
    spot.player_count     = player_count
    return spot


def _make_node_key(
    spot_type="SRP",
    position_matchup="BTN_vs_BB",
    stack_depth="100bb",
    spr="8_PLUS",
    board_class="A_HIGH_DRY",
    street="flop",
    player_count=2,
) -> MagicMock:
    nk = MagicMock()
    nk.to_string.return_value = (
        f"{spot_type}::{position_matchup}::{stack_depth}"
        f"::{spr}::{board_class}::{street}::{player_count}p"
    )
    return nk


@pytest.fixture(autouse=True)
def reset_singletons():
    """Each test gets a fresh store + cache (no state bleed)."""
    _reset_singletons()
    yield
    _reset_singletons()


# ── RetrievalResult ───────────────────────────────────────────────────────────

class TestRetrievalResult:
    def test_to_debug_dict(self):
        rr = RetrievalResult(
            profile=MagicMock(spec=StrategyProfile),
            retrieval_type="exact",
            matched_node_key="k::ip",
            similarity_score=1.0,
            cache_hit=False,
            debug={"store_source": "handcrafted"},
        )
        d = rr.to_debug_dict()
        assert d["retrieval_type"] == "exact"
        assert d["similarity_score"] == 1.0
        assert d["cache_hit"] is False
        assert d["store_source"] == "handcrafted"


# ── Core retrieval ─────────────────────────────────────────────────────────────

class TestRetrieveStrategy:

    def test_returns_retrieval_result(self):
        nk = _make_node_key()
        spot = _make_spot()
        result = retrieve_strategy(nk, spot)
        assert isinstance(result, RetrievalResult)

    def test_profile_is_strategy_profile(self):
        nk = _make_node_key()
        spot = _make_spot()
        result = retrieve_strategy(nk, spot)
        assert isinstance(result.profile, StrategyProfile)

    def test_retrieval_type_in_known_values(self):
        nk = _make_node_key()
        spot = _make_spot()
        result = retrieve_strategy(nk, spot)
        assert result.retrieval_type in ("exact", "similar", "fallback", "default")

    def test_similarity_score_in_range(self):
        nk = _make_node_key()
        spot = _make_spot()
        result = retrieve_strategy(nk, spot)
        assert 0.0 <= result.similarity_score <= 1.0

    @pytest.mark.parametrize("spot_type,board,is_ip", [
        ("SRP",      "A_HIGH_DRY",   True),
        ("SRP",      "LOW_DYNAMIC",  False),
        ("3BET",     "MONOTONE",     True),
        ("4BET",     "NEUTRAL",      False),
        ("LIMPED",   "LOW_CONNECTED",True),
        ("SQUEEZE",  "K_HIGH_WET",   False),
    ])
    def test_never_raises(self, spot_type, board, is_ip):
        nk = _make_node_key(spot_type=spot_type, board_class=board)
        spot = _make_spot(spot_type=spot_type, board_class=board, is_ip=is_ip)
        result = retrieve_strategy(nk, spot)
        assert result is not None
        assert result.profile is not None

    def test_all_board_classes_never_raise(self):
        for bc in BoardClassEnum:
            nk = _make_node_key(board_class=bc.value)
            spot = _make_spot(board_class=bc.value)
            result = retrieve_strategy(nk, spot)
            assert result.profile is not None


# ── Exact retrieval (seeded store hit) ────────────────────────────────────────

class TestExactRetrieval:
    """These tests use the seeded store — keys matching seed format get exact hits."""

    def test_seeded_key_gets_exact_or_similar(self):
        # The seeded store contains BTN_vs_BB / SRP / A_HIGH_DRY / 8_PLUS / flop
        nk = _make_node_key(
            spot_type="SRP", position_matchup="BTN_vs_BB",
            spr="8_PLUS", board_class="A_HIGH_DRY", street="flop",
        )
        spot = _make_spot("SRP", is_ip=True, spr_bucket="8_PLUS",
                          board_class="A_HIGH_DRY", street="flop")
        result = retrieve_strategy(nk, spot)
        # Exact or similar — not fallback or default
        assert result.retrieval_type in ("exact", "similar")

    def test_exact_hit_similarity_is_one(self):
        nk = _make_node_key(
            spot_type="SRP", position_matchup="BTN_vs_BB",
            spr="8_PLUS", board_class="A_HIGH_DRY", street="flop",
        )
        spot = _make_spot("SRP", is_ip=True, spr_bucket="8_PLUS",
                          board_class="A_HIGH_DRY", street="flop")
        result = retrieve_strategy(nk, spot)
        if result.retrieval_type == "exact":
            assert result.similarity_score == pytest.approx(1.0)


# ── Cache behaviour ───────────────────────────────────────────────────────────

class TestCacheBehaviour:
    def test_second_call_is_cache_hit(self):
        nk = _make_node_key()
        spot = _make_spot()
        r1 = retrieve_strategy(nk, spot)
        r2 = retrieve_strategy(nk, spot)
        # Second call for the same key should be a cache hit
        assert r2.cache_hit is True

    def test_cache_hit_profile_matches_first_call(self):
        nk = _make_node_key()
        spot = _make_spot()
        r1 = retrieve_strategy(nk, spot)
        r2 = retrieve_strategy(nk, spot)
        assert r1.profile.bet_frequency == r2.profile.bet_frequency
        assert r1.profile.range_advantage == r2.profile.range_advantage


# ── Determinism ───────────────────────────────────────────────────────────────

class TestDeterminism:
    def test_same_input_same_output(self):
        results = []
        for _ in range(3):
            _reset_singletons()
            nk = _make_node_key("3BET", spr="4_8", board_class="K_HIGH_DRY")
            spot = _make_spot("3BET", is_ip=True, spr_bucket="4_8", board_class="K_HIGH_DRY")
            results.append(retrieve_strategy(nk, spot))

        bet_freqs = [r.profile.bet_frequency for r in results]
        assert len(set(bet_freqs)) == 1, "Different calls returned different bet_frequencies"

    def test_different_boards_differ(self):
        nk_dry = _make_node_key(board_class="A_HIGH_DRY")
        nk_low = _make_node_key(board_class="LOW_DYNAMIC")
        spot_dry = _make_spot(board_class="A_HIGH_DRY")
        spot_low = _make_spot(board_class="LOW_DYNAMIC")
        r_dry = retrieve_strategy(nk_dry, spot_dry)
        r_low = retrieve_strategy(nk_low, spot_low)
        assert r_dry.profile.bet_frequency != r_low.profile.bet_frequency


# ── Nearest-neighbour match ───────────────────────────────────────────────────

class TestNearestNeighbour:
    def test_close_match_above_threshold(self):
        # CO_vs_BB is not in seeds (only BTN_vs_BB); should match via similar
        nk = _make_node_key(
            spot_type="SRP", position_matchup="CO_vs_BB",
            spr="8_PLUS", board_class="A_HIGH_DRY", street="flop",
        )
        spot = _make_spot("SRP", is_ip=True, position_matchup="CO_vs_BB",
                          spr_bucket="8_PLUS", board_class="A_HIGH_DRY")
        result = retrieve_strategy(nk, spot)
        assert result.retrieval_type in ("exact", "similar")
        if result.retrieval_type == "similar":
            assert result.similarity_score >= SIMILAR_THRESHOLD

    def test_similar_retrieval_debug_populated(self):
        nk = _make_node_key(
            spot_type="SRP", position_matchup="CO_vs_BB",
            spr="8_PLUS", board_class="A_HIGH_DRY", street="flop",
        )
        spot = _make_spot("SRP", is_ip=True, position_matchup="CO_vs_BB")
        result = retrieve_strategy(nk, spot)
        d = result.to_debug_dict()
        assert "node_key" in d
        assert "retrieval_type" in d
        assert "cache_hit" in d


# ── Fallback robustness ───────────────────────────────────────────────────────

class TestFallbackRobustness:
    def test_unknown_spot_type_does_not_crash(self):
        nk = _make_node_key(spot_type="UNKNOWN")
        spot = _make_spot(spot_type="UNKNOWN")
        result = retrieve_strategy(nk, spot)
        assert result is not None

    def test_profile_fields_valid_for_any_result(self):
        for spot_type in ("SRP", "3BET", "4BET", "LIMPED", "SQUEEZE", "UNKNOWN"):
            _reset_singletons()
            nk = _make_node_key(spot_type=spot_type)
            spot = _make_spot(spot_type=spot_type)
            result = retrieve_strategy(nk, spot)
            p = result.profile
            assert 0.0 <= p.bet_frequency <= 1.0
            assert 0.0 <= p.check_frequency <= 1.0
            assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6
            assert 0.0 <= p.range_advantage <= 1.0
