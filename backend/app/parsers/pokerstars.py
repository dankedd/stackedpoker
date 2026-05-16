"""
PokerStars hand history parser — deterministic, regex-based.

Chip convention (same as GGPoker parser):
  raises:  size_bb = "to" total
  calls:   size_bb = additional
  bets:    size_bb = bet amount

Site-specific methods only — all shared logic lives in BaseParser.
"""
import re
import logging
from app.parsers.base import BaseParser
from app.models.schemas import ParsedHand
from app.engines.pot_engine import compute_final_pot

_log = logging.getLogger(__name__)


class PokerStarsParser(BaseParser):
    """Parser for PokerStars hand history format (cash and tournament)."""

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r"PokerStars (?:Hand|Game) #\d+", text))

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

        # Recovery mode: if primary parsing found no actions, fall back to
        # line-by-line scanner which works even with unknown header formats.
        recovered = 0
        if not actions:
            _log.warning(
                "PS %s: primary action parsing found 0 actions — attempting recovery",
                hand_id,
            )
            actions = self._recover_actions_from_text(text, hero_name, bb)
            recovered = len(actions)
            if not actions:
                _log.error("PS %s: recovery also found 0 actions", hand_id)

        effective_stack = self._calc_effective_stack(players, hero_name)
        sb_bb = sb / bb
        sb_name = next((p.name for p in players if p.position == "SB"), "")
        bb_name = next((p.name for p in players if p.position == "BB"), "")
        pot_size_bb = compute_final_pot(
            actions, sb_bb, 1.0, 0.0,
            sb_player=sb_name, bb_player=bb_name,
        )

        diagnostics = self._build_diagnostics(text, actions, board, hero_cards, recovered)
        _log.debug(
            "PS %s diagnostics: found=%s missing=%s actions=%d board=%d recovered=%d",
            hand_id,
            diagnostics.sections_found,
            diagnostics.sections_missing,
            diagnostics.actions_parsed,
            diagnostics.board_cards_parsed,
            diagnostics.recovered_actions,
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
            parse_diagnostics=diagnostics,
        )

    # ── PokerStars-specific helpers ────────────────────────────────────────

    def _parse_hand_id(self, text: str) -> str:
        m = re.search(r"PokerStars (?:Hand|Game) #(\d+)", text)
        return m.group(1) if m else "unknown"

    def _parse_stakes(self, text: str) -> tuple[str, float, float]:
        # 1. Cash: ($0.01/$0.02 USD) — dollar signs required
        m = re.search(r"\(\$([0-9.]+)/\$([0-9.]+)(?:\s+\w+)?\)", text)
        if m:
            sb, bb = float(m.group(1)), float(m.group(2))
            return f"{m.group(1)}/{m.group(2)}", sb, bb

        # 2. Tournament Level header: Level I (10/20), Level X (1,000/2,000)
        m = re.search(r"Level\s+\w+\s*\(([\d,]+)/([\d,]+)", text, re.IGNORECASE)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                _log.debug("PS stakes (level header): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        # 3. Posted blind lines
        m_bb = re.search(r":\s*posts big blind\s+\$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        m_sb = re.search(r":\s*posts small blind\s+\$?([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
        if m_bb:
            bb = float(m_bb.group(1).replace(",", ""))
            sb = float(m_sb.group(1).replace(",", "")) if m_sb else bb / 2
            if bb > 0:
                _log.debug("PS stakes (posted blinds): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        # 4. Generic parentheses — last resort
        m = re.search(r"\(([\d,]+)/([\d,]+)[^)]*\)", text)
        if m:
            sb = float(m.group(1).replace(",", ""))
            bb = float(m.group(2).replace(",", ""))
            if bb > 0:
                _log.debug("PS stakes (parens): sb=%s bb=%s", sb, bb)
                return f"T{int(sb)}/{int(bb)}", sb, bb

        _log.warning("PS stakes: all patterns failed for: %r", text[:120])
        return "0.5/1", 0.5, 1.0

    def _parse_button_seat(self, text: str) -> int:
        m = re.search(r"Seat #(\d+) is the Button", text, re.IGNORECASE)
        return int(m.group(1)) if m else 1
