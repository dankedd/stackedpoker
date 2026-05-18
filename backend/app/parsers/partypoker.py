"""
PartyPoker hand history parser — deterministic, regex-based.

PartyPoker format notes:
  - Header: "Game #NNNN  Texas Hold'em  No Limit ..."
  - Table: "Table ... $X/$Y"
  - Seats: "Seat N: PlayerName ( $X USD )"
  - Dealt: "PlayerName  [ Kd, Ah ]"
  - Button: "PlayerName has the button"
  - Blinds: "PlayerName posts small blind [$X]" / "... big blind ..."
  - Actions: "PlayerName folds/checks/calls [$X]/bets [$X]/raises [$X]"
  - Board: "** Dealing flop ** [ Jh, 8d, 2s ]"

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

_CARD = r"[2-9TJQKAtjqka][cdhs]"
_AMT = r"\[?\$?([\d,]+(?:\.\d+)?)\]?"


class PartyPokerParser(BaseParser):
    """Parser for PartyPoker hand history format."""

    def can_parse(self, text: str) -> bool:
        return bool(
            re.search(r"Game #\d+", text) and
            re.search(r"Texas Hold.em", text, re.IGNORECASE)
        )

    def parse(self, text: str) -> ParsedHand:
        hand_id = self._parse_hand_id(text)
        stakes, sb, bb = self._parse_stakes(text)
        game_type = "NLHE"
        site = "PartyPoker"

        table_max_seats = self._parse_table_max_seats(text)
        players_raw = self._parse_seats_pp(text, bb)
        button_seat = self._parse_button_seat(text)
        players = self._assign_positions(players_raw, button_seat, table_max_seats)

        hero_name, hero_cards = self._parse_hero_cards_pp(text)
        hero_position = next(
            (p.position for p in players if p.name == hero_name), "BTN"
        )

        board = _parse_partypoker_board(text)
        actions = self._parse_actions_pp(text, hero_name, bb)

        recovered = 0
        if not actions:
            _log.warning("PP %s: primary parse found 0 actions — attempting recovery", hand_id)
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

    # ── PartyPoker-specific helpers ─────────────────────────────────────────

    def _parse_hand_id(self, text: str) -> str:
        m = re.search(r"Game #(\d+)", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # Table line: "Table ... $0.50/$1.00" or "Blinds $0.50/$1.00"
        m = re.search(r"\$?([\d.]+)/\$?([\d.]+)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            if bb > 0:
                return f"{m.group(1)}/{m.group(2)}", sb, bb
        # Fallback from blind lines
        m_bb = re.search(r"posts big blind\s*\[?\$?([\d.]+)\]?", text, re.IGNORECASE)
        m_sb = re.search(r"posts small blind\s*\[?\$?([\d.]+)\]?", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1))
            sb = float(m_sb.group(1)) if m_sb else bb / 2
            return f"{sb}/{bb}", sb, bb
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat(self, text: str) -> int:
        # "PlayerName has the button" — find their seat
        m = re.search(r"(\S+)\s+has the button", text, re.IGNORECASE)
        if m:
            btn_player = m.group(1)
            m2 = re.search(rf"Seat (\d+):\s+{re.escape(btn_player)}", text)
            if m2:
                return int(m2.group(1))
        return 1

    def _parse_seats_pp(self, text: str, bb: float) -> list[dict]:
        """PartyPoker seat format: 'Seat N: PlayerName ( $X.XX USD )'"""
        seats = []
        for m in re.finditer(
            r"Seat (\d+):\s+(\S+)\s+\(\s*\$?([\d,]+(?:\.\d+)?)\s*(?:USD|EUR|GBP)?\s*\)",
            text,
        ):
            stack = float(m.group(3).replace(",", ""))
            seats.append({
                "seat": int(m.group(1)),
                "name": m.group(2),
                "stack": stack,
                "stack_bb": round(stack / bb, 2) if bb else 0.0,
            })
        return seats

    def _parse_hero_cards_pp(self, text: str) -> tuple[str, list[str]]:
        """PartyPoker: 'PlayerName  [ Kd, Ah ]'"""
        m = re.search(
            rf"(\S+)\s+\[\s*({_CARD}),?\s+({_CARD})\s*\]",
            text,
        )
        if m:
            hero = m.group(1)
            c1 = m.group(2)[0].upper() + m.group(2)[1].lower()
            c2 = m.group(3)[0].upper() + m.group(3)[1].lower()
            return hero, [c1, c2]
        return "Hero", []

    def _parse_actions_pp(
        self, text: str, hero_name: str, bb: float
    ) -> list:
        """Parse PartyPoker actions, adapting to their section markers."""
        from app.models.schemas import HandAction

        sections = {
            "preflop": _pp_section(text, "HOLE CARDS", "FLOP"),
            "flop":    _pp_section(text, "FLOP", "TURN"),
            "turn":    _pp_section(text, "TURN", "RIVER"),
            "river":   _pp_section(text, "RIVER", r"SHOW\s*DOWN|SUMMARY|wins"),
        }

        action_re = re.compile(
            rf"^(\S+)\s+(folds|checks|calls|bets|raises)"
            rf"(?:\s*{_AMT})?"
            rf"(?:\s+to\s+{_AMT})?",
            re.MULTILINE | re.IGNORECASE,
        )
        action_map = {
            "folds": "fold", "checks": "check", "calls": "call",
            "bets": "bet",   "raises": "raise",
        }
        actions = []
        for street, section in sections.items():
            if not section:
                continue
            for m in action_re.finditer(section):
                player = m.group(1)
                raw = m.group(2).lower()
                amt = m.group(4) or m.group(3)
                amount: float | None = None
                if amt and bb:
                    amount = round(float(amt.replace(",", "")) / bb, 2)
                actions.append(HandAction(
                    street=street,
                    player=player,
                    action=action_map[raw],
                    size_bb=amount,
                    is_hero=(player == hero_name),
                    is_all_in=False,
                ))
        return actions


def _pp_section(text: str, start: str, end: str) -> str:
    """Extract PartyPoker section using '** SECTION **' markers."""
    pattern = rf"\*\*\s*{start}.*?\*\*(.*?)(?:\*\*\s*{end}|\Z)"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return m.group(1) if m else ""


def _parse_partypoker_board(text: str) -> BoardCards:
    """Parse PartyPoker board: '** Dealing flop ** [ Jh, 8d, 2s ]'"""
    _CARD_PAT = r"([2-9TJQKAtjqka][cdhs])"
    flop: list[str] = []
    turn: list[str] = []
    river: list[str] = []

    m_flop = re.search(
        rf"Dealing flop.*?\[\s*{_CARD_PAT},?\s+{_CARD_PAT},?\s+{_CARD_PAT}\s*\]",
        text, re.IGNORECASE,
    )
    if m_flop:
        flop = [_norm(m_flop.group(i)) for i in range(1, 4)]

    m_turn = re.search(
        rf"Dealing turn.*?\[\s*{_CARD_PAT}\s*\]",
        text, re.IGNORECASE,
    )
    if m_turn:
        turn = [_norm(m_turn.group(1))]

    m_river = re.search(
        rf"Dealing river.*?\[\s*{_CARD_PAT}\s*\]",
        text, re.IGNORECASE,
    )
    if m_river:
        river = [_norm(m_river.group(1))]

    return BoardCards(flop=flop, turn=turn, river=river)


def _norm(card: str) -> str:
    return card[0].upper() + card[1].lower()
