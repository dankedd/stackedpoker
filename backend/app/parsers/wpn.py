"""
WPN (Winning Poker Network) hand history parser — deterministic, regex-based.

WPN format notes:
  - Header: "Hand #NNNN ... No Limit Holdem" or "Game #NNNN"
  - Different from PartyPoker despite similar numbering
  - Seats: "Seat N: PlayerName ($X)" or "Seat N: PlayerName (X)"
  - Button: "Seat #N is the button"  or  "Dealer: Seat N"
  - Dealt: "Dealt to PlayerName [Ah Kd]"
  - Actions: "PlayerName: folds/checks/calls/bets/raises to X"
  - Board: uses *** FLOP *** / *** TURN *** / *** RIVER *** markers

Chip convention:
  raises:  size_bb = "to" total
  calls:   size_bb = additional
  bets:    size_bb = bet amount
"""
import re
import logging
from app.parsers.base import BaseParser
from app.models.schemas import ParsedHand
from app.engines.pot_engine import compute_final_pot

_log = logging.getLogger(__name__)


class WPNParser(BaseParser):
    """Parser for WPN (Winning Poker Network) hand history format."""

    def can_parse(self, text: str) -> bool:
        # WPN-specific markers
        return bool(
            re.search(r"Hand #\d+", text) and
            re.search(r"No Limit Holdem|Hold'em No Limit", text, re.IGNORECASE) and
            # Negative: not PartyPoker (which also uses "Game #")
            not re.search(r"PartyPoker|PokerStars|GGPoker|Winamax", text, re.IGNORECASE)
        )

    def parse(self, text: str) -> ParsedHand:
        hand_id = self._parse_hand_id(text)
        stakes, sb, bb = self._parse_stakes(text)
        game_type = "NLHE"
        site = "WPN"

        table_max_seats = self._parse_table_max_seats(text)
        players_raw = self._parse_seats(text, bb)
        button_seat = self._parse_button_seat(text)
        players = self._assign_positions(players_raw, button_seat, table_max_seats)

        hero_name, hero_cards = self._parse_hero_cards(text)
        hero_position = next(
            (p.position for p in players if p.name == hero_name), "BTN"
        )

        board = self._parse_board(text)
        actions = self._parse_actions(text, hero_name, bb)

        recovered = 0
        if not actions:
            _log.warning("WPN %s: primary parse found 0 actions — attempting recovery", hand_id)
            actions = self._recover_actions_from_text(text, hero_name, bb)
            recovered = len(actions)

        effective_stack = self._calc_effective_stack(players, hero_name)
        sb_bb = sb / bb if bb else 0.5
        sb_name = next((p.name for p in players if p.position == "SB"), "")
        bb_name = next((p.name for p in players if p.position == "BB"), "")
        pot_size_bb = compute_final_pot(
            actions, sb_bb, 1.0, 0.0,
            sb_player=sb_name, bb_player=bb_name,
        )

        diagnostics = self._build_diagnostics(text, actions, board, hero_cards, recovered)

        return ParsedHand(
            site="Unknown",     # WPN mapped to Unknown to avoid schema Literal issue
            game_type=game_type,
            stakes=stakes,
            hand_id=hand_id,
            hero_name=hero_name,
            hero_position=hero_position,
            effective_stack_bb=effective_stack,
            hero_cards=hero_cards,
            board=board,
            players=players,
            actions=actions,
            pot_size_bb=pot_size_bb,
            big_blind=bb,
            table_max_seats=table_max_seats,
            parse_diagnostics=diagnostics,
        )

    # ── WPN-specific helpers ────────────────────────────────────────────────

    def _parse_hand_id(self, text: str) -> str:
        m = re.search(r"Hand #(\d+)", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # "$0.50/$1.00" or "0.50/1.00"
        m = re.search(r"\$?([\d.]+)/\$?([\d.]+)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            if bb > 0:
                return f"{m.group(1)}/{m.group(2)}", sb, bb
        # From blind lines
        m_bb = re.search(r"posts big blind\s+\$?([\d.]+)", text, re.IGNORECASE)
        m_sb = re.search(r"posts small blind\s+\$?([\d.]+)", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1))
            sb = float(m_sb.group(1)) if m_sb else bb / 2
            return f"{sb}/{bb}", sb, bb
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat(self, text: str) -> int:
        # "Seat #N is the button" or "Dealer: Seat N"
        m = re.search(r"Seat #?(\d+)\s+is\s+the\s+[Bb]utton", text)
        if m:
            return int(m.group(1))
        m = re.search(r"Dealer\s*:\s*Seat\s+(\d+)", text, re.IGNORECASE)
        return int(m.group(1)) if m else 1
