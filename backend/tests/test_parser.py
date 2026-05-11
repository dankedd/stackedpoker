"""Regression tests for deterministic seat mapping and position assignment."""
import pytest
from app.parsers.base import derive_positions, POSITIONS_BY_SIZE
from app.parsers.ggpoker import GGPokerParser
from app.parsers.pokerstars import PokerStarsParser


# ── derive_positions unit tests ──────────────────────────────────────────────

def test_derive_positions_full_6max():
    """All 6 seats occupied — straightforward mapping."""
    result = derive_positions([1, 2, 3, 4, 5, 6], button_seat=6, table_max_seats=6)
    assert result[6] == "BTN"
    assert result[1] == "SB"
    assert result[2] == "BB"
    assert result[3] == "UTG"
    assert result[4] == "HJ"
    assert result[5] == "CO"


def test_derive_positions_missing_seat_3():
    """6-max, seat 3 empty — positions use 5-handed names."""
    result = derive_positions([1, 2, 4, 5, 6], button_seat=5, table_max_seats=6)
    assert result[5] == "BTN"
    assert result[6] == "SB"
    assert result[1] == "BB"
    assert result[2] == "UTG"
    assert result[4] == "CO"
    assert 3 not in result


def test_derive_positions_9max_partial():
    """9-max table, only 5 players seated."""
    result = derive_positions([1, 3, 5, 7, 9], button_seat=9, table_max_seats=9)
    assert result[9] == "BTN"
    assert result[1] == "SB"
    assert result[3] == "BB"
    assert result[5] == "UTG"
    assert result[7] == "CO"


def test_derive_positions_hu():
    """Heads-up: 2 players."""
    result = derive_positions([1, 2], button_seat=1, table_max_seats=2)
    assert result[1] == "BTN"
    assert result[2] == "BB"


def test_derive_positions_btn_wraparound():
    """Button is highest seat — clockwise wraps to seat 1."""
    result = derive_positions([1, 2, 3, 4, 5, 6], button_seat=5, table_max_seats=6)
    assert result[5] == "BTN"
    assert result[6] == "SB"
    assert result[1] == "BB"
    assert result[2] == "UTG"
    assert result[3] == "HJ"
    assert result[4] == "CO"


def test_positions_by_size_matches_frontend():
    """Backend POSITIONS_BY_SIZE must mirror frontend positions.ts exactly."""
    expected = {
        2: ["BTN", "BB"],
        3: ["BTN", "SB", "BB"],
        4: ["BTN", "SB", "BB", "UTG"],
        5: ["BTN", "SB", "BB", "UTG", "CO"],
        6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
        7: ["BTN", "SB", "BB", "UTG", "LJ", "HJ", "CO"],
        8: ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"],
        9: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"],
    }
    assert POSITIONS_BY_SIZE == expected


# ── GGPoker parser integration tests ────────────────────────────────────────

GG_6MAX_HAND = """\
Poker Hand #RC1234567890: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00
Table 'TestTable' 6-max Seat #3 is the button
Seat 1: PlayerA ($50.00 in chips)
Seat 2: PlayerB ($45.00 in chips)
Seat 3: Hero ($100.00 in chips)
Seat 4: PlayerD ($80.00 in chips)
Seat 5: PlayerE ($60.00 in chips)
Seat 6: PlayerF ($55.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
PlayerD: folds
PlayerE: folds
PlayerF: folds
PlayerA: folds
PlayerB: folds
*** SUMMARY ***
"""

GG_6MAX_MISSING_SEAT = """\
Poker Hand #RC9999999999: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00
Table 'TestTable' 6-max Seat #5 is the button
Seat 1: PlayerA ($50.00 in chips)
Seat 2: PlayerB ($45.00 in chips)
Seat 4: PlayerD ($80.00 in chips)
Seat 5: Hero ($100.00 in chips)
Seat 6: PlayerF ($55.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [Ac Kc]
PlayerF: folds
PlayerA: folds
PlayerB: folds
PlayerD: folds
*** SUMMARY ***
"""

GG_HU_HAND = """\
Poker Hand #RC1111111111: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00
Table 'TestTable' 2-max Seat #1 is the button
Seat 1: Hero ($100.00 in chips)
Seat 2: Villain ($100.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [As Ks]
*** SUMMARY ***
"""


def test_gg_full_6max_positions():
    parsed = GGPokerParser().parse(GG_6MAX_HAND)
    assert parsed.table_max_seats == 6
    pos = {p.name: p.position for p in parsed.players}
    assert pos["Hero"] == "BTN"
    assert pos["PlayerD"] == "SB"
    assert pos["PlayerE"] == "BB"
    assert pos["PlayerF"] == "UTG"
    assert pos["PlayerA"] == "HJ"
    assert pos["PlayerB"] == "CO"


def test_gg_6max_missing_seat():
    """5 players on a 6-max table — positions use 5-handed names."""
    parsed = GGPokerParser().parse(GG_6MAX_MISSING_SEAT)
    assert parsed.table_max_seats == 6
    pos = {p.name: p.position for p in parsed.players}
    assert pos["Hero"] == "BTN"
    assert pos["PlayerF"] == "SB"
    assert pos["PlayerA"] == "BB"
    assert pos["PlayerB"] == "UTG"
    assert pos["PlayerD"] == "CO"


def test_gg_hu():
    parsed = GGPokerParser().parse(GG_HU_HAND)
    assert parsed.table_max_seats == 2
    pos = {p.name: p.position for p in parsed.players}
    assert pos["Hero"] == "BTN"
    assert pos["Villain"] == "BB"


# ── PokerStars parser integration tests ─────────────────────────────────────

PS_6MAX_HAND = """\
PokerStars Hand #123456789: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00 ET
Table 'Altair II' 6-max Seat #2 is the Button
Seat 1: PlayerA ($50.00 in chips)
Seat 2: Hero ($100.00 in chips)
Seat 3: PlayerC ($45.00 in chips)
Seat 4: PlayerD ($80.00 in chips)
Seat 5: PlayerE ($60.00 in chips)
Seat 6: PlayerF ($55.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [Th Tc]
PlayerC: folds
PlayerD: folds
PlayerE: folds
PlayerF: folds
PlayerA: folds
*** SUMMARY ***
"""

PS_9MAX_PARTIAL = """\
PokerStars Hand #987654321: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00 ET
Table 'Regulus A' 9-max Seat #6 is the Button
Seat 1: PlayerA ($50.00 in chips)
Seat 2: PlayerB ($45.00 in chips)
Seat 4: PlayerD ($80.00 in chips)
Seat 6: Hero ($100.00 in chips)
Seat 8: PlayerH ($60.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [Qh Qd]
PlayerH: folds
PlayerA: folds
PlayerB: folds
PlayerD: folds
*** SUMMARY ***
"""


def test_ps_full_6max_positions():
    parsed = PokerStarsParser().parse(PS_6MAX_HAND)
    assert parsed.table_max_seats == 6
    pos = {p.name: p.position for p in parsed.players}
    assert pos["Hero"] == "BTN"
    assert pos["PlayerC"] == "SB"
    assert pos["PlayerD"] == "BB"
    assert pos["PlayerE"] == "UTG"
    assert pos["PlayerF"] == "HJ"
    assert pos["PlayerA"] == "CO"


def test_ps_9max_partial():
    """9-max table, 5 players — positions use 5-handed names."""
    parsed = PokerStarsParser().parse(PS_9MAX_PARTIAL)
    assert parsed.table_max_seats == 9
    pos = {p.name: p.position for p in parsed.players}
    assert pos["Hero"] == "BTN"
    assert pos["PlayerH"] == "SB"
    assert pos["PlayerA"] == "BB"
    assert pos["PlayerB"] == "UTG"
    assert pos["PlayerD"] == "CO"
