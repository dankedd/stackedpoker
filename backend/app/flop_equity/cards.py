"""Cards, the 1,755 suit-isomorphic flops, and the book's flop classification.

Modern Poker Theory (p.624-630) reduces the 22,100 flops to 1,755 strategically
distinct ones by suit isomorphism and describes each flop along five axes:
structure, suit texture (with three two-tone subtypes), rank, number of
possible flopped straights, and family (A / H / M / L card classes).
"""

from __future__ import annotations

from itertools import combinations, permutations

RANKS = "23456789TJQKA"
SUITS = "cdhs"
DECK = [r + s for r in RANKS for s in SUITS]
RANK_VALUE = {r: i + 2 for i, r in enumerate(RANKS)}


def rank(card: str) -> int:
    return RANK_VALUE[card[0]]


def canonical(flop: list[str]) -> str:
    """The suit-isomorphism representative of a flop: the lexicographically
    smallest string over all suit relabelings, cards sorted high to low."""
    best = None
    for perm in permutations(SUITS):
        m = dict(zip(SUITS, perm))
        cards = sorted((c[0] + m[c[1]] for c in flop), key=lambda c: (-rank(c), c[1]))
        key = "".join(cards)
        if best is None or key < best:
            best = key
    return best


def all_flops() -> list[tuple[str, int]]:
    """All 1,755 canonical flops with the number of specific flops each stands for."""
    counts: dict[str, int] = {}
    for flop in combinations(DECK, 3):
        key = canonical(list(flop))
        counts[key] = counts.get(key, 0) + 1
    return sorted(counts.items(), key=lambda kv: kv[0])


def split(flop: str) -> list[str]:
    return [flop[i : i + 2] for i in range(0, len(flop), 2)]


# ── Classification (book p.626-630) ─────────────────────────────────────────


def card_class(r: int) -> str:
    """Book p.629: A = ace, H = K-T, M = 9-6, L = 5-2."""
    if r == 14:
        return "A"
    if r >= 10:
        return "H"
    if r >= 6:
        return "M"
    return "L"


def flopped_straights(ranks: list[int]) -> int:
    """Number of possible flopped straights (book p.627): the five-card
    windows (A can be low) that contain all three board ranks."""
    distinct = set(ranks)
    if len(distinct) < 3:
        return 0
    with_low_ace = distinct | ({1} if 14 in distinct else set())
    n = 0
    for low in range(1, 11):
        window = set(range(low, low + 5))
        hit = window & with_low_ace
        # all three board ranks inside the window (an ace counts once, high or low)
        if len({14 if r == 1 else r for r in hit}) == 3:
            n += 1
    return n


RANK_CHAR = {v: k for k, v in RANK_VALUE.items()}


def texture(flop: str) -> dict:
    cards = split(flop)
    ranks = sorted((rank(c) for c in cards), reverse=True)
    suits = [c[1] for c in sorted(cards, key=lambda c: -rank(c))]
    distinct = len(set(ranks))
    structure = "trips" if distinct == 1 else "paired" if distinct == 2 else "unpaired"

    n_suits = len(set(suits))
    if n_suits == 1:
        suit_texture, two_tone = "monotone", None
    elif n_suits == 3:
        suit_texture, two_tone = "rainbow", None
    else:
        suit_texture = "two-tone"
        hi, mid, lo = suits
        # For paired boards the "high/mid/low" positions are still the sorted cards.
        two_tone = "high-mid" if hi == mid else "mid-low" if mid == lo else "high-low"

    top = ranks[0]
    letters = "".join(card_class(r) for r in ranks)
    if structure == "paired":
        pair = ranks[1]  # the middle card of a sorted paired flop is always part of the pair
        kicker = next(r for r in ranks if r != pair)
        subfamily = RANK_CHAR[pair] * 2 + card_class(kicker)
    elif structure == "trips":
        subfamily = RANK_CHAR[top] * 3
    else:
        subfamily = ("A" if top == 14 else RANK_CHAR[top]) + letters[1:]

    return {
        "structure": structure,
        "suit_texture": suit_texture,
        "two_tone": two_tone,
        "rank": f"{RANK_CHAR[top]}xx",
        "straights": flopped_straights(ranks),
        "family": letters,
        "subfamily": subfamily,
    }


def texture_labels(flop: str) -> list[str]:
    """Flat labels for the `texture text[]` column."""
    t = texture(flop)
    labels = [t["structure"], t["suit_texture"], f"rank:{t['rank']}", f"straights:{t['straights']}",
              f"family:{t['family']}", f"subfamily:{t['subfamily']}"]
    if t["two_tone"]:
        labels.append(f"two-tone:{t['two_tone']}")
    return labels
