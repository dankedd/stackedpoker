"""
Simplified strategic hand bucket system.

Maps every hand to one of 10 strategic categories.
Used for range composition analysis and density queries.
"""
from __future__ import annotations

from app.ranges.models import HandBucket, PreflopRange, RANK_VAL
from app.ranges.utils import normalize_hand, hand_to_ranks, is_pair, is_suited, hand_gap


# ── Bucket classification ──────────────────────────────────────────────────────

def classify_hand_bucket(hand: str) -> HandBucket:
    """
    Classify any two-card hand into a strategic bucket.

    Deterministic — same input always returns same bucket.
    """
    norm = normalize_hand(hand)
    r1, r2 = hand_to_ranks(norm)
    v1, v2 = RANK_VAL[r1], RANK_VAL[r2]
    pair = (r1 == r2)
    suited = norm.endswith("s")
    gap = v1 - v2 if not pair else 0

    # ── Pocket pairs ──────────────────────────────────────────────────────
    if pair:
        if v1 >= 10:  # JJ+
            return HandBucket.PREMIUM
        if v1 >= 8:   # TT, 99
            return HandBucket.STRONG_BROADWAY
        if v1 >= 5:   # 77, 88
            return HandBucket.MEDIUM_PAIR
        if v1 >= 2:   # 66–22
            return HandBucket.SMALL_PAIR
        return HandBucket.SMALL_PAIR

    # ── Ace-high hands ────────────────────────────────────────────────────
    if r1 == "A":
        if r2 == "K":
            return HandBucket.PREMIUM if suited else HandBucket.STRONG_BROADWAY
        if r2 in ("Q", "J"):
            return HandBucket.STRONG_BROADWAY
        # A2s–A9s
        if suited:
            return HandBucket.SUITED_ACE
        # Ax offsuit with decent kicker
        if v2 >= 8:  # ATo+
            return HandBucket.BROADWAY_OFFSUIT
        return HandBucket.WEAK_OFFSUIT

    # ── King-high ─────────────────────────────────────────────────────────
    if r1 == "K":
        if r2 == "Q":
            return HandBucket.STRONG_BROADWAY if suited else HandBucket.BROADWAY_OFFSUIT
        if r2 in ("J", "T"):
            return HandBucket.BROADWAY_OFFSUIT if not suited else HandBucket.SUITED_CONNECTOR
        if suited:
            return HandBucket.WEAK_SUITED
        if v2 >= 6:  # K9o, K8o, K7o — playable from late position
            return HandBucket.WEAK_OFFSUIT
        return HandBucket.TRASH

    # ── Queen-high ────────────────────────────────────────────────────────
    if r1 == "Q":
        if r2 == "J":
            return HandBucket.BROADWAY_OFFSUIT if not suited else HandBucket.SUITED_CONNECTOR
        if r2 == "T":
            return HandBucket.BROADWAY_OFFSUIT if not suited else HandBucket.SUITED_CONNECTOR
        if suited:
            return HandBucket.WEAK_SUITED
        if v2 >= 7:  # Q9o — late-position open
            return HandBucket.WEAK_OFFSUIT
        return HandBucket.TRASH

    # ── Jack-high ─────────────────────────────────────────────────────────
    if r1 == "J":
        if r2 == "T":
            return HandBucket.SUITED_CONNECTOR if suited else HandBucket.BROADWAY_OFFSUIT
        if suited and gap <= 2:
            return HandBucket.SUITED_CONNECTOR
        if suited:
            return HandBucket.WEAK_SUITED
        if gap <= 2:
            return HandBucket.WEAK_OFFSUIT  # J9o, J8o — BTN/SB wide opens
        return HandBucket.TRASH

    # ── Ten-high and below ────────────────────────────────────────────────
    if suited:
        if gap <= 1:
            return HandBucket.SUITED_CONNECTOR
        if gap <= 3:
            return HandBucket.WEAK_SUITED
        return HandBucket.TRASH
    # Offsuit connectors / one-gappers (T9o, 98o, 87o, T8o) played from late pos
    if gap <= 2:
        return HandBucket.WEAK_OFFSUIT

    return HandBucket.TRASH


# ── Bucket density queries ─────────────────────────────────────────────────────

def combos_in_bucket(range_: PreflopRange, bucket: HandBucket) -> float:
    """Return total weighted combos in a range belonging to the given bucket."""
    total = 0.0
    for combo in range_.combos:
        if classify_hand_bucket(combo.hand) == bucket:
            total += combo.combo_count
    return total


def bucket_breakdown(range_: PreflopRange) -> dict[HandBucket, float]:
    """Return combo count per bucket for the full range."""
    result: dict[HandBucket, float] = {b: 0.0 for b in HandBucket}
    for combo in range_.combos:
        b = classify_hand_bucket(combo.hand)
        result[b] += combo.combo_count
    return result


def premium_combo_count(range_: PreflopRange) -> float:
    """Return weighted combos of AA, KK, QQ, AKs — canonical premium hands."""
    return sum(
        c.combo_count
        for c in range_.combos
        if c.hand in ("AA", "KK", "QQ", "AKs")
    )


def is_capped(range_: PreflopRange, threshold: float = 12.0) -> bool:
    """
    Detect whether a range is capped (missing top premiums).

    A range is capped if it has fewer than `threshold` combos of
    AA + KK + QQ combined. This identifies typical calling ranges
    that have 3bet-folded their best hands away.

    Default threshold 12 = roughly 2 of the 3 premium pairs present.
    """
    count = sum(
        c.combo_count
        for c in range_.combos
        if c.hand in ("AA", "KK", "QQ")
    )
    return count < threshold
