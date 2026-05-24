"""
Regression tests for player inference from actions.

Covers the bug where:
  - Actions exist and are parsed correctly
  - BUT players array is empty
  - Causing validation failure: "Hand has 0 player(s); minimum is 2"

After fix:
  - Players are inferred from action actors
  - Positions are assigned from names or defaults
  - hero_id maps to an actual player
  - Validation passes → analysis can run
"""

import pytest

from app.models.schemas import ParsedHand, BoardCards, HandAction, PlayerInfo
from app.models.canonical import CanonicalHand, CanonicalPlayer
from app.engines.normalizer import (
    normalize_hand,
    normalize_position,
    _infer_players_from_actions,
)
from app.engines.canonical_validator import validate_canonical


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_parsed_hand(
    *,
    players: list[PlayerInfo] | None = None,
    actions: list[HandAction] | None = None,
    hero_name: str = "Hero",
    hero_position: str = "BTN",
    hero_cards: list[str] | None = None,
    effective_stack_bb: float = 100.0,
) -> ParsedHand:
    """Build a minimal ParsedHand for testing."""
    return ParsedHand(
        site="Unknown",
        game_type="NLHE",
        stakes="0.5/1",
        hand_id="test_001",
        hero_name=hero_name,
        hero_position=hero_position,
        effective_stack_bb=effective_stack_bb,
        hero_cards=hero_cards or [],
        board=BoardCards(flop=["Ah", "Kc", "7d"]),
        players=players or [],
        actions=actions or [],
        pot_size_bb=6.5,
        big_blind=1.0,
    )


# ── Core inference tests ─────────────────────────────────────────────────────

class TestPlayerInferenceFromActions:
    """Test _infer_players_from_actions directly."""

    def test_hero_vs_bb_inferred(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
        ]
        players, by_name, id_by_name = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert len(players) == 2
        assert "Hero" in by_name
        assert "BB" in by_name

    def test_hero_marked_correctly(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert by_name["Hero"].is_hero is True
        assert by_name["Villain"].is_hero is False

    def test_position_inferred_from_name_bb(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert by_name["BB"].position == "BB"
        assert by_name["Hero"].position == "BTN"

    def test_position_inferred_from_name_sb(self):
        actions = [
            HandAction(street="preflop", player="SB", action="raise", size_bb=3.0, is_hero=True),
            HandAction(street="preflop", player="BB", action="call", size_bb=3.0),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="SB", hero_position="SB", effective_stack_bb=100.0,
        )
        assert by_name["SB"].position == "SB"
        assert by_name["BB"].position == "BB"

    def test_hu_defaults_assigned(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        # Hero should get BTN, Villain gets BB (only remaining HU position)
        assert by_name["Hero"].position == "BTN"
        assert by_name["Villain"].position == "BB"

    def test_three_players(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Player2", action="call", size_bb=2.5),
            HandAction(street="preflop", player="Player3", action="fold"),
        ]
        players, _, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="CO", effective_stack_bb=100.0,
        )
        assert len(players) == 3

    def test_stable_seat_ids(self):
        actions = [
            HandAction(street="preflop", player="Alice", action="raise", size_bb=3.0, is_hero=True),
            HandAction(street="preflop", player="Bob", action="call", size_bb=3.0),
        ]
        players, _, id_by_name = _infer_players_from_actions(
            actions, hero_name="Alice", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert id_by_name["Alice"] == "seat_1"
        assert id_by_name["Bob"] == "seat_2"

    def test_default_stack_assigned(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=85.0,
        )
        assert by_name["Hero"].stack_bb == 85.0
        assert by_name["Villain"].stack_bb == 85.0

    def test_default_stack_when_zero(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
        ]
        players, by_name, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=0.0,
        )
        # Should default to 100bb when effective_stack is 0
        assert by_name["Hero"].stack_bb == 100.0

    def test_empty_actions_returns_empty(self):
        players, by_name, id_by_name = _infer_players_from_actions(
            [], hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert players == []
        assert by_name == {}
        assert id_by_name == {}

    def test_no_duplicate_players_from_multi_street_actions(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            HandAction(street="flop", player="Villain", action="check"),
            HandAction(street="flop", player="Hero", action="bet", size_bb=3.0, is_hero=True),
            HandAction(street="flop", player="Villain", action="call", size_bb=3.0),
        ]
        players, _, _ = _infer_players_from_actions(
            actions, hero_name="Hero", hero_position="BTN", effective_stack_bb=100.0,
        )
        assert len(players) == 2


# ── Normalizer integration tests ─────────────────────────────────────────────

class TestNormalizerPlayerInference:
    """Test normalize_hand with empty players but populated actions."""

    def test_empty_players_inferred_from_actions(self):
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        assert len(canonical.players) == 2

    def test_hero_id_valid_after_inference(self):
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        hero = next((p for p in canonical.players if p.id == canonical.hero_id), None)
        assert hero is not None
        assert hero.name == "Hero"

    def test_hero_cards_assigned_after_inference(self):
        parsed = _make_parsed_hand(
            players=[],
            hero_cards=["As", "Kh"],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        hero = next((p for p in canonical.players if p.id == canonical.hero_id), None)
        assert hero is not None
        assert len(hero.hole_cards) == 2
        assert hero.hole_cards[0].notation == "As"

    def test_actions_reference_valid_player_ids(self):
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        player_ids = {p.id for p in canonical.players}
        for street in canonical.streets:
            for action in street.actions:
                assert action.player_id in player_ids, (
                    f"Action by {action.player_name!r} references unknown player_id {action.player_id!r}"
                )

    def test_normal_hand_still_works(self):
        """Ensure the normal path (players provided) is unaffected."""
        parsed = _make_parsed_hand(
            players=[
                PlayerInfo(name="Hero", seat=1, stack_bb=100.0, position="BTN"),
                PlayerInfo(name="Villain", seat=2, stack_bb=100.0, position="BB"),
            ],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        assert len(canonical.players) == 2
        assert canonical.players[0].id == "seat_1"
        assert canonical.players[1].id == "seat_2"


# ── Validator integration tests ──────────────────────────────────────────────

class TestValidationAfterInference:
    """Test that inferred players pass validation."""

    def test_inferred_hand_passes_validation(self):
        parsed = _make_parsed_hand(
            players=[],
            hero_cards=["As", "Kh"],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)

        assert result.can_analyze, (
            f"Validation should pass after player inference. Errors: "
            f"{[e.message for e in result.errors]}"
        )

    def test_no_too_few_players_error(self):
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)

        error_codes = [e.code for e in result.errors]
        assert "TOO_FEW_PLAYERS" not in error_codes

    def test_no_hero_not_found_error(self):
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="BB", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)

        error_codes = [e.code for e in result.errors]
        assert "HERO_NOT_IN_PLAYERS" not in error_codes

    def test_multistreet_hand_validates(self):
        parsed = _make_parsed_hand(
            players=[],
            hero_cards=["As", "Kh"],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
                HandAction(street="flop", player="Villain", action="check"),
                HandAction(street="flop", player="Hero", action="bet", size_bb=4.0, is_hero=True),
                HandAction(street="flop", player="Villain", action="fold"),
            ],
        )
        canonical = normalize_hand(parsed)
        result = validate_canonical(canonical)
        assert result.can_analyze


# ── Position normalization tests ─────────────────────────────────────────────

class TestPositionNormalization:
    def test_btn_aliases(self):
        assert normalize_position("btn") == "BTN"
        assert normalize_position("button") == "BTN"
        assert normalize_position("BTN") == "BTN"
        assert normalize_position("dealer") == "BTN"

    def test_blind_aliases(self):
        assert normalize_position("sb") == "SB"
        assert normalize_position("bb") == "BB"
        assert normalize_position("small blind") == "SB"
        assert normalize_position("big blind") == "BB"

    def test_middle_late_aliases(self):
        assert normalize_position("co") == "CO"
        assert normalize_position("hj") == "HJ"
        assert normalize_position("lj") == "LJ"
        assert normalize_position("cutoff") == "CO"
        assert normalize_position("hijack") == "HJ"

    def test_utg_aliases(self):
        assert normalize_position("utg") == "UTG"
        assert normalize_position("ep") == "UTG"

    def test_unknown_passthrough(self):
        assert normalize_position("unknown") == "UNKNOWN"
        assert normalize_position("?") == "?"


# ── Hero ID mapping edge cases ───────────────────────────────────────────────

class TestHeroIdMapping:
    def test_hero_id_never_references_nonexistent_player(self):
        """The old bug: hero_id='seat_0' but no player with that ID exists."""
        parsed = _make_parsed_hand(
            players=[],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        player_ids = {p.id for p in canonical.players}
        assert canonical.hero_id in player_ids, (
            f"hero_id={canonical.hero_id!r} not in player IDs: {player_ids}"
        )

    def test_hero_id_with_provided_players(self):
        parsed = _make_parsed_hand(
            players=[
                PlayerInfo(name="Hero", seat=3, stack_bb=100.0, position="BTN"),
                PlayerInfo(name="Villain", seat=5, stack_bb=100.0, position="BB"),
            ],
            actions=[
                HandAction(street="preflop", player="Hero", action="raise", size_bb=2.5, is_hero=True),
                HandAction(street="preflop", player="Villain", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        assert canonical.hero_id == "seat_3"

    def test_hero_id_when_hero_name_not_in_players(self):
        """If hero_name doesn't match any parser-provided player, hero_id
        remains stale so the validator can flag HERO_NOT_IN_PLAYERS."""
        parsed = _make_parsed_hand(
            players=[
                PlayerInfo(name="Alice", seat=1, stack_bb=100.0, position="BTN"),
                PlayerInfo(name="Bob", seat=2, stack_bb=100.0, position="BB"),
            ],
            hero_name="NonexistentHero",
            actions=[
                HandAction(street="preflop", player="Alice", action="raise", size_bb=2.5),
                HandAction(street="preflop", player="Bob", action="call", size_bb=2.5),
            ],
        )
        canonical = normalize_hand(parsed)
        # No player was marked is_hero (hero_name didn't match), so hero_id
        # falls through to the stale "seat_0" — the validator will flag this.
        assert canonical.hero_id == "seat_0"
        result = validate_canonical(canonical)
        error_codes = [e.code for e in result.errors]
        assert "HERO_NOT_IN_PLAYERS" in error_codes
