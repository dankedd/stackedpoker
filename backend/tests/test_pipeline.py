"""
Pipeline test suite — fixture-based, deterministic.

Tests the full pipeline:
  parseHand → normalizeHand → validateCanonical → PipelineResult

Run with:
  cd backend && pytest tests/test_pipeline.py -v

Each test loads a fixture file from tests/hands/ and asserts specific
outcomes on the PipelineResult.
"""
from __future__ import annotations

import os
import pytest
from pathlib import Path

from app.engines.pipeline import run_text_pipeline
from app.models.canonical import (
    PipelineResult, ValidationErrorCode, Street, ActionType,
)

HANDS_DIR = Path(__file__).parent / "hands"


def load_fixture(relative: str) -> str:
    path = HANDS_DIR / relative
    return path.read_text(encoding="utf-8")


# ── Utilities ─────────────────────────────────────────────────────────────────

def run(fixture_path: str) -> PipelineResult:
    return run_text_pipeline(load_fixture(fixture_path))


def get_error_codes(result: PipelineResult) -> set[str]:
    return {e.code for e in result.validation.errors}


def get_warning_codes(result: PipelineResult) -> set[str]:
    return {w.code for w in result.validation.warnings}


# ── Valid hands ───────────────────────────────────────────────────────────────

class TestValidHands:

    def test_pokerstars_6max_parses_and_validates(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.validation.valid, f"Expected valid, errors: {result.validation.errors}"
        assert result.validation.can_analyze
        assert result.validation.confidence > 0.7

    def test_pokerstars_6max_site_detected(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.canonical.site == "PokerStars"

    def test_pokerstars_6max_hand_id(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.canonical.hand_id == "234567890123"

    def test_pokerstars_6max_player_count(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert len(result.canonical.players) == 6

    def test_pokerstars_6max_hero_found(self):
        result = run("valid/pokerstars_cash_6max.txt")
        hero = next((p for p in result.canonical.players if p.is_hero), None)
        assert hero is not None, "Hero player not found"
        assert hero.name == "Hero"

    def test_pokerstars_6max_hero_cards(self):
        result = run("valid/pokerstars_cash_6max.txt")
        hero = next(p for p in result.canonical.players if p.is_hero)
        notations = {c.notation for c in hero.hole_cards}
        assert notations == {"Ah", "Kd"}

    def test_pokerstars_6max_flop_board(self):
        result = run("valid/pokerstars_cash_6max.txt")
        flop = next((s for s in result.canonical.streets if s.name == Street.FLOP), None)
        assert flop is not None
        assert len(flop.board_cards) == 3
        notations = {c.notation for c in flop.board_cards}
        assert notations == {"Jh", "8d", "2c"}

    def test_pokerstars_6max_turn_board(self):
        result = run("valid/pokerstars_cash_6max.txt")
        turn = next((s for s in result.canonical.streets if s.name == Street.TURN), None)
        assert turn is not None
        assert len(turn.board_cards) == 1
        assert turn.board_cards[0].notation == "Ac"

    def test_pokerstars_6max_hero_position(self):
        result = run("valid/pokerstars_cash_6max.txt")
        hero = next(p for p in result.canonical.players if p.is_hero)
        assert hero.position == "BTN"

    def test_pokerstars_6max_preflop_has_hero_action(self):
        result = run("valid/pokerstars_cash_6max.txt")
        preflop = next(s for s in result.canonical.streets if s.name == Street.PREFLOP)
        hero_actions = [a for a in preflop.actions if a.is_hero]
        assert len(hero_actions) >= 1
        assert hero_actions[0].action == ActionType.RAISE

    def test_pokerstars_6max_effective_stack_positive(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.canonical.effective_stack_bb > 0

    def test_ggpoker_hu_parses_and_validates(self):
        result = run("valid/ggpoker_cash_hu.txt")
        assert result.validation.valid, f"Expected valid, errors: {result.validation.errors}"
        assert result.validation.can_analyze
        assert result.canonical.site == "GGPoker"

    def test_ggpoker_hu_hero_cards(self):
        result = run("valid/ggpoker_cash_hu.txt")
        hero = next(p for p in result.canonical.players if p.is_hero)
        notations = {c.notation for c in hero.hole_cards}
        assert notations == {"Ks", "Qh"}

    def test_pokerstars_tournament_allin_parses(self):
        result = run("valid/pokerstars_tournament_allin.txt")
        assert result.validation.valid or len(result.validation.errors) == 0
        assert result.canonical.hand_id == "234567890200"


# ── Invalid hands (must fail validation) ─────────────────────────────────────

class TestInvalidHands:

    def test_duplicate_cards_detected(self):
        result = run("invalid/duplicate_cards.txt")
        assert not result.validation.valid
        assert not result.validation.can_analyze
        assert ValidationErrorCode.DUPLICATE_CARD.value in get_error_codes(result)

    def test_duplicate_cards_blocks_analysis(self):
        result = run("invalid/duplicate_cards.txt")
        assert not result.validation.can_analyze

    def test_duplicate_cards_confidence_below_threshold(self):
        result = run("invalid/duplicate_cards.txt")
        assert result.validation.confidence < 0.6

    def test_negative_stack_detected(self):
        result = run("invalid/negative_stack.txt")
        assert not result.validation.valid
        assert ValidationErrorCode.NEGATIVE_STACK.value in get_error_codes(result)

    def test_missing_hero_produces_warning(self):
        """Hero name in HOLE CARDS doesn't match any player seat."""
        result = run("invalid/missing_hero.txt")
        # Hero name "Hero" not in players → HERO_NOT_IN_PLAYERS error
        error_codes = get_error_codes(result)
        assert ValidationErrorCode.HERO_NOT_IN_PLAYERS.value in error_codes


# ── Edge cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_multiway_sidepot_parses(self):
        result = run("edge_cases/multiway_sidepot.txt")
        assert result.canonical is not None
        assert len(result.canonical.players) == 4

    def test_multiway_sidepot_hero_cards(self):
        result = run("edge_cases/multiway_sidepot.txt")
        hero = next((p for p in result.canonical.players if p.is_hero), None)
        assert hero is not None
        notations = {c.notation for c in hero.hole_cards}
        assert notations == {"Ks", "Kd"}

    def test_river_bluff_all_streets_parsed(self):
        result = run("edge_cases/river_bluff_call.txt")
        street_names = {s.name.value for s in result.canonical.streets}
        assert "flop"  in street_names
        assert "turn"  in street_names
        assert "river" in street_names

    def test_river_bluff_hero_position_btn(self):
        result = run("edge_cases/river_bluff_call.txt")
        hero = next(p for p in result.canonical.players if p.is_hero)
        assert hero.position == "BTN"

    def test_river_bluff_hero_cards_straight_draw(self):
        result = run("edge_cases/river_bluff_call.txt")
        hero = next(p for p in result.canonical.players if p.is_hero)
        notations = {c.notation for c in hero.hole_cards}
        assert notations == {"9h", "8h"}


# ── Schema invariants ─────────────────────────────────────────────────────────

class TestSchemaInvariants:

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
        "valid/pokerstars_tournament_allin.txt",
        "edge_cases/river_bluff_call.txt",
    ])
    def test_schema_version_is_set(self, fixture: str):
        result = run(fixture)
        assert result.canonical.schema_version == "1.0"

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
    ])
    def test_hero_id_in_players(self, fixture: str):
        result = run(fixture)
        player_ids = {p.id for p in result.canonical.players}
        assert result.canonical.hero_id in player_ids

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
    ])
    def test_action_sequences_are_monotonic(self, fixture: str):
        result = run(fixture)
        all_actions = [
            a for s in result.canonical.streets for a in s.actions
        ]
        seqs = [a.sequence for a in all_actions]
        assert seqs == sorted(seqs), "Action sequences not monotonically increasing"

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
    ])
    def test_pot_never_negative(self, fixture: str):
        result = run(fixture)
        for s in result.canonical.streets:
            for a in s.actions:
                assert a.pot_after_bb >= 0, f"Negative pot at action {a.sequence}"

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
    ])
    def test_stacks_never_negative(self, fixture: str):
        result = run(fixture)
        for s in result.canonical.streets:
            for a in s.actions:
                assert a.stack_after_bb >= -0.01, (
                    f"Negative stack for {a.player_name} at action {a.sequence}: "
                    f"{a.stack_after_bb}"
                )

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
        "edge_cases/river_bluff_call.txt",
        "edge_cases/multiway_sidepot.txt",
    ])
    def test_player_ids_are_unique(self, fixture: str):
        result = run(fixture)
        ids = [p.id for p in result.canonical.players]
        assert len(ids) == len(set(ids)), "Duplicate player IDs found"

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
    ])
    def test_flop_has_exactly_3_cards(self, fixture: str):
        result = run(fixture)
        flop = next((s for s in result.canonical.streets if s.name == Street.FLOP), None)
        if flop and flop.board_cards:
            assert len(flop.board_cards) == 3

    @pytest.mark.parametrize("fixture", [
        "valid/pokerstars_cash_6max.txt",
        "valid/ggpoker_cash_hu.txt",
        "edge_cases/river_bluff_call.txt",
        "edge_cases/multiway_sidepot.txt",
    ])
    def test_no_duplicate_board_cards(self, fixture: str):
        result = run(fixture)
        all_board = [
            c.notation for s in result.canonical.streets for c in s.board_cards
        ]
        assert len(all_board) == len(set(all_board)), "Duplicate board cards detected"


# ── Normalizer-specific tests ──────────────────────────────────────────────────

class TestNormalizer:

    def test_position_normalization_btn(self):
        from app.engines.normalizer import normalize_position
        for alias in ["BTN", "btn", "Button", "button", "Dealer", "dealer", "D", "d"]:
            assert normalize_position(alias) == "BTN", f"Failed for: {alias!r}"

    def test_position_normalization_sb(self):
        from app.engines.normalizer import normalize_position
        for alias in ["SB", "sb", "small blind", "Small Blind", "small_blind"]:
            assert normalize_position(alias) == "SB", f"Failed for: {alias!r}"

    def test_position_normalization_bb(self):
        from app.engines.normalizer import normalize_position
        for alias in ["BB", "bb", "big blind", "Big Blind", "big_blind"]:
            assert normalize_position(alias) == "BB", f"Failed for: {alias!r}"

    def test_card_normalization_valid(self):
        from app.engines.normalizer import normalize_card
        card = normalize_card("ah")
        assert card is not None
        assert card.rank == "A"
        assert card.suit == "h"
        assert card.notation == "Ah"

    def test_card_normalization_invalid(self):
        from app.engines.normalizer import normalize_card
        assert normalize_card("XX") is None
        assert normalize_card("A")  is None
        assert normalize_card("")   is None
        assert normalize_card("Az") is None

    def test_canonical_hand_has_preflop_street(self):
        result = run("valid/pokerstars_cash_6max.txt")
        preflop = next((s for s in result.canonical.streets if s.name == Street.PREFLOP), None)
        assert preflop is not None, "Preflop street not found"

    def test_stakes_display_populated(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.canonical.stakes.display, "Stakes display is empty"


# ── Validator-specific tests ───────────────────────────────────────────────────

class TestValidator:

    def test_valid_hand_no_errors(self):
        from app.engines.canonical_validator import validate_canonical
        result = run("valid/pokerstars_cash_6max.txt")
        validation = validate_canonical(result.canonical)
        assert len(validation.errors) == 0, f"Unexpected errors: {validation.errors}"

    def test_invalid_hand_duplicate_card_error(self):
        from app.engines.canonical_validator import validate_canonical
        result = run("invalid/duplicate_cards.txt")
        validation = validate_canonical(result.canonical)
        codes = {e.code for e in validation.errors}
        assert ValidationErrorCode.DUPLICATE_CARD.value in codes

    def test_confidence_high_for_valid_known_site(self):
        result = run("valid/pokerstars_cash_6max.txt")
        assert result.validation.confidence >= 0.80

    def test_confidence_low_for_invalid_hand(self):
        result = run("invalid/duplicate_cards.txt")
        assert result.validation.confidence < 0.60


# ── Parser detection ───────────────────────────────────────────────────────────

class TestParserDetection:

    def test_pokerstars_detected(self):
        from app.parsers.detector import detect_site
        text = load_fixture("valid/pokerstars_cash_6max.txt")
        assert detect_site(text) == "PokerStars"

    def test_ggpoker_detected(self):
        from app.parsers.detector import detect_site
        text = load_fixture("valid/ggpoker_cash_hu.txt")
        assert detect_site(text) == "GGPoker"

    def test_generic_fallback_does_not_raise(self):
        from app.parsers.generic import GenericParser
        parser = GenericParser()
        text = "Some random hand with [Ah Kd] and folds checks raises"
        assert parser.can_parse(text)
        result = parser.parse(text)
        assert result is not None
