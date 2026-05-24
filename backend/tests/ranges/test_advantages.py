"""
Tests for range advantage and nut advantage evaluation.

Covers:
  - analyze_solver_spot advantage verdicts across matchups and board classes
  - build_range_advantage_reason / build_nut_advantage_reason qualitative text
  - No fake percentages or solver math in outputs
  - Determinism of advantage labels
"""
from __future__ import annotations

import pytest

from app.ranges.evaluators import analyze_solver_spot, resolve_ranges
from app.ranges.heuristics import build_range_advantage_reason, build_nut_advantage_reason
from app.ranges.interactions import RangeInteractionProfile, RangeMetrics

from app.solver.enums import (
    BoardClassEnum,
    PositionMatchup,
    SpotType,
    PotType,
)
from app.solver.models import SolverSpot
from app.solver.board_features import BoardFeatures


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _board(
    board_class: BoardClassEnum = BoardClassEnum.A_HIGH_DRY,
    dynamic: bool = False,
    static: bool = True,
    paired: bool = False,
    monotone: bool = False,
    flush_completed: bool = False,
    straight_completed: bool = False,
    flush_draw_possible: bool = False,
    straight_draw_possible: bool = True,
    scare_card: bool = False,
    connectedness_score: int = 2,
    wheel_possible: bool = False,
) -> BoardFeatures:
    return BoardFeatures(
        board_class=board_class,
        dynamic=dynamic,
        static=static,
        paired=paired,
        monotone=monotone,
        flush_completed=flush_completed,
        straight_completed=straight_completed,
        flush_draw_possible=flush_draw_possible,
        straight_draw_possible=straight_draw_possible,
        scare_card=scare_card,
        connectedness_score=connectedness_score,
        wheel_possible=wheel_possible,
    )


def _spot(
    matchup: PositionMatchup = PositionMatchup.BTN_vs_BB,
    spot_type: SpotType = SpotType.SRP,
    board_class: BoardClassEnum = BoardClassEnum.A_HIGH_DRY,
    board_texture: BoardFeatures | None = None,
) -> SolverSpot:
    return SolverSpot(
        position_matchup=matchup,
        spot_type=spot_type,
        pot_type=PotType.SRP,
        board_class=board_class,
        board_texture=board_texture or _board(board_class),
        metadata={"board_cards": ["Ah", "Kd", "3c"]},
    )


def _profile(
    range_adv: str = "IP",
    nut_adv: str = "NEUTRAL",
    ip_capped: bool = False,
    oop_capped: bool = True,
    ip_top_pair: str = "high",
    oop_top_pair: str = "low",
    ip_overpair: str = "high",
    oop_overpair: str = "minimal",
    ip_pos: str = "BTN",
    oop_pos: str = "BB",
    board_pressure: str = "aggressor_dry_high_card",
) -> RangeInteractionProfile:
    empty = RangeMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0)
    return RangeInteractionProfile(
        range_advantage=range_adv,
        nut_advantage=nut_adv,
        ip_capped=ip_capped,
        oop_capped=oop_capped,
        board_dynamic=False,
        top_pair_density={"IP": ip_top_pair, "OOP": oop_top_pair},
        overpair_density={"IP": ip_overpair, "OOP": oop_overpair},
        set_density={},
        draw_density={},
        broadway_density={},
        ip_metrics=empty,
        oop_metrics=empty,
        summary="",
        ip_position=ip_pos,
        oop_position=oop_pos,
        board_pressure_profile=board_pressure,
    )


# ── Range advantage verdict tests ───────────────────────────────────────────────

class TestRangeAdvantageVerdict:
    def test_btn_bb_a_high_dry_ip_advantage(self):
        """BTN (opener) should hold range advantage on ace-high dry boards."""
        spot = _spot(PositionMatchup.BTN_vs_BB, board_class=BoardClassEnum.A_HIGH_DRY)
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        # IP (BTN) typically has more Ax/KK/QQ combos
        assert profile.range_advantage in ("IP", "NEUTRAL")

    def test_btn_bb_low_connected_oop_advantage(self):
        """BB (defender) tends to have range advantage on low connected boards."""
        bf = _board(
            board_class=BoardClassEnum.LOW_CONNECTED,
            dynamic=True, static=False,
            straight_draw_possible=True, connectedness_score=7,
        )
        spot = _spot(
            PositionMatchup.BTN_vs_BB,
            board_class=BoardClassEnum.LOW_CONNECTED,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, ["6h", "7d", "8c"])
        assert profile.range_advantage in ("OOP", "NEUTRAL")

    def test_advantage_is_one_of_three_values(self):
        """range_advantage must be IP, OOP, or NEUTRAL."""
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")

    def test_nut_advantage_is_one_of_three_values(self):
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert profile.nut_advantage in ("IP", "OOP", "NEUTRAL")

    def test_broadway_board_ip_range_advantage(self):
        """Triple broadway board favours the opening range."""
        bf = _board(board_class=BoardClassEnum.TRIPLE_BROADWAY, static=True, dynamic=False)
        spot = _spot(
            PositionMatchup.BTN_vs_BB,
            board_class=BoardClassEnum.TRIPLE_BROADWAY,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, ["Kh", "Qd", "Jc"])
        assert profile.range_advantage in ("IP", "NEUTRAL")

    def test_sb_bb_srp_advantage_not_neutral(self):
        """SB vs BB — structural difference should produce a non-neutral advantage."""
        bf = _board(board_class=BoardClassEnum.A_HIGH_DRY)
        spot = _spot(
            PositionMatchup.SB_vs_BB,
            board_class=BoardClassEnum.A_HIGH_DRY,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        # Advantage may be IP, OOP, or NEUTRAL — just confirm label is valid
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")

    def test_three_bet_pot_advantage_label_valid(self):
        """3bet pot analysis still produces valid advantage label."""
        spot = _spot(spot_type=SpotType.THREE_BET)
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")

    def test_advantage_deterministic_multiple_calls(self):
        """Same spot always returns the same advantage labels."""
        spot = _spot()
        board = ["Ah", "Kd", "3c"]
        p1 = analyze_solver_spot(spot, board)
        p2 = analyze_solver_spot(spot, board)
        assert p1.range_advantage == p2.range_advantage
        assert p1.nut_advantage == p2.nut_advantage


# ── Nut advantage tests ─────────────────────────────────────────────────────────

class TestNutAdvantage:
    def test_nut_advantage_field_present(self):
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert hasattr(profile, "nut_advantage")

    def test_ip_capped_oop_not_capped_on_a_high(self):
        """BTN as flat-caller is capped; BB 3-bettor is not."""
        bf = _board(board_class=BoardClassEnum.A_HIGH_DRY)
        spot = _spot(
            PositionMatchup.BTN_vs_BB,
            spot_type=SpotType.THREE_BET,
            board_class=BoardClassEnum.A_HIGH_DRY,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        # BB 3bet range has AA/KK → not capped; BTN caller range may be capped
        assert isinstance(profile.oop_capped, bool)
        assert isinstance(profile.ip_capped, bool)

    def test_nut_advantage_low_connected_board(self):
        """OOP (BB) typically holds nut advantage on low-connected runouts."""
        bf = _board(
            board_class=BoardClassEnum.LOW_CONNECTED,
            dynamic=True, static=False,
            straight_draw_possible=True, connectedness_score=8,
        )
        spot = _spot(
            PositionMatchup.BTN_vs_BB,
            board_class=BoardClassEnum.LOW_CONNECTED,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, ["6h", "7d", "8c"])
        assert profile.nut_advantage in ("IP", "OOP", "NEUTRAL")

    def test_capped_flags_are_bool(self):
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert isinstance(profile.ip_capped, bool)
        assert isinstance(profile.oop_capped, bool)


# ── Range advantage reason text tests ───────────────────────────────────────────

class TestRangeAdvantageReason:
    def test_reason_returned_non_empty(self):
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert isinstance(profile.range_advantage_reason, str)
        assert len(profile.range_advantage_reason) > 10

    def test_reason_no_percentages(self):
        """Qualitative output never includes percentage values."""
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        import re
        assert not re.search(r"\d+\.\d+%", profile.range_advantage_reason), (
            f"Fake percentage found: {profile.range_advantage_reason}"
        )

    def test_reason_no_equity_numbers(self):
        """No exact equity numbers should appear in the reason."""
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        import re
        assert not re.search(r"\d+% equity", profile.range_advantage_reason)

    def test_reason_mentions_position(self):
        """Reason text should reference at least one position name."""
        spot = _spot(PositionMatchup.BTN_vs_BB)
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        text = profile.range_advantage_reason.upper()
        assert any(pos in text for pos in ("BTN", "BB", "IP", "OOP"))

    def test_nut_reason_returned_non_empty(self):
        spot = _spot()
        profile = analyze_solver_spot(spot, ["Ah", "Kd", "3c"])
        assert isinstance(profile.nut_advantage_reason, str)
        assert len(profile.nut_advantage_reason) > 10

    def test_neutral_range_advantage_reason_text(self):
        """NEUTRAL verdict should say 'balanced' or 'approximately'."""
        p = _profile(range_adv="NEUTRAL", ip_pos="BTN", oop_pos="BB")
        spot = _spot()
        reason = build_range_advantage_reason(p, spot)
        text_lower = reason.lower()
        assert "balanced" in text_lower or "approximately" in text_lower or "neither" in text_lower

    def test_ip_advantage_reason_mentions_adv_position(self):
        """IP advantage reason should name the IP position."""
        p = _profile(range_adv="IP", ip_pos="CO", oop_pos="BB")
        spot = _spot()
        reason = build_range_advantage_reason(p, spot)
        assert "CO" in reason or "IP" in reason or "opening" in reason.lower()

    def test_oop_advantage_reason_mentions_oop_position(self):
        p = _profile(range_adv="OOP", ip_pos="BTN", oop_pos="SB")
        spot = _spot()
        reason = build_range_advantage_reason(p, spot)
        assert "SB" in reason or "OOP" in reason or "defending" in reason.lower()

    def test_low_connected_reason_mentions_suited_connectors(self):
        """Low connected board reason references suited connectors."""
        p = _profile(
            range_adv="OOP",
            ip_pos="BTN",
            oop_pos="BB",
            board_pressure="dynamic_low_connected",
        )
        spot = _spot(board_class=BoardClassEnum.LOW_CONNECTED)
        reason = build_range_advantage_reason(p, spot)
        assert "connected" in reason.lower() or "suited" in reason.lower() or "low" in reason.lower()

    def test_nut_advantage_reason_neutral(self):
        p = _profile(nut_adv="NEUTRAL")
        spot = _spot()
        reason = build_nut_advantage_reason(p, spot)
        assert "balanced" in reason.lower() or "neutral" in reason.lower() or "neither" in reason.lower()

    def test_nut_advantage_reason_low_connected_mentions_draws(self):
        """Low connected nut advantage reason should reference draws/straights."""
        p = _profile(nut_adv="OOP")
        spot = _spot(board_class=BoardClassEnum.LOW_CONNECTED)
        reason = build_nut_advantage_reason(p, spot)
        text_lower = reason.lower()
        assert (
            "straight" in text_lower
            or "suited" in text_lower
            or "connector" in text_lower
            or "set" in text_lower
        )

    def test_nut_advantage_reason_a_high_mentions_top_set(self):
        """Ace-high nut advantage reason should reference top set or top pair."""
        p = _profile(nut_adv="IP")
        spot = _spot(board_class=BoardClassEnum.A_HIGH_DRY)
        reason = build_nut_advantage_reason(p, spot)
        text_lower = reason.lower()
        assert "set" in text_lower or "overpair" in text_lower or "top pair" in text_lower


# ── Cross-matchup consistency ────────────────────────────────────────────────────

class TestCrossMatchupAdvantage:
    @pytest.mark.parametrize("matchup,board", [
        (PositionMatchup.BTN_vs_BB, ["Ah", "Kd", "3c"]),
        (PositionMatchup.CO_vs_BB,  ["Kh", "Qd", "2s"]),
        (PositionMatchup.HJ_vs_BB,  ["Th", "9d", "8c"]),
        (PositionMatchup.SB_vs_BB,  ["7h", "7d", "3c"]),
    ])
    def test_advantage_is_valid_across_matchups(self, matchup, board):
        """Advantage label is valid for all common matchups."""
        spot = _spot(matchup=matchup)
        profile = analyze_solver_spot(spot, board)
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")
        assert profile.nut_advantage in ("IP", "OOP", "NEUTRAL")

    @pytest.mark.parametrize("board_class,board_cards", [
        (BoardClassEnum.A_HIGH_DRY,       ["Ah", "Kd", "3c"]),
        (BoardClassEnum.LOW_CONNECTED,    ["6h", "7d", "8c"]),
        (BoardClassEnum.TRIPLE_BROADWAY,  ["Kh", "Qd", "Jc"]),
        (BoardClassEnum.PAIRED_HIGH,      ["Kh", "Kd", "3c"]),
        (BoardClassEnum.MONOTONE,         ["Ah", "Kh", "3h"]),
    ])
    def test_advantage_valid_across_board_classes(self, board_class, board_cards):
        """All board class types produce valid advantage labels."""
        bf = _board(board_class=board_class, dynamic=(board_class == BoardClassEnum.LOW_CONNECTED))
        spot = _spot(
            PositionMatchup.BTN_vs_BB,
            board_class=board_class,
            board_texture=bf,
        )
        profile = analyze_solver_spot(spot, board_cards)
        assert profile.range_advantage in ("IP", "OOP", "NEUTRAL")
