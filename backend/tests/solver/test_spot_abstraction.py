"""
Tests for the Solver Spot Abstraction system.

Covers:
    — Utility helpers: calculate_spr, bucket_spr, bucket_stack_depth
    — SolverSpotClassifier: pot type, positional matchup, IP/OOP, SPR, stack, board
    — NodeKey: construction, string generation, prefix helpers, hashability
    — SpotAbstraction: full pipeline from CanonicalHand to abstraction
    — Multiway pots: 3-way, 4-way player count detection
    — All six spot types: SRP, 3BET, 4BET, LIMPED, SQUEEZE, ISO_RAISE
    — Street classification: flop, turn, river
    — Edge cases: preflop-only hands, unknown positions, shallow stacks

Fixture strategy
----------------
All test hands are constructed programmatically from CanonicalHand — no
real hand history strings, no parsers, no GPT.  Factory helpers keep
fixtures concise.  Every field that the classifier reads is explicitly set.
"""

from __future__ import annotations

import pytest

from app.models.canonical import (
    ActionType,
    CanonicalAction,
    CanonicalCard,
    CanonicalHand,
    CanonicalPlayer,
    CanonicalStakes,
    CanonicalStreet,
    Street,
)
from app.solver.abstractions import NodeKey, SpotAbstraction
from app.solver.enums import (
    BoardClassEnum,
    PositionMatchup,
    SPRBucket,
    SolverStreet,
    SpotType,
    StackDepthBucket,
)
from app.solver.models import SolverSpot
from app.solver.spot_classifier import SolverSpotClassifier
from app.solver.utils import (
    bucket_spr,
    bucket_stack_depth,
    calculate_spr,
    normalize_position_for_matchup,
    postflop_position_rank,
)

# ═══════════════════════════════════════════════════════════════════════════════
# FIXTURE FACTORIES
# ═══════════════════════════════════════════════════════════════════════════════


def _card(notation: str) -> CanonicalCard:
    return CanonicalCard.from_notation(notation)


def _stakes() -> CanonicalStakes:
    return CanonicalStakes(big_blind=1.0, display="$0.50/$1.00")


def _player(
    seat: int,
    position: str,
    stack_bb: float = 100.0,
    is_hero: bool = False,
    hole_cards: list[str] | None = None,
) -> CanonicalPlayer:
    cards = [_card(c) for c in (hole_cards or [])]
    return CanonicalPlayer(
        id=f"seat_{seat}",
        name="Hero" if is_hero else f"P{seat}",
        seat=seat,
        position=position,
        stack_bb=stack_bb,
        hole_cards=cards,
        is_hero=is_hero,
        is_active=True,
    )


def _action(
    seq: int,
    street: Street,
    seat: int,
    action: ActionType,
    amount: float = 0.0,
    total_bet: float = 0.0,
    is_hero: bool = False,
    stack_before: float = 100.0,
    stack_after: float = 100.0,
    pot_before: float = 0.0,
    pot_after: float = 0.0,
) -> CanonicalAction:
    return CanonicalAction(
        sequence=seq,
        street=street,
        player_id=f"seat_{seat}",
        player_name="Hero" if is_hero else f"P{seat}",
        action=action,
        amount_bb=amount,
        total_bet_bb=total_bet,
        is_hero=is_hero,
        is_all_in=False,
        stack_before_bb=stack_before,
        stack_after_bb=stack_after,
        pot_before_bb=pot_before,
        pot_after_bb=pot_after,
    )


def _street(
    name: Street,
    pot_start: float = 0.0,
    board: list[str] | None = None,
    actions: list[CanonicalAction] | None = None,
) -> CanonicalStreet:
    return CanonicalStreet(
        name=name,
        board_cards=[_card(c) for c in (board or [])],
        pot_start_bb=pot_start,
        actions=actions or [],
    )


def _hand(
    players: list[CanonicalPlayer],
    hero_seat: int,
    streets: list[CanonicalStreet],
    effective_stack_bb: float,
    final_pot_bb: float,
    hand_id: str = "test_001",
) -> CanonicalHand:
    return CanonicalHand(
        hand_id=hand_id,
        site="GGPoker",
        game_type="NLHE",
        is_tournament=False,
        stakes=_stakes(),
        table_name="Test",
        table_max_seats=6,
        players=players,
        hero_id=f"seat_{hero_seat}",
        streets=streets,
        effective_stack_bb=effective_stack_bb,
        final_pot_bb=final_pot_bb,
    )


# ── Prebuilt hand scenarios ────────────────────────────────────────────────────

def _srp_btn_vs_bb_flop(board: list[str] | None = None) -> CanonicalHand:
    """
    SRP: 6-max, BTN (hero, seat 4) opens to 3bb, everyone else folds, BB calls.
    Flop: Ah Kd 3c (default)  — A_HIGH_DRY, rainbow, disconnected.
    Effective stack at flop: 97bb.  Pot at flop: 6.5bb.
    """
    board = board or ["Ah", "Kd", "3c"]
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["Ah", "Kd"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(5, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=4.5, pot_after=4.5),
        _action(7, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, total_bet=3.0, stack_before=99, stack_after=97, pot_before=4.5, pot_after=6.5),
    ])
    flop = _street(Street.FLOP, pot_start=6.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=6.5)


def _3bet_btn_vs_co_flop(board: list[str] | None = None) -> CanonicalHand:
    """
    3BET: CO opens 3bb, BTN (hero, seat 4) 3-bets to 9bb, CO calls.
    Flop: 9h 8h 7c (LOW_DYNAMIC)
    Effective stack at flop: 91bb.  Pot: 19.5bb.
    """
    board = board or ["9h", "8h", "7c"]
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["Jh", "Tc"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(5, Street.PREFLOP, 4, ActionType.RAISE, amount=9.0, total_bet=9.0, is_hero=True, stack_before=100, stack_after=91, pot_before=4.5, pot_after=13.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=13.5, pot_after=13.5),
        _action(7, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=13.5, pot_after=13.5),
        _action(8, Street.PREFLOP, 3, ActionType.CALL, amount=6.0, total_bet=9.0, stack_before=97, stack_after=91, pot_before=13.5, pot_after=19.5),
    ])
    flop = _street(Street.FLOP, pot_start=19.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=19.5)


def _4bet_hand() -> CanonicalHand:
    """
    4BET: CO opens, BTN 3-bets, CO 4-bets, BTN calls.
    Pot at flop: 58bb.  Effective stack: ~71bb.
    """
    players = [
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["Kh", "Kd"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 3, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(3, Street.PREFLOP, 4, ActionType.RAISE, amount=9.0, total_bet=9.0, is_hero=True, stack_before=100, stack_after=91, pot_before=4.5, pot_after=13.5),
        _action(4, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=13.5, pot_after=13.5),
        _action(5, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=13.5, pot_after=13.5),
        _action(6, Street.PREFLOP, 3, ActionType.RAISE, amount=26.0, total_bet=29.0, stack_before=97, stack_after=71, pot_before=13.5, pot_after=39.5),
        _action(7, Street.PREFLOP, 4, ActionType.CALL, amount=20.0, total_bet=29.0, is_hero=True, stack_before=91, stack_after=71, pot_before=39.5, pot_after=59.5),
    ])
    flop = _street(Street.FLOP, pot_start=59.5, board=["Ah", "Kd", "3c"])
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=59.5)


def _limped_hand() -> CanonicalHand:
    """
    LIMPED: SB (seat 5) limps, BB (hero, seat 6) checks.
    Pot at flop: 2.0bb.  Effective stack: ~99bb.
    """
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN"),
        _player(5, "SB"),
        _player(6, "BB", is_hero=True, hole_cards=["Qs", "Jd"]),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(5, Street.PREFLOP, 4, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(6, Street.PREFLOP, 5, ActionType.CALL, amount=0.5, total_bet=1.0, stack_before=99.5, stack_after=99.0, pot_before=1.5, pot_after=2.0),
        _action(7, Street.PREFLOP, 6, ActionType.CHECK, is_hero=True, stack_before=99, stack_after=99, pot_before=2.0, pot_after=2.0),
    ])
    flop = _street(Street.FLOP, pot_start=2.0, board=["Ts", "8d", "4c"])
    return _hand(players, 6, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=2.0)


def _squeeze_hand() -> CanonicalHand:
    """
    SQUEEZE: CO opens 3bb, BTN calls 3bb, SB (hero, seat 5) squeezes to 12bb.
    CO calls. Others fold.  Pot at flop: 28.0bb.  Effective stack: 88bb.
    """
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN"),
        _player(5, "SB", is_hero=True, hole_cards=["Ah", "Qh"]),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(5, Street.PREFLOP, 4, ActionType.CALL, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=4.5, pot_after=7.5),
        _action(6, Street.PREFLOP, 5, ActionType.RAISE, amount=11.5, total_bet=12.0, is_hero=True, stack_before=99.5, stack_after=88, pot_before=7.5, pot_after=19.0),
        _action(7, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=19.0, pot_after=19.0),
        _action(8, Street.PREFLOP, 3, ActionType.CALL, amount=9.0, total_bet=12.0, stack_before=97, stack_after=88, pot_before=19.0, pot_after=28.0),
        _action(9, Street.PREFLOP, 4, ActionType.FOLD, stack_before=97, stack_after=97, pot_before=28.0, pot_after=28.0),
    ])
    flop = _street(Street.FLOP, pot_start=28.0, board=["Ah", "Kd", "3c"])
    return _hand(players, 5, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=28.0)


def _iso_raise_hand() -> CanonicalHand:
    """
    ISO_RAISE: UTG limps, CO limps, BTN (hero, seat 4) raises to 8bb.
    UTG calls.  Pot at flop: 18.5bb.  Effective stack: 92bb.
    """
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["As", "Ks"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.CALL, amount=1.0, total_bet=1.0, stack_before=100, stack_after=99, pot_before=1.5, pot_after=2.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=2.5, pot_after=2.5),
        _action(4, Street.PREFLOP, 3, ActionType.CALL, amount=1.0, total_bet=1.0, stack_before=100, stack_after=99, pot_before=2.5, pot_after=3.5),
        _action(5, Street.PREFLOP, 4, ActionType.RAISE, amount=8.0, total_bet=8.0, is_hero=True, stack_before=100, stack_after=92, pot_before=3.5, pot_after=11.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=11.5, pot_after=11.5),
        _action(7, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=11.5, pot_after=11.5),
        _action(8, Street.PREFLOP, 1, ActionType.CALL, amount=7.0, total_bet=8.0, stack_before=99, stack_after=92, pot_before=11.5, pot_after=18.5),
        _action(9, Street.PREFLOP, 3, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=18.5, pot_after=18.5),
    ])
    flop = _street(Street.FLOP, pot_start=18.5, board=["Qs", "Jh", "Tc"])
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=18.5)


def _multiway_3way_hand() -> CanonicalHand:
    """
    3-way: CO opens 3bb, BTN calls 3bb, BB calls 2bb more.
    Pot at flop: 9.5bb.
    """
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["9h", "8h"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(5, Street.PREFLOP, 4, ActionType.CALL, amount=3.0, total_bet=3.0, is_hero=True, stack_before=100, stack_after=97, pot_before=4.5, pot_after=7.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=7.5, pot_after=7.5),
        _action(7, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, total_bet=3.0, stack_before=99, stack_after=97, pot_before=7.5, pot_after=9.5),
    ])
    flop = _street(Street.FLOP, pot_start=9.5, board=["7h", "6h", "2c"])
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=9.5)


def _turn_hand() -> CanonicalHand:
    """SRP BTN vs BB hand that goes to the turn."""
    base = _srp_btn_vs_bb_flop()
    flop_street = base.streets[1]
    turn_street = _street(Street.TURN, pot_start=flop_street.pot_start_bb, board=["Qd"])
    return _hand(
        base.players, 4,
        [base.streets[0], flop_street, turn_street],
        effective_stack_bb=base.effective_stack_bb,
        final_pot_bb=base.final_pot_bb,
    )


def _river_hand() -> CanonicalHand:
    """SRP BTN vs BB hand that goes to the river."""
    base = _srp_btn_vs_bb_flop()
    flop_street = base.streets[1]
    turn_street = _street(Street.TURN, pot_start=flop_street.pot_start_bb, board=["Qd"])
    river_street = _street(Street.RIVER, pot_start=flop_street.pot_start_bb, board=["Jh"])
    return _hand(
        base.players, 4,
        [base.streets[0], flop_street, turn_street, river_street],
        effective_stack_bb=base.effective_stack_bb,
        final_pot_bb=base.final_pot_bb,
    )


def _shallow_stack_hand(stack: float = 20.0) -> CanonicalHand:
    """SRP BTN vs BB at 20bb effective."""
    players = [
        _player(4, "BTN", stack_bb=stack, is_hero=True, hole_cards=["Ah", "Kd"]),
        _player(5, "SB", stack_bb=stack),
        _player(6, "BB", stack_bb=stack),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=stack, stack_after=stack - 0.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=stack, stack_after=stack - 1.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=stack, stack_after=stack - 3, pot_before=1.5, pot_after=4.5),
        _action(3, Street.PREFLOP, 5, ActionType.FOLD, stack_before=stack - 0.5, stack_after=stack - 0.5, pot_before=4.5, pot_after=4.5),
        _action(4, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, total_bet=3.0, stack_before=stack - 1, stack_after=stack - 3, pot_before=4.5, pot_after=6.5),
    ])
    flop = _street(Street.FLOP, pot_start=6.5, board=["Ah", "Kd", "3c"])
    return _hand(players, 4, [preflop, flop], effective_stack_bb=stack, final_pot_bb=6.5)


clf = SolverSpotClassifier()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Utility function unit tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestCalculateSPR:
    def test_standard(self):
        assert calculate_spr(97.0, 6.5) == pytest.approx(14.92, abs=0.01)

    def test_zero_pot(self):
        assert calculate_spr(100.0, 0.0) == 0.0

    def test_negative_pot(self):
        assert calculate_spr(100.0, -1.0) == 0.0

    def test_low_spr(self):
        assert calculate_spr(10.0, 30.0) == pytest.approx(0.33, abs=0.01)

    def test_exactly_two(self):
        assert calculate_spr(20.0, 10.0) == 2.0

    def test_rounding(self):
        # Should return exactly 2 decimal places
        spr = calculate_spr(97.0, 6.5)
        assert spr == round(spr, 2)


class TestBucketSPR:
    def test_commit_territory(self):
        assert bucket_spr(1.5) == "0_2"
        assert bucket_spr(0.0) == "0_2"
        assert bucket_spr(1.99) == "0_2"

    def test_low_spr(self):
        assert bucket_spr(2.0) == "2_4"
        assert bucket_spr(3.5) == "2_4"
        assert bucket_spr(3.99) == "2_4"

    def test_medium_spr(self):
        assert bucket_spr(4.0) == "4_8"
        assert bucket_spr(6.0) == "4_8"
        assert bucket_spr(7.99) == "4_8"

    def test_deep_spr(self):
        assert bucket_spr(8.0) == "8_PLUS"
        assert bucket_spr(15.0) == "8_PLUS"
        assert bucket_spr(100.0) == "8_PLUS"

    def test_boundary_values(self):
        assert bucket_spr(2.0) == "2_4"  # boundary: NOT 0_2
        assert bucket_spr(4.0) == "4_8"  # boundary: NOT 2_4
        assert bucket_spr(8.0) == "8_PLUS"  # boundary: NOT 4_8


class TestBucketStackDepth:
    def test_push_fold(self):
        assert bucket_stack_depth(10.0) == "10bb"
        assert bucket_stack_depth(12.0) == "10bb"

    def test_shallow(self):
        assert bucket_stack_depth(13.0) == "20bb"
        assert bucket_stack_depth(25.0) == "20bb"

    def test_mid_stack(self):
        assert bucket_stack_depth(26.0) == "40bb"
        assert bucket_stack_depth(50.0) == "40bb"

    def test_approaching_standard(self):
        assert bucket_stack_depth(51.0) == "60bb"
        assert bucket_stack_depth(70.0) == "60bb"

    def test_standard(self):
        assert bucket_stack_depth(71.0) == "100bb"
        assert bucket_stack_depth(100.0) == "100bb"
        assert bucket_stack_depth(125.0) == "100bb"

    def test_deep(self):
        assert bucket_stack_depth(126.0) == "150bb"
        assert bucket_stack_depth(175.0) == "150bb"

    def test_very_deep(self):
        assert bucket_stack_depth(176.0) == "200bb_plus"
        assert bucket_stack_depth(500.0) == "200bb_plus"

    def test_boundary_at_125(self):
        assert bucket_stack_depth(125.0) == "100bb"
        assert bucket_stack_depth(125.1) == "150bb"


class TestPositionHelpers:
    def test_postflop_rank_ordering(self):
        assert postflop_position_rank("SB") < postflop_position_rank("BB")
        assert postflop_position_rank("BB") < postflop_position_rank("UTG")
        assert postflop_position_rank("HJ") < postflop_position_rank("CO")
        assert postflop_position_rank("CO") < postflop_position_rank("BTN")

    def test_btn_is_most_ip(self):
        positions = ["SB", "BB", "UTG", "LJ", "HJ", "CO", "BTN"]
        ranks = [postflop_position_rank(p) for p in positions]
        assert ranks == sorted(ranks)

    def test_unknown_position(self):
        assert postflop_position_rank("UNKNOWN") == -1

    def test_normalize_position(self):
        assert normalize_position_for_matchup("UTG+1") == "UTG1"
        assert normalize_position_for_matchup("UTG+2") == "UTG2"
        assert normalize_position_for_matchup("BTN") == "BTN"
        assert normalize_position_for_matchup("BB") == "BB"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Spot type detection
# ═══════════════════════════════════════════════════════════════════════════════


class TestSpotTypeDetection:
    def test_srp(self):
        hand = _srp_btn_vs_bb_flop()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.SRP

    def test_three_bet(self):
        hand = _3bet_btn_vs_co_flop()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.THREE_BET

    def test_four_bet(self):
        hand = _4bet_hand()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.FOUR_BET

    def test_limped(self):
        hand = _limped_hand()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.LIMPED

    def test_squeeze(self):
        hand = _squeeze_hand()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.SQUEEZE

    def test_iso_raise(self):
        hand = _iso_raise_hand()
        spot = clf.classify(hand)
        assert spot.spot_type == SpotType.ISO_RAISE


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Positional matchup and IP/OOP detection
# ═══════════════════════════════════════════════════════════════════════════════


class TestPositionalMatchup:
    def test_srp_btn_vs_bb(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.position_matchup == PositionMatchup.BTN_vs_BB

    def test_3bet_btn_vs_co(self):
        spot = clf.classify(_3bet_btn_vs_co_flop())
        assert spot.position_matchup == PositionMatchup.BTN_vs_CO

    def test_limped_sb_vs_bb(self):
        # SB limps, BB (hero) checks — SB is OOP vs BB is also OOP?
        # Actually BB is IP vs SB postflop (BB acts last HU when SB is in).
        # So BB is IP, matchup = BB_vs_SB
        spot = clf.classify(_limped_hand())
        assert spot.position_matchup == PositionMatchup.BB_vs_SB

    def test_multiway_3way(self):
        spot = clf.classify(_multiway_3way_hand())
        assert spot.position_matchup == PositionMatchup.MULTIWAY_3WAY

    def test_player_count_hu(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.player_count == 2

    def test_player_count_3way(self):
        spot = clf.classify(_multiway_3way_hand())
        assert spot.player_count == 3


class TestIPOOP:
    def test_btn_is_ip(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.is_ip is True

    def test_btn_vs_co_btn_is_ip(self):
        # BTN is IP vs CO
        spot = clf.classify(_3bet_btn_vs_co_flop())
        assert spot.is_ip is True

    def test_bb_hero_is_oop_vs_btn(self):
        """When hero is BB facing BTN, hero should be OOP."""
        players = [
            _player(4, "BTN"),
            _player(5, "SB"),
            _player(6, "BB", is_hero=True, hole_cards=["Kh", "Qh"]),
        ]
        preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
            _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
            _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, is_hero=True, stack_before=100, stack_after=99, pot_before=0.5, pot_after=1.5),
            _action(2, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
            _action(3, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=4.5, pot_after=4.5),
            _action(4, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, is_hero=True, stack_before=99, stack_after=97, pot_before=4.5, pot_after=6.5),
        ])
        flop = _street(Street.FLOP, pot_start=6.5, board=["Ah", "Kd", "3c"])
        hand = _hand(players, 6, [preflop, flop], 100.0, 6.5)
        spot = clf.classify(hand)
        assert spot.is_ip is False

    def test_sb_is_oop(self):
        # SB (hero) squeezes — SB is OOP postflop
        spot = clf.classify(_squeeze_hand())
        assert spot.is_ip is False

    def test_hero_position_set(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.hero_position == "BTN"

    def test_villain_position_set_for_hu(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.villain_position == "BB"

    def test_villain_position_none_for_multiway(self):
        spot = clf.classify(_multiway_3way_hand())
        assert spot.villain_position is None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Stack depth and SPR bucketing
# ═══════════════════════════════════════════════════════════════════════════════


class TestStackAndSPRBuckets:
    def test_100bb_stack_bucket(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        # After open to 3bb, effective stack at flop = 97bb → "100bb" bucket
        assert spot.stack_depth_bucket == StackDepthBucket.BB100

    def test_deep_spr_srp(self):
        # SPR ≈ 97/6.5 ≈ 14.9 → 8_PLUS
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.spr_bucket == SPRBucket.SPR_8_PLUS

    def test_3bet_pot_lower_spr(self):
        # Effective ≈ 91, pot ≈ 19.5 → SPR ≈ 4.67 → "4_8"
        spot = clf.classify(_3bet_btn_vs_co_flop())
        assert spot.spr_bucket == SPRBucket.SPR_4_8

    def test_4bet_pot_very_low_spr(self):
        # Effective ≈ 71, pot ≈ 59.5 → SPR ≈ 1.19 → "0_2"
        spot = clf.classify(_4bet_hand())
        assert spot.spr_bucket == SPRBucket.SPR_0_2

    def test_shallow_20bb_stack(self):
        spot = clf.classify(_shallow_stack_hand(20.0))
        assert spot.stack_depth_bucket == StackDepthBucket.BB20

    def test_shallow_40bb_stack(self):
        spot = clf.classify(_shallow_stack_hand(40.0))
        assert spot.stack_depth_bucket == StackDepthBucket.BB40

    def test_spr_raw_value_is_set(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.spr > 0.0

    def test_effective_stack_raw_value(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        # Both players at 97bb after 3bb open
        assert spot.effective_stack_bb == pytest.approx(97.0, abs=0.1)

    def test_pot_bb_matches_flop_pot(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.pot_bb == pytest.approx(6.5, abs=0.1)

    def test_limped_pot_large_spr(self):
        # Pot=2bb, stack~99bb → SPR≈49.5 → 8_PLUS
        spot = clf.classify(_limped_hand())
        assert spot.spr_bucket == SPRBucket.SPR_8_PLUS


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Board classification integration
# ═══════════════════════════════════════════════════════════════════════════════


class TestBoardClassification:
    def test_a_high_dry_flop(self):
        spot = clf.classify(_srp_btn_vs_bb_flop(["Ah", "Kd", "3c"]))
        assert spot.board_class == BoardClassEnum.A_HIGH_DRY
        assert spot.board_texture is not None

    def test_low_dynamic_flop(self):
        spot = clf.classify(_srp_btn_vs_bb_flop(["9h", "8h", "7c"]))
        assert spot.board_class == BoardClassEnum.LOW_DYNAMIC

    def test_monotone_flop(self):
        spot = clf.classify(_srp_btn_vs_bb_flop(["Kh", "8h", "3h"]))
        assert spot.board_class == BoardClassEnum.MONOTONE

    def test_triple_broadway_flop(self):
        spot = clf.classify(_iso_raise_hand())
        # Iso raise hand uses Qs Jh Tc flop
        assert spot.board_class == BoardClassEnum.TRIPLE_BROADWAY

    def test_board_texture_features_populated(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.board_texture is not None
        assert isinstance(spot.board_texture.broadway_count, int)
        assert isinstance(spot.board_texture.paired, bool)

    def test_paired_board(self):
        spot = clf.classify(_srp_btn_vs_bb_flop(["Qh", "Qd", "5c"]))
        assert spot.board_class == BoardClassEnum.PAIRED_HIGH

    def test_low_connected(self):
        spot = clf.classify(_srp_btn_vs_bb_flop(["7h", "4d", "2c"]))
        assert spot.board_class == BoardClassEnum.LOW_CONNECTED

    def test_no_board_preflop(self):
        """Preflop-only hand should have NEUTRAL board class and no texture."""
        players = [
            _player(4, "BTN", is_hero=True, hole_cards=["Ah", "Kd"]),
            _player(6, "BB"),
        ]
        preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
            _action(0, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99, pot_before=0, pot_after=1.0),
            _action(1, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=100, stack_after=97, pot_before=1.0, pot_after=4.0),
            _action(2, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=4.0, pot_after=4.0),
        ])
        hand = _hand(players, 4, [preflop], 100.0, 4.0)
        spot = clf.classify(hand)
        assert spot.board_class == BoardClassEnum.NEUTRAL
        assert spot.board_texture is None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Street classification
# ═══════════════════════════════════════════════════════════════════════════════


class TestStreetClassification:
    def test_flop_street(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.street == SolverStreet.FLOP

    def test_turn_street(self):
        spot = clf.classify(_turn_hand())
        assert spot.street == SolverStreet.TURN

    def test_river_street(self):
        spot = clf.classify(_river_hand())
        assert spot.street == SolverStreet.RIVER

    def test_turn_board_class_uses_4_cards(self):
        # Ah Kd 3c (A_HIGH_DRY) → turn Qd → TRIPLE_BROADWAY or similar
        hand = _turn_hand()
        spot = clf.classify(hand)
        # 4-card board: Ah Kd 3c Qd — 3 broadway, so TRIPLE_BROADWAY
        assert spot.board_class == BoardClassEnum.TRIPLE_BROADWAY

    def test_river_board_class_uses_5_cards(self):
        hand = _river_hand()
        spot = clf.classify(hand)
        # 5-card board: Ah Kd 3c Qd Jh — 4 broadway cards
        assert spot.board_texture is not None
        assert spot.board_texture.broadway_count >= 3


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — NodeKey construction and properties
# ═══════════════════════════════════════════════════════════════════════════════


class TestNodeKey:
    def setup_method(self):
        hand = _srp_btn_vs_bb_flop()
        spot = clf.classify(hand)
        self.key = NodeKey.from_solver_spot(spot)

    def test_spot_type_field(self):
        assert self.key.spot_type == "SRP"

    def test_position_matchup_field(self):
        assert self.key.position_matchup == "BTN_vs_BB"

    def test_stack_depth_field(self):
        assert self.key.stack_depth_bucket == "100bb"

    def test_spr_bucket_field(self):
        assert self.key.spr_bucket == "8_PLUS"

    def test_board_class_field(self):
        assert self.key.board_class == "A_HIGH_DRY"

    def test_street_field(self):
        assert self.key.street == "flop"

    def test_player_count_field(self):
        assert self.key.player_count == 2

    def test_to_string_format(self):
        s = self.key.to_string()
        assert s == "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"

    def test_str_equals_to_string(self):
        assert str(self.key) == self.key.to_string()

    def test_hashable(self):
        key_set = {self.key}
        assert self.key in key_set

    def test_equality(self):
        hand = _srp_btn_vs_bb_flop()
        spot = clf.classify(hand)
        key2 = NodeKey.from_solver_spot(spot)
        assert self.key == key2

    def test_used_as_dict_key(self):
        lookup = {self.key: "strategy_data"}
        assert lookup[self.key] == "strategy_data"

    def test_immutable(self):
        with pytest.raises(Exception):
            self.key.spot_type = "3BET"  # type: ignore[misc]

    def test_positional_prefix(self):
        assert self.key.positional_prefix() == "SRP::BTN_vs_BB"

    def test_street_prefix(self):
        assert self.key.street_prefix() == "SRP::BTN_vs_BB::100bb::flop"

    def test_from_canonical_hand(self):
        hand = _srp_btn_vs_bb_flop()
        key = NodeKey.from_canonical_hand(hand)
        assert key == self.key

    def test_3bet_key_differs_from_srp(self):
        hand_3bet = _3bet_btn_vs_co_flop()
        key_3bet = NodeKey.from_solver_spot(clf.classify(hand_3bet))
        assert key_3bet != self.key
        assert key_3bet.spot_type == "3BET"

    def test_different_board_class_different_key(self):
        hand_wet = _srp_btn_vs_bb_flop(["9h", "8h", "7c"])
        key_wet = NodeKey.from_solver_spot(clf.classify(hand_wet))
        assert key_wet.board_class != self.key.board_class
        assert key_wet != self.key


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — SpotAbstraction pipeline
# ═══════════════════════════════════════════════════════════════════════════════


class TestSpotAbstraction:
    def setup_method(self):
        self.hand = _srp_btn_vs_bb_flop()
        self.abstraction = SpotAbstraction.from_canonical_hand(self.hand)

    def test_node_key_string_populated(self):
        assert self.abstraction.node_key_string == "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"

    def test_solver_spot_present(self):
        assert isinstance(self.abstraction.solver_spot, SolverSpot)

    def test_node_key_present(self):
        assert isinstance(self.abstraction.node_key, NodeKey)

    def test_convenience_properties(self):
        assert self.abstraction.spot_type == "SRP"
        assert self.abstraction.board_class == "A_HIGH_DRY"
        assert self.abstraction.position_matchup == "BTN_vs_BB"
        assert self.abstraction.street == "flop"

    def test_repr(self):
        assert "SRP::BTN_vs_BB" in repr(self.abstraction)

    def test_from_solver_spot(self):
        spot = clf.classify(self.hand)
        abstraction2 = SpotAbstraction.from_solver_spot(spot)
        assert abstraction2.node_key_string == self.abstraction.node_key_string

    def test_3bet_abstraction_key(self):
        hand = _3bet_btn_vs_co_flop()
        ab = SpotAbstraction.from_canonical_hand(hand)
        assert "3BET" in ab.node_key_string
        assert "BTN_vs_CO" in ab.node_key_string

    def test_squeeze_abstraction_key(self):
        hand = _squeeze_hand()
        ab = SpotAbstraction.from_canonical_hand(hand)
        assert "SQUEEZE" in ab.node_key_string

    def test_limped_abstraction_key(self):
        hand = _limped_hand()
        ab = SpotAbstraction.from_canonical_hand(hand)
        assert "LIMPED" in ab.node_key_string

    def test_iso_raise_abstraction_key(self):
        hand = _iso_raise_hand()
        ab = SpotAbstraction.from_canonical_hand(hand)
        assert "ISO_RAISE" in ab.node_key_string

    def test_multiway_abstraction_key(self):
        hand = _multiway_3way_hand()
        ab = SpotAbstraction.from_canonical_hand(hand)
        assert "MULTIWAY_3WAY" in ab.node_key_string
        assert "3p" in ab.node_key_string

    def test_determinism(self):
        """Same hand always produces identical abstraction."""
        ab1 = SpotAbstraction.from_canonical_hand(self.hand)
        ab2 = SpotAbstraction.from_canonical_hand(self.hand)
        assert ab1.node_key_string == ab2.node_key_string
        assert ab1.node_key == ab2.node_key


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9 — Metadata passthrough
# ═══════════════════════════════════════════════════════════════════════════════


class TestMetadata:
    def test_hand_id_in_metadata(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.metadata["hand_id"] == "test_001"

    def test_site_in_metadata(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.metadata["site"] == "GGPoker"

    def test_game_type_in_metadata(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.metadata["game_type"] == "NLHE"

    def test_is_tournament_in_metadata(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        assert spot.metadata["is_tournament"] is False

    def test_metadata_never_affects_node_key(self):
        """Metadata is tracing data — two hands with different IDs but same
        strategic situation must produce the same NodeKey."""
        h1 = _srp_btn_vs_bb_flop()
        h2 = _hand(
            h1.players, 4, h1.streets,
            h1.effective_stack_bb, h1.final_pot_bb,
            hand_id="different_id_999",
        )
        key1 = NodeKey.from_canonical_hand(h1)
        key2 = NodeKey.from_canonical_hand(h2)
        assert key1 == key2


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10 — SolverSpot model serialisation
# ═══════════════════════════════════════════════════════════════════════════════


class TestSolverSpotModel:
    def test_model_dump(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        d = spot.model_dump()
        assert d["spot_type"] == "SRP"
        assert d["position_matchup"] == "BTN_vs_BB"
        assert d["board_class"] == "A_HIGH_DRY"
        assert d["street"] == "flop"
        assert d["is_ip"] is True

    def test_json_roundtrip(self):
        import json
        spot = clf.classify(_srp_btn_vs_bb_flop())
        j = spot.model_dump_json()
        parsed = json.loads(j)
        assert parsed["spot_type"] == "SRP"
        assert parsed["player_count"] == 2

    def test_required_fields_all_present(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        required = [
            "spot_type", "hero_position", "position_matchup", "is_ip",
            "player_count", "effective_stack_bb", "pot_bb", "spr",
            "stack_depth_bucket", "spr_bucket", "board_class", "street",
        ]
        d = spot.model_dump()
        for field in required:
            assert field in d, f"Missing field: {field}"

    def test_board_texture_nested_in_dump(self):
        spot = clf.classify(_srp_btn_vs_bb_flop())
        d = spot.model_dump()
        assert d["board_texture"] is not None
        assert "broadway_count" in d["board_texture"]
        assert "paired" in d["board_texture"]
