"""
Puzzle Integrity & Decision Ordering regression tests.

Covers:
  - Flush detection (4 suited ≠ flush, 5 suited = flush)
  - Flush draw detection (exactly 4 suited cards)
  - Backdoor flush detection (exactly 3 suited cards on flop)
  - Straight draw detection (OESD, gutshot, double gutter)
  - Board texture (paired, monotone, disconnected, dynamic)
  - Nut flush ranking correctness
  - River draw suppression
  - Puzzle validation pipeline
  - Action ordering (passive → aggressive)
  - Sizing order (ascending)
"""
import pytest

from app.engines.hand_evaluator import (
    best_hand,
    evaluate_hole_and_board,
    parse_card,
)
from app.engines.draw_evaluator import analyze_draws
from app.engines.poker_state import _has_nut_flush, _has_near_nut_flush
from app.engines.puzzle_validator import (
    validate_puzzle_state,
    PuzzleData,
    PuzzleStep,
    PuzzleOption,
)


# ═══════════════════════════════════════════════════════════════════════════════
# FLUSH DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

class TestFlushDetection:
    """CRITICAL: Only 5+ suited cards in the best 5-card hand = flush."""

    def test_4_suited_is_NOT_flush(self):
        """4 suited cards does NOT make a flush — this was the primary bug."""
        result = evaluate_hole_and_board(["Ah", "Kh"], ["Qh", "Jh", "2c"])
        assert result.category_name != "flush", (
            f"4 suited cards classified as flush: {result.description}"
        )

    def test_5_suited_IS_flush(self):
        """Exactly 5 suited cards = flush."""
        result = evaluate_hole_and_board(["Ah", "Kh"], ["Qh", "Jh", "2h"])
        assert result.category_name == "flush", (
            f"5 suited cards NOT classified as flush: {result.description}"
        )

    def test_6_suited_IS_flush(self):
        """6 suited cards = still a flush."""
        result = evaluate_hole_and_board(["Ah", "Kh"], ["Qh", "Jh", "9h", "2h"])
        assert result.category_name == "flush"

    def test_7_suited_IS_flush(self):
        """All 7 cards same suit = flush (or straight flush)."""
        result = evaluate_hole_and_board(["Ah", "3h"], ["Kh", "Jh", "9h", "7h", "2h"])
        assert result.category in (5, 8)  # flush or straight flush

    def test_monotone_flop_no_flush(self):
        """3 suited board + 1 suited hero = 4 suited, NOT flush."""
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Qh", "Jh", "9h"])
        assert result.category_name != "flush"

    def test_monotone_board_hero_suited_flush(self):
        """3 suited board + 2 suited hero = 5 suited = flush."""
        result = evaluate_hole_and_board(["Ah", "2h"], ["Qh", "Jh", "9h"])
        assert result.category_name == "flush"

    def test_rainbow_no_flush(self):
        """Rainbow board never produces a flush."""
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Qc", "Js", "9h"])
        assert result.category_name != "flush"


# ═══════════════════════════════════════════════════════════════════════════════
# FLUSH DRAW DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

class TestFlushDrawDetection:
    """Flush draw = exactly 4 cards same suit (hero contributing)."""

    def test_4_suited_is_flush_draw(self):
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jh", "2c"])
        assert da.has_flush_draw, "4 suited should be flush draw"

    def test_3_suited_is_backdoor(self):
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jd", "2c"])
        assert not da.has_flush_draw, "3 suited should NOT be flush draw"
        assert da.has_backdoor_flush, "3 suited on flop = backdoor flush"

    def test_5_suited_is_made_not_draw(self):
        """5 suited = made flush, not a draw."""
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jh", "2h"])
        assert not da.has_flush_draw, "Made flush should NOT be classified as draw"

    def test_6_suited_is_made_not_draw(self):
        """6 suited = made flush, not a draw."""
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jh", "9h", "2h"])
        assert not da.has_flush_draw

    def test_hero_must_contribute(self):
        """If hero has no cards of the draw suit, no flush draw."""
        da = analyze_draws(["Ac", "Kd"], ["Qh", "Jh", "9h", "2h"])
        assert not da.has_flush_draw, "Hero doesn't contribute to the suited cards"

    def test_no_flush_draw_counted_twice(self):
        """Only one flush draw per suit, never duplicated."""
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jh", "2c"])
        fd_count = sum(1 for fd in da.flush_draws if fd.draw_type == "flush_draw")
        assert fd_count == 1, f"Flush draw counted {fd_count} times"


# ═══════════════════════════════════════════════════════════════════════════════
# BACKDOOR FLUSH DRAW
# ═══════════════════════════════════════════════════════════════════════════════

class TestBackdoorFlushDraw:
    """Backdoor flush = exactly 3 cards same suit on FLOP only."""

    def test_backdoor_on_flop(self):
        da = analyze_draws(["Ah", "Kd"], ["Qh", "Jh", "2c"])
        assert da.has_backdoor_flush

    def test_no_backdoor_on_turn(self):
        """Backdoor draws suppressed on turn (only 1 card coming)."""
        da = analyze_draws(["Ah", "Kd"], ["Qh", "Jh", "2c", "3s"])
        assert not da.has_backdoor_flush, "Backdoor should be suppressed on turn"

    def test_no_backdoor_on_river(self):
        """No draws at all on river."""
        da = analyze_draws(["Ah", "Kd"], ["Qh", "Jh", "2c", "3s", "4d"])
        assert not da.has_backdoor_flush
        assert not da.has_flush_draw
        assert not da.has_direct_straight_draw


# ═══════════════════════════════════════════════════════════════════════════════
# STRAIGHT DRAW DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

class TestStraightDrawDetection:

    def test_oesd_6789(self):
        """6-7-8-9 is an OESD (needs 5 or T)."""
        da = analyze_draws(["8h", "9d"], ["6c", "7s", "2h"])
        has_oesd = any(sd.draw_type == "oesd" for sd in da.straight_draws)
        assert has_oesd, f"6-7-8-9 should be OESD, got: {[sd.draw_type for sd in da.straight_draws]}"

    def test_not_oesd_789_only(self):
        """9h8h on Ah7d2s: only 7-8-9 = 3 consecutive, NOT OESD."""
        da = analyze_draws(["9h", "8h"], ["Ah", "7d", "2s"])
        has_oesd = any(sd.draw_type == "oesd" for sd in da.straight_draws)
        assert not has_oesd, "7-8-9 is only 3 consecutive ranks — NOT an OESD"

    def test_gutshot(self):
        """5-6-_-8 is a gutshot (needs 7)."""
        da = analyze_draws(["5h", "8d"], ["6c", "Ks", "2h"])
        has_gutshot = any(sd.draw_type == "gutshot" for sd in da.straight_draws)
        assert has_gutshot

    def test_double_gutter(self):
        """5-7-8-9 gives two gutshots with different needed ranks = DBB."""
        da = analyze_draws(["5h", "9d"], ["7c", "8s", "2h"])
        # Should have some form of draw
        has_draw = da.has_direct_straight_draw
        assert has_draw

    def test_broadway_one_sided(self):
        """A-K-Q-J needs T only (one end) — should be gutshot/one-sided."""
        da = analyze_draws(["Ah", "Kd"], ["Qc", "Js", "2h"])
        has_direct = da.has_direct_straight_draw
        assert has_direct, "AKQJ should have a direct straight draw"

    def test_wheel_draw(self):
        """A-2-3-4 needs 5 — one-sided straight draw."""
        da = analyze_draws(["Ah", "2d"], ["3c", "4s", "Kh"])
        has_direct = da.has_direct_straight_draw
        assert has_direct, "A-2-3-4 should have a direct straight draw"


# ═══════════════════════════════════════════════════════════════════════════════
# RIVER DRAW SUPPRESSION
# ═══════════════════════════════════════════════════════════════════════════════

class TestRiverDrawSuppression:
    """On the river, no draws should be reported — hand is final."""

    def test_river_no_flush_draw(self):
        da = analyze_draws(["Ah", "Kh"], ["Qh", "Jh", "2c", "3s", "4d"])
        assert not da.has_flush_draw
        assert not da.has_backdoor_flush

    def test_river_no_straight_draw(self):
        da = analyze_draws(["8h", "9d"], ["6c", "7s", "2h", "Kd", "3c"])
        assert not da.has_direct_straight_draw
        assert not da.has_backdoor_straight

    def test_river_no_combo_draw(self):
        da = analyze_draws(["Jh", "Th"], ["Qh", "8h", "3d", "2c", "6h"])
        assert not da.is_combo_draw


# ═══════════════════════════════════════════════════════════════════════════════
# NUT FLUSH RANKING
# ═══════════════════════════════════════════════════════════════════════════════

class TestNutFlushRanking:
    """Nut flush detection must verify hero actually MADE a flush."""

    def test_nut_flush_requires_made_flush(self):
        """Hero has Ah but only 4 suited = flush DRAW, not nut flush."""
        assert not _has_nut_flush(["Ah", "Kd"], ["Qh", "Jh", "2c"])

    def test_nut_flush_with_5_suited(self):
        """Hero has Ah + 5 total suited = nut flush."""
        assert _has_nut_flush(["Ah", "Kh"], ["Qh", "Jh", "2h"])

    def test_not_nut_flush_without_ace(self):
        """Hero made flush but without ace = not nut flush."""
        assert not _has_nut_flush(["Kh", "Qh"], ["Jh", "9h", "2h"])

    def test_near_nut_flush_with_king(self):
        """Hero has Kh + 5 suited = near-nut flush."""
        assert _has_near_nut_flush(["Kh", "Qh"], ["Jh", "9h", "2h"])

    def test_near_nut_requires_made_flush(self):
        """Kh with only 4 suited = not near-nut (it's a draw)."""
        assert not _has_near_nut_flush(["Kh", "Qd"], ["Jh", "9h", "2h"])


# ═══════════════════════════════════════════════════════════════════════════════
# BUSTED DRAW CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestBustedDraws:
    """Busted draws on river must be classified as high card / air."""

    def test_busted_flush_draw_is_air(self):
        """Missed flush draw on river = high card."""
        result = evaluate_hole_and_board(
            ["Jh", "Th"], ["Qh", "8h", "3d", "2c", "6s"]
        )
        assert result.category == 0, f"Busted FD should be high card, got {result.category_name}"

    def test_busted_oesd_is_air(self):
        """Missed OESD on river = high card (assuming no pair)."""
        result = evaluate_hole_and_board(
            ["8h", "9d"], ["6c", "7s", "2h", "Kd", "3c"]
        )
        # 6-7-8-9 was OESD, missed on river → check it's at most a pair (if hit something)
        assert result.category <= 1  # high card or pair


# ═══════════════════════════════════════════════════════════════════════════════
# MADE HAND CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestMadeHandClassification:

    def test_straight_flush(self):
        result = evaluate_hole_and_board(["Ah", "Kh"], ["Qh", "Jh", "Th"])
        assert result.category == 8
        assert "Royal Flush" in result.description

    def test_quads(self):
        result = evaluate_hole_and_board(["Ah", "As"], ["Ad", "Ac", "2h"])
        assert result.category == 7

    def test_full_house(self):
        result = evaluate_hole_and_board(["Ah", "As"], ["Ad", "Kc", "Kh"])
        assert result.category == 6

    def test_flush(self):
        result = evaluate_hole_and_board(["Ah", "3h"], ["Kh", "9h", "2h"])
        assert result.category == 5

    def test_straight(self):
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Qc", "Js", "Th"])
        assert result.category == 4

    def test_trips(self):
        result = evaluate_hole_and_board(["Ah", "As"], ["Ad", "Kc", "2h"])
        assert result.category == 3

    def test_two_pair(self):
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Ac", "Ks", "2h"])
        assert result.category == 2

    def test_pair(self):
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Ac", "Js", "2h"])
        assert result.category == 1

    def test_high_card(self):
        result = evaluate_hole_and_board(["Ah", "Kd"], ["Qc", "Js", "2h"])
        assert result.category == 0

    def test_wheel_straight(self):
        """A-2-3-4-5 = wheel straight."""
        result = evaluate_hole_and_board(["Ah", "2d"], ["3c", "4s", "5h"])
        assert result.category == 4
        assert "5" in result.description.lower() or "five" in result.description.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# PUZZLE VALIDATION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def _make_puzzle(
    puzzle_id: str,
    hero_cards: list[str],
    steps: list[PuzzleStep],
) -> PuzzleData:
    return PuzzleData(
        id=puzzle_id,
        hero_cards=hero_cards,
        hero_position="BTN",
        villain_position="BB",
        effective_stack=100,
        steps=steps,
    )


def _make_step(
    street: str,
    board: list[str],
    options: list[PuzzleOption],
    context: str = "",
    prompt: str = "",
) -> PuzzleStep:
    return PuzzleStep(
        street=street, board=board, context=context,
        prompt=prompt, options=options,
    )


def _make_opt(id: str, label: str, coaching: str = "", quality: str = "good") -> PuzzleOption:
    return PuzzleOption(id=id, label=label, quality=quality, ev_loss=0, coaching=coaching)


class TestPuzzleValidator:

    def test_valid_puzzle_passes(self):
        puzzle = _make_puzzle("test-valid", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js", "2h"], [
                _make_opt("check", "Check"),
                _make_opt("bet", "Bet 5bb"),
                _make_opt("raise", "Raise to 15bb"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert result.valid, f"Should pass: {[i.message for i in result.errors]}"

    def test_duplicate_card_fails(self):
        puzzle = _make_puzzle("test-dupe", ["Ah", "Kd"], [
            _make_step("flop", ["Ah", "Js", "2h"], [
                _make_opt("check", "Check"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert not result.valid
        assert any("Duplicate" in i.message for i in result.errors)

    def test_wrong_board_count_fails(self):
        puzzle = _make_puzzle("test-board", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js"], [  # 2 cards, flop needs 3
                _make_opt("check", "Check"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert not result.valid

    def test_false_flush_claim_fails(self):
        """Coaching says 'you have the flush' but hero only has 4 suited."""
        puzzle = _make_puzzle("test-flush-lie", ["Ah", "Kh"], [
            _make_step("flop", ["Qh", "Jh", "2c"], [
                _make_opt("bet", "Bet big", coaching="You have the flush, bet for value"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert not result.valid
        assert any("flush" in i.message.lower() for i in result.errors)

    def test_correct_flush_claim_passes(self):
        """Coaching says 'you have the flush' and hero actually has 5 suited."""
        puzzle = _make_puzzle("test-flush-real", ["Ah", "Kh"], [
            _make_step("flop", ["Qh", "Jh", "2h"], [
                _make_opt("bet", "Bet big", coaching="You have the flush, bet for value"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert result.valid, f"Should pass: {[i.message for i in result.errors]}"

    def test_false_oesd_claim_fails(self):
        """Coaching says 'OESD' but no OESD exists."""
        puzzle = _make_puzzle("test-oesd-lie", ["9h", "8h"], [
            _make_step("flop", ["Ah", "7d", "2s"], [
                _make_opt("bet", "Bet", coaching="With your OESD, semi-bluff here"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        assert not result.valid
        assert any("OESD" in i.message for i in result.errors)

    def test_action_ordering_correct(self):
        """Fold < Call < Raise should pass."""
        puzzle = _make_puzzle("test-order-ok", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js", "2h"], [
                _make_opt("fold", "Fold"),
                _make_opt("call", "Call"),
                _make_opt("raise", "Raise"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        ordering_errors = [i for i in result.errors if i.check == "action_ordering"]
        assert len(ordering_errors) == 0

    def test_action_ordering_wrong_fails(self):
        """Raise before Fold should fail."""
        puzzle = _make_puzzle("test-order-bad", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js", "2h"], [
                _make_opt("raise", "Raise to 15bb"),
                _make_opt("fold", "Fold"),
                _make_opt("call", "Call"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        ordering_errors = [i for i in result.errors if i.check == "action_ordering"]
        assert len(ordering_errors) > 0

    def test_sizing_order_ascending(self):
        """Bet 4bb < Bet 8bb < Bet 20bb should pass."""
        puzzle = _make_puzzle("test-sizing-ok", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js", "2h"], [
                _make_opt("s", "Bet 4bb"),
                _make_opt("m", "Bet 8bb"),
                _make_opt("l", "Bet 20bb"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        sizing_errors = [i for i in result.errors if i.check == "sizing_order"]
        assert len(sizing_errors) == 0

    def test_sizing_order_wrong_fails(self):
        """Bet 20bb before Bet 8bb should fail."""
        puzzle = _make_puzzle("test-sizing-bad", ["Ah", "Kd"], [
            _make_step("flop", ["Qc", "Js", "2h"], [
                _make_opt("l", "Bet 20bb"),
                _make_opt("s", "Bet 8bb"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        sizing_errors = [i for i in result.errors if i.check == "sizing_order"]
        assert len(sizing_errors) > 0

    def test_overbet_with_air_fails(self):
        """Recommending overbet with busted draw + air quality='perfect' should fail."""
        puzzle = _make_puzzle("test-overbet-air", ["Jh", "Td"], [
            _make_step("river", ["Qc", "8c", "3d", "2s", "6s"], [
                _make_opt("check", "Check"),
                _make_opt("overbet", "Overbet 2x pot", coaching="Overbet for value", quality="perfect"),
            ]),
        ])
        result = validate_puzzle_state(puzzle)
        coherence_errors = [i for i in result.errors if i.check == "coaching_coherence"]
        assert len(coherence_errors) > 0
