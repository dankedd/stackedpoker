"""
Range string parser.

Supported syntax:
    "AA"         → pocket aces, weight 1.0
    "AKs"        → AK suited, weight 1.0
    "AKo"        → AK offsuit, weight 1.0
    "AK"         → AK both, weight 1.0
    "AKs:0.5"    → AK suited, weight 0.5
    "QJo:0.33"   → QJ offsuit, weight 0.33

Range strings are comma or whitespace separated lists of hand entries.
"""
from __future__ import annotations

from app.ranges.models import RangeCombo
from app.ranges.utils import normalize_hand, raw_combo_count, is_pair, is_suited, is_offsuit


def parse_hand_entry(entry: str) -> RangeCombo:
    """
    Parse a single hand entry like "AKs", "QJo:0.5", "AA".

    Returns a RangeCombo with correct structural metadata.
    Raises ValueError on malformed input.
    """
    entry = entry.strip()
    if not entry:
        raise ValueError("Empty hand entry")

    # Split off weight
    if ":" in entry:
        hand_part, weight_part = entry.split(":", 1)
        try:
            weight = float(weight_part)
        except ValueError:
            raise ValueError(f"Invalid weight in entry: {entry!r}")
        if not (0.0 <= weight <= 1.0):
            raise ValueError(f"Weight must be 0.0–1.0, got {weight} in {entry!r}")
    else:
        hand_part = entry
        weight = 1.0

    hand = normalize_hand(hand_part)

    pair   = is_pair(hand)
    suited = is_suited(hand)
    offsuit = is_offsuit(hand)

    return RangeCombo(
        hand=hand,
        weight=weight,
        suited=suited,
        offsuit=offsuit,
        pocket_pair=pair,
        raw_combos=raw_combo_count(hand),
    )


def parse_range_string(range_str: str) -> list[RangeCombo]:
    """
    Parse a range string into a list of RangeCombos.

    Input can be comma-separated, whitespace-separated, or mixed.

    Example:
        "AA, KK, QQ, AKs, AKo:0.5, 76s:0.4"
    """
    # Normalize separators: replace commas with spaces, split on whitespace
    tokens = range_str.replace(",", " ").split()
    combos: list[RangeCombo] = []
    seen: set[str] = set()

    for token in tokens:
        token = token.strip()
        if not token:
            continue
        combo = parse_hand_entry(token)
        if combo.hand in seen:
            # Later entries override earlier for same hand
            combos = [c for c in combos if c.hand != combo.hand]
        seen.add(combo.hand)
        combos.append(combo)

    return combos


def parse_range_list(entries: list[str]) -> list[RangeCombo]:
    """
    Parse a Python list of hand entry strings.

    Convenience wrapper for range database definitions:
        parse_range_list(["AA", "KK", "AKs", "AKo:0.5"])
    """
    combos: list[RangeCombo] = []
    seen: set[str] = set()

    for entry in entries:
        combo = parse_hand_entry(entry)
        if combo.hand in seen:
            combos = [c for c in combos if c.hand != combo.hand]
        seen.add(combo.hand)
        combos.append(combo)

    return combos
