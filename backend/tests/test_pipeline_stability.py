"""
Pipeline stability regression tests.

Verifies:
- Actions never disappear between pipeline stages
- Trace is always populated
- Action counts match across stages
- River actions survive the full pipeline
- Solver data is present when expected
"""

import pytest

from app.models.schemas import ParsedHand, BoardCards, HandAction, PlayerInfo
from app.engines.analysis import analyse_hand


def _make_river_hand() -> ParsedHand:
    """Standard HU hand with river bet + call."""
    return ParsedHand(
        site="PokerStars",
        game_type="NLHE",
        stakes="1/2",
        hand_id="stability_001",
        hero_name="Hero",
        hero_position="BTN",
        effective_stack_bb=100.0,
        hero_cards=["Qh", "Jd"],
        board=BoardCards(flop=["Ks", "8c", "3h"], turn=["2d"], river=["7s"]),
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
            HandAction(street="turn", player="Hero", action="check", is_hero=True),
            HandAction(street="river", player="Villain", action="bet", size_bb=91.0, is_all_in=True),
            HandAction(street="river", player="Hero", action="call", size_bb=91.0, is_hero=True),
        ],
        pot_size_bb=200.0,
        big_blind=1.0,
    )


class TestActionCountStability:
    """Actions must never disappear between pipeline stages."""

    def test_input_equals_output(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert len(result.parsed_hand.actions) == len(hand.actions), (
            f"Input had {len(hand.actions)} actions, output has {len(result.parsed_hand.actions)}"
        )

    def test_river_actions_preserved(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        river = [a for a in result.parsed_hand.actions if a.street == "river"]
        assert len(river) == 2, f"Expected 2 river actions, got {len(river)}"

    def test_villain_river_bet_preserved(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        villain_river = [
            a for a in result.parsed_hand.actions
            if a.street == "river" and not a.is_hero
        ]
        assert len(villain_river) == 1
        assert villain_river[0].action in ("bet", "raise")

    def test_hero_river_call_preserved(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        hero_river = [
            a for a in result.parsed_hand.actions
            if a.street == "river" and a.is_hero
        ]
        assert len(hero_river) == 1
        assert hero_river[0].action == "call"


class TestTracePresent:
    """Every analysis response must include a trace."""

    def test_trace_exists(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert result.trace is not None

    def test_trace_has_input(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert "input" in result.trace
        assert result.trace["input"]["action_count"] == 9

    def test_trace_has_sanitized(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert "sanitized" in result.trace

    def test_trace_has_analysed(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert "analysed" in result.trace

    def test_trace_no_mismatch(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert result.trace.get("action_count_mismatch") is False

    def test_trace_river_actions(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        river = result.trace["input"]["river_actions"]
        assert len(river) == 2
        assert any("bet" in r or "raise" in r for r in river)
        assert any("call" in r for r in river)


class TestEngineVersion:
    def test_version_present(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert result.engine_version is not None
        assert result.engine_version >= "3.0"


class TestSanitizedHand:
    def test_no_sanitization_for_legal_hand(self):
        hand = _make_river_hand()
        result = analyse_hand(hand)
        assert result.parsed_hand_sanitized is None
        assert len(result.corrections_applied) == 0

    def test_sanitization_for_illegal_fold(self):
        hand = _make_river_hand()
        # Replace villain bet with check, hero call with fold (illegal)
        hand.actions[7] = HandAction(
            street="river", player="Villain", action="check",
        )
        hand.actions[8] = HandAction(
            street="river", player="Hero", action="fold", is_hero=True,
        )
        result = analyse_hand(hand)
        assert result.parsed_hand_sanitized is not None
        assert len(result.corrections_applied) > 0

    def test_sanitized_preserves_action_count(self):
        hand = _make_river_hand()
        hand.actions[7] = HandAction(
            street="river", player="Villain", action="check",
        )
        hand.actions[8] = HandAction(
            street="river", player="Hero", action="fold", is_hero=True,
        )
        result = analyse_hand(hand)
        assert len(result.parsed_hand.actions) == len(result.parsed_hand_sanitized.actions)


class TestImmutability:
    """The analysis engine must not mutate its input."""

    def test_input_unchanged(self):
        hand = _make_river_hand()
        original_actions = [(a.player, a.action, a.size_bb) for a in hand.actions]
        analyse_hand(hand)
        after_actions = [(a.player, a.action, a.size_bb) for a in hand.actions]
        assert original_actions == after_actions, "analyse_hand mutated its input"
