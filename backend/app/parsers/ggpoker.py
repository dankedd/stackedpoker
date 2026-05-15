"""
GGPoker hand history parser — deterministic, regex-based.

Chip convention:
  raises:  size_bb = "to" total (group 4 in action regex)
  calls:   size_bb = additional amount (group 3)
  bets:    size_bb = bet amount (group 3)

Pot is computed by engines.pot_engine.compute_final_pot() which correctly
handles the edge case of blinds re-raising (no double-count).
"""
import re
import logging
from app.parsers.base import BaseParser, derive_positions
from app.models.schemas import (
    ParsedHand, BoardCards, PlayerInfo, HandAction,
)
from app.engines.pot_engine import compute_final_pot

_log = logging.getLogger(__name__)

# ── Card token (rank + suit) ──────────────────────────────────────────────────
_CARD = r"[2-9TJQKAtjqka][cdhs]"


class GGPokerParser(BaseParser):
    """Parser for GGPoker hand history format (cash and tournament)."""

    # GGPoker hand IDs: #RC…, #HD…, #CB…, #TO…  (may contain dashes)
    _CAN_PARSE_RE = re.compile(r"Poker Hand #[A-Z]{2}[\w-]+:", re.IGNORECASE)

    def can_parse(self, text: str) -> bool:
        return bool(self._CAN_PARSE_RE.search(text))

    def parse(self, text: str) -> ParsedHand:
        hand_id = self._parse_hand_id(text)
        stakes, sb, bb = self._parse_stakes(text)
        game_type = "NLHE"
        site = "GGPoker"

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

        effective_stack = self._calc_effective_stack(players, hero_name)
        antes_bb = self._sum_antes(text, bb)

        sb_bb = sb / bb
        sb_name = next((p.name for p in players if p.position == "SB"), "")
        bb_name = next((p.name for p in players if p.position == "BB"), "")
        pot_size_bb = compute_final_pot(
            actions, sb_bb, 1.0, antes_bb,
            sb_player=sb_name, bb_player=bb_name,
        )

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
        )

    # ── Private helpers ────────────────────────────────────────────────────

    def _parse_hand_id(self, text: str) -> str:
        m = re.search(r"Poker Hand #([\w-]+):", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # 1. Cash game: ($0.50/$1.00) or ($0.50/$1.00 USD)
        m = re.search(r"\(\$([0-9.]+)/\$([0-9.]+)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            _log.debug("GG stakes (cash): sb=%s bb=%s", sb, bb)
            return f"${m.group(1)}/${m.group(2)}", sb, bb

        # 2. Tournament Level header: Level I (100/200), Level V (1,500/3,000)
        m = re.search(r"Level\s+\w+\s*\(([\d,]+)/([\d,]+)", text, re.IGNORECASE)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                _log.debug("GG stakes (level header): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        # 3. Posted blind lines — reliable even without Level keyword
        m_bb = re.search(r":\s*posts big blind\s+\$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        m_sb = re.search(r":\s*posts small blind\s+\$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1).replace(",", ""))
            sb = float(m_sb.group(1).replace(",", "")) if m_sb else bb / 2
            if bb > 0:
                _log.debug("GG stakes (posted blinds): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        # 4. Generic parentheses — last resort
        m = re.search(r"\(([\d,]+)/([\d,]+)[^)]*\)", text)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                _log.debug("GG stakes (parens): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        _log.warning("GG stakes: all patterns failed for: %r", text[:120])
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat(self, text: str) -> int:
        m = re.search(r"Seat #(\d+) is the button", text, re.IGNORECASE)
        return int(m.group(1)) if m else 1

    def _parse_seats(self, text: str, bb: float) -> list[dict]:
        seats = []
        # Handles: $123.45  /  123,456  /  1234.56  (cash and tournament)
        for m in re.finditer(
            r"Seat (\d+):\s+(\S+)\s+\(\$?([0-9,]+(?:\.[0-9]+)?)\s+in chips\)",
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

    def _parse_table_max_seats(self, text: str) -> int:
        m = re.search(r"(\d+)-[Mm]ax", text)
        if m:
            return int(m.group(1))
        seats = [int(m.group(1)) for m in re.finditer(r"Seat (\d+):", text)]
        return max(seats) if seats else 6

    def _assign_positions(
        self, seats: list[dict], button_seat: int, table_max_seats: int
    ) -> list[PlayerInfo]:
        if not seats:
            return []
        occupied = [s["seat"] for s in seats]
        # If button_seat isn't in occupied seats, find the nearest occupied seat
        if button_seat not in occupied and occupied:
            all_seats = list(range(1, table_max_seats + 1))
            btn_idx = all_seats.index(button_seat) if button_seat in all_seats else 0
            # Search clockwise for first occupied seat
            for offset in range(len(all_seats)):
                candidate = all_seats[(btn_idx + offset) % len(all_seats)]
                if candidate in occupied:
                    button_seat = candidate
                    break
        pos_map = derive_positions(occupied, button_seat, table_max_seats)
        return [
            PlayerInfo(
                name=s["name"],
                seat=s["seat"],
                stack_bb=s["stack_bb"],
                position=pos_map.get(s["seat"], "?"),
            )
            for s in seats
        ]

    def _parse_hero_cards(self, text: str) -> tuple[str, list[str]]:
        # Supports 2-card (NLHE) and 4-card (PLO) dealt lines
        m = re.search(
            rf"Dealt to (\S+) \[({_CARD})((?:\s+{_CARD})*)\]",
            text,
        )
        if m:
            hero = m.group(1)
            raw = m.group(2) + m.group(3)
            cards = [self._normalise_card(c) for c in raw.split()]
            return hero, cards
        return "Hero", []

    def _parse_board(self, text: str) -> BoardCards:
        flop: list[str] = []
        turn: list[str] = []
        river: list[str] = []

        # FLOP: *** FLOP *** [Kd 7c 2s]  or  [Kd 7c 2s] [Kd 8c 2s] (run-it-twice)
        m_flop = re.search(
            rf"\*\*\* FLOP \*\*\*[^[]*\[({_CARD})\s+({_CARD})\s+({_CARD})\]",
            text,
        )
        if m_flop:
            flop = [
                self._normalise_card(m_flop.group(1)),
                self._normalise_card(m_flop.group(2)),
                self._normalise_card(m_flop.group(3)),
            ]

        # TURN: *** TURN *** [board] [card]
        m_turn = re.search(
            rf"\*\*\* TURN \*\*\* \[[^\]]+\] \[({_CARD})\]",
            text,
        )
        if m_turn:
            turn = [self._normalise_card(m_turn.group(1))]

        # RIVER: *** RIVER *** [board] [card]
        m_river = re.search(
            rf"\*\*\* RIVER \*\*\* \[[^\]]+\] \[({_CARD})\]",
            text,
        )
        if m_river:
            river = [self._normalise_card(m_river.group(1))]

        return BoardCards(flop=flop, turn=turn, river=river)

    def _parse_actions(
        self, text: str, hero_name: str, bb: float
    ) -> list[HandAction]:
        sections = {
            "preflop": self._extract_section(text, "HOLE CARDS", "FLOP"),
            "flop":    self._extract_section(text, "FLOP", "TURN"),
            "turn":    self._extract_section(text, "TURN", "RIVER"),
            "river":   self._extract_section(text, "RIVER", r"SHOW DOWN|SUMMARY"),
        }

        # Amount: optional $ prefix, digits and commas, optional decimals
        _AMT = r"\$?([0-9,]+(?:\.[0-9]+)?)"
        action_re = re.compile(
            rf"^(\S+): (folds|checks|calls|bets|raises)"
            rf"(?:\s+{_AMT})?"              # group 3: first amount
            rf"(?:\s+to\s+{_AMT})?"         # group 4: "to" total (raises)
            rf"(\s+and is all.in)?",         # group 5: all-in marker
            re.MULTILINE | re.IGNORECASE,
        )
        action_map = {
            "folds": "fold", "checks": "check", "calls": "call",
            "bets": "bet",   "raises": "raise",
        }

        actions: list[HandAction] = []
        for street, section in sections.items():
            if not section:
                continue
            for m in action_re.finditer(section):
                player = m.group(1)
                raw_action = m.group(2).lower()
                # Prefers "to X" total for raises; falls back to first amount
                amount_str = m.group(4) or m.group(3)
                is_all_in = bool(m.group(5))
                amount: float | None = None
                if amount_str and bb:
                    amount = round(float(amount_str.replace(",", "")) / bb, 2)
                actions.append(HandAction(
                    street=street,
                    player=player,
                    action=action_map[raw_action],
                    size_bb=amount,
                    is_hero=(player == hero_name),
                    is_all_in=is_all_in,
                ))
        return actions

    def _extract_section(self, text: str, start: str, end: str) -> str:
        pattern = rf"\*\*\* {start} \*\*\*(.*?)(?:\*\*\* (?:{end})|$)"
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        return m.group(1) if m else ""

    def _sum_antes(self, text: str, bb: float) -> float:
        total = 0.0
        for m in re.finditer(
            r":\s*posts (?:the )?ante\s+\$?([\d,]+(?:\.[0-9]+)?)",
            text, re.IGNORECASE,
        ):
            total += float(m.group(1).replace(",", "")) / bb
        return total

    def _calc_effective_stack(
        self, players: list[PlayerInfo], hero_name: str
    ) -> float:
        hero_stack = next(
            (p.stack_bb for p in players if p.name == hero_name), 100.0
        )
        other_stacks = [p.stack_bb for p in players if p.name != hero_name]
        if not other_stacks:
            return hero_stack
        return round(min(hero_stack, min(other_stacks)), 1)
