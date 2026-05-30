"""
Generic hand history parser — deterministic fallback for unrecognised formats.

Strategy:
  1. Try to find common patterns present in almost all poker clients.
  2. Use line-by-line scanning when section markers are absent.
  3. Produce a ParsedHand with partial/unknown fields rather than failing.
  4. Always set parse_diagnostics.is_partial=True so the validator applies
     stricter rules and confidence is adjusted accordingly.

This parser deliberately trades strict site-specific regex for broad coverage.
"""
import re
import logging
from app.parsers.base import BaseParser
from app.models.schemas import ParsedHand, BoardCards, HandAction
from app.engines.pot_engine import compute_final_pot

_log = logging.getLogger(__name__)

_CARD = r"[2-9TJQKAtjqka][cdhs]"


class GenericParser(BaseParser):
    """Fallback parser accepting any text that looks like a poker hand."""

    def can_parse(self, text: str) -> bool:
        """Accept anything that has at least two of: cards, bet amounts, street keywords."""
        has_cards = bool(re.search(rf"\b{_CARD}\b", text))
        has_street = bool(re.search(r"\b(preflop|flop|turn|river|hole cards)\b", text, re.IGNORECASE))
        has_action = bool(re.search(r"\b(folds|checks|calls|bets|raises)\b", text, re.IGNORECASE))
        score = int(has_cards) + int(has_street) + int(has_action)
        return score >= 2

    def parse(self, text: str) -> ParsedHand:
        hand_id = self._parse_hand_id_generic(text)
        stakes, sb, bb = self._parse_stakes_generic(text)
        game_type = "NLHE"

        pos_warnings: list[str] = []

        table_max_seats = self._parse_table_max_seats(text)
        players_raw = self._parse_seats_generic(text, bb)
        raw_button = self._parse_button_seat_generic(text)
        button_seat, button_found = self._resolve_button_seat(
            raw_button, players_raw, pos_warnings,
        )
        btn_occupied = button_seat in [s["seat"] for s in players_raw] if players_raw else False
        players = self._assign_positions(
            players_raw, button_seat, table_max_seats, pos_warnings,
        ) if players_raw else []

        hero_name, hero_cards = self._parse_hero_cards_generic(text)
        hero_position = self._resolve_hero_position(players, hero_name, pos_warnings)
        hero_found = hero_position != "UNKNOWN"

        board = self._parse_board_generic(text)
        actions = self._recover_actions_from_text(text, hero_name, bb)

        effective_stack = (
            self._calc_effective_stack(players, hero_name)
            if players else 100.0
        )
        sb_bb = sb / bb if bb else 0.5
        sb_name = next((p.name for p in players if p.position == "SB"), "")
        bb_name = next((p.name for p in players if p.position == "BB"), "")
        pot_size_bb = compute_final_pot(
            actions, sb_bb, 1.0, 0.0,
            sb_player=sb_name, bb_player=bb_name,
        )

        pos_valid = self._validate_blind_positions(text, players, pos_warnings)

        diagnostics = self._build_diagnostics(
            text, actions, board, hero_cards, len(actions),
            extra_warnings=pos_warnings,
            button_found=button_found,
            button_seat_occupied=btn_occupied,
            hero_found=hero_found,
            position_validation_passed=pos_valid,
        )

        return ParsedHand(
            site="Unknown",
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

    # ── Generic helpers ─────────────────────────────────────────────────────

    def _parse_hand_id_generic(self, text: str) -> str:
        # Any "Hand #N", "Game #N", "Hand N", "#N" pattern
        for pattern in [
            r"[Hh]and\s*#?(\d{5,})",
            r"[Gg]ame\s*#?(\d{5,})",
            r"#(\d{7,})",
        ]:
            m = re.search(pattern, text)
            if m:
                return m.group(1)
        return "generic_unknown"

    def _parse_stakes_generic(self, text: str) -> tuple[str, float, float]:
        """Try multiple patterns to find blinds."""
        # Dollar amounts in slash notation
        m = re.search(r"\$?([\d.]+)\s*/\s*\$?([\d.]+)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            if 0 < sb < bb:
                return f"{m.group(1)}/{m.group(2)}", sb, bb

        # From blind posting lines
        m_bb = re.search(r"big blind[^$\d]*\$?([\d.]+)", text, re.IGNORECASE)
        m_sb = re.search(r"small blind[^$\d]*\$?([\d.]+)", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1))
            sb = float(m_sb.group(1)) if m_sb else bb / 2
            if bb > 0:
                return f"{sb}/{bb}", sb, bb

        # Chips in parentheses: "(500/1000)"
        m = re.search(r"\(([\d,]+)/([\d,]+)\)", text)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if 0 < sb < bb:
                return f"T{int(sb)}/{int(bb)}", sb, bb

        _log.debug("GenericParser: all stake patterns failed")
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat_generic(self, text: str) -> int | None:
        for pattern in [
            r"[Ss]eat\s*#?(\d+)\s+is\s+the\s+[Bb]utton",
            r"[Ss]eat\s*#?(\d+)\s+[Bb]utton",
            r"[Bb]utton.*?[Ss]eat\s*#?(\d+)",
        ]:
            m = re.search(pattern, text)
            if m:
                return int(m.group(1))
        return None

    def _parse_seats_generic(self, text: str, bb: float) -> list[dict]:
        """Try to parse seat lines in various formats."""
        seats = []
        # Standard: "Seat N: Name (X in chips)" or "Seat N: Name ($X)"
        for m in re.finditer(
            r"Seat\s+(\d+)\s*:\s+(\S+)\s+\(\s*\$?([\d,]+(?:\.\d+)?)\s*(?:in\s+chips)?\s*(?:USD|EUR|GBP)?\s*\)",
            text,
        ):
            stack = float(m.group(3).replace(",", ""))
            seats.append({
                "seat": int(m.group(1)),
                "name": m.group(2),
                "stack": stack,
                "stack_bb": round(stack / bb, 2) if bb else 0.0,
            })
        if seats:
            return seats
        # Fallback: "Seat N - Name - X"
        for m in re.finditer(r"Seat\s+(\d+)\s*[-:]\s+(\S+)\s*[-:]\s*([\d,]+(?:\.\d+)?)", text):
            stack = float(m.group(3).replace(",", ""))
            seats.append({
                "seat": int(m.group(1)),
                "name": m.group(2),
                "stack": stack,
                "stack_bb": round(stack / bb, 2) if bb else 0.0,
            })
        return seats

    def _parse_hero_cards_generic(self, text: str) -> tuple[str, list[str]]:
        """Try several hero-card patterns."""
        # "Dealt to Name [Ah Kd]"
        m = re.search(
            rf"Dealt to (\S+)\s+\[({_CARD})\s+({_CARD})\]",
            text,
        )
        if m:
            c1 = m.group(2)[0].upper() + m.group(2)[1].lower()
            c2 = m.group(3)[0].upper() + m.group(3)[1].lower()
            return m.group(1), [c1, c2]
        # "Hero [Ah Kd]" or "Hero: [Ah Kd]"
        m = re.search(
            rf"(\S+)\s*:?\s+\[({_CARD})[,\s]+({_CARD})\]",
            text,
        )
        if m:
            c1 = m.group(2)[0].upper() + m.group(2)[1].lower()
            c2 = m.group(3)[0].upper() + m.group(3)[1].lower()
            return m.group(1), [c1, c2]
        return "Hero", []

    def _parse_board_generic(self, text: str) -> BoardCards:
        """Try standard board patterns then fall back to positional heuristics."""
        # Standard *** FLOP *** format handled by base _parse_board
        board = self._parse_board(text)
        if board.flop:
            return board
        # Winamax-style "Board: [cards]"
        board_m = re.search(r"[Bb]oard\s*:\s*(.*)", text)
        if board_m:
            all_cards = re.findall(rf"\b({_CARD})\b", board_m.group(1))
            if len(all_cards) >= 3:
                flop = [_norm(c) for c in all_cards[:3]]
                turn = [_norm(all_cards[3])] if len(all_cards) > 3 else []
                river = [_norm(all_cards[4])] if len(all_cards) > 4 else []
                return BoardCards(flop=flop, turn=turn, river=river)
        return board

    # Override to use base implementations for these:
    def _parse_hand_id(self, text: str) -> str:
        return self._parse_hand_id_generic(text)

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        return self._parse_stakes_generic(text)

    def _parse_button_seat(self, text: str) -> int:
        return self._parse_button_seat_generic(text)


def _norm(card: str) -> str:
    return card[0].upper() + card[1].lower()
