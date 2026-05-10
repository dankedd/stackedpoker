from abc import ABC, abstractmethod
from app.models.schemas import ParsedHand


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
