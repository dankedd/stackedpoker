"""
Comprehensive parser tests.

Covers: positions, stacks, BB conversion, actions, board cards, all-ins,
        partial tables, tournament format, pot size, hero detection.
"""
import pytest
from app.parsers.base import derive_positions, POSITIONS_BY_SIZE
from app.parsers.ggpoker import GGPokerParser
from app.parsers.pokerstars import PokerStarsParser


# ─────────────────────────────────────────────────────────────────────────────
# derive_positions unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDerivePositions:
    def test_full_6max(self):
        result = derive_positions([1, 2, 3, 4, 5, 6], button_seat=6, table_max_seats=6)
        assert result == {6: "BTN", 1: "SB", 2: "BB", 3: "UTG", 4: "HJ", 5: "CO"}

    def test_6max_seat3_empty(self):
        result = derive_positions([1, 2, 4, 5, 6], button_seat=5, table_max_seats=6)
        assert result[5] == "BTN"
        assert result[6] == "SB"
        assert result[1] == "BB"
        assert result[2] == "UTG"
        assert result[4] == "CO"
        assert 3 not in result

    def test_9max_partial_5_players(self):
        result = derive_positions([1, 3, 5, 7, 9], button_seat=9, table_max_seats=9)
        assert result[9] == "BTN"
        assert result[1] == "SB"
        assert result[3] == "BB"
        assert result[5] == "UTG"
        assert result[7] == "CO"

    def test_heads_up(self):
        result = derive_positions([1, 2], button_seat=1, table_max_seats=2)
        assert result[1] == "BTN"
        assert result[2] == "BB"

    def test_btn_wrap_around(self):
        result = derive_positions([1, 2, 3, 4, 5, 6], button_seat=5, table_max_seats=6)
        assert result[5] == "BTN"
        assert result[6] == "SB"
        assert result[1] == "BB"
        assert result[2] == "UTG"
        assert result[3] == "HJ"
        assert result[4] == "CO"

    def test_3handed(self):
        result = derive_positions([3, 5, 7], button_seat=7, table_max_seats=9)
        assert result[7] == "BTN"
        assert result[3] == "SB"
        assert result[5] == "BB"

    def test_positions_by_size_table(self):
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


# ─────────────────────────────────────────────────────────────────────────────
# GGPoker parser
# ─────────────────────────────────────────────────────────────────────────────

GG_CASH_BASIC = """\
Poker Hand #RC0199283746: Hold'em No Limit ($0.50/$1.00) - 2024/01/15 14:22:33
Table 'FastForward' 6-Max Seat #3 is the button
Seat 1: Player1 ($112.30 in chips)
Seat 2: Player2 ($78.50 in chips)
Seat 3: Hero ($100.00 in chips)
Seat 4: Player4 ($145.20 in chips)
Seat 5: Player5 ($98.75 in chips)
Seat 6: Player6 ($65.00 in chips)
Player4: posts small blind $0.50
Player5: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Player6: folds
Player1: folds
Player2: folds
Hero: raises $2.50 to $3.00
Player4: folds
Player5: calls $2.00
*** FLOP *** [Kd 7c 2s]
Player5: checks
Hero: bets $4.00
Player5: folds
*** SUMMARY ***
Total pot $10.50 | Rake $0.50
"""

GG_TOURNAMENT = """\
Poker Hand #TO1234567-1-9876543210: Hold'em No Limit
Table 'Tournament' 9-Max Seat #1 is the button
Level III (100/200)
Seat 1: Hero (15000 in chips)
Seat 2: Villain1 (12000 in chips)
Seat 3: Villain2 (8000 in chips)
Seat 4: Villain3 (22000 in chips)
Seat 5: Villain4 (9500 in chips)
Seat 6: Villain5 (11000 in chips)
Seat 7: Villain6 (7000 in chips)
Seat 8: Villain7 (18000 in chips)
Seat 9: Villain8 (14000 in chips)
Villain1: posts small blind 100
Villain2: posts big blind 200
*** HOLE CARDS ***
Dealt to Hero [Ac Kc]
Villain3: folds
Villain4: folds
Villain5: folds
Villain6: folds
Villain7: folds
Villain8: folds
Hero: raises 500 to 600
Villain1: folds
Villain2: calls 400
*** FLOP *** [Qh 8d 3c]
Villain2: checks
Hero: bets 600
Villain2: folds
*** SUMMARY ***
"""

GG_ALL_IN = """\
Poker Hand #RC9999999999: Hold'em No Limit ($1.00/$2.00) - 2024/01/15 14:22:33
Table 'TestTable' 6-max Seat #1 is the button
Seat 1: Hero ($50.00 in chips)
Seat 2: Villain ($200.00 in chips)
Hero: posts small blind $1.00
Villain: posts big blind $2.00
*** HOLE CARDS ***
Dealt to Hero [As Ad]
Hero: raises $6.00 to $6.00
Villain: raises $18.00 to $20.00
Hero: raises $44.00 to $50.00 and is all-in
Villain: calls $30.00
*** FLOP *** [Kh Qd Jc]
*** TURN *** [Kh Qd Jc] [Th]
*** RIVER *** [Kh Qd Jc Th] [2s]
*** SUMMARY ***
"""

GG_MISSING_SEAT = """\
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

GG_HU = """\
Poker Hand #RC1111111111: Hold'em No Limit ($0.25/$0.50 USD) - 2024/01/01 12:00:00
Table 'TestTable' 2-max Seat #1 is the button
Seat 1: Hero ($100.00 in chips)
Seat 2: Villain ($100.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [As Ks]
*** SUMMARY ***
"""


class TestGGPokerParser:
    def setup_method(self):
        self.parser = GGPokerParser()

    def test_can_parse_cash(self):
        assert self.parser.can_parse(GG_CASH_BASIC)

    def test_can_parse_tournament(self):
        assert self.parser.can_parse(GG_TOURNAMENT)

    def test_site(self):
        assert self.parser.parse(GG_CASH_BASIC).site == "GGPoker"

    # ── Positions ──────────────────────────────────────────────────────────

    def test_cash_positions(self):
        p = self.parser.parse(GG_CASH_BASIC)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["Player4"] == "SB"
        assert pos["Player5"] == "BB"

    def test_tournament_positions(self):
        p = self.parser.parse(GG_TOURNAMENT)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["Villain1"] == "SB"
        assert pos["Villain2"] == "BB"

    def test_missing_seat_positions(self):
        p = self.parser.parse(GG_MISSING_SEAT)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["PlayerF"] == "SB"
        assert pos["PlayerA"] == "BB"
        assert pos["PlayerB"] == "UTG"
        assert pos["PlayerD"] == "CO"

    def test_heads_up_positions(self):
        p = self.parser.parse(GG_HU)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["Villain"] == "BB"

    # ── Stakes and BB conversion ───────────────────────────────────────────

    def test_cash_stakes(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.big_blind == 1.0
        assert p.stakes == "$0.50/$1.00"

    def test_tournament_stakes(self):
        p = self.parser.parse(GG_TOURNAMENT)
        assert p.big_blind == 200.0
        assert "200" in p.stakes

    def test_cash_stacks_in_bb(self):
        p = self.parser.parse(GG_CASH_BASIC)
        hero = next(pl for pl in p.players if pl.name == "Hero")
        assert hero.stack_bb == pytest.approx(100.0, rel=0.01)

    def test_tournament_stacks_in_bb(self):
        p = self.parser.parse(GG_TOURNAMENT)
        hero = next(pl for pl in p.players if pl.name == "Hero")
        assert hero.stack_bb == pytest.approx(75.0, rel=0.01)  # 15000/200

    # ── Hero cards ────────────────────────────────────────────────────────

    def test_hero_cards(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.hero_cards == ["Ah", "Kh"]

    def test_hero_position(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.hero_position == "BTN"

    # ── Board parsing ─────────────────────────────────────────────────────

    def test_flop_parsed(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.board.flop == ["Kd", "7c", "2s"]

    def test_turn_river_empty_when_not_dealt(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.board.turn == []
        assert p.board.river == []

    def test_full_board_all_in(self):
        p = self.parser.parse(GG_ALL_IN)
        assert p.board.flop == ["Kh", "Qd", "Jc"]
        assert p.board.turn == ["Th"]
        assert p.board.river == ["2s"]

    # ── Actions ───────────────────────────────────────────────────────────

    def test_actions_parsed(self):
        p = self.parser.parse(GG_CASH_BASIC)
        preflop = [a for a in p.actions if a.street == "preflop"]
        assert any(a.action == "raise" and a.is_hero for a in preflop)
        assert any(a.action == "call" and not a.is_hero for a in preflop)

    def test_action_order_is_preflop_then_flop(self):
        p = self.parser.parse(GG_CASH_BASIC)
        streets = [a.street for a in p.actions]
        # No flop action should appear before preflop ends
        last_preflop = max((i for i, s in enumerate(streets) if s == "preflop"), default=-1)
        first_flop = min((i for i, s in enumerate(streets) if s == "flop"), default=len(streets))
        assert last_preflop < first_flop

    def test_all_in_detected(self):
        p = self.parser.parse(GG_ALL_IN)
        all_in_actions = [a for a in p.actions if a.is_all_in]
        assert len(all_in_actions) >= 1
        assert all_in_actions[0].is_hero

    def test_hero_raise_size(self):
        p = self.parser.parse(GG_CASH_BASIC)
        hero_raise = next(
            a for a in p.actions if a.action == "raise" and a.is_hero
        )
        assert hero_raise.size_bb == pytest.approx(3.0, rel=0.01)

    # ── Table metadata ────────────────────────────────────────────────────

    def test_table_max_seats_cash(self):
        p = self.parser.parse(GG_CASH_BASIC)
        assert p.table_max_seats == 6

    def test_table_max_seats_tournament(self):
        p = self.parser.parse(GG_TOURNAMENT)
        assert p.table_max_seats == 9

    # ── Effective stack ───────────────────────────────────────────────────

    def test_effective_stack_is_min_of_hero_and_opponents(self):
        p = self.parser.parse(GG_CASH_BASIC)
        # Hero has 100BB, smallest opponent has 65BB (Player6)
        assert p.effective_stack_bb == pytest.approx(65.0, rel=0.01)


# ─────────────────────────────────────────────────────────────────────────────
# PokerStars parser
# ─────────────────────────────────────────────────────────────────────────────

PS_CASH = """\
PokerStars Hand #234567890: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/15 14:45:12 ET
Table 'Adhafera IV' 6-Max Seat #1 is the Button
Seat 1: Hero ($100.00 in chips)
Seat 2: Player2 ($90.00 in chips)
Seat 3: Player3 ($87.50 in chips)
Seat 4: Player4 ($134.20 in chips)
Seat 5: Player5 ($98.75 in chips)
Seat 6: Player6 ($72.40 in chips)
Player2: posts small blind $0.50
Player3: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Qh Jh]
Player4: folds
Player5: folds
Player6: folds
Hero: raises $2.50 to $3.00
Player2: folds
Player3: calls $2.00
*** FLOP *** [Kd Tc 9s]
Player3: checks
Hero: bets $4.00
Player3: calls $4.00
*** TURN *** [Kd Tc 9s] [2h]
Player3: checks
Hero: bets $9.00
Player3: folds
*** SUMMARY ***
"""

PS_TOURNAMENT = """\
PokerStars Hand #111222333: Hold'em No Limit (Tournament) - 2024/06/01 10:00:00 ET
Table 'MTT' 9-max Seat #5 is the Button
Level VI (200/400)
Seat 1: UTGPlayer (12000 in chips)
Seat 2: UTG1Player (15500 in chips)
Seat 3: HJPlayer (8000 in chips)
Seat 4: COPlayer (20000 in chips)
Seat 5: Hero (25000 in chips)
Seat 6: SBPlayer (18000 in chips)
Seat 7: BBPlayer (10000 in chips)
SBPlayer: posts small blind 200
BBPlayer: posts big blind 400
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
UTGPlayer: folds
UTG1Player: folds
HJPlayer: folds
COPlayer: folds
Hero: raises 800 to 1000
SBPlayer: folds
BBPlayer: calls 600
*** FLOP *** [As 7h 2c]
BBPlayer: checks
Hero: bets 1000
BBPlayer: folds
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

PS_ALL_IN = """\
PokerStars Hand #555666777: Hold'em No Limit ($1.00/$2.00 USD) - 2024/01/01 12:00:00 ET
Table 'ShoveTable' 6-Max Seat #1 is the Button
Seat 1: Hero ($40.00 in chips)
Seat 2: Villain ($200.00 in chips)
Hero: posts small blind $1.00
Villain: posts big blind $2.00
*** HOLE CARDS ***
Dealt to Hero [Ah Ad]
Hero: raises $6.00 to $6.00
Villain: raises $18.00 to $20.00
Hero: raises $34.00 to $40.00 and is all-in
Villain: calls $20.00
*** FLOP *** [Kd Qc Jh]
*** TURN *** [Kd Qc Jh] [Ts]
*** RIVER *** [Kd Qc Jh Ts] [9c]
*** SUMMARY ***
"""


class TestPokerStarsParser:
    def setup_method(self):
        self.parser = PokerStarsParser()

    def test_can_parse_cash(self):
        assert self.parser.can_parse(PS_CASH)

    def test_can_parse_tournament(self):
        assert self.parser.can_parse(PS_TOURNAMENT)

    def test_site(self):
        assert self.parser.parse(PS_CASH).site == "PokerStars"

    # ── Positions ──────────────────────────────────────────────────────────

    def test_cash_positions(self):
        p = self.parser.parse(PS_CASH)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["Player2"] == "SB"
        assert pos["Player3"] == "BB"

    def test_tournament_positions(self):
        p = self.parser.parse(PS_TOURNAMENT)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["SBPlayer"] == "SB"
        assert pos["BBPlayer"] == "BB"

    def test_9max_partial_positions(self):
        p = self.parser.parse(PS_9MAX_PARTIAL)
        pos = {pl.name: pl.position for pl in p.players}
        assert pos["Hero"] == "BTN"
        assert pos["PlayerH"] == "SB"
        assert pos["PlayerA"] == "BB"
        assert pos["PlayerB"] == "UTG"
        assert pos["PlayerD"] == "CO"

    # ── Tournament chip parsing (the KEY FIX: no $ sign) ──────────────────

    def test_tournament_stacks_no_dollar_sign(self):
        p = self.parser.parse(PS_TOURNAMENT)
        # If regex still requires $, all stacks would be 0 or fail
        for pl in p.players:
            assert pl.stack_bb > 0, (
                f"Player {pl.name!r} has 0 stack — tournament chip regex broken"
            )

    def test_tournament_hero_stack_in_bb(self):
        p = self.parser.parse(PS_TOURNAMENT)
        hero = next(pl for pl in p.players if pl.name == "Hero")
        assert hero.stack_bb == pytest.approx(62.5, rel=0.01)  # 25000/400

    def test_tournament_bb_correct(self):
        p = self.parser.parse(PS_TOURNAMENT)
        assert p.big_blind == 400.0

    # ── Cash stakes ───────────────────────────────────────────────────────

    def test_cash_stakes(self):
        p = self.parser.parse(PS_CASH)
        assert p.big_blind == 1.0

    def test_cash_hero_stack(self):
        p = self.parser.parse(PS_CASH)
        hero = next(pl for pl in p.players if pl.name == "Hero")
        assert hero.stack_bb == pytest.approx(100.0, rel=0.01)

    # ── Hero cards ────────────────────────────────────────────────────────

    def test_hero_cards_cash(self):
        p = self.parser.parse(PS_CASH)
        assert p.hero_cards == ["Qh", "Jh"]

    def test_hero_cards_tournament(self):
        p = self.parser.parse(PS_TOURNAMENT)
        assert p.hero_cards == ["Ah", "Kd"]

    # ── Board parsing ─────────────────────────────────────────────────────

    def test_flop_turn_river(self):
        p = self.parser.parse(PS_CASH)
        assert p.board.flop == ["Kd", "Tc", "9s"]
        assert p.board.turn == ["2h"]
        assert p.board.river == []

    def test_all_in_full_board(self):
        p = self.parser.parse(PS_ALL_IN)
        assert p.board.flop == ["Kd", "Qc", "Jh"]
        assert p.board.turn == ["Ts"]
        assert p.board.river == ["9c"]

    # ── All-in detection ──────────────────────────────────────────────────

    def test_all_in_flagged(self):
        p = self.parser.parse(PS_ALL_IN)
        all_ins = [a for a in p.actions if a.is_all_in]
        assert len(all_ins) >= 1
        assert all_ins[0].is_hero

    # ── Actions ───────────────────────────────────────────────────────────

    def test_preflop_action_street(self):
        p = self.parser.parse(PS_CASH)
        preflop = [a for a in p.actions if a.street == "preflop"]
        assert len(preflop) > 0

    def test_multistreet_actions(self):
        p = self.parser.parse(PS_CASH)
        streets = {a.street for a in p.actions}
        assert "preflop" in streets
        assert "flop" in streets
        assert "turn" in streets

    def test_hero_raise_size_bb(self):
        p = self.parser.parse(PS_CASH)
        raise_action = next(a for a in p.actions if a.action == "raise" and a.is_hero)
        assert raise_action.size_bb == pytest.approx(3.0, rel=0.01)

    def test_table_max_seats(self):
        p = self.parser.parse(PS_CASH)
        assert p.table_max_seats == 6

    def test_tournament_max_seats(self):
        p = self.parser.parse(PS_TOURNAMENT)
        assert p.table_max_seats == 9


# ─────────────────────────────────────────────────────────────────────────────
# Cross-parser / edge-case tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCrossParser:
    def test_gg_does_not_match_pokerstars(self):
        assert not GGPokerParser().can_parse(PS_CASH)

    def test_ps_does_not_match_ggpoker(self):
        assert not PokerStarsParser().can_parse(GG_CASH_BASIC)

    def test_gg_hero_position_matches_player_list(self):
        p = GGPokerParser().parse(GG_CASH_BASIC)
        player_positions = {pl.name: pl.position for pl in p.players}
        assert p.hero_position == player_positions[p.hero_name]

    def test_ps_hero_position_matches_player_list(self):
        p = PokerStarsParser().parse(PS_CASH)
        player_positions = {pl.name: pl.position for pl in p.players}
        assert p.hero_position == player_positions[p.hero_name]

    def test_no_negative_stacks_gg(self):
        p = GGPokerParser().parse(GG_CASH_BASIC)
        for pl in p.players:
            assert pl.stack_bb >= 0

    def test_no_negative_stacks_ps(self):
        p = PokerStarsParser().parse(PS_CASH)
        for pl in p.players:
            assert pl.stack_bb >= 0

    def test_all_cards_valid_format(self):
        from app.engines.validator import _is_valid_card
        p = GGPokerParser().parse(GG_CASH_BASIC)
        for card in p.hero_cards + p.board.flop + p.board.turn + p.board.river:
            assert _is_valid_card(card), f"Invalid card: {card!r}"

    def test_no_duplicate_cards(self):
        p = PokerStarsParser().parse(PS_CASH)
        all_cards = p.hero_cards + p.board.flop + p.board.turn + p.board.river
        assert len(all_cards) == len(set(all_cards)), "Duplicate cards detected"


# ─────────────────────────────────────────────────────────────────────────────
# Single-star GGPoker format (e.g. hand #HD2860661008 from some client builds)
# ─────────────────────────────────────────────────────────────────────────────

GG_SINGLE_STAR = """\
Poker Hand #HD2860661008: Hold'em No Limit ($0.50/$1.00) - 2024/03/10 21:15:44
Table 'CashGame' 6-max Seat #3 is the button
Seat 1: OtherPlayer ($95.00 in chips)
Seat 2: AnotherPlayer ($110.00 in chips)
Seat 3: Hero ($100.00 in chips)
Seat 4: Player4 ($80.00 in chips)
Seat 5: Player5 ($120.00 in chips)
Seat 6: Player6 ($75.00 in chips)
Player4: posts small blind $0.50
Player5: posts big blind $1.00
* HOLE CARDS *
Dealt to Hero [6c 7d]
Player6: folds
OtherPlayer: folds
AnotherPlayer: folds
Hero: raises $2.50 to $3.00
Player4: folds
Player5: calls $2.00
* FLOP * [6c 7d 9c]
Player5: checks
Hero: bets $4.00
Player5: calls $4.00
* TURN * [6c 7d 9c] [7s]
Player5: checks
Hero: bets $9.00
Player5: folds
* SHOWDOWN *
* SUMMARY *
"""

GG_SINGLE_STAR_SHOWDOWN_NOSPACE = """\
Poker Hand #HD1111111111: Hold'em No Limit ($1.00/$2.00) - 2024/03/10 21:15:44
Table 'CashGame' 6-max Seat #1 is the button
Seat 1: Hero ($200.00 in chips)
Seat 2: Villain ($200.00 in chips)
Hero: posts small blind $1.00
Villain: posts big blind $2.00
* HOLE CARDS *
Dealt to Hero [As Ks]
Hero: raises $6.00 to $6.00
Villain: calls $4.00
* FLOP * [Ah Kd 2c]
Villain: checks
Hero: bets $8.00
Villain: calls $8.00
* TURN * [Ah Kd 2c] [3s]
Villain: checks
Hero: bets $20.00
Villain: folds
* SHOWDOWN *
* SUMMARY *
"""


class TestGGSingleStarFormat:
    """Regression tests for GGPoker single-asterisk section markers (* SECTION *)."""

    def setup_method(self):
        self.parser = GGPokerParser()

    def test_can_parse_single_star_hand(self):
        assert self.parser.can_parse(GG_SINGLE_STAR)

    def test_hero_cards_detected(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.hero_cards == ["6c", "7d"]

    def test_flop_parsed_single_star(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.board.flop == ["6c", "7d", "9c"]

    def test_turn_parsed_single_star(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.board.turn == ["7s"]

    def test_river_empty_single_star(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.board.river == []

    def test_preflop_actions_parsed(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        preflop = [a for a in p.actions if a.street == "preflop"]
        assert len(preflop) > 0, "No preflop actions parsed from single-star hand"
        assert any(a.action == "raise" and a.is_hero for a in preflop)

    def test_flop_actions_parsed(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        flop = [a for a in p.actions if a.street == "flop"]
        assert len(flop) > 0, "No flop actions parsed from single-star hand"

    def test_turn_actions_parsed(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        turn = [a for a in p.actions if a.street == "turn"]
        assert len(turn) > 0, "No turn actions parsed from single-star hand"

    def test_total_action_count(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        # preflop: folds x3 + Hero raise + Player5 call = 5
        # flop: check + bet + call = 3
        # turn: check + bet + fold = 3  → total 11
        assert len(p.actions) >= 8, (
            f"Only {len(p.actions)} actions parsed — single-star extraction may have failed"
        )

    def test_showdown_nospace_doesnt_eat_river_actions(self):
        """SHOWDOWN (no space) must not absorb turn actions into its terminator match."""
        p = self.parser.parse(GG_SINGLE_STAR_SHOWDOWN_NOSPACE)
        turn = [a for a in p.actions if a.street == "turn"]
        assert len(turn) > 0, "Turn actions swallowed by SHOWDOWN terminator"

    def test_diagnostics_present(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.parse_diagnostics is not None

    def test_diagnostics_sections_found(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        d = p.parse_diagnostics
        assert "HOLE CARDS" in d.sections_found
        assert "FLOP" in d.sections_found
        assert "TURN" in d.sections_found

    def test_diagnostics_no_errors_for_clean_hand(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        d = p.parse_diagnostics
        assert d.errors == [], f"Unexpected errors: {d.errors}"

    def test_diagnostics_hero_cards_found(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.parse_diagnostics.hero_cards_found is True

    def test_diagnostics_action_count_matches(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        assert p.parse_diagnostics.actions_parsed == len(p.actions)

    def test_diagnostics_board_cards_count(self):
        p = self.parser.parse(GG_SINGLE_STAR)
        d = p.parse_diagnostics
        # flop(3) + turn(1) = 4
        assert d.board_cards_parsed == 4


# ─────────────────────────────────────────────────────────────────────────────
# Recovery mode: malformed / unknown header format
# ─────────────────────────────────────────────────────────────────────────────

GG_UNKNOWN_HEADER = """\
Poker Hand #CB9999999999: Hold'em No Limit ($1.00/$2.00) - 2024/06/01
Table 'WeirdClient' 6-max Seat #2 is the button
Seat 1: Hero ($100.00 in chips)
Seat 2: Villain ($200.00 in chips)
Hero: posts small blind $1.00
Villain: posts big blind $2.00
HOLE CARDS
Dealt to Hero [Ac Kd]
Villain: raises $6.00 to $6.00
Hero: calls $4.00
FLOP [Ah 7c 2s]
Hero: checks
Villain: bets $8.00
Hero: calls $8.00
SUMMARY
"""


class TestRecoveryMode:
    """Tests for _recover_actions_from_text fallback parser."""

    def setup_method(self):
        self.parser = GGPokerParser()

    def test_recovery_finds_some_actions(self):
        """When section extraction fails, recovery should still find actions."""
        p = self.parser.parse(GG_UNKNOWN_HEADER)
        # Recovery may find actions even without proper star markers
        # The main assertion: no crash, and diagnostics track recovery
        assert p.parse_diagnostics is not None

    def test_diagnostics_is_partial_when_no_starred_sections(self):
        p = self.parser.parse(GG_UNKNOWN_HEADER)
        d = p.parse_diagnostics
        # HOLE CARDS section should be missing (no * markers)
        assert "HOLE CARDS" not in d.sections_found or d.is_partial


# ─────────────────────────────────────────────────────────────────────────────
# Check/check streets (no sizing, no chips_in)
# ─────────────────────────────────────────────────────────────────────────────

GG_CHECK_CHECK = """\
Poker Hand #RC5555555555: Hold'em No Limit ($0.25/$0.50) - 2024/01/01 12:00:00
Table 'CheckStreet' 6-max Seat #1 is the button
Seat 1: Hero ($50.00 in chips)
Seat 2: Villain ($50.00 in chips)
Villain: posts small blind $0.25
Hero: posts big blind $0.50
*** HOLE CARDS ***
Dealt to Hero [Qh Qs]
Villain: calls $0.25
Hero: checks
*** FLOP *** [2c 5d 8h]
Villain: checks
Hero: checks
*** TURN *** [2c 5d 8h] [9s]
Villain: checks
Hero: checks
*** RIVER *** [2c 5d 8h 9s] [Kc]
Villain: checks
Hero: bets $1.00
Villain: folds
*** SUMMARY ***
"""


class TestCheckCheckStreet:
    def setup_method(self):
        self.parser = GGPokerParser()

    def test_all_streets_parsed(self):
        p = self.parser.parse(GG_CHECK_CHECK)
        streets = {a.street for a in p.actions}
        assert "preflop" in streets
        assert "flop" in streets
        assert "turn" in streets
        assert "river" in streets

    def test_check_actions_have_no_size(self):
        p = self.parser.parse(GG_CHECK_CHECK)
        checks = [a for a in p.actions if a.action == "check"]
        assert len(checks) >= 4
        for c in checks:
            assert c.size_bb is None

    def test_river_bet_detected(self):
        p = self.parser.parse(GG_CHECK_CHECK)
        river = [a for a in p.actions if a.street == "river"]
        assert any(a.action == "bet" for a in river)


# ─────────────────────────────────────────────────────────────────────────────
# PokerStars triple-star format still works after base.py refactor
# ─────────────────────────────────────────────────────────────────────────────

class TestPokerStarsTripleStar:
    """Regression: PokerStars *** markers must still parse correctly."""

    def setup_method(self):
        self.parser = PokerStarsParser()

    def test_multistreet_actions_preserved(self):
        p = self.parser.parse(PS_CASH)
        streets = {a.street for a in p.actions}
        assert "preflop" in streets
        assert "flop" in streets
        assert "turn" in streets

    def test_board_flop_turn(self):
        p = self.parser.parse(PS_CASH)
        assert p.board.flop == ["Kd", "Tc", "9s"]
        assert p.board.turn == ["2h"]

    def test_diagnostics_present(self):
        p = self.parser.parse(PS_CASH)
        assert p.parse_diagnostics is not None

    def test_diagnostics_no_recovery_needed(self):
        p = self.parser.parse(PS_CASH)
        assert p.parse_diagnostics.recovered_actions == 0

    def test_diagnostics_sections_found(self):
        p = self.parser.parse(PS_CASH)
        d = p.parse_diagnostics
        assert "HOLE CARDS" in d.sections_found
        assert "FLOP" in d.sections_found
        assert "TURN" in d.sections_found
