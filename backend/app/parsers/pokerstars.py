import re
from app.parsers.base import BaseParser, derive_positions
from app.models.schemas import (
    ParsedHand, BoardCards, PlayerInfo, HandAction
)


class PokerStarsParser(BaseParser):
    """Parser for PokerStars hand history format."""

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r"PokerStars (Hand|Game) #\d+", text))

    def parse(self, text: str) -> ParsedHand:
        hand_id = self._parse_hand_id(text)
        stakes, sb, bb = self._parse_stakes(text)
        game_type = "NLHE"
        site = "PokerStars"

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
        pot_size_bb = self._calc_pot(actions, sb, bb)

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
        m = re.search(r"PokerStars (?:Hand|Game) #(\d+)", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # Cash game: ($0.01/$0.02 USD) — dollar signs required
        m = re.search(r"\(\$([0-9.]+)/\$([0-9.]+)(?:\s+\w+)?\)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            return f"{m.group(1)}/{m.group(2)}", sb, bb
        # Tournament: Level I (10/20) or (1,000/2,000) — no dollar signs
        m = re.search(r"\(([\d,]+)/([\d,]+)[^)]*\)", text)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                return f"T{int(sb)}/{int(bb)}", sb, bb
        # Fallback: extract from posted blind actions
        m_bb = re.search(r": posts big blind \$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        m_sb = re.search(r": posts small blind \$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1).replace(",", ""))
            sb = float(m_sb.group(1).replace(",", "")) if m_sb else bb / 2
            if bb > 0:
                return f"T{int(sb)}/{int(bb)}", sb, bb
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat(self, text: str) -> int:
        m = re.search(r"Seat #(\d+) is the Button", text, re.IGNORECASE)
        return int(m.group(1)) if m else 1

    def _parse_seats(self, text: str, bb: float) -> list[dict]:
        seats = []
        for m in re.finditer(
            r"Seat (\d+): (\S+) \(\$([0-9.]+) in chips\)", text
        ):
            seats.append({
                "seat": int(m.group(1)),
                "name": m.group(2),
                "stack": float(m.group(3)),
                "stack_bb": round(float(m.group(3)) / bb, 2),
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
        m = re.search(
            r"Dealt to (\S+) \[([2-9TJQKAtjqka][cdhs]) ([2-9TJQKAtjqka][cdhs])\]",
            text,
        )
        if m:
            return m.group(1), [
                self._normalise_card(m.group(2)),
                self._normalise_card(m.group(3)),
            ]
        return "Hero", []

    def _parse_board(self, text: str) -> BoardCards:
        flop = turn = river = []

        m_flop = re.search(
            r"\*\*\* FLOP \*\*\*[^[]*\[([2-9TJQKAtjqka][cdhs]) ([2-9TJQKAtjqka][cdhs]) ([2-9TJQKAtjqka][cdhs])\]",
            text,
        )
        if m_flop:
            flop = [
                self._normalise_card(m_flop.group(i)) for i in range(1, 4)
            ]

        m_turn = re.search(
            r"\*\*\* TURN \*\*\* \[.*?\] \[([2-9TJQKAtjqka][cdhs])\]", text
        )
        if m_turn:
            turn = [self._normalise_card(m_turn.group(1))]

        m_river = re.search(
            r"\*\*\* RIVER \*\*\* \[.*?\] \[([2-9TJQKAtjqka][cdhs])\]", text
        )
        if m_river:
            river = [self._normalise_card(m_river.group(1))]

        return BoardCards(flop=flop, turn=turn, river=river)

    def _parse_actions(self, text: str, hero_name: str, bb: float) -> list[HandAction]:
        sections = {
            "preflop": self._extract_section(text, "HOLE CARDS", "FLOP"),
            "flop": self._extract_section(text, "FLOP", "TURN"),
            "turn": self._extract_section(text, "TURN", "RIVER"),
            "river": self._extract_section(text, "RIVER", "SHOW DOWN|SUMMARY"),
        }

        actions = []
        action_re = re.compile(
            r"^(\S+): (folds|checks|calls|bets|raises)(?: \$([0-9.]+))?(?: to \$([0-9.]+))?",
            re.MULTILINE,
        )

        for street, section in sections.items():
            if not section:
                continue
            for m in action_re.finditer(section):
                player = m.group(1)
                raw_action = m.group(2)
                amount_str = m.group(4) or m.group(3)
                amount = float(amount_str) / bb if amount_str else None

                action_map = {
                    "folds": "fold",
                    "checks": "check",
                    "calls": "call",
                    "bets": "bet",
                    "raises": "raise",
                }
                actions.append(HandAction(
                    street=street,
                    player=player,
                    action=action_map[raw_action],
                    size_bb=round(amount, 2) if amount else None,
                    is_hero=(player == hero_name),
                ))
        return actions

    def _extract_section(self, text: str, start: str, end: str) -> str:
        pattern = rf"\*\*\* {start} \*\*\*(.*?)(?:\*\*\* {end}|$)"
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        return m.group(1) if m else ""

    def _calc_effective_stack(self, players: list[PlayerInfo], hero_name: str) -> float:
        hero_stack = next((p.stack_bb for p in players if p.name == hero_name), 100.0)
        other_stacks = [p.stack_bb for p in players if p.name != hero_name]
        if not other_stacks:
            return hero_stack
        return round(min(hero_stack, min(other_stacks)), 1)

    def _calc_pot(self, actions: list[HandAction], sb: float, bb: float) -> float:
        total = sb / bb + 1.0
        for a in actions:
            if a.action in ("call", "bet", "raise") and a.size_bb:
                total += a.size_bb
        return round(total, 2)
