"""
Tests for the Range Interaction Engine.

Covers: range advantage heuristics, nut advantage, capped detection,
board dynamic assessment, density labels, strategic example scenarios.
"""
import pytest

from app.ranges.interactions import (
    RangeInteractionEngine,
    RangeInteractionProfile,
    _density_label,
    _board_rank_metrics,
    _parse_board_ranks,
    _is_board_dynamic,
)
from app.ranges.preflop.cash_100bb.registry import get_range


@pytest.fixture
def engine():
    return RangeInteractionEngine()


@pytest.fixture
def btn_open():
    return get_range("BTN_OPEN")


@pytest.fixture
def bb_vs_btn():
    return get_range("BB_VS_BTN_DEFEND")


@pytest.fixture
def sb_3bet_vs_btn():
    return get_range("SB_3BET_VS_BTN")


# ── Density labels ────────────────────────────────────────────────────────────

class TestDensityLabel:
    def test_none(self):
        assert _density_label(0) == "none"
        assert _density_label(-1) == "none"

    def test_low(self):
        assert _density_label(1) == "low"
        assert _density_label(3) == "low"

    def test_medium(self):
        assert _density_label(4) == "medium"
        assert _density_label(9) == "medium"

    def test_high(self):
        assert _density_label(10) == "high"
        assert _density_label(19) == "high"

    def test_very_high(self):
        assert _density_label(20) == "very_high"
        assert _density_label(50) == "very_high"


# ── Board parsing ──────────────────────────────────────────────────────────────

class TestBoardParsing:
    def test_ranks_sorted_high_to_low(self):
        ranks = _parse_board_ranks(["Ah", "Kd", "3c"])
        assert ranks[0] == "A"
        assert ranks[1] == "K"
        assert ranks[2] == "3"

    def test_low_board(self):
        ranks = _parse_board_ranks(["9h", "8s", "7c"])
        assert ranks[0] == "9"

    def test_single_card(self):
        ranks = _parse_board_ranks(["Kd"])
        assert ranks == ["K"]


# ── Board dynamics ─────────────────────────────────────────────────────────────

class TestBoardDynamic:
    def test_rainbow_ace_high_static(self):
        # Ah Kd 3c — disconnected, rainbow → static
        assert not _is_board_dynamic(["A", "K", "3"], ["h", "d", "c"])

    def test_two_tone_flush_draw_dynamic(self):
        # Two hearts on board → dynamic
        assert _is_board_dynamic(["9", "8", "7"], ["h", "h", "c"])

    def test_connected_low_board_dynamic(self):
        # 9-8-7 connected low board
        assert _is_board_dynamic(["9", "8", "7"], ["h", "s", "c"])

    def test_monotone_dynamic(self):
        # Three same suits
        assert _is_board_dynamic(["A", "K", "Q"], ["h", "h", "h"])


# ── Range metrics ─────────────────────────────────────────────────────────────

class TestBoardRankMetrics:
    def test_btn_has_top_pair_on_ace_high(self, btn_open):
        # BTN opens many Ax hands → high top pair density on A-high board
        metrics = _board_rank_metrics(btn_open, ["Ah", "Kd", "3c"])
        assert metrics.top_pair_combos > 10  # many Ax combos

    def test_btn_has_overpairs_on_low_board(self, btn_open):
        # BTN has AA-TT as overpairs on 7-6-2 board
        metrics = _board_rank_metrics(btn_open, ["7h", "6d", "2c"])
        assert metrics.overpair_combos > 15  # AA KK QQ JJ TT 99 88

    def test_btn_has_sets_on_paired_rank(self, btn_open):
        # BTN opens 77 — should detect as potential set on 7-high board
        metrics = _board_rank_metrics(btn_open, ["7h", "Kd", "2c"])
        assert metrics.set_combos > 0  # 77 in BTN range

    def test_bb_has_sets_on_low_board(self, bb_vs_btn):
        # BB defends 22-99, all small pairs → more sets on low connected board
        metrics = _board_rank_metrics(bb_vs_btn, ["7h", "8d", "9c"])
        assert metrics.set_combos > 0  # 77, 88, 99 in range

    def test_draw_density_suited_hands(self, btn_open):
        # BTN has many suited hands → draw density on wet board
        metrics = _board_rank_metrics(btn_open, ["9h", "8h", "3c"])
        assert metrics.draw_density_est > 0


# ── Full engine: strategic scenarios ──────────────────────────────────────────

class TestRangeInteractionEngine:
    def test_returns_profile(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert isinstance(profile, RangeInteractionProfile)

    def test_profile_fields_populated(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")
        assert profile.nut_advantage in ("IP", "OOP", "NEUTRAL")
        assert isinstance(profile.ip_capped, bool)
        assert isinstance(profile.oop_capped, bool)
        assert isinstance(profile.board_dynamic, bool)
        assert profile.summary != ""

    # ── SCENARIO 1: BTN open vs BB defend — Ah Kd 3c ─────────────────────────
    # Expected: BTN (IP) has range advantage on A-high board.
    # BTN opens many AK/AQ/AJ; BB calling range has weaker Ax hands.
    def test_btn_has_range_advantage_ah_kd_3c(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        # IP (BTN) should have range advantage on A-K-3 board
        assert profile.range_advantage == "IP"

    def test_btn_has_top_pair_density_ah_kd_3c(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert profile.top_pair_density["IP"] in ("high", "very_high")

    # ── SCENARIO 2: BTN open vs BB defend — 9h 8h 7c ─────────────────────────
    # Expected: BB (OOP) improves on this connected low board.
    # BB defends many 97s, T8s, 65s, small pairs — connects well.
    # BTN has overpairs but fewer sets/straights.
    def test_bb_improves_on_low_connected_board(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["9h", "8h", "7c"])
        # OOP should improve on this board
        assert profile.range_advantage in ("OOP", "NEUTRAL")

    def test_low_connected_board_is_dynamic(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["9h", "8h", "7c"])
        assert profile.board_dynamic is True

    # ── SCENARIO 3: BB calling range is capped ───────────────────────────────
    def test_bb_defend_is_capped(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert profile.oop_capped is True  # BB calling range capped

    def test_btn_open_not_capped(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert profile.ip_capped is False  # BTN open uncapped

    # ── SCENARIO 4: SB 3bet range vs BB defend — Ah Kd 3c ────────────────────
    # SB 3bet range is polarized value+bluffs — uncapped, strong.
    def test_sb_3bet_not_capped(self, engine, sb_3bet_vs_btn, bb_vs_btn):
        profile = engine.analyze(sb_3bet_vs_btn, bb_vs_btn, ["Ah", "Kd", "3c"])
        assert profile.ip_capped is False

    # ── SCENARIO 5: Density labels are valid strings ──────────────────────────
    def test_density_labels_valid(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kd", "3c"])
        valid = {"none", "low", "medium", "high", "very_high"}
        for label_dict in [
            profile.top_pair_density,
            profile.overpair_density,
            profile.set_density,
            profile.draw_density,
            profile.broadway_density,
        ]:
            for val in label_dict.values():
                assert val in valid, f"Invalid density label: {val}"

    # ── SCENARIO 6: Empty board raises ────────────────────────────────────────
    def test_empty_board_raises(self, engine, btn_open, bb_vs_btn):
        with pytest.raises(ValueError):
            engine.analyze(btn_open, bb_vs_btn, [])

    # ── SCENARIO 7: Monotone board is dynamic ────────────────────────────────
    def test_monotone_board_dynamic(self, engine, btn_open, bb_vs_btn):
        profile = engine.analyze(btn_open, bb_vs_btn, ["Ah", "Kh", "3h"])
        assert profile.board_dynamic is True


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4: SolverSpot-aware analysis
# ═══════════════════════════════════════════════════════════════════════════════

from app.solver.board_classifier import BoardClassifier
from app.solver.enums import (
    PositionMatchup,
    SPRBucket,
    SolverStreet,
    StackDepthBucket,
)
from app.solver.models import SolverSpot
from app.ranges.evaluators import analyze_solver_spot, resolve_ranges, advantage_from_hero_perspective
from app.ranges.heuristics import evaluate_board_pressure, build_range_advantage_reason
from app.ranges.density import extend_density_profile

_board_clf = BoardClassifier()


def _make_spot(
    matchup: PositionMatchup,
    spot_type,
    board: list[str],
    *,
    hero_pos: str,
    villain_pos: str = "BB",
    is_ip: bool = True,
    pot_bb: float = 6.5,
    stack_bb: float = 96.75,
) -> SolverSpot:
    features = _board_clf.classify_flop(board) if len(board) == 3 else None
    from app.solver.enums import BoardClassEnum
    return SolverSpot(
        spot_type=spot_type,
        hero_position=hero_pos,
        villain_position=villain_pos,
        position_matchup=matchup,
        is_ip=is_ip,
        player_count=2,
        effective_stack_bb=stack_bb,
        pot_bb=pot_bb,
        spr=round(stack_bb / pot_bb, 2),
        stack_depth_bucket=StackDepthBucket.BB100,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        board_class=features.board_class if features else BoardClassEnum.NEUTRAL,
        board_texture=features,
        street=SolverStreet.FLOP,
        metadata={"board_cards": board},
    )


class TestPhase4SolverSpotIntegration:
    """Tests for the SolverSpot-aware Phase 4 analysis pipeline."""

    def test_analyze_solver_spot_returns_profile(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert isinstance(p, RangeInteractionProfile)

    def test_btn_bb_a_high_dry_ip_range_advantage(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert p.range_advantage == "IP"
        assert p.ip_position == "BTN"
        assert p.oop_position == "BB"

    def test_btn_bb_low_connected_oop_range_advantage(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["9h", "8h", "7c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["9h", "8h", "7c"])
        assert p.range_advantage == "OOP"

    def test_strategic_flags_non_empty(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert len(p.strategic_flags) >= 2

    def test_strategic_flags_deduplicated(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert len(p.strategic_flags) == len(set(p.strategic_flags))

    def test_capped_defender_flag_when_oop_capped(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        if p.oop_capped:
            assert "capped_defender" in p.strategic_flags

    def test_three_bet_pot_flag(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.THREE_BET,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
            pot_bb=18.0, stack_bb=82.0,
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert "three_bet_pot" in p.strategic_flags

    def test_dynamic_board_flag_low_connected(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["9h", "8h", "7c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["9h", "8h", "7c"])
        assert "dynamic_board" in p.strategic_flags

    def test_nut_density_populated(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert "IP" in p.nut_density and "OOP" in p.nut_density

    def test_board_pressure_populated(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert len(p.board_pressure_profile) > 0
        assert p.board_pressure_profile != "neutral"

    def test_range_advantage_reason_no_fake_pct(self):
        """Qualitative reasons must never contain percentage strings."""
        import re
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        pct = re.compile(r"\d+\.\d+%")
        assert not pct.search(p.range_advantage_reason)
        assert not pct.search(p.nut_advantage_reason)

    def test_deterministic_output(self):
        """Same inputs always produce identical outputs."""
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["9h", "8h", "7c"], hero_pos="BTN",
        )
        p1 = analyze_solver_spot(spot, ["9h", "8h", "7c"])
        p2 = analyze_solver_spot(spot, ["9h", "8h", "7c"])
        assert p1.range_advantage == p2.range_advantage
        assert p1.strategic_flags == p2.strategic_flags

    def test_advantage_from_hero_perspective_ip(self):
        from app.solver.enums import SpotType
        spot = _make_spot(
            PositionMatchup.BTN_vs_BB, SpotType.SRP,
            ["Ah", "Kd", "3c"], hero_pos="BTN",
        )
        p = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        hv = advantage_from_hero_perspective(p, hero_is_ip=True)
        assert hv["range_advantage"] in ("hero", "villain", "neutral")
        assert isinstance(hv["hero_capped"], bool)
        assert isinstance(hv["villain_capped"], bool)


class TestBoardPressureProfiles:
    """Board pressure evaluation returns expected profile strings."""

    def test_a_high_dry_aggressor_pressure(self):
        from app.solver.enums import BoardClassEnum
        from app.solver.board_classifier import BoardClassifier
        clf = BoardClassifier()
        features = clf.classify_flop(["Ah", "Kd", "3c"])
        pressure = evaluate_board_pressure(features, features.board_class)
        assert "aggressor" in pressure

    def test_low_connected_dynamic_pressure(self):
        clf = BoardClassifier()
        features = clf.classify_flop(["9h", "8h", "7c"])
        pressure = evaluate_board_pressure(features, features.board_class)
        assert "dynamic" in pressure or "low" in pressure

    def test_monotone_nut_sensitivity(self):
        clf = BoardClassifier()
        features = clf.classify_flop(["Ah", "Kh", "3h"])
        pressure = evaluate_board_pressure(features, features.board_class)
        assert "monotone" in pressure or "nut" in pressure
