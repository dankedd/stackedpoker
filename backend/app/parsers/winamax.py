"""
Winamax hand history parser — deterministic, regex-based.

Winamax format notes:
  - Header: "Winamax Poker - ..."
  - Seats: "Seat N: PlayerName (Xchips, Y%)"  or  "Seat N: PlayerName (X€)"
  - Button: "Seat N is the button"
  - Blinds: "PlayerName posts small blind Xchips" / "... big blind ..."
  - Actions: "PlayerName folds/checks/calls/bets/raises to X"
  - Board: "Board: [Xc Yd Zh] [Tx] [Ry]"
  - Cards: "Dealt to PlayerName [Ah Kd]"

Chip convention (same as other parsers):
  raises:  size_bb = "to" total
  calls:   size_bb = additional
  bets:    size_bb = bet amount
"""
import re
import logging
from app.parsers.base import BaseParser
from app.models.schemas import ParsedHand, BoardCards
from app.engines.pot_engine import compute_final_pot

_log = logging.getLogger(__name__)

_CARD = r"[2-9TJQKAtjqka][cdhs♣♦♥♠]"


class WinamaxParser(BaseParser):
    """Parser for Winamax hand history format (cash and tournament)."""

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r"Winamax Poker", text, re.IGNORECASE))

    def parse(self, text: str) -> ParsedHand:
        # Normalise unicode suit symbols → ASCII
        text = _normalise_suits(text)

        hand_id = self._parse_hand_id(text)
        stakes, sb, bb = self._parse_stakes(text)
        game_type = "NLHE"
        site = "Winamax"

        table_max_seats = self._parse_table_max_seats(text)
        players_raw = self._parse_seats(text, bb)
        button_seat = self._parse_button_seat(text)
        players = self._assign_positions(players_raw, button_seat, table_max_seats)

        hero_name, hero_cards = self._parse_hero_cards(text)
        hero_position = next(
            (p.position for p in players if p.name == hero_name), "BTN"
        )

        board = _parse_winamax_board(text)
        actions = self._parse_actions(text, hero_name, bb)

        recovered = 0
        if not actions:
            _log.warning("WX %s: primary parse found 0 actions — attempting recovery", hand_id)
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
            site=site,
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

    # ── Winamax-specific helpers ────────────────────────────────────────────

    def _parse_hand_id(self, text: str) -> str:
        # "Winamax Poker - ... HandId: #1234567890"
        m = re.search(r"HandId\s*:\s*#?(\d+)", text, re.IGNORECASE)
        if m:
            return m.group(1)
        # Fallback: any large number in header
        m = re.search(r"Winamax.*?(\d{7,})", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # Cash: "(0.02€/0.05€)" or "(€0.02/€0.05)"
        m = re.search(r"\((?:€)?([\d.]+)(?:€)?/([\d.]+)(?:€)?\)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            if bb > 0:
                return f"{m.group(1)}/{m.group(2)}", sb, bb

        # Tournament levels: "Level N (X/Y)"
        m = re.search(r"Level\s+\w+\s*\(([\d,]+)/([\d,]+)\)", text, re.IGNORECASE)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                return f"T{int(sb)}/{int(bb)}", sb, bb

        # Fallback from blind postings
        m_bb = re.search(r"posts big blind\s+([€$]?[\d.]+)", text, re.IGNORECASE)
        m_sb = re.search(r"posts small blind\s+([€$]?[\d.]+)", text, re.IGNORECASE)
        if m_bb:
            bb = float(re.sub(r"[^0-9.]", "", m_bb.group(1)))
            sb = float(re.sub(r"[^0-9.]", "", m_sb.group(1))) if m_sb else bb / 2
            if bb > 0:
                return f"{sb}/{bb}", sb, bb

        return "0.02/0.05", 0.02, 0.05

    def _parse_button_seat(self, text: str) -> int:
        m = re.search(r"Seat (\d+)\s+is\s+the\s+[Bb]utton", text)
        return int(m.group(1)) if m else 1


def _normalise_suits(text: str) -> str:
    """Replace Unicode suit symbols with ASCII equivalents."""
    return (
        text.replace("♣", "c")
            .replace("♦", "d")
            .replace("♥", "h")
            .replace("♠", "s")
    )


def _parse_winamax_board(text: str) -> BoardCards:
    """Parse Winamax-style board: 'Board: [Xc Yd Zh] [Tx] [Ry]'"""
    _CARD_PAT = r"([2-9TJQKAtjqka][cdhs])"
    m = re.search(r"Board\s*:\s*\[(" + _CARD_PAT + r"\s+" + _CARD_PAT + r"\s+" + _CARD_PAT + r")\]", text)
    flop: list[str] = []
    turn: list[str] = []
    river: list[str] = []

    board_line = re.search(r"Board\s*:\s*(.*)", text)
    if board_line:
        brackets = re.findall(r"\[([^\]]+)\]", board_line.group(1))
        if brackets:
            cards_in_first = brackets[0].split()
            if len(cards_in_first) == 3:
                flop = [c.capitalize()[0] + c[1].lower() for c in cards_in_first]
            elif len(cards_in_first) >= 5:
                # all on one line
                flop = [_norm(c) for c in cards_in_first[:3]]
                if len(cards_in_first) > 3:
                    turn = [_norm(cards_in_first[3])]
                if len(cards_in_first) > 4:
                    river = [_norm(cards_in_first[4])]
            if len(brackets) > 1 and not turn:
                t = brackets[1].split()
                if t:
                    turn = [_norm(t[0])]
            if len(brackets) > 2 and not river:
                r = brackets[2].split()
                if r:
                    river = [_norm(r[0])]

    return BoardCards(flop=flop, turn=turn, river=river)


def _norm(card: str) -> str:
    """Normalize card to rank-upper suit-lower."""
    if len(card) >= 2:
        return card[0].upper() + card[1].lower()
    return card
