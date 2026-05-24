"""
Comprehensive poker abstraction fixture suite.

30 high-quality canonical poker test hands covering every major
abstraction and board classification edge case.

Each fixture validates the REAL deterministic abstraction engine —
no hardcoded outputs.  Every assertion is derived from running the
CanonicalHand through SolverSpotClassifier and SpotAbstraction.

Categories
----------
  1–14  Board classification (all BoardClassEnum values)
 15–20  Turn / river evolution events
 21–26  Pot construction types and multiway
 27–30  Stack depth, SPR edge cases, tournament
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

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
from app.solver.abstractions import SpotAbstraction
from app.solver.enums import (
    BoardClassEnum,
    PositionMatchup,
    SPRBucket,
    SolverStreet,
    SpotType,
    StackDepthBucket,
)
from app.solver.spot_classifier import SolverSpotClassifier


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
    is_all_in: bool = False,
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
        is_all_in=is_all_in,
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
    hand_id: str = "fixture",
    is_tournament: bool = False,
) -> CanonicalHand:
    return CanonicalHand(
        hand_id=hand_id,
        site="GGPoker",
        game_type="NLHE",
        is_tournament=is_tournament,
        stakes=_stakes(),
        table_name="Fixture",
        table_max_seats=6,
        players=players,
        hero_id=f"seat_{hero_seat}",
        streets=streets,
        effective_stack_bb=effective_stack_bb,
        final_pot_bb=final_pot_bb,
    )


# ── Prebuilt scenario builders ───────────────────────────────────────────────


def _srp_btn_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
    stack: float = 100.0,
) -> CanonicalHand:
    """SRP: 6-max, BTN opens 3bb, BB calls. Pot 6.5bb."""
    players = [
        _player(1, "UTG", stack),
        _player(2, "HJ", stack),
        _player(3, "CO", stack),
        _player(4, "BTN", stack, is_hero=True, hole_cards=["Ah", "Kd"]),
        _player(5, "SB", stack),
        _player(6, "BB", stack),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=stack, stack_after=stack - 0.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=stack, stack_after=stack - 1.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(5, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=stack, stack_after=stack - 3, pot_before=1.5, pot_after=4.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=stack - 0.5, stack_after=stack - 0.5, pot_before=4.5, pot_after=4.5),
        _action(7, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, total_bet=3.0, stack_before=stack - 1, stack_after=stack - 3, pot_before=4.5, pot_after=6.5),
    ])
    flop = _street(Street.FLOP, pot_start=6.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=stack, final_pot_bb=6.5, hand_id=hand_id)


def _srp_btn_vs_bb_turn(
    flop_board: list[str],
    turn_card: str,
    hand_id: str = "fixture",
) -> CanonicalHand:
    """SRP BTN vs BB extended to the turn."""
    base = _srp_btn_vs_bb(flop_board, hand_id=hand_id)
    turn = _street(Street.TURN, pot_start=6.5, board=[turn_card])
    return _hand(
        base.players, 4,
        [base.streets[0], base.streets[1], turn],
        effective_stack_bb=base.effective_stack_bb,
        final_pot_bb=base.final_pot_bb,
        hand_id=hand_id,
    )


def _srp_btn_vs_bb_river(
    flop_board: list[str],
    turn_card: str,
    river_card: str,
    hand_id: str = "fixture",
) -> CanonicalHand:
    """SRP BTN vs BB extended to the river."""
    base = _srp_btn_vs_bb(flop_board, hand_id=hand_id)
    turn = _street(Street.TURN, pot_start=6.5, board=[turn_card])
    river = _street(Street.RIVER, pot_start=6.5, board=[river_card])
    return _hand(
        base.players, 4,
        [base.streets[0], base.streets[1], turn, river],
        effective_stack_bb=base.effective_stack_bb,
        final_pot_bb=base.final_pot_bb,
        hand_id=hand_id,
    )


def _srp_co_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """SRP: CO opens 3bb, BB calls. Hero is CO."""
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO", is_hero=True, hole_cards=["Kh", "Qh"]),
        _player(4, "BTN"),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(5, Street.PREFLOP, 4, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=4.5, pot_after=4.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=4.5, pot_after=4.5),
        _action(7, Street.PREFLOP, 6, ActionType.CALL, amount=2.0, total_bet=3.0, stack_before=99, stack_after=97, pot_before=4.5, pot_after=6.5),
    ])
    flop = _street(Street.FLOP, pot_start=6.5, board=board)
    return _hand(players, 3, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=6.5, hand_id=hand_id)


def _3bet_btn_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
    stack: float = 100.0,
) -> CanonicalHand:
    """3BET: BTN opens 3bb, BB 3-bets to 10bb, BTN calls. Pot 20.5bb."""
    players = [
        _player(1, "UTG", stack),
        _player(2, "HJ", stack),
        _player(3, "CO", stack),
        _player(4, "BTN", stack, is_hero=True, hole_cards=["Jd", "Ts"]),
        _player(5, "SB", stack),
        _player(6, "BB", stack),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=stack, stack_after=stack - 0.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=stack, stack_after=stack - 1.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.FOLD, stack_before=stack, stack_after=stack, pot_before=1.5, pot_after=1.5),
        _action(5, Street.PREFLOP, 4, ActionType.RAISE, amount=3.0, total_bet=3.0, is_hero=True, stack_before=stack, stack_after=stack - 3, pot_before=1.5, pot_after=4.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=stack - 0.5, stack_after=stack - 0.5, pot_before=4.5, pot_after=4.5),
        _action(7, Street.PREFLOP, 6, ActionType.RAISE, amount=9.0, total_bet=10.0, stack_before=stack - 1, stack_after=stack - 10, pot_before=4.5, pot_after=13.5),
        _action(8, Street.PREFLOP, 4, ActionType.CALL, amount=7.0, total_bet=10.0, is_hero=True, stack_before=stack - 3, stack_after=stack - 10, pot_before=13.5, pot_after=20.5),
    ])
    flop = _street(Street.FLOP, pot_start=20.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=stack, final_pot_bb=20.5, hand_id=hand_id)


def _short_3bet_btn_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
    stack: float = 25.0,
) -> CanonicalHand:
    """Short-stack 3BET: 25bb, BTN opens 2.5bb, BB 3-bets to 8bb, BTN calls."""
    players = [
        _player(4, "BTN", stack, is_hero=True, hole_cards=["Ah", "Kd"]),
        _player(5, "SB", stack),
        _player(6, "BB", stack),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=stack, stack_after=stack - 0.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=stack, stack_after=stack - 1, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 4, ActionType.RAISE, amount=2.5, total_bet=2.5, is_hero=True, stack_before=stack, stack_after=stack - 2.5, pot_before=1.5, pot_after=4.0),
        _action(3, Street.PREFLOP, 5, ActionType.FOLD, stack_before=stack - 0.5, stack_after=stack - 0.5, pot_before=4.0, pot_after=4.0),
        _action(4, Street.PREFLOP, 6, ActionType.RAISE, amount=7.0, total_bet=8.0, stack_before=stack - 1, stack_after=stack - 8, pot_before=4.0, pot_after=11.0),
        _action(5, Street.PREFLOP, 4, ActionType.CALL, amount=5.5, total_bet=8.0, is_hero=True, stack_before=stack - 2.5, stack_after=stack - 8, pot_before=11.0, pot_after=16.5),
    ])
    flop = _street(Street.FLOP, pot_start=16.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=stack, final_pot_bb=16.5, hand_id=hand_id)


def _4bet_btn_vs_co(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """4BET: CO opens 3bb, BTN 3-bets 9bb, CO 4-bets 29bb, BTN calls. Pot 59.5bb."""
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
    flop = _street(Street.FLOP, pot_start=59.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=59.5, hand_id=hand_id)


def _limp_sb_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """LIMPED: SB completes, BB checks. Hero is BB. Pot 2bb."""
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
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, is_hero=True, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(3, Street.PREFLOP, 2, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(4, Street.PREFLOP, 3, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(5, Street.PREFLOP, 4, ActionType.FOLD, stack_before=100, stack_after=100, pot_before=1.5, pot_after=1.5),
        _action(6, Street.PREFLOP, 5, ActionType.CALL, amount=0.5, total_bet=1.0, stack_before=99.5, stack_after=99.0, pot_before=1.5, pot_after=2.0),
        _action(7, Street.PREFLOP, 6, ActionType.CHECK, is_hero=True, stack_before=99, stack_after=99, pot_before=2.0, pot_after=2.0),
    ])
    flop = _street(Street.FLOP, pot_start=2.0, board=board)
    return _hand(players, 6, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=2.0, hand_id=hand_id)


def _squeeze_sb(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """SQUEEZE: CO opens 3bb, BTN calls, SB (hero) squeezes to 12bb, CO calls. Pot 28bb."""
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
    flop = _street(Street.FLOP, pot_start=28.0, board=board)
    return _hand(players, 5, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=28.0, hand_id=hand_id)


def _multiway_3way(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """3-way SRP: CO opens 3bb, BTN (hero) calls, BB calls. Pot 9.5bb."""
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
    flop = _street(Street.FLOP, pot_start=9.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=9.5, hand_id=hand_id)


def _multiway_4way(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """4-way SRP: UTG opens 3bb, HJ/CO/BTN (hero) all call. Pot 13.5bb."""
    players = [
        _player(1, "UTG"),
        _player(2, "HJ"),
        _player(3, "CO"),
        _player(4, "BTN", is_hero=True, hole_cards=["Th", "9h"]),
        _player(5, "SB"),
        _player(6, "BB"),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=100, stack_after=99.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=100, stack_after=99.0, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 1, ActionType.RAISE, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=1.5, pot_after=4.5),
        _action(3, Street.PREFLOP, 2, ActionType.CALL, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=4.5, pot_after=7.5),
        _action(4, Street.PREFLOP, 3, ActionType.CALL, amount=3.0, total_bet=3.0, stack_before=100, stack_after=97, pot_before=7.5, pot_after=10.5),
        _action(5, Street.PREFLOP, 4, ActionType.CALL, amount=3.0, total_bet=3.0, is_hero=True, stack_before=100, stack_after=97, pot_before=10.5, pot_after=13.5),
        _action(6, Street.PREFLOP, 5, ActionType.FOLD, stack_before=99.5, stack_after=99.5, pot_before=13.5, pot_after=13.5),
        _action(7, Street.PREFLOP, 6, ActionType.FOLD, stack_before=99, stack_after=99, pot_before=13.5, pot_after=13.5),
    ])
    flop = _street(Street.FLOP, pot_start=13.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=13.5, hand_id=hand_id)


def _deep_srp_btn_vs_bb(
    board: list[str],
    hand_id: str = "fixture",
    stack: float = 200.0,
) -> CanonicalHand:
    """Deep SRP: 200bb stacks, BTN opens 3bb, BB calls."""
    return _srp_btn_vs_bb(board, hand_id=hand_id, stack=stack)


def _tournament_jam(
    board: list[str],
    hand_id: str = "fixture",
    stack: float = 15.0,
) -> CanonicalHand:
    """Tournament jam: BTN shoves 15bb, BB calls. is_tournament=True."""
    players = [
        _player(4, "BTN", stack, is_hero=True, hole_cards=["Ah", "Kd"]),
        _player(5, "SB", stack),
        _player(6, "BB", stack),
    ]
    preflop = _street(Street.PREFLOP, pot_start=0.0, actions=[
        _action(0, Street.PREFLOP, 5, ActionType.POST_SB, amount=0.5, stack_before=stack, stack_after=stack - 0.5, pot_before=0, pot_after=0.5),
        _action(1, Street.PREFLOP, 6, ActionType.POST_BB, amount=1.0, stack_before=stack, stack_after=stack - 1, pot_before=0.5, pot_after=1.5),
        _action(2, Street.PREFLOP, 4, ActionType.RAISE, amount=stack, total_bet=stack, is_hero=True, is_all_in=True, stack_before=stack, stack_after=0, pot_before=1.5, pot_after=1.5 + stack),
        _action(3, Street.PREFLOP, 5, ActionType.FOLD, stack_before=stack - 0.5, stack_after=stack - 0.5, pot_before=1.5 + stack, pot_after=1.5 + stack),
        _action(4, Street.PREFLOP, 6, ActionType.CALL, amount=stack - 1, total_bet=stack, is_all_in=True, stack_before=stack - 1, stack_after=0, pot_before=1.5 + stack, pot_after=0.5 + stack * 2),
    ])
    pot = 0.5 + stack * 2
    flop = _street(Street.FLOP, pot_start=pot, board=board)
    return _hand(
        players, 4, [preflop, flop],
        effective_stack_bb=stack, final_pot_bb=pot,
        hand_id=hand_id, is_tournament=True,
    )


def _iso_raise_btn(
    board: list[str],
    hand_id: str = "fixture",
) -> CanonicalHand:
    """ISO_RAISE: UTG limps, CO limps, BTN (hero) raises 8bb. UTG calls. Pot 18.5bb."""
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
    flop = _street(Street.FLOP, pot_start=18.5, board=board)
    return _hand(players, 4, [preflop, flop], effective_stack_bb=100.0, final_pot_bb=18.5, hand_id=hand_id)


# ═══════════════════════════════════════════════════════════════════════════════
# FIXTURE SPEC
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class FixtureSpec:
    """Expected abstraction output for one test hand."""
    id: str
    description: str
    hand_fn: Callable[[], CanonicalHand]
    # Spot-level
    spot_type: SpotType
    position_matchup: PositionMatchup
    player_count: int
    # Money
    pot_bb: float
    spr_bucket: SPRBucket
    stack_bucket: StackDepthBucket
    # Board
    board_class: BoardClassEnum
    street: SolverStreet
    # Texture (only for postflop)
    dynamic: bool
    connectedness: str
    flush_draw: bool
    flush_completed: bool
    straight_draw: bool
    straight_completed: bool
    # Snapshot
    node_key: str


# ── Fixture definitions ──────────────────────────────────────────────────────

FIXTURES: list[FixtureSpec] = [
    # ── 1–14: Board classification (flop) ──────────────────────────────────

    FixtureSpec(
        id="01_a_high_dry",
        description="BTN vs BB SRP — Ah Kd 3c (A-high dry, rainbow, disconnected)",
        hand_fn=lambda: _srp_btn_vs_bb(["Ah", "Kd", "3c"], hand_id="fix_01"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="02_low_dynamic",
        description="BTN vs BB SRP — 9h 8h 7c (low dynamic, two-tone, extremely connected)",
        hand_fn=lambda: _srp_btn_vs_bb(["9h", "8h", "7c"], hand_id="fix_02"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.LOW_DYNAMIC,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="extremely_connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p",
    ),

    FixtureSpec(
        id="03_monotone",
        description="CO vs BB SRP — Kh 8h 3h (monotone, flush completed on flop)",
        hand_fn=lambda: _srp_co_vs_bb(["Kh", "8h", "3h"], hand_id="fix_03"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.CO_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.MONOTONE,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=True,
        flush_completed=True,
        straight_draw=False,
        straight_completed=False,
        node_key="SRP::CO_vs_BB::100bb::8_PLUS::MONOTONE::flop::2p",
    ),

    FixtureSpec(
        id="04_paired_high",
        description="BTN vs BB SRP — Qh Qd 5c (paired high board)",
        hand_fn=lambda: _srp_btn_vs_bb(["Qh", "Qd", "5c"], hand_id="fix_04"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.PAIRED_HIGH,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="semi_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=False,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_HIGH::flop::2p",
    ),

    FixtureSpec(
        id="05_triple_broadway",
        description="BTN vs BB SRP — Qs Jh Tc (triple broadway, extremely connected)",
        hand_fn=lambda: _srp_btn_vs_bb(["Qs", "Jh", "Tc"], hand_id="fix_05"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.TRIPLE_BROADWAY,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="extremely_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::TRIPLE_BROADWAY::flop::2p",
    ),

    FixtureSpec(
        id="06_a_high_wet",
        description="BTN vs BB SRP — Ah 9h 8c (A-high wet, flush draw + straight draw)",
        hand_fn=lambda: _srp_btn_vs_bb(["Ah", "9h", "8c"], hand_id="fix_06"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.A_HIGH_WET,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_WET::flop::2p",
    ),

    FixtureSpec(
        id="07_k_high_dry",
        description="BTN vs BB SRP — Kd 7s 2c (K-high dry, rainbow, disconnected)",
        hand_fn=lambda: _srp_btn_vs_bb(["Kd", "7s", "2c"], hand_id="fix_07"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.K_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=False,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="08_k_high_wet",
        description="BTN vs BB SRP — Kh 9h 7c (K-high wet, flush draw present)",
        hand_fn=lambda: _srp_btn_vs_bb(["Kh", "9h", "7c"], hand_id="fix_08"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.K_HIGH_WET,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::K_HIGH_WET::flop::2p",
    ),

    FixtureSpec(
        id="09_low_connected",
        description="BTN vs BB SRP — 7d 4s 2c (low connected, static, rainbow)",
        hand_fn=lambda: _srp_btn_vs_bb(["7d", "4s", "2c"], hand_id="fix_09"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.LOW_CONNECTED,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::LOW_CONNECTED::flop::2p",
    ),

    FixtureSpec(
        id="10_middle_connected",
        description="BTN vs BB SRP — Ts 7d 5c (middle connected, rainbow)",
        hand_fn=lambda: _srp_btn_vs_bb(["Ts", "7d", "5c"], hand_id="fix_10"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.MIDDLE_CONNECTED,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::MIDDLE_CONNECTED::flop::2p",
    ),

    FixtureSpec(
        id="11_rainbow_static",
        description="BTN vs BB SRP — Td 6s 2c (rainbow static, semi-connected)",
        hand_fn=lambda: _srp_btn_vs_bb(["Td", "6s", "2c"], hand_id="fix_11"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.RAINBOW_STATIC,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="semi_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::RAINBOW_STATIC::flop::2p",
    ),

    FixtureSpec(
        id="12_rainbow_dynamic",
        description="BTN vs BB SRP — Th 4h 2c (rainbow dynamic, flush+straight draws)",
        hand_fn=lambda: _srp_btn_vs_bb(["Th", "4h", "2c"], hand_id="fix_12"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.RAINBOW_DYNAMIC,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="semi_connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::RAINBOW_DYNAMIC::flop::2p",
    ),

    FixtureSpec(
        id="13_double_broadway",
        description="BTN vs BB SRP — Kd Qs 4c (double broadway, K-Q no ace)",
        hand_fn=lambda: _srp_btn_vs_bb(["Kd", "Qs", "4c"], hand_id="fix_13"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.DOUBLE_BROADWAY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="weakly_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::DOUBLE_BROADWAY::flop::2p",
    ),

    FixtureSpec(
        id="14_paired_low",
        description="BTN vs BB SRP — 5h 5d 9c (paired low board)",
        hand_fn=lambda: _srp_btn_vs_bb(["5h", "5d", "9c"], hand_id="fix_14"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.PAIRED_LOW,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="highly_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_LOW::flop::2p",
    ),

    # ── 15–20: Turn / river evolution ─────────────────────────────────────

    FixtureSpec(
        id="15_flush_completing_turn",
        description="BTN vs BB SRP turn — Kh 8h 3c + 5h (flush completing)",
        hand_fn=lambda: _srp_btn_vs_bb_turn(["Kh", "8h", "3c"], "5h", hand_id="fix_15"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.FLUSH_COMPLETING,
        street=SolverStreet.TURN,
        dynamic=True,
        connectedness="disconnected",
        flush_draw=True,
        flush_completed=True,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::FLUSH_COMPLETING::turn::2p",
    ),

    FixtureSpec(
        id="16_straight_completing_turn",
        description="BTN vs BB SRP turn — 9h 8d 5c + 7s (straight completing)",
        hand_fn=lambda: _srp_btn_vs_bb_turn(["9h", "8d", "5c"], "7s", hand_id="fix_16"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.STRAIGHT_COMPLETING,
        street=SolverStreet.TURN,
        dynamic=True,
        connectedness="highly_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=True,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::STRAIGHT_COMPLETING::turn::2p",
    ),

    FixtureSpec(
        id="17_paired_turn",
        description="BTN vs BB SRP turn — Ah Kd 3c + 3s (turn pairs the board)",
        hand_fn=lambda: _srp_btn_vs_bb_turn(["Ah", "Kd", "3c"], "3s", hand_id="fix_17"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.PAIRED_LOW,
        street=SolverStreet.TURN,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_LOW::turn::2p",
    ),

    FixtureSpec(
        id="18_paired_river",
        description="BTN vs BB SRP river — Ah Kd 3c + 7s + 7d (river pairs the board)",
        hand_fn=lambda: _srp_btn_vs_bb_river(["Ah", "Kd", "3c"], "7s", "7d", hand_id="fix_18"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.PAIRED_LOW,
        street=SolverStreet.RIVER,
        dynamic=True,
        connectedness="disconnected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_LOW::river::2p",
    ),

    FixtureSpec(
        id="19_four_flush_river",
        description="BTN vs BB SRP river — Kh 8h 3c + 5h + 2h (4-flush river)",
        hand_fn=lambda: _srp_btn_vs_bb_river(["Kh", "8h", "3c"], "5h", "2h", hand_id="fix_19"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.FLUSH_COMPLETING,
        street=SolverStreet.RIVER,
        dynamic=True,
        connectedness="disconnected",
        flush_draw=True,
        flush_completed=True,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::FLUSH_COMPLETING::river::2p",
    ),

    FixtureSpec(
        id="20_four_straight_river",
        description="BTN vs BB SRP river — Th 8d 3c + 6s + 7c (4-straight river)",
        hand_fn=lambda: _srp_btn_vs_bb_river(["Th", "8d", "3c"], "6s", "7c", hand_id="fix_20"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.STRAIGHT_COMPLETING,
        street=SolverStreet.RIVER,
        dynamic=True,
        connectedness="semi_connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=True,
        node_key="SRP::BTN_vs_BB::100bb::8_PLUS::STRAIGHT_COMPLETING::river::2p",
    ),

    # ── 21–26: Pot construction and multiway ──────────────────────────────

    FixtureSpec(
        id="21_3bet_btn_vs_bb",
        description="3BET BTN vs BB — Jd 9c 4h (rainbow static in 3bet pot)",
        hand_fn=lambda: _3bet_btn_vs_bb(["Jd", "9c", "4h"], hand_id="fix_21"),
        spot_type=SpotType.THREE_BET,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=20.5,
        spr_bucket=SPRBucket.SPR_4_8,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.RAINBOW_STATIC,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="semi_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="3BET::BTN_vs_BB::100bb::4_8::RAINBOW_STATIC::flop::2p",
    ),

    FixtureSpec(
        id="22_limp_sb_vs_bb",
        description="LIMPED SB vs BB — 9c 5d 2h (low connected, limp pot)",
        hand_fn=lambda: _limp_sb_vs_bb(["9c", "5d", "2h"], hand_id="fix_22"),
        spot_type=SpotType.LIMPED,
        position_matchup=PositionMatchup.BB_vs_SB,
        player_count=2,
        pot_bb=2.0,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.LOW_CONNECTED,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="semi_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="LIMPED::BB_vs_SB::100bb::8_PLUS::LOW_CONNECTED::flop::2p",
    ),

    FixtureSpec(
        id="23_squeeze",
        description="SQUEEZE SB — Ah Kd 3c (A-high dry in squeezed pot)",
        hand_fn=lambda: _squeeze_sb(["Ah", "Kd", "3c"], hand_id="fix_23"),
        spot_type=SpotType.SQUEEZE,
        position_matchup=PositionMatchup.CO_vs_SB,
        player_count=2,
        pot_bb=28.0,
        spr_bucket=SPRBucket.SPR_2_4,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SQUEEZE::CO_vs_SB::100bb::2_4::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="24_4bet",
        description="4BET BTN vs CO — Ah Kd 3c (A-high dry in 4bet pot, commit SPR)",
        hand_fn=lambda: _4bet_btn_vs_co(["Ah", "Kd", "3c"], hand_id="fix_24"),
        spot_type=SpotType.FOUR_BET,
        position_matchup=PositionMatchup.BTN_vs_CO,
        player_count=2,
        pot_bb=59.5,
        spr_bucket=SPRBucket.SPR_0_2,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="4BET::BTN_vs_CO::100bb::0_2::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="25_multiway_3way",
        description="3-way SRP — 7h 6h 2c (low dynamic, multiway)",
        hand_fn=lambda: _multiway_3way(["7h", "6h", "2c"], hand_id="fix_25"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.MULTIWAY_3WAY,
        player_count=3,
        pot_bb=9.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.LOW_DYNAMIC,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="connected",
        flush_draw=True,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::MULTIWAY_3WAY::100bb::8_PLUS::LOW_DYNAMIC::flop::3p",
    ),

    FixtureSpec(
        id="26_multiway_4way",
        description="4-way SRP — Qd 8s 3c (rainbow static, 4-way pot)",
        hand_fn=lambda: _multiway_4way(["Qd", "8s", "3c"], hand_id="fix_26"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.MULTIWAY_4WAY,
        player_count=4,
        pot_bb=13.5,
        spr_bucket=SPRBucket.SPR_4_8,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.RAINBOW_STATIC,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="weakly_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::MULTIWAY_4WAY::100bb::4_8::RAINBOW_STATIC::flop::4p",
    ),

    # ── 27–30: Stack depth, SPR, and special scenarios ────────────────────

    FixtureSpec(
        id="27_short_stack_spr_lt_2",
        description="Short 3BET 25bb — Ah Kd 3c (SPR < 2, commit territory)",
        hand_fn=lambda: _short_3bet_btn_vs_bb(["Ah", "Kd", "3c"], hand_id="fix_27"),
        spot_type=SpotType.THREE_BET,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=16.5,
        spr_bucket=SPRBucket.SPR_0_2,
        stack_bucket=StackDepthBucket.BB20,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="3BET::BTN_vs_BB::20bb::0_2::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="28_deep_stack_spr_gt_12",
        description="Deep SRP 200bb — Ah Kd 3c (SPR > 12, deep stacks)",
        hand_fn=lambda: _deep_srp_btn_vs_bb(["Ah", "Kd", "3c"], hand_id="fix_28"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=6.5,
        spr_bucket=SPRBucket.SPR_8_PLUS,
        stack_bucket=StackDepthBucket.BB200_PLUS,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::200bb_plus::8_PLUS::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="29_tournament_jam",
        description="Tournament jam 15bb — Ah Kd 3c (BTN shoves, BB calls)",
        hand_fn=lambda: _tournament_jam(["Ah", "Kd", "3c"], hand_id="fix_29"),
        spot_type=SpotType.SRP,
        position_matchup=PositionMatchup.BTN_vs_BB,
        player_count=2,
        pot_bb=30.5,
        spr_bucket=SPRBucket.SPR_0_2,
        stack_bucket=StackDepthBucket.BB20,
        board_class=BoardClassEnum.A_HIGH_DRY,
        street=SolverStreet.FLOP,
        dynamic=False,
        connectedness="disconnected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="SRP::BTN_vs_BB::20bb::0_2::A_HIGH_DRY::flop::2p",
    ),

    FixtureSpec(
        id="30_iso_raise",
        description="ISO_RAISE BTN — Qs Jh Tc (triple broadway, iso over limpers)",
        hand_fn=lambda: _iso_raise_btn(["Qs", "Jh", "Tc"], hand_id="fix_30"),
        spot_type=SpotType.ISO_RAISE,
        position_matchup=PositionMatchup.BTN_vs_UTG,
        player_count=2,
        pot_bb=18.5,
        spr_bucket=SPRBucket.SPR_4_8,
        stack_bucket=StackDepthBucket.BB100,
        board_class=BoardClassEnum.TRIPLE_BROADWAY,
        street=SolverStreet.FLOP,
        dynamic=True,
        connectedness="extremely_connected",
        flush_draw=False,
        flush_completed=False,
        straight_draw=True,
        straight_completed=False,
        node_key="ISO_RAISE::BTN_vs_UTG::100bb::4_8::TRIPLE_BROADWAY::flop::2p",
    ),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════════════════

clf = SolverSpotClassifier()


@pytest.mark.parametrize("spec", FIXTURES, ids=lambda s: s.id)
class TestFixtureSuite:
    """Full regression suite: validates every abstraction dimension for each fixture."""

    def test_spot_type(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.spot_type == spec.spot_type

    def test_position_matchup(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.position_matchup == spec.position_matchup

    def test_player_count(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.player_count == spec.player_count

    def test_pot_bb(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.pot_bb == pytest.approx(spec.pot_bb, abs=0.5)

    def test_spr_bucket(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.spr_bucket == spec.spr_bucket

    def test_stack_depth_bucket(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.stack_depth_bucket == spec.stack_bucket

    def test_board_class(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.board_class == spec.board_class

    def test_street(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.street == spec.street

    def test_dynamic(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.dynamic == spec.dynamic

    def test_connectedness(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.connectedness_label == spec.connectedness

    def test_flush_draw_possible(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.flush_draw_possible == spec.flush_draw

    def test_flush_completed(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.flush_completed == spec.flush_completed

    def test_straight_draw_possible(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.straight_draw_possible == spec.straight_draw

    def test_straight_completed(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        if spot.board_texture is not None:
            assert spot.board_texture.straight_completed == spec.straight_completed


@pytest.mark.parametrize("spec", FIXTURES, ids=lambda s: s.id)
class TestNodeKeySnapshot:
    """Deterministic snapshot: node_key_string must match expected value."""

    def test_node_key_matches(self, spec: FixtureSpec):
        ab = SpotAbstraction.from_canonical_hand(spec.hand_fn())
        assert ab.node_key_string == spec.node_key

    def test_determinism(self, spec: FixtureSpec):
        """Same hand always produces identical abstraction."""
        hand = spec.hand_fn()
        ab1 = SpotAbstraction.from_canonical_hand(hand)
        ab2 = SpotAbstraction.from_canonical_hand(hand)
        assert ab1.node_key_string == ab2.node_key_string
        assert ab1.node_key == ab2.node_key


@pytest.mark.parametrize("spec", FIXTURES, ids=lambda s: s.id)
class TestFixtureMetadata:
    """Metadata passthrough validation."""

    def test_hand_id_in_metadata(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert "hand_id" in spot.metadata

    def test_site_in_metadata(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.metadata["site"] == "GGPoker"

    def test_model_serializes(self, spec: FixtureSpec):
        """SolverSpot can be serialised to JSON without error."""
        spot = clf.classify(spec.hand_fn())
        d = spot.model_dump()
        assert d["spot_type"] == spec.spot_type.value


@pytest.mark.parametrize("spec", [s for s in FIXTURES if s.id == "29_tournament_jam"])
class TestTournamentFixture:
    """Tournament-specific assertions."""

    def test_is_tournament_in_metadata(self, spec: FixtureSpec):
        spot = clf.classify(spec.hand_fn())
        assert spot.metadata["is_tournament"] is True
