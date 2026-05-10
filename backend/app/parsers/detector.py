from app.parsers.base import BaseParser
from app.parsers.ggpoker import GGPokerParser
from app.parsers.pokerstars import PokerStarsParser


_PARSERS: list[BaseParser] = [
    GGPokerParser(),
    PokerStarsParser(),
]


def detect_and_parse(text: str):
    """Detect site and return parsed hand, or raise ValueError if unrecognised."""
    for parser in _PARSERS:
        if parser.can_parse(text):
            return parser.parse(text)
    raise ValueError(
        "Unrecognised hand history format. "
        "Currently GGPoker and PokerStars are supported."
    )
