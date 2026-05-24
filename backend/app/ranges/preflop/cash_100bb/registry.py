"""
Range registry for 100bb cash game.

Single lookup point for all preflop ranges.
Ranges are built lazily and cached on first access.
"""
from __future__ import annotations

from functools import lru_cache

from app.ranges.models import PreflopRange
from app.ranges.parser import parse_range_list

from app.ranges.preflop.cash_100bb.open_ranges import (
    UTG_OPEN, HJ_OPEN, CO_OPEN, BTN_OPEN, SB_OPEN,
)
from app.ranges.preflop.cash_100bb.defend_ranges import (
    BB_VS_BTN_DEFEND, BB_VS_CO_DEFEND, BB_VS_SB_DEFEND, BB_VS_UTG_DEFEND,
)
from app.ranges.preflop.cash_100bb.threebet_ranges import (
    SB_3BET_VS_BTN,
    BB_3BET_VS_BTN, BB_3BET_VS_CO,
    BTN_3BET_VS_CO, BTN_3BET_VS_SB,
    CO_3BET_VS_BTN,
)


# ── Registry definition ────────────────────────────────────────────────────────
# Maps range keys → (position, action, raw_list)

_DEFINITIONS: dict[str, tuple[str, str, list[str]]] = {
    # Open ranges
    "UTG_OPEN":    ("UTG",  "open",   UTG_OPEN),
    "HJ_OPEN":     ("HJ",   "open",   HJ_OPEN),
    "CO_OPEN":     ("CO",   "open",   CO_OPEN),
    "BTN_OPEN":    ("BTN",  "open",   BTN_OPEN),
    "SB_OPEN":     ("SB",   "open",   SB_OPEN),

    # BB defend (call) ranges
    "BB_VS_BTN_DEFEND":  ("BB", "defend", BB_VS_BTN_DEFEND),
    "BB_VS_CO_DEFEND":   ("BB", "defend", BB_VS_CO_DEFEND),
    "BB_VS_SB_DEFEND":   ("BB", "defend", BB_VS_SB_DEFEND),
    "BB_VS_UTG_DEFEND":  ("BB", "defend", BB_VS_UTG_DEFEND),

    # 3-bet ranges
    "SB_3BET_VS_BTN":  ("SB",  "3bet", SB_3BET_VS_BTN),
    "BB_3BET_VS_BTN":  ("BB",  "3bet", BB_3BET_VS_BTN),
    "BB_3BET_VS_CO":   ("BB",  "3bet", BB_3BET_VS_CO),
    "BTN_3BET_VS_CO":  ("BTN", "3bet", BTN_3BET_VS_CO),
    "BTN_3BET_VS_SB":  ("BTN", "3bet", BTN_3BET_VS_SB),
    "CO_3BET_VS_BTN":  ("CO",  "3bet", CO_3BET_VS_BTN),
}


@lru_cache(maxsize=None)
def get_range(key: str) -> PreflopRange:
    """
    Return a PreflopRange by key. Cached after first build.

    Keys: "UTG_OPEN", "BB_VS_BTN_DEFEND", "SB_3BET_VS_BTN", etc.
    Raises KeyError if key is not registered.
    """
    if key not in _DEFINITIONS:
        available = ", ".join(sorted(_DEFINITIONS.keys()))
        raise KeyError(f"Unknown range key {key!r}. Available: {available}")

    position, action, raw_list = _DEFINITIONS[key]
    combos = parse_range_list(raw_list)

    return PreflopRange(
        name=key,
        position=position,
        action=action,
        stack_depth="100bb",
        combos=combos,
        metadata={"source": "cash_100bb", "key": key},
    )


def list_ranges() -> list[str]:
    """Return all registered range keys."""
    return sorted(_DEFINITIONS.keys())


# Convenience alias
REGISTRY = {key: get_range(key) for key in _DEFINITIONS}
