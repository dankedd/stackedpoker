from abc import ABC, abstractmethod
from app.models.schemas import ParsedHand

# Clockwise from BTN (index 0 = BTN). Mirrors frontend positions.ts exactly.
POSITIONS_BY_SIZE: dict[int, list[str]] = {
    2: ["BTN", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["BTN", "SB", "BB", "UTG"],
    5: ["BTN", "SB", "BB", "UTG", "CO"],
    6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
    7: ["BTN", "SB", "BB", "UTG", "LJ", "HJ", "CO"],
    8: ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"],
    9: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"],
}


def derive_positions(
    occupied_seats: list[int],
    button_seat: int,
    table_max_seats: int,
) -> dict[int, str]:
    """Map occupied seat numbers → position strings using clockwise topology.

    Works correctly for partial tables (seats skipped due to empty chairs).
    Position names are drawn from POSITIONS_BY_SIZE[n_occupied].
    """
    all_seats = list(range(1, table_max_seats + 1))
    btn_idx = all_seats.index(button_seat) if button_seat in all_seats else 0
    cw_all = all_seats[btn_idx:] + all_seats[:btn_idx]
    occupied_set = set(occupied_seats)
    cw_occupied = [s for s in cw_all if s in occupied_set]
    n = len(cw_occupied)
    pos_list = POSITIONS_BY_SIZE.get(n, [f"P{i}" for i in range(n)])
    return {seat: pos_list[i] for i, seat in enumerate(cw_occupied)}


class BaseParser(ABC):
    """Abstract base for site-specific hand history parsers."""

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """Return True if this parser recognises the hand history format."""

    @abstractmethod
    def parse(self, text: str) -> ParsedHand:
        """Parse raw hand history text into a normalised ParsedHand object."""

    # ── Shared card utilities ──────────────────────────────────────────────

    RANK_ORDER = {r: i for i, r in enumerate("23456789TJQKA", 2)}

    def _card_rank(self, card: str) -> str:
        return card[0].upper()

    def _card_suit(self, card: str) -> str:
        return card[1].lower()

    def _rank_value(self, card: str) -> int:
        return self.RANK_ORDER.get(self._card_rank(card), 0)

    def _normalise_card(self, card: str) -> str:
        """Ensure card string is in standard form e.g. 'Ah', 'Td'."""
        if len(card) != 2:
            raise ValueError(f"Invalid card: {card!r}")
        rank = card[0].upper()
        suit = card[1].lower()
        if rank not in self.RANK_ORDER:
            raise ValueError(f"Invalid rank in card: {card!r}")
        if suit not in "cdhs":
            raise ValueError(f"Invalid suit in card: {card!r}")
        return rank + suit
