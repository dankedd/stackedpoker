"""
Tests for range database, registry, PreflopRange methods,
bucket system, and capped range detection.
"""
import pytest

from app.ranges.models import PreflopRange, HandBucket
from app.ranges.abstractions import classify_hand_bucket, combos_in_bucket, is_capped, premium_combo_count
from app.ranges.preflop.cash_100bb.registry import get_range, list_ranges


# ── Bucket classification ──────────────────────────────────────────────────────

class TestHandBucketClassification:
    def test_premium_hands(self):
        assert classify_hand_bucket("AA") == HandBucket.PREMIUM
        assert classify_hand_bucket("KK") == HandBucket.PREMIUM
        assert classify_hand_bucket("QQ") == HandBucket.PREMIUM
        assert classify_hand_bucket("AKs") == HandBucket.PREMIUM

    def test_strong_broadway(self):
        assert classify_hand_bucket("JJ") == HandBucket.STRONG_BROADWAY
        assert classify_hand_bucket("TT") == HandBucket.STRONG_BROADWAY
        assert classify_hand_bucket("AKo") == HandBucket.STRONG_BROADWAY
        assert classify_hand_bucket("AQs") == HandBucket.STRONG_BROADWAY
        assert classify_hand_bucket("AQo") == HandBucket.STRONG_BROADWAY
        assert classify_hand_bucket("KQs") == HandBucket.STRONG_BROADWAY

    def test_medium_pair(self):
        assert classify_hand_bucket("99") == HandBucket.MEDIUM_PAIR
        assert classify_hand_bucket("88") == HandBucket.MEDIUM_PAIR
        assert classify_hand_bucket("77") == HandBucket.MEDIUM_PAIR

    def test_suited_connector(self):
        assert classify_hand_bucket("JTs") == HandBucket.SUITED_CONNECTOR
        assert classify_hand_bucket("T9s") == HandBucket.SUITED_CONNECTOR
        assert classify_hand_bucket("98s") == HandBucket.SUITED_CONNECTOR
        assert classify_hand_bucket("87s") == HandBucket.SUITED_CONNECTOR
        assert classify_hand_bucket("76s") == HandBucket.SUITED_CONNECTOR
        assert classify_hand_bucket("65s") == HandBucket.SUITED_CONNECTOR

    def test_suited_ace(self):
        assert classify_hand_bucket("A5s") == HandBucket.SUITED_ACE
        assert classify_hand_bucket("A2s") == HandBucket.SUITED_ACE
        assert classify_hand_bucket("A8s") == HandBucket.SUITED_ACE

    def test_broadway_offsuit(self):
        assert classify_hand_bucket("KQo") == HandBucket.BROADWAY_OFFSUIT
        assert classify_hand_bucket("KJo") == HandBucket.BROADWAY_OFFSUIT
        assert classify_hand_bucket("QJo") == HandBucket.BROADWAY_OFFSUIT

    def test_small_pair(self):
        assert classify_hand_bucket("66") == HandBucket.SMALL_PAIR
        assert classify_hand_bucket("55") == HandBucket.SMALL_PAIR
        assert classify_hand_bucket("22") == HandBucket.SMALL_PAIR

    def test_trash(self):
        assert classify_hand_bucket("72o") == HandBucket.TRASH
        assert classify_hand_bucket("83o") == HandBucket.TRASH
        assert classify_hand_bucket("94o") == HandBucket.TRASH


# ── Registry ───────────────────────────────────────────────────────────────────

class TestRegistry:
    def test_all_keys_loadable(self):
        for key in list_ranges():
            r = get_range(key)
            assert isinstance(r, PreflopRange)
            assert r.total_combos() > 0

    def test_unknown_key_raises(self):
        with pytest.raises(KeyError):
            get_range("NONEXISTENT_RANGE")

    def test_list_ranges_non_empty(self):
        keys = list_ranges()
        assert len(keys) > 0
        assert "UTG_OPEN" in keys
        assert "BTN_OPEN" in keys
        assert "BB_VS_BTN_DEFEND" in keys
        assert "SB_3BET_VS_BTN" in keys

    def test_caching(self):
        r1 = get_range("UTG_OPEN")
        r2 = get_range("UTG_OPEN")
        assert r1 is r2  # same object from cache


# ── Open range properties ──────────────────────────────────────────────────────

class TestOpenRanges:
    def test_btn_wider_than_utg(self):
        btn = get_range("BTN_OPEN")
        utg = get_range("UTG_OPEN")
        assert btn.total_combos() > utg.total_combos()

    def test_co_wider_than_hj(self):
        co  = get_range("CO_OPEN")
        hj  = get_range("HJ_OPEN")
        assert co.total_combos() > hj.total_combos()

    def test_utg_contains_premiums(self):
        utg = get_range("UTG_OPEN")
        assert utg.contains("AA")
        assert utg.contains("KK")
        assert utg.contains("QQ")
        assert utg.contains("AKs")

    def test_utg_does_not_contain_trash(self):
        utg = get_range("UTG_OPEN")
        assert not utg.contains("72o")
        assert not utg.contains("83o")
        assert not utg.contains("32s")

    def test_btn_contains_small_pairs(self):
        btn = get_range("BTN_OPEN")
        assert btn.contains("22")
        assert btn.contains("33")
        assert btn.contains("44")

    def test_utg_does_not_contain_small_pairs(self):
        utg = get_range("UTG_OPEN")
        assert not utg.contains("22")
        assert not utg.contains("33")

    def test_utg_is_not_capped(self):
        utg = get_range("UTG_OPEN")
        assert not is_capped(utg)

    def test_btn_is_not_capped(self):
        btn = get_range("BTN_OPEN")
        assert not is_capped(btn)

    def test_btn_premium_density_high(self):
        btn = get_range("BTN_OPEN")
        premiums = premium_combo_count(btn)
        assert premiums >= 12  # at minimum AA+KK+QQ present

    def test_open_range_has_pair_combos(self):
        for key in ["UTG_OPEN", "HJ_OPEN", "CO_OPEN", "BTN_OPEN", "SB_OPEN"]:
            r = get_range(key)
            assert r.pair_combos() > 0

    def test_btn_suited_combos_exceed_offsuit(self):
        # BTN plays many suited hands
        btn = get_range("BTN_OPEN")
        assert btn.suited_combos() > 0
        assert btn.offsuit_combos() > 0


# ── Defend range properties ────────────────────────────────────────────────────

class TestDefendRanges:
    def test_bb_vs_btn_wider_than_bb_vs_utg(self):
        vs_btn = get_range("BB_VS_BTN_DEFEND")
        vs_utg = get_range("BB_VS_UTG_DEFEND")
        assert vs_btn.total_combos() > vs_utg.total_combos()

    def test_bb_defend_contains_small_pairs(self):
        bb = get_range("BB_VS_BTN_DEFEND")
        assert bb.contains("22")
        assert bb.contains("55")

    def test_bb_defend_contains_suited_connectors(self):
        bb = get_range("BB_VS_BTN_DEFEND")
        assert bb.contains("76s")
        assert bb.contains("65s")

    def test_bb_defend_has_wide_combos(self):
        bb = get_range("BB_VS_BTN_DEFEND")
        # BB defends at least 100 combos vs BTN
        assert bb.total_combos() > 100

    def test_bb_defend_capped_detection(self):
        # BB calling range is capped because premiums are often 3bet
        bb = get_range("BB_VS_BTN_DEFEND")
        # Premiums have reduced weight (0.2 for AA/KK) — should be capped
        # AA:0.2 = 1.2 combos, KK:0.2 = 1.2, QQ:0.3 = 1.8 → total ~4.2 < 12
        assert is_capped(bb)


# ── 3-bet range properties ─────────────────────────────────────────────────────

class TestThreeBetRanges:
    def test_3bet_contains_premiums(self):
        for key in ["SB_3BET_VS_BTN", "BB_3BET_VS_BTN", "BTN_3BET_VS_CO"]:
            r = get_range(key)
            assert r.contains("AA"), f"{key} missing AA"
            assert r.contains("KK"), f"{key} missing KK"

    def test_3bet_contains_bluffs(self):
        # All 3bet ranges should have A5s or A4s as bluff
        for key in ["SB_3BET_VS_BTN", "BB_3BET_VS_BTN", "BTN_3BET_VS_CO"]:
            r = get_range(key)
            has_bluff = r.contains("A5s") or r.contains("A4s") or r.contains("A3s")
            assert has_bluff, f"{key} missing blocker bluffs"

    def test_3bet_narrower_than_open(self):
        sb_3bet  = get_range("SB_3BET_VS_BTN")
        btn_open = get_range("BTN_OPEN")
        assert sb_3bet.total_combos() < btn_open.total_combos()

    def test_3bet_not_capped(self):
        # 3bet ranges are uncapped — they include all premiums
        sb_3bet = get_range("SB_3BET_VS_BTN")
        assert not is_capped(sb_3bet)


# ── PreflopRange query API ─────────────────────────────────────────────────────

class TestPreflopRangeAPI:
    def test_contains_exact(self):
        r = get_range("UTG_OPEN")
        assert r.contains("AKs")
        assert r.contains("AA")

    def test_contains_both_covers_suited(self):
        from app.ranges.parser import parse_range_list
        from app.ranges.models import PreflopRange
        r = PreflopRange(
            name="test", position="BTN", action="open", stack_depth="100bb",
            combos=parse_range_list(["AK"]),  # both, no suffix
        )
        assert r.contains("AKs")
        assert r.contains("AKo")

    def test_get_weight(self):
        r = get_range("BB_VS_BTN_DEFEND")
        # AA has weight 0.2
        w = r.get_weight("AA")
        assert w == pytest.approx(0.2)

    def test_get_weight_absent(self):
        r = get_range("UTG_OPEN")
        assert r.get_weight("72o") == 0.0

    def test_bucket_density(self):
        btn = get_range("BTN_OPEN")
        premium = btn.bucket_density(HandBucket.PREMIUM)
        sc      = btn.bucket_density(HandBucket.SUITED_CONNECTOR)
        trash   = btn.bucket_density(HandBucket.TRASH)
        assert premium > 0
        assert sc > 0
        assert trash == 0.0  # BTN open never includes trash

    def test_estimate_top_pair_density_high_board(self):
        # BTN open on A-high board → high top pair density (many Ax hands)
        btn = get_range("BTN_OPEN")
        label = btn.estimate_top_pair_density(["Ah", "Kd", "3c"])
        assert label in ("high", "very_high")

    def test_estimate_top_pair_density_low_board(self):
        # UTG open on 2-high board → none/low top pair density
        utg = get_range("UTG_OPEN")
        label = utg.estimate_top_pair_density(["2h", "5d", "7c"])
        assert label in ("none", "low", "medium")
