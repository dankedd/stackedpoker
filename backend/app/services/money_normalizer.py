"""
Deterministic monetary normalization for poker amounts.

Converts raw OCR text like "$1.23" or "3bb" into normalized big-blind
amounts using detected stakes (big blind value).

Entry points:
  parse_stakes(text)          -> StakesInfo | None
  parse_amount(text, stakes)  -> ParsedAmount | None
  validate_stack_bb(...)
  validate_pot_bb(...)
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# ── Currency symbol → ISO code ───────────────────────────────────────────────

_CURRENCY_SYMBOLS: dict[str, str] = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₩": "KRW",
}

# Any currency symbol as a character class for regex
_SYM_CLASS = r"[$€£¥₩]"


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class StakesInfo:
    small_blind: float
    big_blind: float
    currency: str       # "USD", "EUR", "" = unitless (bb-native)


@dataclass(frozen=True)
class ParsedAmount:
    raw_text: str
    numeric: float          # numeric value as extracted from the text
    amount_bb: float        # value normalized to big blinds
    amount_usd: float | None  # USD (or currency) value; None if already in bb
    currency: str           # "USD", "BB", "" — empty means unitless/bb
    display: str            # UI-ready: "$1.23 (61.5bb)" or "3bb" or "61.5bb"


# ── Stakes parsing ───────────────────────────────────────────────────────────

# Matches: [$€£¥₩]?<number> / [$€£¥₩]?<number>  (e.g. "$0.01/$0.02", "0.5/1")
_STAKES_RE = re.compile(
    rf"({_SYM_CLASS}?)\s*(\d+\.?\d*)\s*/\s*({_SYM_CLASS}?)\s*(\d+\.?\d*)",
    re.IGNORECASE,
)


def parse_stakes(text: str | None) -> StakesInfo | None:
    """
    Parse a stakes string into StakesInfo.

    Examples:
      "$0.01/$0.02 NL"  → StakesInfo(0.01, 0.02, "USD")
      "€0.50/€1"        → StakesInfo(0.50, 1.00, "EUR")
      "0.5/1"           → StakesInfo(0.50, 1.00, "")
      "NL100"           → None  (cannot determine big blind value)
    """
    if not text:
        return None

    m = _STAKES_RE.search(text)
    if not m:
        return None

    sym = m.group(1) or m.group(3)
    currency = _CURRENCY_SYMBOLS.get(sym, "")

    try:
        sb = float(m.group(2))
        bb = float(m.group(4))
    except ValueError:
        return None

    if bb <= 0:
        return None

    return StakesInfo(small_blind=sb, big_blind=bb, currency=currency)


# ── Amount parsing ───────────────────────────────────────────────────────────

# "3bb", "3.5BB", "3 BB"
_BB_SUFFIX_RE = re.compile(r"^({sym}?)\s*(\d+\.?\d*)\s*bb$".format(sym=_SYM_CLASS), re.IGNORECASE)

# "$1.23", "€0.50"
_CURRENCY_PREFIX_RE = re.compile(rf"^({_SYM_CLASS})\s*(\d+\.?\d*)")

# Bare number — possibly with comma decimal: "100", "3.5", "1,23"
_BARE_NUMERIC_RE = re.compile(r"(\d+[.,]\d+|\d+)")


def _fmt_bb(val: float) -> str:
    """Format a bb value for display (trim trailing .0)."""
    if val == int(val):
        return f"{int(val)}bb"
    return f"{val:.1f}bb"


def parse_amount(
    text: str | None,
    stakes: StakesInfo | None,
) -> ParsedAmount | None:
    """
    Parse a raw amount string into a fully normalized ParsedAmount.

    Resolution order:
      1. Explicit bb suffix  ("3bb", "3.5BB")    → native bb
      2. Currency prefix     ("$1.23", "€0.50")  → convert using stakes.big_blind
      3. Bare numeric        ("100", "3.5")       → treated as bb

    When a currency amount is seen but stakes is None, the numeric value is
    kept as-is in amount_bb with a warning embedded in display. This is a
    known-degraded mode — callers should always supply stakes when available.
    """
    if not text:
        return None

    t = text.strip()

    # ── 1. Explicit bb suffix ────────────────────────────────────────────
    m = _BB_SUFFIX_RE.match(t)
    if m:
        val = float(m.group(2))
        return ParsedAmount(
            raw_text=t,
            numeric=val,
            amount_bb=round(val, 4),
            amount_usd=None,
            currency="BB",
            display=_fmt_bb(val),
        )

    # ── 2. Currency prefix ───────────────────────────────────────────────
    m = _CURRENCY_PREFIX_RE.match(t)
    if m:
        sym = m.group(1)
        currency = _CURRENCY_SYMBOLS.get(sym, "")
        numeric = float(m.group(2))

        if stakes and stakes.big_blind > 0:
            bb_val = round(numeric / stakes.big_blind, 4)
            display = f"{sym}{numeric:.2f} ({_fmt_bb(bb_val)})"
        else:
            # Degraded mode: no stakes available — treat raw as bb (wrong but recoverable)
            bb_val = round(numeric, 4)
            display = f"{sym}{numeric:.2f} [bb?]"

        return ParsedAmount(
            raw_text=t,
            numeric=numeric,
            amount_bb=bb_val,
            amount_usd=numeric if currency else None,
            currency=currency,
            display=display,
        )

    # ── 3. Bare numeric ──────────────────────────────────────────────────
    m = _BARE_NUMERIC_RE.search(t.replace(",", "."))
    if m:
        numeric = float(m.group(1))
        return ParsedAmount(
            raw_text=t,
            numeric=numeric,
            amount_bb=round(numeric, 4),
            amount_usd=None,
            currency="",
            display=_fmt_bb(numeric),
        )

    return None


# ── Validation helpers ────────────────────────────────────────────────────────

def validate_stack_bb(
    stack_bb: float,
    warnings: list[str],
    label: str = "",
) -> None:
    """Flag implausible stack sizes (likely unit-conversion errors)."""
    prefix = f"{label}: " if label else ""
    if stack_bb < 1.0:
        warnings.append(
            f"{prefix}Stack {stack_bb:.2f}bb is unrealistically small — "
            "likely a currency→bb conversion error (check stakes)"
        )
    elif stack_bb > 10_000:
        warnings.append(
            f"{prefix}Stack {stack_bb:.0f}bb is unrealistically large — "
            "likely a currency→bb conversion error (check stakes)"
        )


def validate_pot_bb(pot_bb: float, warnings: list[str]) -> None:
    """Flag implausible pot sizes."""
    if pot_bb < 0.5:
        warnings.append(
            f"Pot {pot_bb:.2f}bb is below minimum possible — "
            "likely a currency→bb conversion error"
        )
    elif pot_bb > 5_000:
        warnings.append(
            f"Pot {pot_bb:.0f}bb is unrealistically large — "
            "likely a currency→bb conversion error"
        )
