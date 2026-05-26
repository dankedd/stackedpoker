"""
Regression tests for the fold-facing-no-bet pipeline bug.

Scenario: Hero folds on the river after Villain checks. No bet was ever
made on the river. This is an illegal game action.

The system should:
  1. PRESERVE the original fold in parsed_hand (for coaching fidelity)
  2. Create a SANITIZED copy (fold→check) for pot engine / replay legality
  3. Flag the fold as a mistake in heuristics
  4. Score/grade the user's ACTUAL fold (not the sanitized check)
  5. Recommend Check as the primary action
  6. Never produce "Good Fold" when facing no bet
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
from app.engines.analysis import analyse_hand, _sanitize_illegal_folds
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


# ── Normalizer: preserves original action ────────────────────────────────────

class TestNormalizerPreservesOriginal:
    def test_fold_facing_no_bet_preserved_in_canonical(self):
        """The normalizer must preserve the user's actual fold (not rewrite it)."""
        parsed = _make_bug_hand()
        canonical = normalize_hand(parsed)

        river_street = next(s for s in canonical.streets if s.name.value == "river")
        hero_river = next(a for a in river_street.actions if a.is_hero)

        assert hero_river.action.value == "fold", (
            f"Normalizer must preserve original fold, got '{hero_river.action.value}'"
        )

    def test_fold_facing_bet_preserved(self):
        """A legitimate fold facing a bet should be preserved."""
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        parsed.actions[9] = HandAction(street="river", player="Hero", action="fold", is_hero=True)

        canonical = normalize_hand(parsed)
        river_street = next(s for s in canonical.streets if s.name.value == "river")
        hero_river = next(a for a in river_street.actions if a.is_hero)

        assert hero_river.action.value == "fold"


# ── Sanitizer: creates legal copy for pot engine ─────────────────────────────

class TestSanitizer:
    def test_sanitizer_converts_fold_to_check(self):
        """_sanitize_illegal_folds creates a copy with fold→check."""
        parsed = _make_bug_hand()
        sanitized, corrections = _sanitize_illegal_folds(parsed)

        river_actions = [a for a in sanitized.actions if a.street == "river" and a.is_hero]
        assert len(river_actions) == 1
        assert river_actions[0].action == "check"

    def test_sanitizer_preserves_original(self):
        """The original hand is not mutated by the sanitizer."""
        parsed = _make_bug_hand()
        _sanitize_illegal_folds(parsed)

        river_actions = [a for a in parsed.actions if a.street == "river" and a.is_hero]
        assert river_actions[0].action == "fold", "Original must not be mutated"

    def test_corrections_list_populated(self):
        parsed = _make_bug_hand()
        _, corrections = _sanitize_illegal_folds(parsed)

        assert len(corrections) == 1
        assert "fold_to_check" in corrections[0]
        assert "Hero" in corrections[0]
        assert "river" in corrections[0]

    def test_no_corrections_for_legal_hand(self):
        parsed = _make_bug_hand()
        parsed.actions[9] = HandAction(
            street="river", player="Hero", action="check", is_hero=True,
        )
        _, corrections = _sanitize_illegal_folds(parsed)
        assert corrections == []

    def test_legitimate_fold_not_sanitized(self):
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        parsed.actions[9] = HandAction(street="river", player="Hero", action="fold", is_hero=True)

        sanitized, corrections = _sanitize_illegal_folds(parsed)
        river_hero = [a for a in sanitized.actions if a.street == "river" and a.is_hero]
        assert river_hero[0].action == "fold"
        assert corrections == []


# ── Validator ────────────────────────────────────────────────────────────────

class TestValidatorDetection:
    def test_fold_facing_no_bet_flagged_as_warning(self):
        """Validator should flag fold-facing-no-bet."""
        parsed = _make_bug_hand()
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)
        warning_codes = [w.code for w in result.warnings]
        assert "FOLD_FACING_NO_BET" in warning_codes

    def test_hand_still_analyzable(self):
        """Fold-facing-no-bet is a warning, not a blocking error."""
        parsed = _make_bug_hand()
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)
        assert result.can_analyze


# ── Heuristics ───────────────────────────────────────────────────────────────

class TestHeuristicDetection:
    def test_fold_facing_no_bet_detected_as_mistake(self):
        parsed = _make_bug_hand()
        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 1
        assert findings[0].severity == "mistake"
        assert "river" in findings[0].street

    def test_no_false_positive_on_legitimate_fold(self):
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        parsed.actions[9] = HandAction(street="river", player="Hero", action="fold", is_hero=True)
        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 0

    def test_no_false_positive_on_check(self):
        parsed = _make_bug_hand()
        parsed.actions[9] = HandAction(street="river", player="Hero", action="check", is_hero=True)
        findings = _detect_fold_facing_no_bet(parsed)
        assert len(findings) == 0


# ── Scoring ──────────────────────────────────────────────────────────────────

class TestScoringFacingBet:
    def test_is_facing_bet_false_after_check(self):
        parsed = _make_bug_hand()
        hero_fold = parsed.actions[9]
        assert not _is_facing_bet(parsed, hero_fold)

    def test_is_facing_bet_true_after_villain_bet(self):
        parsed = _make_bug_hand()
        parsed.actions[8] = HandAction(street="river", player="Villain", action="bet", size_bb=20.0)
        hero_fold = parsed.actions[9]
        assert _is_facing_bet(parsed, hero_fold)

    def test_fold_facing_no_bet_primary_is_check(self):
        """Scoring must recommend Check as primary when facing no bet."""
        parsed = _make_bug_hand()
        spot = classify_spot(parsed)
        texture = classify_board(parsed.board.flop, parsed.board.turn, parsed.board.river)

        coaching = score_all_hero_actions(parsed, [], spot, texture)
        fold_coaching = coaching[9]

        primary = next((o for o in fold_coaching.strategic_options if o.priority == 1), None)
        assert primary is not None
        assert "check" in primary.action.lower(), f"Primary should be Check, got {primary.action}"

    def test_fold_facing_no_bet_not_good(self):
        """Fold facing no bet must NOT be graded 'Good'."""
        parsed = _make_bug_hand()
        spot = classify_spot(parsed)
        texture = classify_board(parsed.board.flop, parsed.board.turn, parsed.board.river)

        coaching = score_all_hero_actions(parsed, [], spot, texture)
        fold_coaching = coaching[9]

        assert fold_coaching.quality != "Good", (
            f"Illegal fold should not be Good, got quality={fold_coaching.quality} score={fold_coaching.score}"
        )


# ── Full pipeline integration ────────────────────────────────────────────────

class TestFullPipeline:
    def test_analysis_preserves_original_fold(self):
        """analyse_hand must preserve the user's actual fold in parsed_hand."""
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)

        river_hero = [a for a in result.parsed_hand.actions
                      if a.street == "river" and a.is_hero]
        assert len(river_hero) == 1
        assert river_hero[0].action == "fold", (
            "parsed_hand must show the user's actual fold"
        )

    def test_analysis_provides_sanitized_copy(self):
        """analyse_hand must provide a sanitized copy with fold→check."""
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)

        assert result.parsed_hand_sanitized is not None, (
            "parsed_hand_sanitized must be provided when corrections exist"
        )
        river_hero = [a for a in result.parsed_hand_sanitized.actions
                      if a.street == "river" and a.is_hero]
        assert len(river_hero) == 1
        assert river_hero[0].action == "check"

    def test_analysis_corrections_field(self):
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)

        assert len(result.corrections_applied) == 1
        assert "fold_to_check" in result.corrections_applied[0]

    def test_analysis_engine_version(self):
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)
        assert result.engine_version is not None
        assert result.engine_version >= "2.2"

    def test_analysis_finds_illegal_fold_mistake(self):
        """The analysis must produce a 'mistake' finding for the illegal fold."""
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)

        fold_findings = [
            f for f in result.findings
            if f.street == "river" and "fold" in f.action_taken.lower()
        ]
        assert len(fold_findings) >= 1, "Must have a finding about the illegal fold"
        assert fold_findings[0].severity == "mistake"

    def test_analysis_overall_score_penalized(self):
        """The overall score must be penalized for the illegal fold."""
        parsed = _make_bug_hand()
        result = analyse_hand(parsed)

        # A hand with a mistake finding should score below 70
        assert result.overall_score < 70, (
            f"Score {result.overall_score} too high for hand with illegal fold"
        )

    def test_no_sanitized_copy_for_legal_hand(self):
        """Legal hands should not produce a sanitized copy."""
        parsed = _make_bug_hand()
        parsed.actions[9] = HandAction(
            street="river", player="Hero", action="check", is_hero=True,
        )
        result = analyse_hand(parsed)
        assert result.parsed_hand_sanitized is None

    def test_text_pipeline_preserves_fold(self):
        """The text pipeline must preserve the original fold in canonical."""
        from app.engines.pipeline import run_text_pipeline
        result = run_text_pipeline(HAND_TEXT)

        river_street = next(
            s for s in result.canonical.streets if s.name.value == "river"
        )
        hero_river = next(a for a in river_street.actions if a.is_hero)
        assert hero_river.action.value == "fold", (
            "Pipeline must preserve user's actual fold in canonical"
        )
