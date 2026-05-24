"""
Tests for similarity_score() and parse_node_key().

Invariants:
  - Identical keys → 1.0
  - Asymmetry: score(a,b) == score(b,a)
  - Ordering: more-similar pairs score higher than less-similar pairs
  - Different spot type → score significantly lower (weight 0.30)
  - Same spot type, same board group, same SPR → score near 1.0
  - IP vs OOP position mismatch → position_similarity = 0.0
"""

from __future__ import annotations

import pytest

from app.strategy_db.similarity import (
    _board_similarity,
    _position_similarity,
    _spr_similarity,
    parse_node_key,
    similarity_score,
    similarity_breakdown,
)


# ── Canonical keys for testing ────────────────────────────────────────────────

_SRP_BTN_BB_DRY  = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
_SRP_BTN_BB_DRY2 = "SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p"
_SRP_CO_BB_DRY   = "SRP::CO_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
_SRP_BTN_BB_LOW  = "SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p"
_SRP_BTN_BB_DRY_TURN = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::turn::2p"
_3BET_BTN_BB_DRY = "3BET::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
_SRP_BTN_BB_DRY_LOW_SPR = "SRP::BTN_vs_BB::100bb::0_2::A_HIGH_DRY::flop::2p"
_MULTIWAY_SRP    = "SRP::MULTIWAY_3WAY::100bb::8_PLUS::A_HIGH_DRY::flop::3p"

# Extended key variants
_SRP_BTN_BB_DRY_IP  = _SRP_BTN_BB_DRY + "::ip"
_SRP_BTN_BB_DRY_OOP = _SRP_BTN_BB_DRY + "::oop"


class TestParseNodeKey:
    def test_parses_all_7_fields(self):
        d = parse_node_key(_SRP_BTN_BB_DRY)
        assert d["spot_type"] == "SRP"
        assert d["position_matchup"] == "BTN_vs_BB"
        assert d["stack_depth_bucket"] == "100bb"
        assert d["spr_bucket"] == "8_PLUS"
        assert d["board_class"] == "A_HIGH_DRY"
        assert d["street"] == "flop"
        assert d["player_count"] == 2

    def test_parses_extended_ip_key(self):
        d = parse_node_key(_SRP_BTN_BB_DRY_IP)
        assert d["is_ip"] is True
        assert d["spot_type"] == "SRP"

    def test_parses_extended_oop_key(self):
        d = parse_node_key(_SRP_BTN_BB_DRY_OOP)
        assert d["is_ip"] is False

    def test_player_count_integer(self):
        d = parse_node_key(_MULTIWAY_SRP)
        assert d["player_count"] == 3

    def test_invalid_key_raises(self):
        with pytest.raises(ValueError):
            parse_node_key("bad::key")


class TestBoardSimilarity:
    def test_identical(self):
        assert _board_similarity("A_HIGH_DRY", "A_HIGH_DRY") == 1.0

    def test_same_group(self):
        # A_HIGH_DRY and K_HIGH_DRY are both "dry_high_card"
        s = _board_similarity("A_HIGH_DRY", "K_HIGH_DRY")
        assert s == 1.0

    def test_adjacent_group(self):
        # dry_high_card is adjacent to broadway
        s = _board_similarity("A_HIGH_DRY", "DOUBLE_BROADWAY")
        assert s == pytest.approx(0.55)

    def test_unrelated_group(self):
        s = _board_similarity("A_HIGH_DRY", "LOW_DYNAMIC")
        assert s == 0.10

    def test_symmetric(self):
        assert _board_similarity("MONOTONE", "LOW_DYNAMIC") == _board_similarity("LOW_DYNAMIC", "MONOTONE")

    def test_all_17_board_classes_covered(self):
        classes = [
            "A_HIGH_DRY", "A_HIGH_WET", "K_HIGH_DRY", "K_HIGH_WET",
            "LOW_CONNECTED", "LOW_DYNAMIC", "MIDDLE_CONNECTED",
            "DOUBLE_BROADWAY", "TRIPLE_BROADWAY",
            "PAIRED_LOW", "PAIRED_HIGH",
            "MONOTONE", "RAINBOW_STATIC", "RAINBOW_DYNAMIC",
            "FLUSH_COMPLETING", "STRAIGHT_COMPLETING", "NEUTRAL",
        ]
        for c in classes:
            s = _board_similarity(c, c)
            assert s == 1.0, f"{c} self-similarity != 1.0"

    def test_unknown_class_returns_unrelated(self):
        s = _board_similarity("UNKNOWN_CLASS", "A_HIGH_DRY")
        assert s == 0.10  # falls back to unrelated


class TestSPRSimilarity:
    def test_identical(self):
        assert _spr_similarity("8_PLUS", "8_PLUS") == 1.0

    def test_adjacent_buckets(self):
        # 4_8 and 8_PLUS are 1 apart
        s = _spr_similarity("4_8", "8_PLUS")
        assert 0.5 < s < 1.0

    def test_distant_buckets(self):
        # 0_2 and 8_PLUS are 3 apart (max)
        s = _spr_similarity("0_2", "8_PLUS")
        assert s == 0.0

    def test_monotone_ordering(self):
        s01 = _spr_similarity("0_2", "2_4")
        s12 = _spr_similarity("2_4", "4_8")
        s23 = _spr_similarity("4_8", "8_PLUS")
        s02 = _spr_similarity("0_2", "4_8")
        # adjacent pairs should score higher than non-adjacent
        assert s01 > s02

    def test_symmetric(self):
        assert _spr_similarity("0_2", "4_8") == _spr_similarity("4_8", "0_2")


class TestPositionSimilarity:
    def test_identical(self):
        assert _position_similarity("BTN_vs_BB", "BTN_vs_BB") == 1.0

    def test_same_family_ip(self):
        # BTN and CO are both "late" position
        s = _position_similarity("BTN_vs_BB", "CO_vs_BB")
        assert s >= 0.80

    def test_different_family_ip(self):
        # BTN (late) vs UTG (early)
        s = _position_similarity("BTN_vs_BB", "UTG_vs_BB")
        assert 0.3 < s < 0.9  # same IP side but different family

    def test_ip_vs_oop_is_zero(self):
        # BTN (IP) vs SB (OOP)
        s = _position_similarity("BTN_vs_BB", "SB_vs_BB")
        assert s == 0.0

    def test_both_multiway(self):
        s = _position_similarity("MULTIWAY_3WAY", "MULTIWAY_4WAY")
        assert s == 0.70

    def test_multiway_vs_headsup(self):
        s = _position_similarity("MULTIWAY_3WAY", "BTN_vs_BB")
        assert s == 0.20


class TestSimilarityScore:
    def test_identical_key_is_one(self):
        assert similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY) == pytest.approx(1.0, abs=1e-6)

    def test_symmetry(self):
        a = similarity_score(_SRP_BTN_BB_DRY, _3BET_BTN_BB_DRY)
        b = similarity_score(_3BET_BTN_BB_DRY, _SRP_BTN_BB_DRY)
        assert a == pytest.approx(b, abs=1e-9)

    def test_different_spot_type_lower_than_same(self):
        same_spot = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY2)
        diff_spot = similarity_score(_SRP_BTN_BB_DRY, _3BET_BTN_BB_DRY)
        assert same_spot > diff_spot

    def test_same_family_position_higher_than_different_board(self):
        # Same spot + position family + SPR, different board group
        close = similarity_score(_SRP_CO_BB_DRY, _SRP_BTN_BB_DRY)
        # A_HIGH_DRY vs LOW_DYNAMIC (same everything else)
        distant = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_LOW)
        assert close > distant

    def test_different_street_lower_than_same(self):
        same_street = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY2)
        diff_street = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY_TURN)
        assert same_street > diff_street

    def test_low_spr_vs_high_spr_penalty(self):
        same_spr = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY)
        diff_spr = similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY_LOW_SPR)
        assert same_spr > diff_spr

    def test_extended_keys_handled(self):
        s = similarity_score(_SRP_BTN_BB_DRY_IP, _SRP_BTN_BB_DRY_OOP)
        assert 0.0 <= s <= 1.0

    def test_invalid_key_returns_zero(self):
        assert similarity_score("bad_key", _SRP_BTN_BB_DRY) == 0.0

    def test_score_in_range(self):
        pairs = [
            (_SRP_BTN_BB_DRY, _3BET_BTN_BB_DRY),
            (_SRP_BTN_BB_DRY, _SRP_BTN_BB_LOW),
            (_SRP_BTN_BB_DRY, _MULTIWAY_SRP),
        ]
        for a, b in pairs:
            s = similarity_score(a, b)
            assert 0.0 <= s <= 1.0, f"score out of range for ({a!r}, {b!r}): {s}"

    def test_breakdown_total_matches_score(self):
        bd = similarity_breakdown(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY2)
        assert bd["total"] == pytest.approx(
            similarity_score(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY2), abs=1e-4
        )

    def test_dry_boards_within_same_group(self):
        # A_HIGH_DRY and K_HIGH_DRY are in same board group → board sim = 1.0
        bd = similarity_breakdown(_SRP_BTN_BB_DRY, _SRP_BTN_BB_DRY2)
        assert bd["dimensions"]["board_class"] == 1.0
