"""
Shared fixtures and hand builders for e2e pipeline tests.

Builds minimal CanonicalHand objects that can be fed to SpotAbstraction
without touching the HTTP layer — tests call Python functions directly.

Hand builder conventions:
  - BTN hero is always seat 1 (IP)
  - BB villain is always seat 2 (OOP)
  - Stack defaults to 100bb
  - SRP: BTN opens 2.5bb, BB calls → pot 5bb, effective stack ~97.5bb
  - 3BET: BTN opens 2.5bb, BB 3bets 8bb, BTN calls → larger pot
"""

from __future__ import annotations

from typing import Any

import pytest

from app.models.canonical import CanonicalHand


# ── Low-level card/player/action builders ─────────────────────────────────────

def card(rank: str, suit: str) -> dict[str, str]:
    return {"rank": rank, "suit": suit, "notation": f"{rank}{suit}"}


def player(
    seat: int,
    name: str,
    position: str,
    stack: float,
    *,
    is_hero: bool = False,
    cards: list[dict] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"seat_{seat}",
        "name": name,
        "seat": seat,
        "position": position,
        "stack_bb": stack,
        "hole_cards": cards or [],
        "is_hero": is_hero,
        "is_active": True,
    }


def action(
    seq: int,
    street: str,
    pid: str,
    pname: str,
    act: str,
    amount: float = 0.0,
    total_bet: float = 0.0,
    is_hero: bool = False,
    sb: float = 100.0,
    sa: float = 100.0,
    pb: float = 0.0,
    pa: float = 0.0,
) -> dict[str, Any]:
    return {
        "sequence": seq,
        "street": street,
        "player_id": pid,
        "player_name": pname,
        "action": act,
        "amount_bb": amount,
        "total_bet_bb": total_bet,
        "is_hero": is_hero,
        "is_all_in": False,
        "stack_before_bb": sb,
        "stack_after_bb": sa,
        "pot_before_bb": pb,
        "pot_after_bb": pa,
    }


# ── Hand builders ─────────────────────────────────────────────────────────────

def make_srp_hand(
    flop: list[tuple[str, str]],
    hero_position: str = "BTN",
    villain_position: str = "BB",
    hero_stack: float = 100.0,
    villain_stack: float = 100.0,
    hero_cards: list[tuple[str, str]] | None = None,
) -> CanonicalHand:
    """
    Build a minimal SRP hand (BTN opens 2.5bb, BB calls).

    Args:
        flop: list of (rank, suit) tuples, e.g. [("A","h"),("K","c"),("7","d")]
        hero_position: hero's seat position label (default "BTN")
        villain_position: villain's seat label (default "BB")
        hero_stack: starting stack in BB
        hero_cards: optional hero hole cards as (rank, suit) pairs
    """
    h_cards = [card(r, s) for r, s in (hero_cards or [("A", "s"), ("K", "d")])]
    players = [
        player(1, "Hero", hero_position, hero_stack, is_hero=True, cards=h_cards),
        player(2, "Villain", villain_position, villain_stack),
    ]
    preflop_actions = [
        action(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5,
               is_hero=True, sb=hero_stack, sa=hero_stack - 2.5, pb=1.5, pa=5.5),
        action(2, "preflop", "seat_2", "Villain", "call", 1.5, 2.5,
               sb=villain_stack, sa=villain_stack - 2.5, pb=5.5, pa=6.5),
    ]
    flop_cards = [card(r, s) for r, s in flop]
    data = {
        "hand_id": f"e2e_srp_{''.join(r+s for r,s in flop)}",
        "site": "GGPoker",
        "game_type": "NLHE",
        "stakes": {"big_blind": 1.0, "display": "0.5/1"},
        "players": players,
        "hero_id": "seat_1",
        "streets": [
            {"name": "preflop", "board_cards": [], "actions": preflop_actions},
            {"name": "flop", "board_cards": flop_cards, "actions": []},
        ],
        "effective_stack_bb": hero_stack - 2.5,
        "final_pot_bb": 6.5,
    }
    return CanonicalHand(**data)


def make_3bet_hand(
    flop: list[tuple[str, str]],
    hero_position: str = "BTN",
    hero_stack: float = 100.0,
) -> CanonicalHand:
    """
    Build a minimal 3BET hand (BTN opens 2.5bb, BB 3bets 8bb, BTN calls).
    Hero is BTN (IP).
    """
    h_cards = [card("A", "s"), card("K", "d")]
    players = [
        player(1, "Hero", hero_position, hero_stack, is_hero=True, cards=h_cards),
        player(2, "Villain", "BB", hero_stack),
    ]
    preflop_actions = [
        action(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5,
               is_hero=True, sb=100.0, sa=97.5, pb=1.5, pa=5.5),
        action(2, "preflop", "seat_2", "Villain", "raise", 5.5, 8.0,
               sb=100.0, sa=92.0, pb=5.5, pa=16.5),
        action(3, "preflop", "seat_1", "Hero", "call", 5.5, 8.0,
               is_hero=True, sb=97.5, sa=92.0, pb=16.5, pa=16.5),
    ]
    flop_cards = [card(r, s) for r, s in flop]
    data = {
        "hand_id": f"e2e_3bet_{''.join(r+s for r,s in flop)}",
        "site": "GGPoker",
        "game_type": "NLHE",
        "stakes": {"big_blind": 1.0, "display": "0.5/1"},
        "players": players,
        "hero_id": "seat_1",
        "streets": [
            {"name": "preflop", "board_cards": [], "actions": preflop_actions},
            {"name": "flop", "board_cards": flop_cards, "actions": []},
        ],
        "effective_stack_bb": 92.0,
        "final_pot_bb": 16.5,
    }
    return CanonicalHand(**data)


def make_low_spr_hand(
    flop: list[tuple[str, str]],
    effective_stack: float = 8.0,
) -> CanonicalHand:
    """
    Build a hand with very low SPR (short stack → commit territory).
    """
    h_cards = [card("A", "s"), card("K", "d")]
    players = [
        player(1, "Hero", "BTN", 10.0, is_hero=True, cards=h_cards),
        player(2, "Villain", "BB", 10.0),
    ]
    preflop_actions = [
        action(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5,
               is_hero=True, sb=10.0, sa=7.5, pb=1.5, pa=5.5),
        action(2, "preflop", "seat_2", "Villain", "call", 1.5, 2.5,
               sb=10.0, sa=7.5, pb=5.5, pa=6.5),
    ]
    flop_cards = [card(r, s) for r, s in flop]
    data = {
        "hand_id": f"e2e_lowspr_{''.join(r+s for r,s in flop)}",
        "site": "GGPoker",
        "game_type": "NLHE",
        "stakes": {"big_blind": 1.0, "display": "0.5/1"},
        "players": players,
        "hero_id": "seat_1",
        "streets": [
            {"name": "preflop", "board_cards": [], "actions": preflop_actions},
            {"name": "flop", "board_cards": flop_cards, "actions": []},
        ],
        "effective_stack_bb": effective_stack,
        "final_pot_bb": 6.5,
    }
    return CanonicalHand(**data)


# ── Pytest fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def srp_ace_high_dry() -> CanonicalHand:
    """SRP BTN vs BB, Ah Kc 7d — classic A-high dry board."""
    return make_srp_hand([("A", "h"), ("K", "c"), ("7", "d")])


@pytest.fixture
def srp_low_connected() -> CanonicalHand:
    """SRP BTN vs BB, 9h 8c 7d — low connected, dynamic."""
    return make_srp_hand([("9", "h"), ("8", "c"), ("7", "d")])


@pytest.fixture
def srp_monotone() -> CanonicalHand:
    """SRP BTN vs BB, Ah 8h 2h — monotone board."""
    return make_srp_hand([("A", "h"), ("8", "h"), ("2", "h")])


@pytest.fixture
def srp_broadway() -> CanonicalHand:
    """SRP BTN vs BB, Qh Jh Ts — double/triple broadway."""
    return make_srp_hand([("Q", "h"), ("J", "h"), ("T", "s")])


@pytest.fixture
def srp_paired() -> CanonicalHand:
    """SRP BTN vs BB, Kh Kc 7d — paired high board."""
    return make_srp_hand([("K", "h"), ("K", "c"), ("7", "d")])


@pytest.fixture
def three_bet_ace_high() -> CanonicalHand:
    """3BET BTN vs BB, Ah Kc 7d."""
    return make_3bet_hand([("A", "h"), ("K", "c"), ("7", "d")])


@pytest.fixture
def low_spr_hand() -> CanonicalHand:
    """SRP low SPR (~1.2), Ah Kc 7d."""
    return make_low_spr_hand([("A", "h"), ("K", "c"), ("7", "d")], effective_stack=8.0)
