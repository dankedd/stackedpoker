"""
Test suite for hand_evaluator.py — 5-card hand ranking.

Tests all hand categories, tiebreakers, Ace-low straights,
and the evaluate_hole_and_board() interface.

Run with: pytest tests/test_hand_evaluator.py -v
"""
import pytest
from app.engines.hand_evaluator import (
    best_hand,
    evaluate_hole_and_board,
    classify_made_hand_category,
    has_pair_or_better,
    parse_card,
    HandRank,
)


class TestBasicHandCategories:
    def test_straight_flush(self):
        h = best_hand(['5h', '6h', '7h', '8h', '9h'])
        assert h.category == 8
        assert h.category_name == 'straight_flush'

    def test_royal_flush(self):
        h = best_hand(['Th', 'Jh', 'Qh', 'Kh', 'Ah'])
        assert h.category == 8
        assert 'Royal' in h.description

    def test_quads(self):
        h = best_hand(['Ah', 'As', 'Ad', 'Ac', '9h'])
        assert h.category == 7
        assert h.category_name == 'quads'

    def test_full_house(self):
        h = best_hand(['Kh', 'Ks', 'Kd', 'Ah', 'As'])
        assert h.category == 6
        assert h.category_name == 'full_house'

    def test_flush(self):
        h = best_hand(['2h', '5h', '9h', 'Jh', 'Ah'])
        assert h.category == 5
        assert h.category_name == 'flush'

    def test_straight(self):
        h = best_hand(['5h', '6d', '7c', '8s', '9h'])
        assert h.category == 4
        assert h.category_name == 'straight'

    def test_trips(self):
        h = best_hand(['9h', '9s', '9d', 'Kh', '2c'])
        assert h.category == 3
        assert h.category_name == 'trips'

    def test_two_pair(self):
        h = best_hand(['Ah', 'As', 'Kh', 'Ks', '7c'])
        assert h.category == 2
        assert h.category_name == 'two_pair'

    def test_pair(self):
        h = best_hand(['Ah', 'As', 'Kh', 'Qc', '7d'])
        assert h.category == 1
        assert h.category_name == 'pair'

    def test_high_card(self):
        h = best_hand(['2h', '5d', '7c', 'Jh', 'Ah'])
        # Not flush (different suits), not straight (gaps)
        assert h.category == 0
        assert h.category_name == 'high_card'


class TestAceLowStraight:
    def test_wheel_A2345(self):
        h = best_hand(['Ah', '2d', '3c', '4s', '5h'])
        assert h.category == 4
        assert h.category_name == 'straight'

    def test_wheel_high_card_is_5(self):
        """Ace-low straight (wheel) has a high card of 5, not Ace."""
        h = best_hand(['Ah', '2d', '3c', '4s', '5h'])
        # tiebreak should be (4, 5) — straight with high=5
        assert h.tiebreak[1] == 5

    def test_wheel_beats_nothing(self):
        """Wheel (A-5 straight) beats all non-straights."""
        wheel = best_hand(['Ah', '2d', '3c', '4s', '5h'])
        flush = best_hand(['2h', '5h', '9h', 'Jh', 'Kh'])
        assert flush > wheel  # flush beats straight


class TestBestHandFrom7Cards:
    def test_best_flush_from_7(self):
        """Best 5 from 7 includes flush."""
        h = best_hand(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2d', '7s'])
        assert h.category == 8  # Royal flush
        assert h.category_name == 'straight_flush'

    def test_best_straight_from_7(self):
        """Best 5 from 7 selects highest straight."""
        h = best_hand(['5h', '6d', '7c', '8s', '9h', 'Th', '2c'])
        # Should pick 6-7-8-9-T (highest possible)
        assert h.category == 4
        assert h.tiebreak[1] == 10  # T-high straight


class TestEvaluateHoleAndBoard:
    def test_top_pair_TPTK(self):
        result = evaluate_hole_and_board(['Ah', 'Kh'], ['Ac', '7d', '2s'])
        assert result.category == 1  # pair
        assert result.tiebreak[1] == 14  # pair of aces

    def test_two_pair(self):
        result = evaluate_hole_and_board(['Jc', 'Tc'], ['Jd', 'Th', '3s'])
        assert result.category == 2
        assert result.category_name == 'two_pair'

    def test_straight_on_board(self):
        result = evaluate_hole_and_board(['Ah', 'Kh'], ['Qd', 'Jc', 'Ts'])
        assert result.category == 4
        assert result.category_name == 'straight'

    def test_set(self):
        result = evaluate_hole_and_board(['7h', '7s'], ['7d', '2c', 'Ah'])
        assert result.category == 3
        assert result.category_name == 'trips'

    def test_full_house(self):
        result = evaluate_hole_and_board(['Ah', 'As'], ['Ad', 'Kh', 'Ks'])
        assert result.category == 6
        assert result.category_name == 'full_house'


class TestClassifyMadeHandCategory:
    def test_no_board(self):
        cat = classify_made_hand_category(['Ah', 'Kh'], [])
        assert cat == 'high_card'

    def test_pair(self):
        cat = classify_made_hand_category(['Ah', 'Kh'], ['Ac', '7d', '2s'])
        assert cat == 'pair'

    def test_flush_draw_does_not_make_flush(self):
        """4 to a flush is not a made flush."""
        cat = classify_made_hand_category(['9h', '8h'], ['7h', '6h', 'Ac'])
        assert cat == 'straight'  # 5-6-7-8-9 straight! Not flush (only 4 hearts)


class TestHasPairOrBetter:
    def test_pair_or_better_true_for_pair(self):
        assert has_pair_or_better(['Ah', 'Kh'], ['Ac', '7d', '2s'])

    def test_pair_or_better_false_for_high_card(self):
        assert not has_pair_or_better(['Jh', 'Kh'], ['2c', '5d', '9s'])

    def test_pair_or_better_true_for_set(self):
        assert has_pair_or_better(['Ah', 'As'], ['Ad', '2c', '7h'])


class TestHandComparisons:
    def test_flush_beats_straight(self):
        flush = best_hand(['2h', '5h', '9h', 'Jh', 'Ah'])
        straight = best_hand(['5h', '6d', '7c', '8s', '9d'])
        assert flush > straight

    def test_two_pair_beats_pair(self):
        tp = best_hand(['Ah', 'As', 'Kh', 'Ks', '7c'])
        p = best_hand(['Ah', 'As', 'Kh', 'Qc', '7d'])
        assert tp > p

    def test_higher_pair_wins(self):
        aces = best_hand(['Ah', 'As', '2d', '5c', '9h'])
        kings = best_hand(['Kh', 'Ks', '2d', '5c', '9h'])
        assert aces > kings

    def test_same_hand_equal(self):
        h1 = best_hand(['Ah', 'As', '2d', '5c', '9h'])
        h2 = best_hand(['Ac', 'Ad', '2h', '5s', '9d'])
        assert h1 == h2
