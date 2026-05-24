"""
Swagger / OpenAPI example payloads for POST /api/debug/spot.

Each example is a FULLY STANDALONE dict — no deep-merge, no dict-spread.
FastAPI's openapi_extra deep-merges dicts, which concatenates lists
(players, streets, actions) instead of replacing them.  Body(openapi_examples=...)
is the correct mechanism and does not suffer from this bug.

20 examples covering all major abstraction categories:
  01–05  Core board classifications (A-high dry, low dynamic, monotone, paired, broadway)
  06–11  Turn / river evolution events (flush/straight completing, paired turn/river)
  12–14  Pot construction types (3bet, limp, squeeze)
  15–16  Multiway pots (3-way, 4-way)
  17–18  Stack depth extremes (short SPR<2, deep SPR>12)
  19     Tournament jam
  20     ISO raise
"""

from __future__ import annotations

from typing import Any


# ═══════════════════════════════════════════════════════════════════════════════
# BUILDER HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _card(rank: str, suit: str) -> dict[str, str]:
    return {"rank": rank, "suit": suit, "notation": f"{rank}{suit}"}


def _player(
    seat: int,
    name: str,
    position: str,
    stack: float,
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


def _act(
    seq: int,
    street: str,
    pid: str,
    pname: str,
    action: str,
    amount: float = 0.0,
    total_bet: float = 0.0,
    is_hero: bool = False,
    is_all_in: bool = False,
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
        "action": action,
        "amount_bb": amount,
        "total_bet_bb": total_bet,
        "is_hero": is_hero,
        "is_all_in": is_all_in,
        "stack_before_bb": sb,
        "stack_after_bb": sa,
        "pot_before_bb": pb,
        "pot_after_bb": pa,
    }


def _stakes() -> dict[str, Any]:
    return {
        "small_blind_bb": 0.5,
        "big_blind": 1.0,
        "ante_bb": 0.0,
        "straddle_bb": 0.0,
        "currency": "USD",
        "display": "$0.50/$1.00",
    }


def _example(
    hand_id: str,
    players: list[dict],
    hero_id: str,
    streets: list[dict],
    effective_stack: float,
    final_pot: float,
    is_tournament: bool = False,
) -> dict[str, Any]:
    return {
        "hand_id": hand_id,
        "site": "GGPoker",
        "game_type": "NLHE",
        "is_tournament": is_tournament,
        "schema_version": "1.0",
        "stakes": _stakes(),
        "table_name": "Debug Table",
        "table_max_seats": 6,
        "players": players,
        "hero_id": hero_id,
        "streets": streets,
        "effective_stack_bb": effective_stack,
        "final_pot_bb": final_pot,
        "parse_source": "manual",
    }


# ── Shared preflop templates ─────────────────────────────────────────────────


def _srp_btn_bb_preflop(stack: float = 100.0) -> list[dict]:
    """BTN opens 2.5bb, BB calls. Returns preflop actions list."""
    return [
        _act(0, "preflop", "seat_2", "Villain", "post_bb", 1.0, 1.0, sb=stack, sa=stack - 1, pb=0, pa=1.0),
        _act(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5, is_hero=True, sb=stack, sa=stack - 2.5, pb=1.0, pa=3.5),
        _act(2, "preflop", "seat_2", "Villain", "call", 1.5, 2.5, sb=stack - 1, sa=stack - 2.5, pb=3.5, pa=5.0),
    ]


def _flop_street(board_cards: list[dict], pot_start: float) -> dict:
    return {
        "name": "flop",
        "board_cards": board_cards,
        "pot_start_bb": pot_start,
        "actions": [
            _act(3, "flop", "seat_2", "Villain", "check", sb=97.5, sa=97.5, pb=pot_start, pa=pot_start),
            _act(4, "flop", "seat_1", "Hero", "bet", 3.5, 3.5, is_hero=True, sb=97.5, sa=94.0, pb=pot_start, pa=pot_start + 3.5),
        ],
    }


def _srp_btn_bb(
    hand_id: str,
    board_cards: list[dict],
    hero_cards: list[dict],
    stack: float = 100.0,
    turn_card: dict | None = None,
    river_card: dict | None = None,
    is_tournament: bool = False,
) -> dict[str, Any]:
    """Generate a complete BTN vs BB SRP example."""
    players = [
        _player(1, "Hero", "BTN", stack, is_hero=True, cards=hero_cards),
        _player(2, "Villain", "BB", stack),
    ]
    pot = 5.0
    streets = [
        {"name": "preflop", "board_cards": [], "pot_start_bb": 0.0, "actions": _srp_btn_bb_preflop(stack)},
        _flop_street(board_cards, pot),
    ]
    if turn_card:
        streets.append({
            "name": "turn", "board_cards": [turn_card], "pot_start_bb": pot,
            "actions": [_act(5, "turn", "seat_2", "Villain", "check", sb=97.5, sa=97.5, pb=pot, pa=pot)],
        })
    if river_card:
        streets.append({
            "name": "river", "board_cards": [river_card], "pot_start_bb": pot,
            "actions": [_act(6, "river", "seat_2", "Villain", "check", sb=97.5, sa=97.5, pb=pot, pa=pot)],
        })
    return _example(hand_id, players, "seat_1", streets, stack if stack == 100 else stack, pot + 3.5, is_tournament)


# ═══════════════════════════════════════════════════════════════════════════════
# 20 SWAGGER EXAMPLES
# ═══════════════════════════════════════════════════════════════════════════════


# ── 01: A-high dry ───────────────────────────────────────────────────────────

EXAMPLE_01_A_HIGH_DRY = _srp_btn_bb(
    "fixture-01-a-high-dry",
    [_card("A", "h"), _card("K", "d"), _card("3", "c")],
    [_card("A", "s"), _card("K", "s")],
)

# ── 02: Low dynamic ─────────────────────────────────────────────────────────

EXAMPLE_02_LOW_DYNAMIC = _srp_btn_bb(
    "fixture-02-low-dynamic",
    [_card("9", "h"), _card("8", "h"), _card("7", "c")],
    [_card("9", "s"), _card("8", "s")],
)

# ── 03: Monotone ─────────────────────────────────────────────────────────────

EXAMPLE_03_MONOTONE: dict[str, Any] = {
    "hand_id": "fixture-03-monotone",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Hero", "CO", 100.0, is_hero=True, cards=[_card("K", "h"), _card("Q", "h")]),
        _player(2, "Villain", "BB", 100.0),
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_2", "Villain", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0, pa=1),
                _act(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5, is_hero=True, sb=100, sa=97.5, pb=1, pa=3.5),
                _act(2, "preflop", "seat_2", "Villain", "call", 1.5, 2.5, sb=99, sa=97.5, pb=3.5, pa=5),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("K", "h"), _card("8", "h"), _card("3", "h")],
            "pot_start_bb": 5.0,
            "actions": [
                _act(3, "flop", "seat_2", "Villain", "check", sb=97.5, sa=97.5, pb=5, pa=5),
                _act(4, "flop", "seat_1", "Hero", "bet", 3.5, 3.5, is_hero=True, sb=97.5, sa=94, pb=5, pa=8.5),
            ],
        },
    ],
    "effective_stack_bb": 97.5,
    "final_pot_bb": 8.5,
    "parse_source": "manual",
}

# ── 04: Paired high ──────────────────────────────────────────────────────────

EXAMPLE_04_PAIRED_HIGH = _srp_btn_bb(
    "fixture-04-paired-high",
    [_card("Q", "h"), _card("Q", "d"), _card("5", "c")],
    [_card("A", "s"), _card("K", "s")],
)

# ── 05: Triple broadway ──────────────────────────────────────────────────────

EXAMPLE_05_TRIPLE_BROADWAY = _srp_btn_bb(
    "fixture-05-triple-broadway",
    [_card("Q", "s"), _card("J", "h"), _card("T", "c")],
    [_card("A", "h"), _card("K", "d")],
)

# ── 06: Flush-completing turn ─────────────────────────────────────────────────

EXAMPLE_06_FLUSH_COMPLETING_TURN = _srp_btn_bb(
    "fixture-06-flush-completing-turn",
    [_card("K", "h"), _card("8", "h"), _card("3", "c")],
    [_card("A", "h"), _card("K", "d")],
    turn_card=_card("5", "h"),
)

# ── 07: Straight-completing turn ─────────────────────────────────────────────

EXAMPLE_07_STRAIGHT_COMPLETING_TURN = _srp_btn_bb(
    "fixture-07-straight-completing-turn",
    [_card("9", "h"), _card("8", "d"), _card("5", "c")],
    [_card("T", "s"), _card("6", "s")],
    turn_card=_card("7", "s"),
)

# ── 08: Paired turn ──────────────────────────────────────────────────────────

EXAMPLE_08_PAIRED_TURN = _srp_btn_bb(
    "fixture-08-paired-turn",
    [_card("A", "h"), _card("K", "d"), _card("3", "c")],
    [_card("A", "s"), _card("Q", "s")],
    turn_card=_card("3", "s"),
)

# ── 09: Paired river ─────────────────────────────────────────────────────────

EXAMPLE_09_PAIRED_RIVER = _srp_btn_bb(
    "fixture-09-paired-river",
    [_card("A", "h"), _card("K", "d"), _card("3", "c")],
    [_card("A", "s"), _card("Q", "s")],
    turn_card=_card("7", "s"),
    river_card=_card("7", "d"),
)

# ── 10: Four-flush river ─────────────────────────────────────────────────────

EXAMPLE_10_FOUR_FLUSH_RIVER = _srp_btn_bb(
    "fixture-10-four-flush-river",
    [_card("K", "h"), _card("8", "h"), _card("3", "c")],
    [_card("A", "h"), _card("K", "d")],
    turn_card=_card("5", "h"),
    river_card=_card("2", "h"),
)

# ── 11: Four-straight river ──────────────────────────────────────────────────

EXAMPLE_11_FOUR_STRAIGHT_RIVER = _srp_btn_bb(
    "fixture-11-four-straight-river",
    [_card("T", "h"), _card("8", "d"), _card("3", "c")],
    [_card("9", "s"), _card("7", "s")],
    turn_card=_card("6", "s"),
    river_card=_card("7", "c"),
)

# ── 12: 3bet BTN vs BB ───────────────────────────────────────────────────────

EXAMPLE_12_3BET_BTN_VS_BB: dict[str, Any] = {
    "hand_id": "fixture-12-3bet-btn-vs-bb",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Hero", "BTN", 100.0, is_hero=True, cards=[_card("J", "d"), _card("T", "s")]),
        _player(2, "Villain", "BB", 100.0),
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_2", "Villain", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0, pa=1),
                _act(1, "preflop", "seat_1", "Hero", "raise", 3.0, 3.0, is_hero=True, sb=100, sa=97, pb=1, pa=4),
                _act(2, "preflop", "seat_2", "Villain", "raise", 9.0, 10.0, sb=99, sa=90, pb=4, pa=13),
                _act(3, "preflop", "seat_1", "Hero", "call", 7.0, 10.0, is_hero=True, sb=97, sa=90, pb=13, pa=20),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("J", "d"), _card("9", "c"), _card("4", "h")],
            "pot_start_bb": 20.0,
            "actions": [
                _act(4, "flop", "seat_2", "Villain", "check", sb=90, sa=90, pb=20, pa=20),
                _act(5, "flop", "seat_1", "Hero", "bet", 10.0, 10.0, is_hero=True, sb=90, sa=80, pb=20, pa=30),
            ],
        },
    ],
    "effective_stack_bb": 90.0,
    "final_pot_bb": 30.0,
    "parse_source": "manual",
}

# ── 13: SB vs BB limp ────────────────────────────────────────────────────────

EXAMPLE_13_LIMP_SB_VS_BB: dict[str, Any] = {
    "hand_id": "fixture-13-limp-sb-vs-bb",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Villain", "SB", 100.0),
        _player(2, "Hero", "BB", 100.0, is_hero=True, cards=[_card("Q", "s"), _card("J", "d")]),
    ],
    "hero_id": "seat_2",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_1", "Villain", "post_sb", 0.5, 0.5, sb=100, sa=99.5, pb=0, pa=0.5),
                _act(1, "preflop", "seat_2", "Hero", "post_bb", 1.0, 1.0, is_hero=True, sb=100, sa=99, pb=0.5, pa=1.5),
                _act(2, "preflop", "seat_1", "Villain", "call", 0.5, 1.0, sb=99.5, sa=99, pb=1.5, pa=2),
                _act(3, "preflop", "seat_2", "Hero", "check", is_hero=True, sb=99, sa=99, pb=2, pa=2),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("9", "c"), _card("5", "d"), _card("2", "h")],
            "pot_start_bb": 2.0,
            "actions": [
                _act(4, "flop", "seat_1", "Villain", "check", sb=99, sa=99, pb=2, pa=2),
                _act(5, "flop", "seat_2", "Hero", "bet", 1.5, 1.5, is_hero=True, sb=99, sa=97.5, pb=2, pa=3.5),
            ],
        },
    ],
    "effective_stack_bb": 99.0,
    "final_pot_bb": 3.5,
    "parse_source": "manual",
}

# ── 14: Squeeze ──────────────────────────────────────────────────────────────

EXAMPLE_14_SQUEEZE: dict[str, Any] = {
    "hand_id": "fixture-14-squeeze",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Villain", "CO", 100.0),
        _player(2, "P2", "BTN", 100.0),
        _player(3, "Hero", "SB", 100.0, is_hero=True, cards=[_card("A", "h"), _card("Q", "h")]),
        _player(4, "P4", "BB", 100.0),
    ],
    "hero_id": "seat_3",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_3", "Hero", "post_sb", 0.5, 0.5, is_hero=True, sb=100, sa=99.5, pb=0, pa=0.5),
                _act(1, "preflop", "seat_4", "P4", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0.5, pa=1.5),
                _act(2, "preflop", "seat_1", "Villain", "raise", 3.0, 3.0, sb=100, sa=97, pb=1.5, pa=4.5),
                _act(3, "preflop", "seat_2", "P2", "call", 3.0, 3.0, sb=100, sa=97, pb=4.5, pa=7.5),
                _act(4, "preflop", "seat_3", "Hero", "raise", 11.5, 12.0, is_hero=True, sb=99.5, sa=88, pb=7.5, pa=19),
                _act(5, "preflop", "seat_4", "P4", "fold", sb=99, sa=99, pb=19, pa=19),
                _act(6, "preflop", "seat_1", "Villain", "call", 9.0, 12.0, sb=97, sa=88, pb=19, pa=28),
                _act(7, "preflop", "seat_2", "P2", "fold", sb=97, sa=97, pb=28, pa=28),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("A", "h"), _card("K", "d"), _card("3", "c")],
            "pot_start_bb": 28.0,
            "actions": [
                _act(8, "flop", "seat_3", "Hero", "bet", 14.0, 14.0, is_hero=True, sb=88, sa=74, pb=28, pa=42),
            ],
        },
    ],
    "effective_stack_bb": 88.0,
    "final_pot_bb": 42.0,
    "parse_source": "manual",
}

# ── 15: Multiway 3-way ───────────────────────────────────────────────────────

EXAMPLE_15_MULTIWAY_3WAY: dict[str, Any] = {
    "hand_id": "fixture-15-multiway-3way",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Villain1", "CO", 100.0),
        _player(2, "Hero", "BTN", 100.0, is_hero=True, cards=[_card("9", "h"), _card("8", "h")]),
        _player(3, "Villain2", "BB", 100.0),
    ],
    "hero_id": "seat_2",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_3", "Villain2", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0, pa=1),
                _act(1, "preflop", "seat_1", "Villain1", "raise", 3.0, 3.0, sb=100, sa=97, pb=1, pa=4),
                _act(2, "preflop", "seat_2", "Hero", "call", 3.0, 3.0, is_hero=True, sb=100, sa=97, pb=4, pa=7),
                _act(3, "preflop", "seat_3", "Villain2", "call", 2.0, 3.0, sb=99, sa=97, pb=7, pa=9),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("7", "h"), _card("6", "h"), _card("2", "c")],
            "pot_start_bb": 9.0,
            "actions": [
                _act(4, "flop", "seat_3", "Villain2", "check", sb=97, sa=97, pb=9, pa=9),
                _act(5, "flop", "seat_1", "Villain1", "check", sb=97, sa=97, pb=9, pa=9),
                _act(6, "flop", "seat_2", "Hero", "bet", 6.0, 6.0, is_hero=True, sb=97, sa=91, pb=9, pa=15),
            ],
        },
    ],
    "effective_stack_bb": 97.0,
    "final_pot_bb": 15.0,
    "parse_source": "manual",
}

# ── 16: Multiway 4-way ───────────────────────────────────────────────────────

EXAMPLE_16_MULTIWAY_4WAY: dict[str, Any] = {
    "hand_id": "fixture-16-multiway-4way",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Villain1", "UTG", 100.0),
        _player(2, "Villain2", "HJ", 100.0),
        _player(3, "Villain3", "CO", 100.0),
        _player(4, "Hero", "BTN", 100.0, is_hero=True, cards=[_card("T", "h"), _card("9", "h")]),
        _player(5, "P5", "SB", 100.0),
        _player(6, "P6", "BB", 100.0),
    ],
    "hero_id": "seat_4",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_5", "P5", "post_sb", 0.5, 0.5, sb=100, sa=99.5, pb=0, pa=0.5),
                _act(1, "preflop", "seat_6", "P6", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0.5, pa=1.5),
                _act(2, "preflop", "seat_1", "Villain1", "raise", 3.0, 3.0, sb=100, sa=97, pb=1.5, pa=4.5),
                _act(3, "preflop", "seat_2", "Villain2", "call", 3.0, 3.0, sb=100, sa=97, pb=4.5, pa=7.5),
                _act(4, "preflop", "seat_3", "Villain3", "call", 3.0, 3.0, sb=100, sa=97, pb=7.5, pa=10.5),
                _act(5, "preflop", "seat_4", "Hero", "call", 3.0, 3.0, is_hero=True, sb=100, sa=97, pb=10.5, pa=13.5),
                _act(6, "preflop", "seat_5", "P5", "fold", sb=99.5, sa=99.5, pb=13.5, pa=13.5),
                _act(7, "preflop", "seat_6", "P6", "fold", sb=99, sa=99, pb=13.5, pa=13.5),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("Q", "d"), _card("8", "s"), _card("3", "c")],
            "pot_start_bb": 13.5,
            "actions": [
                _act(8, "flop", "seat_1", "Villain1", "check", sb=97, sa=97, pb=13.5, pa=13.5),
                _act(9, "flop", "seat_2", "Villain2", "check", sb=97, sa=97, pb=13.5, pa=13.5),
                _act(10, "flop", "seat_3", "Villain3", "check", sb=97, sa=97, pb=13.5, pa=13.5),
                _act(11, "flop", "seat_4", "Hero", "check", is_hero=True, sb=97, sa=97, pb=13.5, pa=13.5),
            ],
        },
    ],
    "effective_stack_bb": 97.0,
    "final_pot_bb": 13.5,
    "parse_source": "manual",
}

# ── 17: Short stack SPR < 2 ──────────────────────────────────────────────────

EXAMPLE_17_SHORT_STACK: dict[str, Any] = {
    "hand_id": "fixture-17-short-stack-spr-lt-2",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Hero", "BTN", 25.0, is_hero=True, cards=[_card("A", "h"), _card("K", "d")]),
        _player(2, "Villain", "BB", 25.0),
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_2", "Villain", "post_bb", 1.0, 1.0, sb=25, sa=24, pb=0, pa=1),
                _act(1, "preflop", "seat_1", "Hero", "raise", 2.5, 2.5, is_hero=True, sb=25, sa=22.5, pb=1, pa=3.5),
                _act(2, "preflop", "seat_2", "Villain", "raise", 7.0, 8.0, sb=24, sa=17, pb=3.5, pa=10.5),
                _act(3, "preflop", "seat_1", "Hero", "call", 5.5, 8.0, is_hero=True, sb=22.5, sa=17, pb=10.5, pa=16),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("A", "h"), _card("K", "d"), _card("3", "c")],
            "pot_start_bb": 16.0,
            "actions": [
                _act(4, "flop", "seat_2", "Villain", "check", sb=17, sa=17, pb=16, pa=16),
                _act(5, "flop", "seat_1", "Hero", "bet", 17.0, 17.0, is_hero=True, is_all_in=True, sb=17, sa=0, pb=16, pa=33),
            ],
        },
    ],
    "effective_stack_bb": 17.0,
    "final_pot_bb": 33.0,
    "parse_source": "manual",
}

# ── 18: Deep stack SPR > 12 ──────────────────────────────────────────────────

EXAMPLE_18_DEEP_STACK = _srp_btn_bb(
    "fixture-18-deep-stack-spr-gt-12",
    [_card("A", "h"), _card("K", "d"), _card("3", "c")],
    [_card("A", "s"), _card("K", "s")],
    stack=200.0,
)

# ── 19: Tournament jam ───────────────────────────────────────────────────────

EXAMPLE_19_TOURNAMENT_JAM: dict[str, Any] = {
    "hand_id": "fixture-19-tournament-jam",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": True,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Hero", "BTN", 15.0, is_hero=True, cards=[_card("A", "h"), _card("K", "d")]),
        _player(2, "P2", "SB", 15.0),
        _player(3, "Villain", "BB", 15.0),
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_2", "P2", "post_sb", 0.5, 0.5, sb=15, sa=14.5, pb=0, pa=0.5),
                _act(1, "preflop", "seat_3", "Villain", "post_bb", 1.0, 1.0, sb=15, sa=14, pb=0.5, pa=1.5),
                _act(2, "preflop", "seat_1", "Hero", "raise", 15.0, 15.0, is_hero=True, is_all_in=True, sb=15, sa=0, pb=1.5, pa=16.5),
                _act(3, "preflop", "seat_2", "P2", "fold", sb=14.5, sa=14.5, pb=16.5, pa=16.5),
                _act(4, "preflop", "seat_3", "Villain", "call", 14.0, 15.0, is_all_in=True, sb=14, sa=0, pb=16.5, pa=30.5),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("A", "h"), _card("K", "d"), _card("3", "c")],
            "pot_start_bb": 30.5,
            "actions": [],
        },
    ],
    "effective_stack_bb": 15.0,
    "final_pot_bb": 30.5,
    "parse_source": "manual",
}

# ── 20: ISO raise ────────────────────────────────────────────────────────────

EXAMPLE_20_ISO_RAISE: dict[str, Any] = {
    "hand_id": "fixture-20-iso-raise",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": _stakes(),
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        _player(1, "Villain", "UTG", 100.0),
        _player(2, "P2", "HJ", 100.0),
        _player(3, "P3", "CO", 100.0),
        _player(4, "Hero", "BTN", 100.0, is_hero=True, cards=[_card("A", "s"), _card("K", "s")]),
        _player(5, "P5", "SB", 100.0),
        _player(6, "P6", "BB", 100.0),
    ],
    "hero_id": "seat_4",
    "streets": [
        {
            "name": "preflop", "board_cards": [], "pot_start_bb": 0.0,
            "actions": [
                _act(0, "preflop", "seat_5", "P5", "post_sb", 0.5, 0.5, sb=100, sa=99.5, pb=0, pa=0.5),
                _act(1, "preflop", "seat_6", "P6", "post_bb", 1.0, 1.0, sb=100, sa=99, pb=0.5, pa=1.5),
                _act(2, "preflop", "seat_1", "Villain", "call", 1.0, 1.0, sb=100, sa=99, pb=1.5, pa=2.5),
                _act(3, "preflop", "seat_2", "P2", "fold", sb=100, sa=100, pb=2.5, pa=2.5),
                _act(4, "preflop", "seat_3", "P3", "call", 1.0, 1.0, sb=100, sa=99, pb=2.5, pa=3.5),
                _act(5, "preflop", "seat_4", "Hero", "raise", 8.0, 8.0, is_hero=True, sb=100, sa=92, pb=3.5, pa=11.5),
                _act(6, "preflop", "seat_5", "P5", "fold", sb=99.5, sa=99.5, pb=11.5, pa=11.5),
                _act(7, "preflop", "seat_6", "P6", "fold", sb=99, sa=99, pb=11.5, pa=11.5),
                _act(8, "preflop", "seat_1", "Villain", "call", 7.0, 8.0, sb=99, sa=92, pb=11.5, pa=18.5),
                _act(9, "preflop", "seat_3", "P3", "fold", sb=99, sa=99, pb=18.5, pa=18.5),
            ],
        },
        {
            "name": "flop",
            "board_cards": [_card("Q", "s"), _card("J", "h"), _card("T", "c")],
            "pot_start_bb": 18.5,
            "actions": [
                _act(10, "flop", "seat_1", "Villain", "check", sb=92, sa=92, pb=18.5, pa=18.5),
                _act(11, "flop", "seat_4", "Hero", "bet", 12.0, 12.0, is_hero=True, sb=92, sa=80, pb=18.5, pa=30.5),
            ],
        },
    ],
    "effective_stack_bb": 92.0,
    "final_pot_bb": 30.5,
    "parse_source": "manual",
}


# ═══════════════════════════════════════════════════════════════════════════════
# OPENAPI_EXAMPLES dict — ready to pass to Body(openapi_examples=...)
# ═══════════════════════════════════════════════════════════════════════════════

SPOT_OPENAPI_EXAMPLES: dict[str, dict[str, Any]] = {
    "01_A_high_dry_flop": {
        "summary": "BTN vs BB SRP — Ah Kd 3c (A-high dry)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p",
        "value": EXAMPLE_01_A_HIGH_DRY,
    },
    "02_Low_dynamic_flop": {
        "summary": "BTN vs BB SRP — 9h 8h 7c (low dynamic)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p",
        "value": EXAMPLE_02_LOW_DYNAMIC,
    },
    "03_Monotone_flop": {
        "summary": "CO vs BB SRP — Kh 8h 3h (monotone)",
        "description": "Expected: SRP::CO_vs_BB::100bb::8_PLUS::MONOTONE::flop::2p",
        "value": EXAMPLE_03_MONOTONE,
    },
    "04_Paired_high_flop": {
        "summary": "BTN vs BB SRP — Qh Qd 5c (paired high)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_HIGH::flop::2p",
        "value": EXAMPLE_04_PAIRED_HIGH,
    },
    "05_Triple_broadway_flop": {
        "summary": "BTN vs BB SRP — Qs Jh Tc (triple broadway)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::TRIPLE_BROADWAY::flop::2p",
        "value": EXAMPLE_05_TRIPLE_BROADWAY,
    },
    "06_Flush_completing_turn": {
        "summary": "BTN vs BB SRP turn — Kh 8h 3c + 5h (flush completing)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::FLUSH_COMPLETING::turn::2p",
        "value": EXAMPLE_06_FLUSH_COMPLETING_TURN,
    },
    "07_Straight_completing_turn": {
        "summary": "BTN vs BB SRP turn — 9h 8d 5c + 7s (straight completing)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::STRAIGHT_COMPLETING::turn::2p",
        "value": EXAMPLE_07_STRAIGHT_COMPLETING_TURN,
    },
    "08_Paired_turn": {
        "summary": "BTN vs BB SRP turn — Ah Kd 3c + 3s (paired turn)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_LOW::turn::2p",
        "value": EXAMPLE_08_PAIRED_TURN,
    },
    "09_Paired_river": {
        "summary": "BTN vs BB SRP river — Ah Kd 3c + 7s + 7d (paired river)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::PAIRED_LOW::river::2p",
        "value": EXAMPLE_09_PAIRED_RIVER,
    },
    "10_Four_flush_river": {
        "summary": "BTN vs BB SRP river — Kh 8h 3c + 5h + 2h (4-flush river)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::FLUSH_COMPLETING::river::2p",
        "value": EXAMPLE_10_FOUR_FLUSH_RIVER,
    },
    "11_Four_straight_river": {
        "summary": "BTN vs BB SRP river — Th 8d 3c + 6s + 7c (4-straight river)",
        "description": "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::STRAIGHT_COMPLETING::river::2p",
        "value": EXAMPLE_11_FOUR_STRAIGHT_RIVER,
    },
    "12_3bet_BTN_vs_BB": {
        "summary": "3BET BTN vs BB — Jd 9c 4h (rainbow static in 3bet pot)",
        "description": "Expected: 3BET::BTN_vs_BB::100bb::4_8::RAINBOW_STATIC::flop::2p",
        "value": EXAMPLE_12_3BET_BTN_VS_BB,
    },
    "13_Limp_SB_vs_BB": {
        "summary": "LIMPED SB vs BB — 9c 5d 2h (low connected, limp pot)",
        "description": "Expected: LIMPED::BB_vs_SB::100bb::8_PLUS::LOW_CONNECTED::flop::2p",
        "value": EXAMPLE_13_LIMP_SB_VS_BB,
    },
    "14_Squeeze": {
        "summary": "SQUEEZE SB — Ah Kd 3c (A-high dry in squeezed pot)",
        "description": "Expected: SQUEEZE::CO_vs_SB::100bb::2_4::A_HIGH_DRY::flop::2p",
        "value": EXAMPLE_14_SQUEEZE,
    },
    "15_Multiway_3way": {
        "summary": "3-way SRP — 7h 6h 2c (low dynamic, multiway)",
        "description": "Expected: SRP::MULTIWAY_3WAY::100bb::8_PLUS::LOW_DYNAMIC::flop::3p",
        "value": EXAMPLE_15_MULTIWAY_3WAY,
    },
    "16_Multiway_4way": {
        "summary": "4-way SRP — Qd 8s 3c (rainbow static, 4-way pot)",
        "description": "Expected: SRP::MULTIWAY_4WAY::100bb::4_8::RAINBOW_STATIC::flop::4p",
        "value": EXAMPLE_16_MULTIWAY_4WAY,
    },
    "17_Short_stack_SPR_lt_2": {
        "summary": "Short 3BET 25bb — Ah Kd 3c (SPR < 2, commit territory)",
        "description": "Expected: 3BET::BTN_vs_BB::20bb::0_2::A_HIGH_DRY::flop::2p",
        "value": EXAMPLE_17_SHORT_STACK,
    },
    "18_Deep_stack_SPR_gt_12": {
        "summary": "Deep SRP 200bb — Ah Kd 3c (SPR > 12, deep stacks)",
        "description": "Expected: SRP::BTN_vs_BB::200bb_plus::8_PLUS::A_HIGH_DRY::flop::2p",
        "value": EXAMPLE_18_DEEP_STACK,
    },
    "19_Tournament_jam": {
        "summary": "Tournament jam 15bb — Ah Kd 3c (BTN shoves, BB calls)",
        "description": "Expected: SRP::BTN_vs_BB::20bb::0_2::A_HIGH_DRY::flop::2p",
        "value": EXAMPLE_19_TOURNAMENT_JAM,
    },
    "20_ISO_raise": {
        "summary": "ISO_RAISE BTN — Qs Jh Tc (triple broadway, iso over limpers)",
        "description": "Expected: ISO_RAISE::BTN_vs_UTG::100bb::4_8::TRIPLE_BROADWAY::flop::2p",
        "value": EXAMPLE_20_ISO_RAISE,
    },
}
