"""
Regression tests for replay action completeness.

Ensures villain aggressive actions (bets, raises, shoves) are always
present in the replay output so the frontend can display what hero
is responding to.
"""

from app.models.schemas import (
    ParsedHand, BoardCards, HandAction, PlayerInfo,
)
from app.engines.analysis import analyse_hand
from app.api.routes.analyze import _build_replay


def _make_shove_hand() -> ParsedHand:
    """Hand where villain shoves river and hero calls."""
    return ParsedHand(
        site="PokerStars",
        game_type="NLHE",
        stakes="1/2",
        hand_id="991133772",
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
            HandAction(street="flop", player="Hero", action="bet", size_bb=2.0, is_hero=True),
            HandAction(street="flop", player="Villain", action="call", size_bb=2.0),
            HandAction(street="turn", player="Villain", action="check"),
            HandAction(street="turn", player="Hero", action="check", is_hero=True),
            HandAction(street="river", player="Villain", action="raise", size_bb=95.5),
            HandAction(street="river", player="Hero", action="call", size_bb=95.5, is_hero=True),
        ],
        pot_size_bb=200.0,
        big_blind=1.0,
    )


class TestReplayActionCompleteness:
    def test_villain_shove_present_in_replay(self):
        """The villain's river shove must appear in replay actions."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        river_actions = [a for a in replay.actions if a.street == "river"]
        assert len(river_actions) == 2, f"Expected 2 river actions, got {len(river_actions)}"

        villain_river = [a for a in river_actions if not a.is_hero]
        assert len(villain_river) == 1, "Villain river action missing from replay"
        assert villain_river[0].action == "raise"
        assert villain_river[0].amount is not None

    def test_villain_shove_before_hero_call(self):
        """Villain's shove must come before hero's call in action order."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        river_actions = [a for a in replay.actions if a.street == "river"]
        assert not river_actions[0].is_hero, "First river action should be villain's"
        assert river_actions[1].is_hero, "Second river action should be hero's"

    def test_villain_shove_has_amount(self):
        """Villain's shove must have an amount for UI display."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        villain_shove = next(
            a for a in replay.actions
            if a.street == "river" and not a.is_hero
        )
        assert villain_shove.amount is not None
        assert float(villain_shove.amount.replace("bb", "")) > 0

    def test_pot_escalation_on_shove(self):
        """Pot must increase after villain's shove."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        river_actions = [a for a in replay.actions if a.street == "river"]
        villain_pot = river_actions[0].pot_after
        hero_pot = river_actions[1].pot_after

        assert hero_pot > villain_pot, (
            f"Pot should increase: villain={villain_pot} hero={hero_pot}"
        )

    def test_hero_call_has_coaching(self):
        """Hero's river call must have coaching data."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        hero_call = next(
            a for a in replay.actions
            if a.street == "river" and a.is_hero
        )
        assert hero_call.coaching is not None
        assert hero_call.coaching.score > 0
        assert len(hero_call.coaching.strategic_options) > 0

    def test_all_streets_present(self):
        """All 4 streets must be represented in replay."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        streets = {a.street for a in replay.actions}
        assert "preflop" in streets
        assert "flop" in streets
        assert "turn" in streets
        assert "river" in streets

    def test_action_count_matches_input(self):
        """Replay must have same number of actions as input."""
        hand = _make_shove_hand()
        result = analyse_hand(hand)
        replay = _build_replay(result)

        assert len(replay.actions) == len(hand.actions), (
            f"Expected {len(hand.actions)} actions, got {len(replay.actions)}"
        )
