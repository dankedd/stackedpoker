"""
Parser detector — auto-selects the correct site parser and falls back to generic.

Priority order:
  1. GGPoker    (most specific header pattern)
  2. PokerStars (second most common)
  3. Winamax    (European client)
  4. WPN        (Winning Poker Network)
  5. PartyPoker (legacy format)
  6. Generic    (broad fallback — always matches)

The generic parser is always the last resort: it sets parse_diagnostics.is_partial=True
so the validation layer applies appropriate confidence penalties.
"""
from app.parsers.base import BaseParser
from app.parsers.ggpoker import GGPokerParser
from app.parsers.pokerstars import PokerStarsParser
from app.parsers.winamax import WinamaxParser
from app.parsers.wpn import WPNParser
from app.parsers.partypoker import PartyPokerParser
from app.parsers.generic import GenericParser


_SITE_PARSERS: list[BaseParser] = [
    GGPokerParser(),
    PokerStarsParser(),
    WinamaxParser(),
    WPNParser(),
    PartyPokerParser(),
]

_GENERIC_PARSER = GenericParser()


def detect_and_parse(text: str):
    """Detect site and return a ParsedHand.

    Tries site-specific parsers in priority order.
    Falls back to GenericParser if none match.
    Never raises ValueError — unknown formats produce a partial ParsedHand
    with parse_diagnostics.is_partial=True.
    """
    for parser in _SITE_PARSERS:
        if parser.can_parse(text):
            return parser.parse(text)

    # Generic fallback always tries to extract something
    return _GENERIC_PARSER.parse(text)


def detect_site(text: str) -> str:
    """Return the detected site name without parsing the full hand."""
    for parser in _SITE_PARSERS:
        if parser.can_parse(text):
            name = type(parser).__name__.replace("Parser", "")
            return name
    return "Unknown"
