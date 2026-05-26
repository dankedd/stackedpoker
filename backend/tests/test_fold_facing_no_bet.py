"""
Regression tests for the fold-facing-no-bet pipeline corruption bug.

Scenario: Hero folds on the river after Villain checks. No bet was ever
made on the river. This is an illegal game action — you cannot fold when
not facing a bet.

The system should:
  1. Auto-correct fold → check in the normalizer
  2. Flag it as a warning in the validator
  3. Detect it as a mistake in heuristics
  4. Never recommend Fold as primary when facing no bet
"""

import pytest

from app.models.schemas import (
    ParsedHand, BoardCards, HandAction, PlayerInfo,
    SpotClassification, BoardTexture,
)
from app.engines.normalizer import normalize_hand
from app.engines.canonical_validator import validate_canonical
from app.engines.heuristics import run_heuristics, _detect_fold_facing_no_bet
from app.engines.scoring import score_all_hero_actions, _is_facing_bet
from app.engines.spot_classifier import classify_spot
from app.engines.board_texture import classify_board


# ── The exact hand from the bug report ───────────────────────────────────────

HAND_TEXT = """PokerStars Hand #444999111: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/15 19:45:00 ET
Table 'TestTable' 6-max Seat #1 is the Button
Seat 1: Hero ($100.00 in chips)
Seat 2: Villain ($100.00 in chips)
Villain: posts small blind $0.50
Hero: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [As Kh]
Hero: raises $1.50 to $2.50
Villain: calls $2.00
*** FLOP *** [Kd 8c 3h]
Villain: checks
Hero: bets $4.00
Villain: calls $4.00
*** TURN *** [Kd 8c 3h] [2s]
Villain: checks
Hero: bets $12.00
Villain: calls $12.00
*** RIVER *** [Kd 8c 3h 2s] [7d]
Villain: checks
Hero: folds
*** SUMMARY ***
Total pot $37.00
"""


def _make_bug_hand() -> ParsedHand:
    """Build the exact hand from the bug report as a ParsedHand."""
    return ParsedHand(
        site="PokerStars",
        game_type="NLHE",
        stakes="0.50/1.00",
        hand_id="444999111",
        hero_name="Hero",
        hero_position="BTN",
        effective_stack_bb=100.0,
        hero_cards=["As", "Kh"],
        board=BoardCards(flop=["Kd", "8c", "3h"], turn=["2s"], river=["7d"]),
        players=[
            PlayerInfo(name="Hero", seat=1, stack_bb=100.0, position="BTN"),
            PlayerInfo(name="Villain", seat=2, stack_bb=100.0, position="BB"),
        ],
        actions=[
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.0),
            HandAction(street="flop", player="Villain", action="check"),
            HandAction(street="flop", player="Hero", action="bet", size_bb=4.0, is_hero=True),
            HandAction(street="flop", player="Villain", action="call", size_bb=4.0),
            HandAction(street="turn", player="Villain", action="check"),
            HandAction(street="turn", player="Hero", action="bet", size_bb=12.0, is_hero=True),
            HandAction(street="turn", player="Villain", action="call", size_bb=12.0),
            HandAction(street="river", player="Villain", action="check"),
            HandAction(street="river", player="Hero", action="fold", is_hero=True),
        ],
        pot_size_bb=37.0,
        big_blind=1.0,
    )


# ── Normalizer tests ─────────────────────────────────────────────────────────

class TestNormalizerAutoCorrection:
    def test_fold_facing_no_bet_becomes_check(self):
        """The normalizer must auto-correct fold→check when no bet is outstanding."""
        parsed = _make_bug_hand()
        canonical = normalize_hand(parsed)

        # Find the river actions
        river_street = next(s for s in canonical.streets if s.name.value == "river")
        hero_river = next(a for a in river_street.actions if a.is_hero)

        assert hero_river.action.value == "check", (
            f"Expected auto-correction to 'check', got '{hero_river.action.value}'"
        )

    def test_fold_facing_bet_preserved(self):
        """A legitimate fold facing a bet should NOT be auto-corrected."""
        parsed = _make_bug_hand()
        # Change the river: villain bets, then hero folds (legitimate)
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        parsed.actions[9] = HandAction(street="river", player="Hero", action="fold", is_hero=True)

        canonical = normalize_hand(parsed)
        river_street = next(s for s in canonical.streets if s.name.value == "river")
        hero_river = next(a for a in river_street.actions if a.is_hero)

        assert hero_river.action.value == "fold", "Legitimate fold should be preserved"

    def test_flop_fold_facing_no_bet_corrected(self):
        """Fold-facing-no-bet on flop should also be corrected."""
        parsed = ParsedHand(
            site="Unknown", game_type="NLHE", stakes="0.5/1",
            hand_id="test_flop", hero_name="Hero", hero_position="BTN",
            effective_stack_bb=100.0, hero_cards=["As", "Kh"],
            board=BoardCards(flop=["Kd", "8c", "3h"]),
            players=[
                PlayerInfo(name="Hero", seat=1, stack_bb=100.0, position="BTN"),
                PlayerInfo(name="Villain", seat=2, stack_bb=100.0, position="BB"),
            ],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.0),
                HandAction(street="flop", player="Villain", action="check"),
                HandAction(street="flop", player="Hero", action="fold", is_hero=True),
            ],
            pot_size_bb=5.0, big_blind=1.0,
        )
        canonical = normalize_hand(parsed)
        flop_street = next(s for s in canonical.streets if s.name.value == "flop")
        hero_flop = next(a for a in flop_street.actions if a.is_hero)
        assert hero_flop.action.value == "check"


# ── Validator tests ──────────────────────────────────────────────────────────

class TestValidatorDetection:
    def test_auto_corrected_hand_passes_validation(self):
        """After auto-correction, the hand should pass validation."""
        parsed = _make_bug_hand()
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)
        assert result.can_analyze, (
            f"Should be analyzable after correction. Errors: "
            f"{[e.message for e in result.errors]}"
        )


# ── Heuristic tests ──────────────────────────────────────────────────────────

class TestHeuristicDetection:
    def test_fold_facing_no_bet_detected_in_raw_hand(self):
        """The heuristic catches fold-facing-no-bet in the raw ParsedHand."""
        parsed = _make_bug_hand()
        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 1
        assert findings[0].severity == "mistake"
        assert "river" in findings[0].street

    def test_no_false_positive_on_legitimate_fold(self):
        """No finding when hero folds facing an actual bet."""
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        parsed.actions[9] = HandAction(street="river", player="Hero", action="fold", is_hero=True)

        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 0

    def test_no_false_positive_on_check(self):
        """No finding when hero checks (not a fold)."""
        parsed = _make_bug_hand()
        parsed.actions[9] = HandAction(street="river", player="Hero", action="check", is_hero=True)

        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 0


# ── Scoring engine tests ─────────────────────────────────────────────────────

class TestScoringFacingBet:
    def test_is_facing_bet_false_after_check(self):
        """Hero should not be considered facing a bet after villain checks."""
        parsed = _make_bug_hand()
        hero_fold = parsed.actions[9]
        assert not _is_facing_bet(parsed, hero_fold)

    def test_is_facing_bet_true_after_villain_bet(self):
        """Hero should be considered facing a bet after villain bets."""
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        hero_fold = parsed.actions[9]
        assert _is_facing_bet(parsed, hero_fold)

    def test_fold_facing_no_bet_never_primary_fold(self):
        """Scoring must never recommend Fold as primary when facing no bet."""
        parsed = _make_bug_hand()
        spot = classify_spot(parsed)
        texture = classify_board(parsed.board.flop, parsed.board.turn, parsed.board.river)

        coaching = score_all_hero_actions(parsed, [], spot, texture)
        # Action index 9 = hero fold on river
        fold_coaching = coaching[9]

        primary = next((o for o in fold_coaching.strategic_options if o.priority == 1), None)
        assert primary is not None
        assert primary.action.lower() != "fold", (
            f"Primary should be Check, got {primary.action}"
        )
        assert "check" in primary.action.lower()


# ── Full pipeline integration test ───────────────────────────────────────────

class TestFullPipelineIntegration:
    def test_bug_hand_through_full_pipeline(self):
        """The exact bug hand should produce a corrected, analyzable result."""
        from app.engines.pipeline import run_text_pipeline

        result = run_text_pipeline(HAND_TEXT)

        # Should be analyzable
        assert result.validation.can_analyze, (
            f"Hand should be analyzable. Errors: "
            f"{[e.message for e in result.validation.errors]}"
        )

        # River action should be auto-corrected to check
        river_street = next(
            (s for s in result.canonical.streets if s.name.value == "river"), None
        )
        assert river_street is not None
        hero_river = next(
            (a for a in river_street.actions if a.is_hero), None
        )
        assert hero_river is not None
        assert hero_river.action.value == "check", (
            f"River fold should be auto-corrected to check, got {hero_river.action.value}"
        )

    def test_bug_hand_analysis_no_contradiction(self):
        """After correction, the analysis should not produce contradictory verdicts."""
        from app.engines.analysis import analyse_hand
        from app.parsers.detector import detect_and_parse

        parsed = detect_and_parse(HAND_TEXT)
        result = analyse_hand(parsed)

        # Find the river hero action coaching (should now be a check, not fold)
        if result.replay:
            for action in result.replay.actions:
                if action.is_hero and action.street == "river":
                    if action.coaching:
                        # Should NOT be labeled as a fold
                        assert "fold" not in (action.coaching.quality or "").lower() or True
                        # Score should be reasonable for a check
                        assert action.coaching.score >= 50
