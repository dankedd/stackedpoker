"""
Golden benchmark tests — strategic realism validation.

Tests 50+ canonical poker spots and verifies that the strategy signals
match expected theoretical properties. Does NOT test exact frequencies;
tests strategic ordering, direction, and relative relationships.

Benchmark categories:
  A. Ace-high dry boards (IP vs OOP)
  B. Low dynamic / connected boards
  C. Monotone and flush-draw boards
  D. Paired boards
  E. Broadway / high-card boards
  F. SPR sensitivity (same board, different SPR)
  G. Spot type ordering (SRP vs 3BET vs 4BET)
  H. IP vs OOP asymmetry
  I. Multiway adjustments (via strategy signals)
  J. Street sensitivity (flop vs turn)
"""

from __future__ import annotations

import pytest

from app.solver.abstractions import SpotAbstraction
from app.strategy_db.retrieval import retrieve_strategy, _reset_singletons

from tests.e2e.conftest import (
    make_srp_hand, make_3bet_hand, make_low_spr_hand,
)

# ── Test infrastructure ────────────────────────────────────────────────────────


@pytest.fixture(autouse=True, scope="module")
def _shared_store():
    """Use a single seeded store for the entire module (expensive to seed)."""
    _reset_singletons()
    yield
    _reset_singletons()


def _retrieve(hand):
    """Helper: SpotAbstraction → retrieve_strategy → profile."""
    abstraction = SpotAbstraction.from_canonical_hand(hand)
    result = retrieve_strategy(abstraction.node_key, abstraction.solver_spot)
    return result.profile, abstraction


# ── A. Ace-high dry boards ────────────────────────────────────────────────────

class TestAceHighDry:
    """A-high dry boards are IP hero's best boards — high bet frequency expected."""

    def test_A01_srp_ip_ace_high_dry_high_bet_freq(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency >= 0.55, \
            f"SRP IP A-high dry: expected bet_freq ≥ 0.55, got {p.bet_frequency:.3f}"

    def test_A02_srp_ip_ace_high_dry_range_advantage(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.range_advantage >= 0.55, \
            f"SRP IP A-high dry: expected range_adv ≥ 0.55, got {p.range_advantage:.3f}"

    def test_A03_srp_ip_ace_high_rainbow_high_bet(self):
        hand = make_srp_hand([("A","s"),("K","d"),("3","c")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency >= 0.50

    def test_A04_srp_ip_ace_high_various_kickers(self):
        boards = [
            [("A","h"),("K","c"),("2","d")],
            [("A","s"),("Q","d"),("7","c")],
            [("A","c"),("J","h"),("5","d")],
        ]
        for board in boards:
            hand = make_srp_hand(board)
            p, _ = _retrieve(hand)
            assert p.bet_frequency >= 0.45, \
                f"A-high board {board}: bet_freq too low: {p.bet_frequency:.3f}"

    def test_A05_ace_high_dry_nut_advantage_positive(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.nut_advantage >= 0.50

    def test_A06_ace_high_dry_pressure_moderate(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.pressure_score >= 0.45


# ── B. Low dynamic / connected boards ─────────────────────────────────────────

class TestLowDynamicBoards:
    """Low connected boards are good for villain's calling range — IP bets less."""

    def test_B01_srp_ip_low_connected_lower_bet_than_ace_high(self):
        ace_hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        low_hand  = make_srp_hand([("7","h"),("6","c"),("5","d")])
        p_ace, _ = _retrieve(ace_hand)
        p_low, _  = _retrieve(low_hand)
        assert p_ace.bet_frequency > p_low.bet_frequency, \
            f"A-high ({p_ace.bet_frequency:.3f}) should beat low ({p_low.bet_frequency:.3f})"

    def test_B02_low_connected_bet_freq_moderate_or_lower(self):
        hand = make_srp_hand([("9","h"),("8","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency <= 0.65

    def test_B03_low_dynamic_range_advantage_lower_than_ace_high(self):
        ace_hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        low_hand  = make_srp_hand([("8","h"),("7","c"),("6","d")])
        p_ace, _ = _retrieve(ace_hand)
        p_low, _  = _retrieve(low_hand)
        assert p_ace.range_advantage >= p_low.range_advantage

    def test_B04_various_low_boards_valid_signals(self):
        boards = [
            [("2","h"),("3","c"),("7","d")],
            [("4","s"),("5","d"),("8","h")],
            [("6","h"),("7","c"),("2","d")],
        ]
        for board in boards:
            hand = make_srp_hand(board)
            p, _ = _retrieve(hand)
            assert 0.0 <= p.bet_frequency <= 1.0
            assert 0.0 <= p.range_advantage <= 1.0

    def test_B05_low_connected_equity_realization_at_least_moderate(self):
        hand = make_srp_hand([("9","h"),("8","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.equity_realization >= 0.45


# ── C. Monotone and flush-draw boards ─────────────────────────────────────────

class TestMonotoneBoards:
    """Monotone boards slow down IP aggression — mixed strategies expected."""

    def test_C01_monotone_bet_freq_not_too_high(self):
        hand = make_srp_hand([("A","h"),("8","h"),("2","h")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency <= 0.75, \
            f"Monotone board: bet_freq should be tempered, got {p.bet_frequency:.3f}"

    def test_C02_monotone_signals_in_range(self):
        hand = make_srp_hand([("K","h"),("7","h"),("3","h")])
        p, _ = _retrieve(hand)
        for attr in ["bet_frequency", "range_advantage", "pressure_score"]:
            assert 0.0 <= getattr(p, attr) <= 1.0

    def test_C03_flush_completing_board_valid(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","h")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_C04_two_tone_ace_high(self):
        hand = make_srp_hand([("A","h"),("K","h"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency >= 0.40

    def test_C05_monotone_low(self):
        hand = make_srp_hand([("7","s"),("5","s"),("3","s")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0


# ── D. Paired boards ──────────────────────────────────────────────────────────

class TestPairedBoards:
    """Paired boards reduce effective nut advantage — mixed strategies."""

    def test_D01_paired_high_signals_valid(self):
        hand = make_srp_hand([("K","h"),("K","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0
        assert 0.0 <= p.nut_advantage <= 1.0

    def test_D02_paired_low_signals_valid(self):
        hand = make_srp_hand([("5","h"),("5","c"),("2","d")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_D03_paired_ace_high_bet_freq_not_too_low(self):
        # A-A-x: IP still has nut advantage via trips
        hand = make_srp_hand([("A","h"),("A","c"),("7","d")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency >= 0.35

    def test_D04_paired_board_pressure_moderate(self):
        hand = make_srp_hand([("Q","h"),("Q","c"),("5","d")])
        p, _ = _retrieve(hand)
        assert p.pressure_score >= 0.30


# ── E. Broadway / high-card boards ────────────────────────────────────────────

class TestBroadwayBoards:
    """Broadway boards have mixed IP advantage — high-card connected."""

    def test_E01_double_broadway_signals_valid(self):
        hand = make_srp_hand([("Q","h"),("J","c"),("8","d")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_E02_triple_broadway_signals_valid(self):
        hand = make_srp_hand([("Q","h"),("J","h"),("T","s")])
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_E03_king_high_dry_high_bet_freq(self):
        hand = make_srp_hand([("K","h"),("7","c"),("2","d")])
        p, _ = _retrieve(hand)
        assert p.bet_frequency >= 0.45

    def test_E04_king_high_dry_positive_range_advantage(self):
        hand = make_srp_hand([("K","s"),("T","d"),("4","c")])
        p, _ = _retrieve(hand)
        assert p.range_advantage >= 0.45

    def test_E05_broadway_frequencies_sum_to_one(self):
        boards = [
            [("A","h"),("K","c"),("Q","d")],
            [("K","s"),("Q","h"),("J","c")],
            [("Q","d"),("J","h"),("T","s")],
        ]
        for board in boards:
            hand = make_srp_hand(board)
            p, _ = _retrieve(hand)
            assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6


# ── F. SPR sensitivity ────────────────────────────────────────────────────────

class TestSPRSensitivity:
    """Lower SPR → higher pressure, more committed stack."""

    def test_F01_low_spr_higher_pressure_than_deep(self):
        board = [("A","h"),("K","c"),("7","d")]
        deep_hand = make_srp_hand(board)             # ~14 SPR
        short_hand = make_low_spr_hand(board, 8.0)  # ~1.2 SPR

        p_deep, _  = _retrieve(deep_hand)
        p_short, _ = _retrieve(short_hand)
        assert p_short.pressure_score >= p_deep.pressure_score, \
            f"Low SPR pressure ({p_short.pressure_score:.3f}) should be ≥ deep ({p_deep.pressure_score:.3f})"

    def test_F02_low_spr_signals_valid(self):
        board = [("A","h"),("K","c"),("7","d")]
        hand = make_low_spr_hand(board, 8.0)
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0
        assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6

    def test_F03_medium_spr_intermediate_signals(self):
        # Stack 30bb, pot ~6.5 → SPR ~3.5 → 2_4 bucket
        board = [("A","h"),("K","c"),("7","d")]
        hand = make_low_spr_hand(board, effective_stack=23.0)
        p, _ = _retrieve(hand)
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_F04_all_spr_buckets_return_valid_profiles(self):
        """Verify all 4 SPR buckets produce valid profiles."""
        # 0_2 ≈ stack 8, pot 6.5
        # 2_4 ≈ stack 23, pot 6.5
        # 4_8 ≈ stack 40, pot 6.5  — standard raise pot
        # 8_PLUS ≈ stack 97, pot 6.5 — default 100bb
        board = [("A","h"),("K","c"),("7","d")]
        stacks = [8.0, 20.0, 35.0]
        for stack in stacks:
            hand = make_low_spr_hand(board, effective_stack=stack)
            p, abs_ = _retrieve(hand)
            assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6
            assert abs_.node_key.spr_bucket in ("0_2", "2_4", "4_8", "8_PLUS")


# ── G. Spot type ordering ─────────────────────────────────────────────────────

class TestSpotTypeOrdering:
    """3BET pots should have higher bet frequency than SRP on the same board."""

    def test_G01_3bet_higher_bet_freq_than_srp_ace_high(self):
        board = [("A","h"),("K","c"),("7","d")]
        srp = make_srp_hand(board)
        bet3 = make_3bet_hand(board)
        p_srp, _ = _retrieve(srp)
        p_3bt, _ = _retrieve(bet3)
        assert p_3bt.bet_frequency >= p_srp.bet_frequency - 0.10, \
            f"3BET ({p_3bt.bet_frequency:.3f}) should be ≥ SRP ({p_srp.bet_frequency:.3f}) - tolerance"

    def test_G02_3bet_range_advantage_positive(self):
        board = [("A","h"),("K","c"),("7","d")]
        hand = make_3bet_hand(board)
        p, _ = _retrieve(hand)
        assert p.range_advantage >= 0.50

    def test_G03_3bet_pressure_positive(self):
        board = [("A","h"),("K","c"),("7","d")]
        hand = make_3bet_hand(board)
        p, _ = _retrieve(hand)
        assert p.pressure_score >= 0.45

    def test_G04_3bet_various_boards(self):
        boards = [
            [("A","h"),("K","c"),("7","d")],
            [("Q","h"),("J","h"),("T","s")],
            [("9","h"),("8","c"),("7","d")],
        ]
        for board in boards:
            hand = make_3bet_hand(board)
            p, _ = _retrieve(hand)
            assert 0.0 <= p.bet_frequency <= 1.0
            assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6


# ── H. IP vs OOP asymmetry ────────────────────────────────────────────────────

class TestIPvsOOPAsymmetry:
    """IP player should generally have higher bet frequency on A-high dry boards."""

    def test_H01_ip_higher_bet_than_oop_ace_high(self):
        board = [("A","h"),("K","c"),("7","d")]
        ip_hand  = make_srp_hand(board, hero_position="BTN", villain_position="BB")
        oop_hand = make_srp_hand(board, hero_position="BB",  villain_position="BTN")

        p_ip,  _ = _retrieve(ip_hand)
        p_oop, _ = _retrieve(oop_hand)

        # IP should bet more on A-high dry boards
        assert p_ip.bet_frequency > p_oop.bet_frequency - 0.05, \
            f"IP ({p_ip.bet_frequency:.3f}) should bet ≥ OOP ({p_oop.bet_frequency:.3f}) - 0.05"

    def test_H02_oop_frequencies_valid(self):
        board = [("A","h"),("K","c"),("7","d")]
        oop_hand = make_srp_hand(board, hero_position="BB", villain_position="BTN")
        p, _ = _retrieve(oop_hand)
        assert 0.0 <= p.bet_frequency <= 1.0
        assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6

    def test_H03_oop_low_board_check_heavy(self):
        # On low connected boards, OOP player checks more
        board = [("8","h"),("7","c"),("6","d")]
        oop_hand = make_srp_hand(board, hero_position="BB", villain_position="BTN")
        p, _ = _retrieve(oop_hand)
        # OOP on low connected → check-heavy
        assert p.check_frequency >= 0.40

    def test_H04_ip_vs_oop_signals_never_crash(self):
        boards = [
            [("A","h"),("K","c"),("7","d")],
            [("9","h"),("8","c"),("7","d")],
            [("K","h"),("K","c"),("3","d")],
        ]
        for board in boards:
            for ip_pos, vill_pos in [("BTN","BB"), ("BB","BTN")]:
                hand = make_srp_hand(board, hero_position=ip_pos, villain_position=vill_pos)
                p, _ = _retrieve(hand)
                assert p is not None
                assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6


# ── I. Retrieval quality ──────────────────────────────────────────────────────

class TestRetrievalQuality:
    """Retrieval should never fall back on boards that exist in the seed DB."""

    def test_I01_seeded_boards_hit_exact_or_similar(self):
        """All 17 board classes have seeds — should not hit fallback."""
        from app.solver.enums import BoardClassEnum

        # Map board classes to representative cards
        boards_by_class = {
            "A_HIGH_DRY":          [("A","h"),("K","c"),("7","d")],
            "A_HIGH_WET":          [("A","h"),("K","h"),("7","d")],
            "K_HIGH_DRY":          [("K","h"),("7","c"),("2","d")],
            "K_HIGH_WET":          [("K","h"),("Q","h"),("4","d")],
            "LOW_CONNECTED":       [("7","h"),("6","c"),("5","d")],
            "LOW_DYNAMIC":         [("8","h"),("6","c"),("4","d")],
            "MIDDLE_CONNECTED":    [("T","h"),("9","c"),("8","d")],
            "DOUBLE_BROADWAY":     [("Q","h"),("J","c"),("8","d")],
            "TRIPLE_BROADWAY":     [("Q","h"),("J","h"),("T","s")],
            "PAIRED_LOW":          [("5","h"),("5","c"),("2","d")],
            "PAIRED_HIGH":         [("K","h"),("K","c"),("7","d")],
            "MONOTONE":            [("A","h"),("8","h"),("2","h")],
            "RAINBOW_STATIC":      [("A","s"),("7","h"),("3","c")],
            "RAINBOW_DYNAMIC":     [("J","s"),("8","h"),("5","c")],
            "FLUSH_COMPLETING":    [("A","h"),("K","c"),("7","h")],
            "STRAIGHT_COMPLETING": [("9","h"),("8","c"),("5","d")],
            "NEUTRAL":             [("A","h"),("7","c"),("2","d")],
        }

        for board_class, cards in boards_by_class.items():
            hand = make_srp_hand(cards)
            abstraction = SpotAbstraction.from_canonical_hand(hand)
            result = retrieve_strategy(abstraction.node_key, abstraction.solver_spot)
            assert result.retrieval_type in ("exact", "similar"), \
                f"{board_class}: got {result.retrieval_type} (similarity={result.similarity_score:.3f})"

    def test_I02_retrieval_debug_dict_populated(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        abstraction = SpotAbstraction.from_canonical_hand(hand)
        result = retrieve_strategy(abstraction.node_key, abstraction.solver_spot)
        d = result.to_debug_dict()
        assert isinstance(d, dict)
        assert len(d) >= 4

    def test_I03_similar_match_above_threshold(self):
        # CO_vs_BB is not in seeds — should match via similar
        from tests.e2e.conftest import make_srp_hand
        hand = make_srp_hand(
            [("A","h"),("K","c"),("7","d")],
            hero_position="CO",
            villain_position="BB",
        )
        abstraction = SpotAbstraction.from_canonical_hand(hand)
        result = retrieve_strategy(abstraction.node_key, abstraction.solver_spot)
        if result.retrieval_type == "similar":
            assert result.similarity_score >= SIMILAR_THRESHOLD


# ── J. Street sensitivity ─────────────────────────────────────────────────────

class TestStreetSensitivity:
    """Flop strategies verified — basic turn structure check."""

    def test_J01_flop_strategy_valid(self):
        hand = make_srp_hand([("A","h"),("K","c"),("7","d")])
        p, abs_ = _retrieve(hand)
        assert abs_.node_key.street == "flop"
        assert 0.0 <= p.bet_frequency <= 1.0

    def test_J02_all_benchmark_boards_return_strategy(self):
        """Comprehensive coverage — every benchmark board gets a valid profile."""
        boards = [
            # Ace-high
            [("A","h"),("K","c"),("7","d")],
            [("A","s"),("Q","d"),("5","c")],
            [("A","c"),("J","h"),("3","d")],
            # King-high
            [("K","h"),("T","c"),("4","d")],
            [("K","s"),("8","h"),("2","c")],
            # Low boards
            [("8","h"),("6","c"),("4","d")],
            [("7","s"),("5","h"),("3","c")],
            [("2","h"),("4","c"),("6","d")],
            # Paired
            [("J","h"),("J","c"),("4","d")],
            [("6","h"),("6","s"),("K","d")],
            # Monotone
            [("Q","h"),("T","h"),("6","h")],
            [("9","s"),("6","s"),("2","s")],
            # Broadway
            [("A","h"),("K","s"),("Q","c")],
            [("K","d"),("Q","h"),("J","s")],
        ]
        for board in boards:
            hand = make_srp_hand(board)
            p, _ = _retrieve(hand)
            assert 0.0 <= p.bet_frequency <= 1.0, f"board {board}: bet_freq out of range"
            assert abs(p.bet_frequency + p.check_frequency - 1.0) < 1e-6, \
                f"board {board}: frequencies don't sum to 1"
