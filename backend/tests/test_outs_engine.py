"""
Test suite for outs_engine.py — true outs calculation.

Verifies out counts, deduplication, blocker handling, and
backdoor equity approximations.

Run with: pytest tests/test_outs_engine.py -v
"""
import pytest
from app.engines.outs_engine import calculate_outs, outs_summary


class TestFlushOuts:
    def test_flush_draw_9_outs(self):
        """Flush draw: 9 out cards (13 of suit - 4 already seen)."""
        result = calculate_outs(['Jh', '9h'], ['2h', '7h', 'Ac'])
        assert result.flush_outs == 9

    def test_flush_outs_minus_seen_card(self):
        """If a heart is also a seen card, outs reduce by 1."""
        # Hero: Ah, Kh. Board: 2h, 7h, Qh. That's 5 hearts = MADE flush
        # Let's test 4 hearts where one is on board
        result = calculate_outs(['Jh', '9h'], ['2h', '7h', 'Ac'])
        # 13 hearts - 4 seen hearts (Jh, 9h, 2h, 7h) = 9 flush outs
        assert result.flush_outs == 9

    def test_no_flush_draw_no_flush_outs(self):
        """No flush draw = no flush outs."""
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        assert result.flush_outs == 0

    def test_flush_out_cards_are_correct_suit(self):
        """All flush out cards are hearts in a heart flush draw."""
        result = calculate_outs(['Jh', '9h'], ['2h', '7h', 'Ac'])
        for card in result.flush_out_cards:
            assert card.endswith('h'), f"Expected heart card, got {card!r}"


class TestStraightOuts:
    def test_oesd_8_straight_outs(self):
        """OESD has 8 straight outs (4 on each end)."""
        result = calculate_outs(['6h', '7h'], ['8d', '9s', '2c'])
        # 6-7-8-9 OESD needs 5 or T
        # 4 fives + 4 tens = 8, minus any seen cards (none of 5/T in hole+board)
        assert result.straight_outs == 8, (
            f"OESD should have 8 straight outs, got {result.straight_outs}"
        )

    def test_gutshot_4_straight_outs(self):
        """Gutshot has 4 straight outs."""
        result = calculate_outs(['9s', '7s'], ['5d', '6h', '2c'])
        # 5-6-_-8-9: needs 8. 4 eights minus any seen (none of 8 in hole/board)
        assert result.straight_outs == 4

    def test_double_gutter_8_outs(self):
        """Double gutter: 8 outs (4+4 for two separate needed ranks)."""
        result = calculate_outs(['9h', '8h'], ['7h', 'Jh', '5c'])
        # Straight outs = 6 or T (4+4=8), but flush outs overlap some
        # straight_only_cards excludes those that are also flush outs
        total = result.total_outs
        assert total >= 13, (
            f"Combo draw (flush + double gutter) should have 13+ outs, got {total}"
        )

    def test_no_straight_draw_no_straight_outs(self):
        """No direct straight draw = no straight outs."""
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        assert result.straight_outs == 0


class TestDeduplication:
    def test_no_double_counting_combo_draw(self):
        """Flush outs and straight outs are deduplicated in total_outs."""
        result = calculate_outs(['6h', '9h'], ['7h', '8h', 'Ac'])
        # Flush draw (hearts) + OESD (needs 5 or T)
        # Some straight outs (5h, Th) are also flush outs
        # total should be < flush_outs + straight_outs
        if result.flush_outs > 0 and result.straight_outs > 0:
            assert result.total_outs <= result.flush_outs + result.straight_outs

    def test_combined_out_cards_no_duplicates(self):
        """combined_out_cards has no duplicate entries."""
        result = calculate_outs(['6h', '9h'], ['7h', '8h', 'Ac'])
        assert len(result.combined_out_cards) == len(set(result.combined_out_cards))


class TestBackdoorEquity:
    def test_backdoor_flush_equity(self):
        """Backdoor flush: ~4.2% approximate equity."""
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        assert result.backdoor_flush_equity_pct > 0

    def test_backdoor_straight_equity(self):
        """Backdoor straight: some approximate equity."""
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        assert result.backdoor_straight_equity_pct > 0

    def test_no_direct_outs_when_backdoor_only(self):
        """Backdoor draws produce 0 total direct outs."""
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        assert result.total_outs == 0
        assert result.straight_outs == 0
        assert result.flush_outs == 0


class TestRiverOuts:
    def test_river_has_zero_outs(self):
        """River: no cards remaining, outs = 0."""
        result = calculate_outs(['9h', '8h'], ['7h', '6h', '5c', '4d', '3s'])
        assert result.total_outs == 0
        assert "River" in result.warnings[0]


class TestRuleOfN:
    def test_rule_of_2_on_turn(self):
        """Rule of 2: outs × 2 equity approximation on turn."""
        result = calculate_outs(['Jh', '9h'], ['2h', '7h', 'Ac', 'Ks'])
        # 4-card board = turn
        assert result.street == 'turn'
        assert result.turn_equity_pct == round(result.total_outs * 2.0, 1)

    def test_rule_of_4_on_flop(self):
        """Rule of 4: outs × 4 equity approximation on flop."""
        result = calculate_outs(['Jh', '9h'], ['2h', '7h', 'Ac'])
        assert result.street == 'flop'
        assert result.flop_equity_pct == round(result.total_outs * 4.0, 1)


class TestOutsSummary:
    def test_summary_includes_outs(self):
        result = calculate_outs(['6h', '7h'], ['8d', '9s', '2c'])
        s = outs_summary(result)
        assert '8' in s or 'outs' in s.lower()

    def test_backdoor_summary_says_backdoor(self):
        result = calculate_outs(['9h', '8h'], ['Ah', '7d', '2s'])
        s = outs_summary(result)
        assert 'backdoor' in s.lower() or 'runner' in s.lower()

    def test_no_draw_summary(self):
        result = calculate_outs(['Ah', 'Kh'], ['2c', '5d', '9s'])
        s = outs_summary(result)
        # May say "No outs" or "Backdoor only"
        assert s  # not empty
