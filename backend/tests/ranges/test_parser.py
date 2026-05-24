"""
Tests for range parser and utils.

Covers: normalization, combo counting, hand entry parsing,
range string parsing, edge cases.
"""
import pytest

from app.ranges.utils import normalize_hand, hand_to_ranks, is_suited, is_offsuit, is_pair, raw_combo_count, hand_gap
from app.ranges.parser import parse_hand_entry, parse_range_string, parse_range_list
from app.ranges.models import RangeCombo


# ── Normalization ──────────────────────────────────────────────────────────────

class TestNormalizeHand:
    def test_pocket_pair(self):
        assert normalize_hand("AA") == "AA"
        assert normalize_hand("22") == "22"
        assert normalize_hand("TT") == "TT"

    def test_suited_uppercase(self):
        assert normalize_hand("AKs") == "AKs"
        assert normalize_hand("aks") == "AKs"
        assert normalize_hand("T9s") == "T9s"

    def test_offsuit_uppercase(self):
        assert normalize_hand("AKo") == "AKo"
        assert normalize_hand("ako") == "AKo"
        assert normalize_hand("72o") == "72o"

    def test_higher_rank_first(self):
        assert normalize_hand("KAs") == "AKs"
        assert normalize_hand("2As") == "A2s"
        assert normalize_hand("9Ts") == "T9s"

    def test_both_no_suffix(self):
        assert normalize_hand("AK") == "AK"
        assert normalize_hand("76") == "76"

    def test_pair_drops_suffix(self):
        # Pairs can't have s/o in standard notation — normalize strips it
        assert normalize_hand("AAs") == "AA"
        assert normalize_hand("AAo") == "AA"

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            normalize_hand("")
        with pytest.raises(ValueError):
            normalize_hand("A")
        with pytest.raises(ValueError):
            normalize_hand("XKs")


# ── Utility functions ──────────────────────────────────────────────────────────

class TestHandUtilities:
    def test_is_suited(self):
        assert is_suited("AKs") is True
        assert is_suited("AKo") is False
        assert is_suited("AK") is False
        assert is_suited("AA") is False

    def test_is_offsuit(self):
        assert is_offsuit("AKo") is True
        assert is_offsuit("AKs") is False
        assert is_offsuit("AA") is False

    def test_is_pair(self):
        assert is_pair("AA") is True
        assert is_pair("22") is True
        assert is_pair("AKs") is False
        assert is_pair("AKo") is False

    def test_raw_combo_count_pair(self):
        assert raw_combo_count("AA") == 6
        assert raw_combo_count("KK") == 6
        assert raw_combo_count("22") == 6

    def test_raw_combo_count_suited(self):
        assert raw_combo_count("AKs") == 4
        assert raw_combo_count("T9s") == 4
        assert raw_combo_count("76s") == 4

    def test_raw_combo_count_offsuit(self):
        assert raw_combo_count("AKo") == 12
        assert raw_combo_count("72o") == 12

    def test_raw_combo_count_both(self):
        assert raw_combo_count("AK") == 16
        assert raw_combo_count("T9") == 16

    def test_hand_gap(self):
        assert hand_gap("AKs") == 1
        assert hand_gap("T9s") == 1
        assert hand_gap("JTs") == 1
        assert hand_gap("A5s") == 9   # A=12, 5=3 → gap=9
        assert hand_gap("72o") == 5   # 7=5, 2=0 → gap=5
        assert hand_gap("AA") == 0


# ── Parse hand entry ──────────────────────────────────────────────────────────

class TestParseHandEntry:
    def test_simple_pair(self):
        c = parse_hand_entry("AA")
        assert c.hand == "AA"
        assert c.weight == 1.0
        assert c.pocket_pair is True
        assert c.suited is False
        assert c.offsuit is False
        assert c.raw_combos == 6
        assert c.combo_count == 6.0

    def test_suited_hand(self):
        c = parse_hand_entry("AKs")
        assert c.hand == "AKs"
        assert c.suited is True
        assert c.offsuit is False
        assert c.raw_combos == 4
        assert c.combo_count == 4.0

    def test_offsuit_hand(self):
        c = parse_hand_entry("AKo")
        assert c.hand == "AKo"
        assert c.suited is False
        assert c.offsuit is True
        assert c.raw_combos == 12
        assert c.combo_count == 12.0

    def test_weighted_hand(self):
        c = parse_hand_entry("QJo:0.5")
        assert c.hand == "QJo"
        assert c.weight == 0.5
        assert c.raw_combos == 12
        assert c.combo_count == pytest.approx(6.0)

    def test_weighted_suited(self):
        c = parse_hand_entry("A5s:0.75")
        assert c.hand == "A5s"
        assert c.weight == 0.75
        assert c.combo_count == pytest.approx(3.0)

    def test_invalid_weight(self):
        with pytest.raises(ValueError):
            parse_hand_entry("AKs:1.5")
        with pytest.raises(ValueError):
            parse_hand_entry("AKs:-0.1")

    def test_invalid_hand(self):
        with pytest.raises(ValueError):
            parse_hand_entry("XKs")

    def test_both_no_suffix(self):
        c = parse_hand_entry("AK")
        assert c.hand == "AK"
        assert c.suited is False
        assert c.offsuit is False
        assert c.raw_combos == 16
        assert c.combo_count == 16.0


# ── Parse range string ────────────────────────────────────────────────────────

class TestParseRangeString:
    def test_comma_separated(self):
        result = parse_range_string("AA, KK, QQ, AKs")
        hands = [c.hand for c in result]
        assert "AA" in hands
        assert "KK" in hands
        assert "AKs" in hands
        assert len(result) == 4

    def test_mixed_weights(self):
        result = parse_range_string("AA, AKs:0.5, QJo:0.33")
        weights = {c.hand: c.weight for c in result}
        assert weights["AA"] == 1.0
        assert weights["AKs"] == pytest.approx(0.5)
        assert weights["QJo"] == pytest.approx(0.33)

    def test_deduplication(self):
        # Later entry should override earlier
        result = parse_range_string("AKs, AKs:0.5")
        aks = [c for c in result if c.hand == "AKs"]
        assert len(aks) == 1
        assert aks[0].weight == pytest.approx(0.5)

    def test_total_combo_count(self):
        # AA(6) + KK(6) + AKs(4) + AKo(12) = 28
        result = parse_range_string("AA, KK, AKs, AKo")
        total = sum(c.combo_count for c in result)
        assert total == pytest.approx(28.0)

    def test_empty_string(self):
        assert parse_range_string("") == []


# ── Parse range list ──────────────────────────────────────────────────────────

class TestParseRangeList:
    def test_basic(self):
        result = parse_range_list(["AA", "KK", "AKs:0.5"])
        assert len(result) == 3
        assert result[0].hand == "AA"

    def test_combo_counts(self):
        result = parse_range_list(["AA", "AKs", "AKo"])
        total = sum(c.combo_count for c in result)
        assert total == pytest.approx(6 + 4 + 12)
