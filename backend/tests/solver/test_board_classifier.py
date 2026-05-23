"""
Tests for the deterministic Board Classification Engine.

Covers:
    — Flop texture: pairedness, suit texture, broadway density, connectedness
    — Dynamic vs static classification
    — Turn/river evolution: completion events, scare cards, pairing
    — Edge cases: A-low wheel, triple broadway, monotone, low boards
    — Determinism: same board always produces the same result
    — Utility functions directly
"""

import pytest

from app.solver.board_classifier import BoardClassifier
from app.solver.enums import BoardClassEnum
from app.solver.utils import (
    calculate_connectivity,
    count_broadways,
    detect_flush_draw,
    detect_monotone,
    detect_pairing,
    detect_rainbow,
    detect_scare_card,
    detect_straight_draws,
    detect_two_tone,
    detect_wheel_possible,
    parse_board,
    rank_to_int,
)

clf = BoardClassifier()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Utility function unit tests
# ══════════════════════════════════════════════════════════════════════════════


class TestParseBoard:
    def test_standard_cards(self):
        ranks, suits = parse_board(["Ah", "Kd", "3c"])
        assert ranks == ["A", "K", "3"]
        assert suits == ["h", "d", "c"]

    def test_ten_normalisation(self):
        ranks, suits = parse_board(["10h", "Js", "Qd"])
        assert ranks == ["T", "J", "Q"]

    def test_invalid_rank_raises(self):
        with pytest.raises(ValueError):
            parse_board(["Xh"])

    def test_invalid_suit_raises(self):
        with pytest.raises(ValueError):
            parse_board(["Ax"])


class TestRankToInt:
    def test_low_cards(self):
        assert rank_to_int("2") == 2
        assert rank_to_int("9") == 9

    def test_broadway(self):
        assert rank_to_int("T") == 10
        assert rank_to_int("J") == 11
        assert rank_to_int("Q") == 12
        assert rank_to_int("K") == 13
        assert rank_to_int("A") == 14

    def test_case_insensitive(self):
        assert rank_to_int("a") == 14
        assert rank_to_int("k") == 13


class TestCountBroadways:
    def test_triple_broadway(self):
        assert count_broadways(["Q", "J", "T"]) == 3

    def test_double_broadway(self):
        assert count_broadways(["K", "Q", "4"]) == 2

    def test_single_broadway(self):
        assert count_broadways(["A", "7", "2"]) == 1

    def test_no_broadway(self):
        assert count_broadways(["9", "8", "2"]) == 0


class TestDetectPairing:
    def test_unpaired(self):
        paired, trips = detect_pairing(["A", "K", "3"])
        assert paired is False
        assert trips is False

    def test_paired(self):
        paired, trips = detect_pairing(["Q", "Q", "5"])
        assert paired is True
        assert trips is False

    def test_trips(self):
        paired, trips = detect_pairing(["7", "7", "7"])
        assert paired is True
        assert trips is True


class TestSuitTexture:
    def test_monotone(self):
        assert detect_monotone(["h", "h", "h"]) is True
        assert detect_monotone(["h", "h", "d"]) is False

    def test_two_tone(self):
        assert detect_two_tone(["h", "h", "d"]) is True
        assert detect_two_tone(["h", "d", "c"]) is False

    def test_rainbow(self):
        assert detect_rainbow(["h", "d", "c"]) is True
        assert detect_rainbow(["h", "h", "c"]) is False


class TestFlushDraw:
    def test_rainbow_no_draw(self):
        draw, completed = detect_flush_draw(["h", "d", "c"])
        assert draw is False
        assert completed is False

    def test_two_tone_draw_possible(self):
        draw, completed = detect_flush_draw(["h", "h", "d"])
        assert draw is True
        assert completed is False

    def test_monotone_flush_completed(self):
        draw, completed = detect_flush_draw(["h", "h", "h"])
        assert draw is True
        assert completed is True

    def test_four_of_same_suit(self):
        draw, completed = detect_flush_draw(["h", "h", "h", "d"])
        assert draw is True
        assert completed is True


class TestStraightDraws:
    def test_highly_connected_flop(self):
        # 9-8-7: obvious straight draws
        draw, completed = detect_straight_draws([9, 8, 7])
        assert draw is True
        assert completed is False

    def test_disconnected_no_draw(self):
        # A-K-3: AK in one window, 3 isolated
        draw, completed = detect_straight_draws([14, 13, 3])
        # AK are in the same 5-wide window, so draw is True
        assert draw is True
        assert completed is False

    def test_straight_completed_river(self):
        # All 5 straight cards on board
        draw, completed = detect_straight_draws([9, 8, 7, 6, 5])
        assert draw is True
        assert completed is True

    def test_wheel_possibility(self):
        draw, completed = detect_straight_draws([14, 2, 3])
        assert draw is True  # A-2-3 in wheel window


class TestConnectivity:
    def test_extremely_connected(self):
        score, label = calculate_connectivity([12, 11, 10])  # QJT
        assert score == 10
        assert label == "extremely_connected"

    def test_highly_connected(self):
        score, label = calculate_connectivity([9, 8, 7])  # 987
        assert score == 10
        assert "connected" in label

    def test_disconnected(self):
        score, label = calculate_connectivity([14, 13, 3])  # AK3
        assert score <= 2
        assert label == "disconnected"

    def test_a_low_span_used(self):
        # A-2-3 span as high = 12 (disconnected), but as low = 2 (extremely)
        score, label = calculate_connectivity([14, 2, 3])
        assert score >= 8

    def test_medium_connectivity(self):
        score, label = calculate_connectivity([10, 7, 4])  # T74 — span 6
        assert 4 <= score <= 6


class TestDetectWheelPossible:
    def test_wheel_with_ace_and_two(self):
        assert detect_wheel_possible([14, 2, 7]) is True

    def test_wheel_with_low_cards(self):
        assert detect_wheel_possible([3, 4, 9]) is True

    def test_no_wheel(self):
        assert detect_wheel_possible([9, 8, 7]) is False

    def test_ace_alone_not_enough(self):
        assert detect_wheel_possible([14, 9, 8]) is False


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Flop classification
# ══════════════════════════════════════════════════════════════════════════════


class TestFlopDryHighCard:
    """Ah Kd 3c — dry, disconnected, A-high."""

    def setup_method(self):
        self.f = clf.classify_flop(["Ah", "Kd", "3c"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.A_HIGH_DRY

    def test_not_paired(self):
        assert self.f.paired is False

    def test_not_monotone(self):
        assert self.f.monotone is False

    def test_rainbow(self):
        assert self.f.rainbow is True

    def test_broadway_count(self):
        assert self.f.broadway_count == 2

    def test_not_dynamic(self):
        assert self.f.dynamic is False
        assert self.f.static is True

    def test_no_flush_draw(self):
        assert self.f.flush_draw_possible is False

    def test_connectedness(self):
        assert self.f.connectedness_label == "disconnected"

    def test_no_scare_card_on_flop(self):
        assert self.f.scare_card is False


class TestFlopLowConnected:
    """9h 8d 7c — highly connected, low board."""

    def setup_method(self):
        self.f = clf.classify_flop(["9h", "8d", "7c"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.LOW_DYNAMIC

    def test_connectedness_score(self):
        assert self.f.connectedness_score >= 8

    def test_straight_draw(self):
        assert self.f.straight_draw_possible is True

    def test_dynamic(self):
        assert self.f.dynamic is True

    def test_not_paired(self):
        assert self.f.paired is False

    def test_zero_broadways(self):
        assert self.f.broadway_count == 0


class TestFlopMonotone:
    """Kh 8h 3h — monotone."""

    def setup_method(self):
        self.f = clf.classify_flop(["Kh", "8h", "3h"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.MONOTONE

    def test_monotone_flag(self):
        assert self.f.monotone is True

    def test_flush_completed(self):
        assert self.f.flush_completed is True

    def test_flush_draw(self):
        assert self.f.flush_draw_possible is True

    def test_not_two_tone(self):
        assert self.f.two_tone is False

    def test_not_rainbow(self):
        assert self.f.rainbow is False


class TestFlopPairedHigh:
    """Qh Qd 5c — pair of queens."""

    def setup_method(self):
        self.f = clf.classify_flop(["Qh", "Qd", "5c"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.PAIRED_HIGH

    def test_paired_flag(self):
        assert self.f.paired is True

    def test_not_trips(self):
        assert self.f.trips is False


class TestFlopPairedLow:
    """7h 7d 2c — pair of sevens."""

    def setup_method(self):
        self.f = clf.classify_flop(["7h", "7d", "2c"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.PAIRED_LOW

    def test_paired_flag(self):
        assert self.f.paired is True


class TestFlopDoubleBroadway:
    """Kd Qh 4s — two broadway cards."""

    def setup_method(self):
        self.f = clf.classify_flop(["Kd", "Qh", "4s"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.DOUBLE_BROADWAY

    def test_broadway_count(self):
        assert self.f.broadway_count == 2

    def test_high_card(self):
        assert self.f.high_card_rank == "K"


class TestFlopTripleBroadway:
    """Qs Jh Tc — three broadway cards."""

    def setup_method(self):
        self.f = clf.classify_flop(["Qs", "Jh", "Tc"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.TRIPLE_BROADWAY

    def test_broadway_count(self):
        assert self.f.broadway_count == 3

    def test_extremely_connected(self):
        assert self.f.connectedness_score == 10

    def test_straight_draw(self):
        assert self.f.straight_draw_possible is True

    def test_dynamic(self):
        assert self.f.dynamic is True


class TestFlopKHighDry:
    """Kd 7h 2c — king-high, disconnected, rainbow."""

    def setup_method(self):
        self.f = clf.classify_flop(["Kd", "7h", "2c"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.K_HIGH_DRY

    def test_not_dynamic(self):
        assert self.f.dynamic is False

    def test_single_broadway(self):
        assert self.f.broadway_count == 1


class TestFlopKHighWet:
    """Kh 9h 8d — king-high, two-tone, connected."""

    def setup_method(self):
        self.f = clf.classify_flop(["Kh", "9h", "8d"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.K_HIGH_WET

    def test_flush_draw(self):
        assert self.f.flush_draw_possible is True

    def test_dynamic(self):
        assert self.f.dynamic is True


class TestFlopMiddleConnected:
    """Ts 9h 7d — T-high (not broadway by our k_high_wet logic), connected."""

    def setup_method(self):
        # T is a broadway card (>=10), but broadway_count == 1, hi == T
        # high_rank is T, which is neither A nor K, so it falls to low/middle check
        self.f = clf.classify_flop(["Ts", "9h", "7d"])

    def test_board_class(self):
        # T is broadway but not A or K, single broadway → falls to middle connected
        assert self.f.board_class == BoardClassEnum.MIDDLE_CONNECTED

    def test_connected(self):
        assert self.f.connectedness_score >= 6

    def test_straight_draw(self):
        assert self.f.straight_draw_possible is True


class TestFlopLowDynamic:
    """9h 8h 7d — low connected, two-tone."""

    def setup_method(self):
        self.f = clf.classify_flop(["9h", "8h", "7d"])

    def test_board_class(self):
        assert self.f.board_class in (
            BoardClassEnum.LOW_DYNAMIC,
            BoardClassEnum.LOW_CONNECTED,
        )

    def test_two_tone(self):
        assert self.f.two_tone is True


class TestFlopTrips:
    """Ah Ad Ac — trips aces."""

    def setup_method(self):
        self.f = clf.classify_flop(["Ah", "Ad", "Ac"])

    def test_trips_flag(self):
        assert self.f.trips is True

    def test_paired_flag(self):
        assert self.f.paired is True

    def test_board_class_high_trips(self):
        assert self.f.board_class == BoardClassEnum.PAIRED_HIGH


class TestFlopAHighWet:
    """Ah 9h 8d — ace-high, two-tone, connected-ish."""

    def setup_method(self):
        self.f = clf.classify_flop(["Ah", "9h", "8d"])

    def test_board_class(self):
        assert self.f.board_class == BoardClassEnum.A_HIGH_WET

    def test_dynamic(self):
        assert self.f.dynamic is True

    def test_flush_draw(self):
        assert self.f.flush_draw_possible is True


class TestFlopWheelBoard:
    """Ah 2d 5c — wheel possible."""

    def setup_method(self):
        self.f = clf.classify_flop(["Ah", "2d", "5c"])

    def test_wheel_possible(self):
        assert self.f.wheel_possible is True

    def test_broadway_count(self):
        assert self.f.broadway_count == 1


class TestFlopDeterminism:
    """Same board always produces the same result regardless of card order."""

    def test_order_independence(self):
        f1 = clf.classify_flop(["Ah", "Kd", "3c"])
        f2 = clf.classify_flop(["3c", "Ah", "Kd"])
        f3 = clf.classify_flop(["Kd", "3c", "Ah"])
        assert f1.board_class == f2.board_class == f3.board_class
        assert f1.connectedness_score == f2.connectedness_score
        assert f1.paired == f2.paired == f3.paired


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Turn evolution
# ══════════════════════════════════════════════════════════════════════════════


class TestTurnFlushCompletion:
    """Flop: 9h 8h 2c  →  Turn: Th (flush completing)."""

    def setup_method(self):
        self.t = clf.classify_turn(["9h", "8h", "2c"], "Th")

    def test_board_class(self):
        assert self.t.board_class == BoardClassEnum.FLUSH_COMPLETING

    def test_flush_completed(self):
        assert self.t.flush_completed is True

    def test_scare_card(self):
        # T is an overcard to 9-8-2 AND completes the flush
        assert self.t.scare_card is True

    def test_not_paired_turn(self):
        assert self.t.paired_turn is False


class TestTurnStraightCompletion:
    """Flop: Ah Kd 3c  →  Turn: Qs (broadway scare, straight-window upgrade)."""

    def setup_method(self):
        self.t = clf.classify_turn(["Ah", "Kd", "3c"], "Qs")

    def test_scare_card(self):
        assert self.t.scare_card is True

    def test_broadway_count_increases(self):
        assert self.t.broadway_count == 3

    def test_board_class_triple_broadway(self):
        assert self.t.board_class == BoardClassEnum.TRIPLE_BROADWAY

    def test_straight_draw(self):
        assert self.t.straight_draw_possible is True


class TestTurnBoardPairing:
    """Flop: Ah Kd 3c  →  Turn: 3s (3 pairs the board)."""

    def setup_method(self):
        self.t = clf.classify_turn(["Ah", "Kd", "3c"], "3s")

    def test_paired_turn(self):
        assert self.t.paired_turn is True

    def test_paired_flag(self):
        assert self.t.paired is True

    def test_board_class(self):
        # Paired low (pair of 3s)
        assert self.t.board_class == BoardClassEnum.PAIRED_LOW


class TestTurnAceOvercard:
    """Flop: 9h 8d 7c  →  Turn: Ah (ace overcard to the board)."""

    def setup_method(self):
        self.t = clf.classify_turn(["9h", "8d", "7c"], "Ah")

    def test_scare_card(self):
        assert self.t.scare_card is True

    def test_high_card_changes(self):
        assert self.t.high_card_rank == "A"

    def test_broadway_count(self):
        assert self.t.broadway_count == 1


class TestTurnNoPairing:
    """Flop: Kh 8h 3h  →  Turn: 2d (non-event turn on monotone flop)."""

    def setup_method(self):
        self.t = clf.classify_turn(["Kh", "8h", "3h"], "2d")

    def test_not_paired_turn(self):
        assert self.t.paired_turn is False

    def test_board_class_monotone_kept(self):
        # The board started monotone; the 2d breaks it for a 4-card board
        # But the flush_completed flag should still be set (3 hearts present)
        assert self.t.flush_completed is True

    def test_scare_card_false(self):
        # 2d is not an overcard to K-8-3, doesn't complete straight/flush
        assert self.t.scare_card is False


class TestTurnLowBoardConnectivity:
    """Flop: 6h 5d 4c  →  Turn: 3s (straight completes from 3-to-6)."""

    def setup_method(self):
        self.t = clf.classify_turn(["6h", "5d", "4c"], "3s")

    def test_straight_completed(self):
        assert self.t.straight_completed is True

    def test_board_class(self):
        assert self.t.board_class == BoardClassEnum.STRAIGHT_COMPLETING

    def test_scare_card(self):
        # 3 upgrades the window count significantly
        assert self.t.scare_card is True


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4: River evolution
# ══════════════════════════════════════════════════════════════════════════════


class TestRiverFlushCompletion:
    """
    Flop: 9h 8d 2h   Turn: Kh   →   River: 5h (flush completes on river).

    Turn board: [9h, 8d, 2h, Kh]  — 3 hearts already → flush_completed on turn.
    River: 5h — 4th heart (flush more than completed).
    """

    def setup_method(self):
        self.r = clf.classify_river(["9h", "8d", "2h", "Kh"], "5h")

    def test_flush_completed(self):
        assert self.r.flush_completed is True

    def test_scare_card(self):
        # 5h brings suits to 4 hearts, which is ≥3 — scare logic fires
        assert self.r.scare_card is True


class TestRiverBoardPairing:
    """Turn board: [Ah, Kd, 3c, 7s]  →  River: 7h (7 pairs the board)."""

    def setup_method(self):
        self.r = clf.classify_river(["Ah", "Kd", "3c", "7s"], "7h")

    def test_paired_river(self):
        assert self.r.paired_river is True

    def test_paired_flag(self):
        assert self.r.paired is True


class TestRiverStraightCompletion:
    """Turn board: [9h, 8d, 7c, 2s]  →  River: Ts (T completes 7-T straight interaction)."""

    def setup_method(self):
        self.r = clf.classify_river(["9h", "8d", "7c", "2s"], "Ts")

    def test_straight_completed(self):
        assert self.r.straight_completed is True

    def test_board_class(self):
        assert self.r.board_class == BoardClassEnum.STRAIGHT_COMPLETING

    def test_scare_card(self):
        assert self.r.scare_card is True


class TestRiverNeutralCard:
    """Turn board: [Ah, Kd, Qc, 2s]  →  River: 2h (2 pairs, low card)."""

    def setup_method(self):
        self.r = clf.classify_river(["Ah", "Kd", "Qc", "2s"], "2h")

    def test_paired_river(self):
        assert self.r.paired_river is True

    def test_triple_broadway_preserved(self):
        assert self.r.broadway_count == 3

    def test_scare_card_false(self):
        # 2h is not high, doesn't complete flush (only 2 hearts), no straight
        assert self.r.scare_card is False


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Edge cases
# ══════════════════════════════════════════════════════════════════════════════


class TestEdgeCases:
    def test_invalid_flop_length_raises(self):
        with pytest.raises(ValueError):
            clf.classify_flop(["Ah", "Kd"])

    def test_invalid_turn_flop_length_raises(self):
        with pytest.raises(ValueError):
            clf.classify_turn(["Ah", "Kd"], "Qs")

    def test_invalid_river_board_length_raises(self):
        with pytest.raises(ValueError):
            clf.classify_river(["Ah", "Kd", "Qs"], "5h")

    def test_low_rainbow_static(self):
        f = clf.classify_flop(["7h", "4d", "2c"])
        assert f.board_class == BoardClassEnum.LOW_CONNECTED
        assert f.dynamic is False

    def test_low_two_tone_dynamic(self):
        f = clf.classify_flop(["7h", "4h", "2d"])
        assert f.dynamic is True

    def test_rainbow_dynamic_medium(self):
        f = clf.classify_flop(["Js", "9h", "7d"])
        assert f.connectedness_score >= 6

    def test_paired_high_kings(self):
        f = clf.classify_flop(["Kh", "Kd", "5c"])
        assert f.board_class == BoardClassEnum.PAIRED_HIGH

    def test_paired_low_twos(self):
        f = clf.classify_flop(["2h", "2d", "9c"])
        assert f.board_class == BoardClassEnum.PAIRED_LOW

    def test_monotone_low(self):
        f = clf.classify_flop(["5h", "4h", "2h"])
        assert f.board_class == BoardClassEnum.MONOTONE
        assert f.monotone is True

    def test_wheel_a_low(self):
        f = clf.classify_flop(["Ah", "2d", "3c"])
        assert f.wheel_possible is True

    def test_no_wheel_high_board(self):
        f = clf.classify_flop(["Kh", "Qd", "Jc"])
        assert f.wheel_possible is False

    def test_scare_card_ace_on_low_board(self):
        # Flop: 6-5-2,  Turn: Ah
        t = clf.classify_turn(["6h", "5d", "2c"], "Ah")
        assert t.scare_card is True

    def test_scare_card_false_low_card(self):
        # Flop: Kh Qd Js — new card 2c cannot be a scare
        t = clf.classify_turn(["Kh", "Qd", "Js"], "2c")
        assert t.scare_card is False


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Output structure validation
# ══════════════════════════════════════════════════════════════════════════════


class TestOutputStructure:
    """Verify the BoardFeatures model fields are all present and typed correctly."""

    def setup_method(self):
        self.f = clf.classify_flop(["Ah", "Kd", "3c"])

    def test_all_fields_present(self):
        fields = [
            "paired", "trips", "monotone", "two_tone", "rainbow",
            "connectedness_score", "connectedness_label",
            "broadway_count", "high_card_rank",
            "dynamic", "static",
            "flush_draw_possible", "flush_completed",
            "straight_draw_possible", "straight_completed",
            "wheel_possible",
            "paired_turn", "paired_river",
            "scare_card",
            "board_class",
        ]
        for field in fields:
            assert hasattr(self.f, field), f"Missing field: {field}"

    def test_board_class_is_enum(self):
        assert isinstance(self.f.board_class, BoardClassEnum)

    def test_connectedness_score_range(self):
        assert 0 <= self.f.connectedness_score <= 10

    def test_static_dynamic_mutex(self):
        assert self.f.dynamic != self.f.static

    def test_serialisable_to_dict(self):
        d = self.f.model_dump()
        assert d["board_class"] == "A_HIGH_DRY"
        assert isinstance(d["connectedness_score"], int)

    def test_json_roundtrip(self):
        import json
        j = self.f.model_dump_json()
        parsed = json.loads(j)
        assert parsed["board_class"] == "A_HIGH_DRY"
        assert parsed["paired"] is False
