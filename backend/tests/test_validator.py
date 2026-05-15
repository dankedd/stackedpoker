"""
Validator tests — verifies deterministic hand validation.
"""
import pytest
from app.models.schemas import ParsedHand, BoardCards, PlayerInfo, HandAction
from app.engines.validator import validate_hand


def _make_hand(**kwargs) -> ParsedHand:
    defaults = dict(
        site="GGPoker",
        game_type="NLHE",
        stakes="$0.50/$1.00",
        hand_id="TEST001",
        hero_name="Hero",
        hero_position="BTN",
        effective_stack_bb=100.0,
        hero_cards=["Ah", "Kd"],
        board=BoardCards(flop=["Qc", "7h", "2s"], turn=[], river=[]),
        players=[
            PlayerInfo(name="Hero", seat=1, stack_bb=100.0, position="BTN"),
            PlayerInfo(name="Villain", seat=2, stack_bb=80.0, position="BB"),
        ],
        actions=[
            HandAction(street="preflop", player="Hero", action="raise",
                       size_bb=3.0, is_hero=True),
            HandAction(street="preflop", player="Villain", action="call",
                       size_bb=2.0, is_hero=False),
            HandAction(street="flop", player="Villain", action="check", is_hero=False),
            HandAction(street="flop", player="Hero", action="bet",
                       size_bb=4.0, is_hero=True),
        ],
        pot_size_bb=6.5,
        big_blind=1.0,
        table_max_seats=6,
    )
    defaults.update(kwargs)
    return ParsedHand(**defaults)


class TestValidateHand:

    def test_valid_hand_passes(self):
        result = validate_hand(_make_hand())
        assert result.is_valid
        assert result.errors == []

    def test_confidence_high_for_valid_hand(self):
        result = validate_hand(_make_hand())
        assert result.confidence >= 0.80

    # ── Card format errors ────────────────────────────────────────────────

    def test_invalid_hero_card_format(self):
        result = validate_hand(_make_hand(hero_cards=["Xh", "Kd"]))
        assert not result.is_valid
        assert any("Invalid hero card" in e for e in result.errors)

    def test_invalid_board_card_format(self):
        board = BoardCards(flop=["Xc", "7h", "2s"], turn=[], river=[])
        result = validate_hand(_make_hand(board=board))
        assert not result.is_valid
        assert any("Invalid board card" in e for e in result.errors)

    # ── Duplicate cards ───────────────────────────────────────────────────

    def test_duplicate_card_hero_vs_board(self):
        board = BoardCards(flop=["Ah", "7h", "2s"], turn=[], river=[])
        result = validate_hand(_make_hand(hero_cards=["Ah", "Kd"], board=board))
        assert not result.is_valid
        assert any("Duplicate" in e for e in result.errors)

    def test_duplicate_card_in_board(self):
        board = BoardCards(flop=["Qc", "Qc", "2s"], turn=[], river=[])
        result = validate_hand(_make_hand(board=board))
        assert not result.is_valid

    # ── Hero presence ─────────────────────────────────────────────────────

    def test_hero_not_in_players(self):
        players = [PlayerInfo(name="Villain", seat=2, stack_bb=80.0, position="BB")]
        result = validate_hand(_make_hand(players=players))
        assert not result.is_valid
        assert any("Hero" in e and "not found" in e for e in result.errors)

    def test_missing_hero_cards_is_warning_not_error(self):
        result = validate_hand(_make_hand(hero_cards=[]))
        assert result.is_valid   # warnings only, not errors
        assert any("hole cards" in w.lower() for w in result.warnings)

    # ── Board progression ─────────────────────────────────────────────────

    def test_turn_without_flop_is_error(self):
        board = BoardCards(flop=[], turn=["Ah"], river=[])
        result = validate_hand(_make_hand(board=board))
        assert not result.is_valid
        assert any("flop" in e.lower() for e in result.errors)

    def test_river_without_turn_is_error(self):
        board = BoardCards(flop=["Qc", "7h", "2s"], turn=[], river=["Kd"])
        result = validate_hand(_make_hand(board=board))
        assert not result.is_valid
        assert any("turn" in e.lower() for e in result.errors)

    # ── Action ordering ───────────────────────────────────────────────────

    def test_flop_action_before_preflop_is_error(self):
        actions = [
            HandAction(street="flop", player="Hero", action="bet",
                       size_bb=4.0, is_hero=True),
            HandAction(street="preflop", player="Villain", action="fold",
                       is_hero=False),
        ]
        result = validate_hand(_make_hand(actions=actions))
        assert not result.is_valid
        assert any("out of order" in e.lower() for e in result.errors)

    # ── Stack sanity ──────────────────────────────────────────────────────

    def test_negative_effective_stack_is_error(self):
        result = validate_hand(_make_hand(effective_stack_bb=-5.0))
        assert not result.is_valid
        assert any("zero or negative" in e.lower() for e in result.errors)

    def test_negative_player_stack_is_error(self):
        players = [
            PlayerInfo(name="Hero", seat=1, stack_bb=-10.0, position="BTN"),
            PlayerInfo(name="Villain", seat=2, stack_bb=80.0, position="BB"),
        ]
        result = validate_hand(_make_hand(players=players))
        assert not result.is_valid
        assert any("Negative stack" in e for e in result.errors)

    # ── Action amount sanity ──────────────────────────────────────────────

    def test_negative_action_size_is_error(self):
        actions = [
            HandAction(street="preflop", player="Hero", action="raise",
                       size_bb=-3.0, is_hero=True),
        ]
        result = validate_hand(_make_hand(actions=actions))
        assert not result.is_valid
        assert any("Negative action" in e for e in result.errors)

    # ── Confidence ────────────────────────────────────────────────────────

    def test_confidence_drops_with_errors(self):
        result_bad = validate_hand(_make_hand(hero_cards=["Xh", "Kd"]))
        result_good = validate_hand(_make_hand())
        assert result_bad.confidence < result_good.confidence

    def test_confidence_drops_without_hero_cards(self):
        result_no_cards = validate_hand(_make_hand(hero_cards=[]))
        result_with_cards = validate_hand(_make_hand())
        assert result_no_cards.confidence < result_with_cards.confidence

    # ── Hero detection method ─────────────────────────────────────────────

    def test_hero_detected_by_known_site(self):
        result = validate_hand(_make_hand())
        assert "GGPoker" in result.hero_detected_by

    def test_hero_detected_by_pokerstars(self):
        result = validate_hand(_make_hand(site="PokerStars"))
        assert "PokerStars" in result.hero_detected_by

    # ── Board ↔ action consistency ────────────────────────────────────────

    def test_flop_actions_without_flop_cards_warns(self):
        board = BoardCards(flop=[], turn=[], river=[])
        actions = [
            HandAction(street="preflop", player="Hero", action="raise",
                       size_bb=3.0, is_hero=True),
            HandAction(street="flop", player="Hero", action="bet",
                       size_bb=4.0, is_hero=True),
        ]
        result = validate_hand(_make_hand(board=board, actions=actions))
        assert any("flop" in w.lower() for w in result.warnings)
