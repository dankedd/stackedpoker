"""
Base parser: abstract base class plus all site-agnostic helpers.

Design principles:
  - All shared regex logic lives here; parsers only override site-specific
    methods (can_parse, _parse_hand_id, _parse_stakes, _parse_button_seat).
  - _extract_section handles both * SECTION * and *** SECTION *** markers.
  - _parse_board uses the same flexible marker pattern.
  - _parse_actions uses SHOW\\s*DOWN to match GGPoker (SHOWDOWN) and
    PokerStars (SHOW DOWN) equally.
  - _recover_actions_from_text is the fallback street-landmark parser used
    when section extraction returns empty strings.
  - _build_diagnostics produces a ParseDiagnostics object attached to every
    ParsedHand so failures are never silent.
"""
import re
import logging
from abc import ABC, abstractmethod
from app.models.schemas import (
    ParsedHand, BoardCards, PlayerInfo, HandAction, ParseDiagnostics,
)
# Single source of truth for position tables — defined in position_engine, re-exported here
from app.services.position_engine import POSITIONS_BY_COUNT as POSITIONS_BY_SIZE  # noqa: F401

_log = logging.getLogger(__name__)

# Shared card token
_CARD = r"[2-9TJQKAtjqka][cdhs]"


def derive_positions(
    occupied_seats: list[int],
    button_seat: int,
    table_max_seats: int,
) -> dict[int, str]:
    """Map occupied seat numbers → position strings using clockwise topology."""
    all_seats = list(range(1, table_max_seats + 1))
    btn_idx = all_seats.index(button_seat) if button_seat in all_seats else 0
    cw_all = all_seats[btn_idx:] + all_seats[:btn_idx]
    occupied_set = set(occupied_seats)
    cw_occupied = [s for s in cw_all if s in occupied_set]
    n = len(cw_occupied)
    pos_list = POSITIONS_BY_SIZE.get(n, [f"P{i}" for i in range(n)])
    return {seat: pos_list[i] for i, seat in enumerate(cw_occupied)}


# ── Abstract base ──────────────────────────────────────────────────────────────

class BaseParser(ABC):
    """Abstract base for site-specific hand history parsers.

    Subclasses must implement:
        can_parse(text)          – format detection
        _parse_hand_id(text)     – site-specific hand ID regex
        _parse_stakes(text)      – site-specific stakes extraction
        _parse_button_seat(text) – site-specific button line regex
        parse(text)              – full parse calling shared helpers
    """

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """Return True if this parser recognises the hand history format."""

    @abstractmethod
    def parse(self, text: str) -> ParsedHand:
        """Parse raw hand history text into a normalised ParsedHand object."""

    # ── Card utilities ─────────────────────────────────────────────────────

    RANK_ORDER = {r: i for i, r in enumerate("23456789TJQKA", 2)}

    def _card_rank(self, card: str) -> str:
        return card[0].upper()

    def _card_suit(self, card: str) -> str:
        return card[1].lower()

    def _rank_value(self, card: str) -> int:
        return self.RANK_ORDER.get(self._card_rank(card), 0)

    def _normalise_card(self, card: str) -> str:
        """Ensure card string is in standard form, e.g. 'Ah', 'Td'."""
        if len(card) != 2:
            raise ValueError(f"Invalid card: {card!r}")
        rank = card[0].upper()
        suit = card[1].lower()
        if rank not in self.RANK_ORDER:
            raise ValueError(f"Invalid rank in card: {card!r}")
        if suit not in "cdhs":
            raise ValueError(f"Invalid suit in card: {card!r}")
        return rank + suit

    # ── Section extraction ─────────────────────────────────────────────────

    def _extract_section(self, text: str, start: str, end: str) -> str:
        """Extract text between section markers.

        Handles both * SECTION * (single-star, some GGPoker clients) and
        *** SECTION *** (triple-star, PokerStars and newer GGPoker) formats.
        \\Z anchors to real end-of-string (not affected by re.MULTILINE).
        """
        pattern = rf"\*{{1,3}}\s*{start}\s*\*{{1,3}}(.*?)(?:\*{{1,3}}\s*(?:{end})|\Z)"
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1)
        _log.debug("_extract_section: no match — start=%r end=%r", start, end)
        return ""

    # ── Board parsing ──────────────────────────────────────────────────────

    def _parse_board(self, text: str) -> BoardCards:
        """Parse community cards.

        Handles both * SECTION * and *** SECTION *** markers.
        Also handles run-it-twice (takes the first run's board).
        """
        # Open marker: stars + optional trailing space
        # Close marker: optional leading space + stars
        # Together they match both "* FLOP *" and "*** FLOP ***"
        _O = r"\*{1,3}\s*"   # open:  stars then optional spaces
        _C = r"\s*\*{1,3}"   # close: optional spaces then stars

        flop: list[str] = []
        turn: list[str] = []
        river: list[str] = []

        m_flop = re.search(
            rf"{_O}FLOP{_C}[^[]*\[({_CARD})\s+({_CARD})\s+({_CARD})\]",
            text, re.IGNORECASE,
        )
        if m_flop:
            flop = [
                self._normalise_card(m_flop.group(1)),
                self._normalise_card(m_flop.group(2)),
                self._normalise_card(m_flop.group(3)),
            ]
        else:
            _log.debug("_parse_board: no FLOP found")

        m_turn = re.search(
            rf"{_O}TURN{_C}\s*\[[^\]]+\]\s*\[({_CARD})\]",
            text, re.IGNORECASE,
        )
        if m_turn:
            turn = [self._normalise_card(m_turn.group(1))]
        else:
            _log.debug("_parse_board: no TURN found")

        m_river = re.search(
            rf"{_O}RIVER{_C}\s*\[[^\]]+\]\s*\[({_CARD})\]",
            text, re.IGNORECASE,
        )
        if m_river:
            river = [self._normalise_card(m_river.group(1))]
        else:
            _log.debug("_parse_board: no RIVER found")

        _log.debug("_parse_board: flop=%s turn=%s river=%s", flop, turn, river)
        return BoardCards(flop=flop, turn=turn, river=river)

    # ── Action parsing ─────────────────────────────────────────────────────

    def _parse_actions(
        self, text: str, hero_name: str, bb: float
    ) -> list[HandAction]:
        """Parse all actions across all streets.

        Uses SHOW\\s*DOWN to match both GGPoker (SHOWDOWN) and
        PokerStars (SHOW DOWN) section terminators.
        """
        sections = {
            "preflop": self._extract_section(text, "HOLE CARDS", "FLOP"),
            "flop":    self._extract_section(text, "FLOP", "TURN"),
            "turn":    self._extract_section(text, "TURN", "RIVER"),
            "river":   self._extract_section(text, "RIVER", r"SHOW\s*DOWN|SUMMARY"),
        }

        _log.debug(
            "_parse_actions: section lengths — preflop=%d flop=%d turn=%d river=%d",
            len(sections["preflop"]), len(sections["flop"]),
            len(sections["turn"]),   len(sections["river"]),
        )

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
                _log.debug("_parse_actions: skipping empty section — street=%r", street)
                continue
            street_count = 0
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
                street_count += 1
            _log.debug(
                "_parse_actions: street=%r → %d action(s)", street, street_count
            )

        _log.debug("_parse_actions: total=%d actions for hero=%r", len(actions), hero_name)
        return actions

    # ── Seat / position helpers ────────────────────────────────────────────

    def _parse_seats(self, text: str, bb: float) -> list[dict]:
        """Parse 'Seat N: Name (X in chips)' lines. Handles $ prefix or bare numbers."""
        seats = []
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
        # If button_seat isn't occupied, snap to nearest clockwise occupied seat
        if button_seat not in occupied and occupied:
            all_seats = list(range(1, table_max_seats + 1))
            btn_idx = all_seats.index(button_seat) if button_seat in all_seats else 0
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
        """Parse 'Dealt to PlayerName [Xh Yc]' line. Supports 2-card and 4-card hands."""
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

    def _sum_antes(self, text: str, bb: float) -> float:
        """Sum all antes posted in the hand (in BB units)."""
        total = 0.0
        for m in re.finditer(
            r":\s*posts (?:the )?ante\s+\$?([\d,]+(?:\.[0-9]+)?)",
            text, re.IGNORECASE,
        ):
            total += float(m.group(1).replace(",", "")) / bb
        return total

    # ── Recovery parsing ───────────────────────────────────────────────────

    def _recover_actions_from_text(
        self, text: str, hero_name: str, bb: float
    ) -> list[HandAction]:
        """Fallback line-by-line action recovery used when section extraction fails.

        Scans every line for action patterns and infers street from nearby
        landmark lines (HOLE CARDS, FLOP, TURN, RIVER). Used when the primary
        _extract_section regex returns empty strings (unknown header format).
        """
        _AMT = r"\$?([0-9,]+(?:\.[0-9]+)?)"
        action_re = re.compile(
            rf"^(\S+): (folds|checks|calls|bets|raises)"
            rf"(?:\s+{_AMT})?"
            rf"(?:\s+to\s+{_AMT})?"
            rf"(\s+and is all.in)?",
            re.IGNORECASE,
        )
        action_map = {
            "folds": "fold", "checks": "check", "calls": "call",
            "bets": "bet",   "raises": "raise",
        }
        STREET_LANDMARKS = [
            (re.compile(r"hole\s+cards", re.IGNORECASE), "preflop"),
            (re.compile(r"\bflop\b", re.IGNORECASE), "flop"),
            (re.compile(r"\bturn\b", re.IGNORECASE), "turn"),
            (re.compile(r"\briver\b", re.IGNORECASE), "river"),
        ]
        STOP_PATTERN = re.compile(r"show\s*down|summary|collected|won\s+\$", re.IGNORECASE)

        current_street = "preflop"
        actions: list[HandAction] = []

        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if STOP_PATTERN.search(stripped):
                break
            for pattern, street in STREET_LANDMARKS:
                if pattern.search(stripped):
                    current_street = street
                    break
            m = action_re.match(stripped)
            if m:
                player = m.group(1)
                raw_action = m.group(2).lower()
                amount_str = m.group(4) or m.group(3)
                is_all_in = bool(m.group(5))
                amount: float | None = None
                if amount_str and bb:
                    amount = round(float(amount_str.replace(",", "")) / bb, 2)
                actions.append(HandAction(
                    street=current_street,
                    player=player,
                    action=action_map[raw_action],
                    size_bb=amount,
                    is_hero=(player == hero_name),
                    is_all_in=is_all_in,
                ))

        _log.debug("_recover_actions_from_text: recovered %d action(s)", len(actions))
        return actions

    # ── Diagnostics ────────────────────────────────────────────────────────

    def _build_diagnostics(
        self,
        text: str,
        actions: list[HandAction],
        board: BoardCards,
        hero_cards: list[str],
        recovered_actions: int = 0,
    ) -> ParseDiagnostics:
        """Build a ParseDiagnostics describing what was and wasn't found."""
        SECTION_NAMES = ["HOLE CARDS", "FLOP", "TURN", "RIVER", "SHOWDOWN", "SUMMARY"]
        found = []
        missing = []
        for name in SECTION_NAMES:
            if re.search(rf"\*{{1,3}}\s*{name}\s*\*{{1,3}}", text, re.IGNORECASE):
                found.append(name)
            else:
                missing.append(name)

        board_cards_parsed = len(board.flop) + len(board.turn) + len(board.river)
        warnings: list[str] = []
        errors: list[str] = []

        if not actions:
            errors.append(
                "No actions parsed — hand may be truncated or in an unsupported format"
            )
        if not hero_cards:
            warnings.append("Hero cards not found")
        if "HOLE CARDS" not in found:
            errors.append(
                "HOLE CARDS section not found — preflop actions may be missing"
            )
        if board_cards_parsed == 0 and "FLOP" in found:
            warnings.append("FLOP section found but no board cards parsed")
        if recovered_actions > 0:
            warnings.append(
                f"Recovery parser used: {recovered_actions} action(s) recovered from raw text"
            )

        return ParseDiagnostics(
            sections_found=found,
            sections_missing=missing,
            actions_parsed=len(actions),
            board_cards_parsed=board_cards_parsed,
            hero_cards_found=bool(hero_cards),
            recovered_actions=recovered_actions,
            warnings=warnings,
            errors=errors,
            is_partial=bool(errors) or recovered_actions > 0,
        )
