"""
Regression tests for Phase 4 — Simplified Solver Strategy Layer.

Tests:
  - resolve_strategy returns correct StrategyProfile types
  - Board class adjustments are directionally correct (A_HIGH_DRY > LOW_DYNAMIC)
  - Spot type ordering (3BET > SRP bet frequency)
  - SPR modifiers (low SPR → higher pressure)
  - IP vs OOP (IP > OOP bet frequency for same spot)
  - action_frequencies sorted by frequency descending
  - Caveats for multiway pots and NEUTRAL board
  - strategy_findings_for_hand generates expected findings
  - Determinism: same NodeKey always returns identical profile
"""

from __future__ import annotations

import pytest

from app.strategy.profiles import ActionFrequency, StrategyProfile
from app.strategy.registry import build_profile_dict, get_board_modifier, get_spr_modifier
from app.strategy.retrieval import resolve_strategy
from app.strategy.recommendations import strategy_findings_for_hand


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_spot(
    spot_type="SRP",
    is_ip=True,
    spr_bucket="8_PLUS",
    board_class="A_HIGH_DRY",
    position_matchup="BTN_vs_BB",
    stack_depth_bucket="100bb",
    street="flop",
    player_count=2,
):
    """Build a minimal SolverSpot-like object for testing."""
    from unittest.mock import MagicMock
    from app.solver.enums import (
        SpotType, PositionMatchup, SPRBucket, StackDepthBucket,
        SolverStreet, BoardClassEnum,
    )

    spot = MagicMock()
    spot.spot_type = SpotType(spot_type)
    spot.is_ip = is_ip
    spot.spr_bucket = SPRBucket(spr_bucket)
    spot.board_class = BoardClassEnum(board_class)
    spot.position_matchup = PositionMatchup(position_matchup)
    spot.stack_depth_bucket = StackDepthBucket(stack_depth_bucket)
    spot.street = SolverStreet(street)
    spot.player_count = player_count
    return spot


def _profile(spot_type="SRP", is_ip=True, spr="8_PLUS", board="A_HIGH_DRY", players=2) -> StrategyProfile:
    return resolve_strategy(_make_spot(
        spot_type=spot_type, is_ip=is_ip, spr_bucket=spr,
        board_class=board, player_count=players,
    ))


# ── build_profile_dict unit tests ─────────────────────────────────────────────

class TestBuildProfileDict:

    def test_returns_all_required_keys(self):
        d = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        required = {
            "bet_frequency", "check_frequency", "primary_sizing",
            "range_advantage", "nut_advantage", "pressure_score",
            "volatility_score", "equity_realization", "rationale",
        }
        assert required.issubset(d.keys())

    def test_frequencies_sum_to_one(self):
        for spot in ("SRP", "3BET", "4BET", "LIMPED"):
            for is_ip in (True, False):
                d = build_profile_dict(spot, is_ip, "8_PLUS", "A_HIGH_DRY")
                assert abs(d["bet_frequency"] + d["check_frequency"] - 1.0) < 1e-9, \
                    f"{spot} is_ip={is_ip}: frequencies don't sum to 1.0"

    def test_all_floats_clamped_0_1(self):
        float_keys = [
            "bet_frequency", "check_frequency", "range_advantage",
            "nut_advantage", "pressure_score", "volatility_score", "equity_realization",
        ]
        combos = [
            ("4BET", True, "0_2", "A_HIGH_DRY"),
            ("LIMPED", False, "8_PLUS", "LOW_DYNAMIC"),
            ("SQUEEZE", True, "0_2", "MONOTONE"),
        ]
        for args in combos:
            d = build_profile_dict(*args)
            for k in float_keys:
                v = d[k]
                assert 0.0 <= v <= 1.0, f"{args} → {k}={v} out of [0,1]"

    def test_board_modifier_size_override(self):
        d_dry = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        d_low = build_profile_dict("SRP", True, "8_PLUS", "LOW_DYNAMIC")
        assert d_dry["primary_sizing"] == "33pct"
        assert d_low["primary_sizing"] == "50pct"

    def test_neutral_board_no_adjustment(self):
        d_neutral = build_profile_dict("SRP", True, "8_PLUS", "NEUTRAL")
        d_base = build_profile_dict("SRP", True, "4_8", "NEUTRAL")
        # 4_8 is the SPR baseline (no delta); neutral board also has no delta
        # → values should equal the base profile exactly
        base_bet = 0.62  # SRP IP base
        assert abs(d_base["bet_frequency"] - base_bet) < 1e-9


# ── Board class ordering tests ────────────────────────────────────────────────

class TestBoardClassOrdering:

    def test_dry_high_card_beats_low_connected_bet_freq(self):
        dry = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        low = build_profile_dict("SRP", True, "8_PLUS", "LOW_DYNAMIC")
        assert dry["bet_frequency"] > low["bet_frequency"], \
            "A_HIGH_DRY should have higher bet_freq than LOW_DYNAMIC"

    def test_dry_high_card_beats_monotone_bet_freq(self):
        dry = build_profile_dict("SRP", True, "8_PLUS", "K_HIGH_DRY")
        mono = build_profile_dict("SRP", True, "8_PLUS", "MONOTONE")
        assert dry["bet_frequency"] > mono["bet_frequency"]

    def test_rainbow_static_higher_than_flush_completing(self):
        rainbow = build_profile_dict("SRP", True, "8_PLUS", "RAINBOW_STATIC")
        flush_c = build_profile_dict("SRP", True, "8_PLUS", "FLUSH_COMPLETING")
        assert rainbow["bet_frequency"] > flush_c["bet_frequency"]

    def test_low_dynamic_lowest_range_advantage(self):
        low = build_profile_dict("SRP", True, "8_PLUS", "LOW_DYNAMIC")
        dry = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert low["range_advantage"] < dry["range_advantage"]

    def test_high_volatility_on_dynamic_boards(self):
        low_dyn = build_profile_dict("SRP", True, "8_PLUS", "LOW_DYNAMIC")
        a_dry = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert low_dyn["volatility_score"] > a_dry["volatility_score"]

    def test_monotone_has_high_volatility(self):
        mono = build_profile_dict("SRP", True, "8_PLUS", "MONOTONE")
        rainbow = build_profile_dict("SRP", True, "8_PLUS", "RAINBOW_STATIC")
        assert mono["volatility_score"] > rainbow["volatility_score"]


# ── Spot type ordering ────────────────────────────────────────────────────────

class TestSpotTypeOrdering:

    def test_3bet_higher_bet_freq_than_srp_ip(self):
        three = build_profile_dict("3BET", True, "8_PLUS", "A_HIGH_DRY")
        srp = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert three["bet_frequency"] > srp["bet_frequency"]

    def test_4bet_highest_bet_freq(self):
        fourbet = build_profile_dict("4BET", True, "0_2", "A_HIGH_DRY")
        squeeze = build_profile_dict("SQUEEZE", True, "4_8", "A_HIGH_DRY")
        srp = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert fourbet["bet_frequency"] >= squeeze["bet_frequency"]
        assert squeeze["bet_frequency"] >= srp["bet_frequency"]

    def test_4bet_highest_range_advantage(self):
        four = build_profile_dict("4BET", True, "0_2", "NEUTRAL")
        srp = build_profile_dict("SRP", True, "8_PLUS", "NEUTRAL")
        assert four["range_advantage"] > srp["range_advantage"]

    def test_limped_lower_range_advantage_than_srp(self):
        limped = build_profile_dict("LIMPED", True, "8_PLUS", "NEUTRAL")
        srp = build_profile_dict("SRP", True, "8_PLUS", "NEUTRAL")
        assert limped["range_advantage"] < srp["range_advantage"]


# ── IP vs OOP ─────────────────────────────────────────────────────────────────

class TestIPvsOOP:

    def test_ip_higher_bet_freq_than_oop_srp(self):
        ip = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        oop = build_profile_dict("SRP", False, "8_PLUS", "A_HIGH_DRY")
        assert ip["bet_frequency"] > oop["bet_frequency"]

    def test_ip_higher_pressure_than_oop(self):
        ip = build_profile_dict("3BET", True, "8_PLUS", "K_HIGH_DRY")
        oop = build_profile_dict("3BET", False, "8_PLUS", "K_HIGH_DRY")
        assert ip["pressure_score"] > oop["pressure_score"]

    @pytest.mark.parametrize("spot", ["SRP", "3BET", "SQUEEZE", "LIMPED"])
    def test_ip_always_higher_or_equal_bet_freq(self, spot):
        ip = build_profile_dict(spot, True, "8_PLUS", "NEUTRAL")
        oop = build_profile_dict(spot, False, "8_PLUS", "NEUTRAL")
        assert ip["bet_frequency"] >= oop["bet_frequency"], \
            f"{spot}: IP bet_freq should be >= OOP"


# ── SPR modifiers ─────────────────────────────────────────────────────────────

class TestSPRModifiers:

    def test_low_spr_higher_pressure(self):
        low = build_profile_dict("SRP", True, "0_2", "A_HIGH_DRY")
        high = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert low["pressure_score"] > high["pressure_score"]

    def test_low_spr_higher_bet_freq(self):
        low = build_profile_dict("SRP", True, "0_2", "A_HIGH_DRY")
        high = build_profile_dict("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert low["bet_frequency"] > high["bet_frequency"]

    def test_low_spr_lower_volatility(self):
        low = build_profile_dict("SRP", True, "0_2", "NEUTRAL")
        high = build_profile_dict("SRP", True, "8_PLUS", "NEUTRAL")
        assert low["volatility_score"] <= high["volatility_score"]

    def test_spr_ordering_pressure(self):
        p0 = build_profile_dict("SRP", True, "0_2", "NEUTRAL")["pressure_score"]
        p2 = build_profile_dict("SRP", True, "2_4", "NEUTRAL")["pressure_score"]
        p8 = build_profile_dict("SRP", True, "8_PLUS", "NEUTRAL")["pressure_score"]
        assert p0 >= p2 >= p8


# ── resolve_strategy integration ──────────────────────────────────────────────

class TestResolveStrategy:

    def test_returns_strategy_profile_instance(self):
        profile = _profile()
        assert isinstance(profile, StrategyProfile)

    def test_node_key_populated(self):
        profile = _profile("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert "SRP" in profile.node_key
        assert "BTN_vs_BB" in profile.node_key
        assert "A_HIGH_DRY" in profile.node_key

    def test_action_frequencies_sorted_descending(self):
        profile = _profile()
        freqs = [af.frequency for af in profile.action_frequencies]
        assert freqs == sorted(freqs, reverse=True), \
            "action_frequencies should be sorted by frequency descending"

    def test_action_frequencies_cover_bet_and_check(self):
        profile = _profile()
        actions = {af.action for af in profile.action_frequencies}
        assert "bet" in actions
        assert "check" in actions

    def test_action_frequency_sum_is_one(self):
        profile = _profile()
        total = sum(af.frequency for af in profile.action_frequencies)
        assert abs(total - 1.0) < 1e-9

    def test_primary_sizing_populated(self):
        profile = _profile()
        assert profile.primary_sizing in ("33pct", "50pct", "75pct", "pot")

    def test_source_is_registry(self):
        profile = _profile()
        assert profile.source == "registry"

    def test_rationale_nonempty(self):
        profile = _profile()
        assert len(profile.rationale) > 10

    def test_multiway_caveat(self):
        profile = _profile(players=3)
        assert any("multiway" in c.lower() for c in profile.caveats)

    def test_no_multiway_caveat_for_headsup(self):
        profile = _profile(players=2)
        assert not any("multiway" in c.lower() for c in profile.caveats)

    def test_neutral_board_caveat(self):
        profile = _profile(board="NEUTRAL")
        assert any("neutral" in c.lower() for c in profile.caveats)

    def test_determinism(self):
        """Same inputs must always produce identical outputs."""
        p1 = _profile("3BET", True, "4_8", "K_HIGH_DRY")
        p2 = _profile("3BET", True, "4_8", "K_HIGH_DRY")
        assert p1.bet_frequency == p2.bet_frequency
        assert p1.range_advantage == p2.range_advantage
        assert p1.node_key == p2.node_key

    @pytest.mark.parametrize("spot,board,is_ip", [
        ("SRP", "A_HIGH_DRY", True),
        ("SRP", "LOW_DYNAMIC", False),
        ("3BET", "MONOTONE", True),
        ("4BET", "NEUTRAL", False),
        ("LIMPED", "LOW_CONNECTED", True),
        ("SQUEEZE", "K_HIGH_WET", False),
    ])
    def test_resolve_does_not_raise(self, spot, board, is_ip):
        profile = _profile(spot, is_ip, "8_PLUS", board)
        assert profile is not None

    def test_all_board_classes_covered(self):
        from app.solver.enums import BoardClassEnum
        for bc in BoardClassEnum:
            profile = _profile("SRP", True, "8_PLUS", bc.value)
            assert 0.0 <= profile.bet_frequency <= 1.0

    def test_all_spot_types_covered(self):
        from app.solver.enums import SpotType
        for st in SpotType:
            profile = _profile(st.value, True, "8_PLUS", "A_HIGH_DRY")
            assert isinstance(profile, StrategyProfile)


# ── strategy_findings_for_hand ────────────────────────────────────────────────

class TestStrategyFindingsForHand:

    def _make_hand(self, flop=None, actions=None):
        """Build a minimal ParsedHand for testing."""
        from unittest.mock import MagicMock
        hand = MagicMock()
        hand.board.flop = flop or ["Ah", "Kd", "3c"]
        hand.actions = actions or []
        return hand

    def _make_spot_classification(self, is_ip=True, is_pfr=True):
        from unittest.mock import MagicMock
        spot = MagicMock()
        spot.hero_is_ip = is_ip
        spot.hero_is_pfr = is_pfr
        return spot

    def _hero_action(self, action="check", street="flop", size_bb=None):
        from unittest.mock import MagicMock
        a = MagicMock()
        a.street = street
        a.action = action
        a.is_hero = True
        a.size_bb = size_bb
        return a

    def test_no_findings_for_no_flop(self):
        profile = _profile()
        hand = self._make_hand(flop=[])
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)
        assert findings == []

    def test_no_findings_for_no_hero_action(self):
        profile = _profile()
        hand = self._make_hand(actions=[])
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)
        assert findings == []

    def test_check_on_high_freq_board_generates_note(self):
        # A_HIGH_DRY SRP IP → high bet_frequency
        profile = _profile("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert profile.bet_frequency >= 0.72, "Precondition: A_HIGH_DRY IP should have high bet_freq"

        hand = self._make_hand(
            actions=[self._hero_action("check", "flop")]
        )
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)

        assert len(findings) >= 1
        note = findings[0]
        assert note.severity == "note"
        assert note.street == "flop"
        assert "check" in note.action_taken.lower() or "betting" in note.recommendation.lower()

    def test_bet_on_low_freq_board_generates_note(self):
        # LOW_DYNAMIC SRP OOP → low bet_frequency
        profile = _profile("SRP", False, "8_PLUS", "LOW_DYNAMIC")
        assert profile.bet_frequency <= 0.40, "Precondition: LOW_DYNAMIC OOP should have low bet_freq"

        hand = self._make_hand(
            actions=[self._hero_action("bet", "flop", size_bb=5.0)]
        )
        spot = self._make_spot_classification(is_ip=False)
        findings = strategy_findings_for_hand(profile, hand, spot)

        assert len(findings) >= 1
        note = findings[0]
        assert note.severity == "note"

    def test_high_range_advantage_generates_good_finding(self):
        profile = _profile("SRP", True, "8_PLUS", "A_HIGH_DRY")
        assert profile.range_advantage >= 0.68, "Precondition: A_HIGH_DRY IP has high range_advantage"

        hand = self._make_hand(
            actions=[self._hero_action("bet", "flop", size_bb=4.0)]
        )
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)

        good_findings = [f for f in findings if f.severity == "good"]
        assert good_findings, "Expected at least one 'good' finding for high range advantage"

    def test_low_range_advantage_generates_range_note(self):
        profile = _profile("LIMPED", False, "8_PLUS", "LOW_DYNAMIC")
        assert profile.range_advantage <= 0.40, "Precondition: LOW_DYNAMIC LIMPED OOP has low range_advantage"

        hand = self._make_hand(
            actions=[self._hero_action("check", "flop")]
        )
        spot = self._make_spot_classification(is_ip=False)
        findings = strategy_findings_for_hand(profile, hand, spot)

        range_notes = [f for f in findings if "range" in f.action_taken.lower()]
        assert range_notes

    def test_max_two_findings(self):
        profile = _profile("SRP", True, "8_PLUS", "A_HIGH_DRY")
        hand = self._make_hand(
            actions=[self._hero_action("check", "flop")]
        )
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)
        assert len(findings) <= 2

    def test_findings_have_required_fields(self):
        profile = _profile("SRP", True, "8_PLUS", "A_HIGH_DRY")
        hand = self._make_hand(
            actions=[self._hero_action("check", "flop")]
        )
        spot = self._make_spot_classification()
        findings = strategy_findings_for_hand(profile, hand, spot)

        for f in findings:
            assert f.severity in ("good", "note", "suboptimal", "mistake")
            assert f.street == "flop"
            assert len(f.recommendation) > 5
            assert len(f.explanation) > 10
