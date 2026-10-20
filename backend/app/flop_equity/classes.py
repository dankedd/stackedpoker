"""Hand classes on the flop, for the per-class breakdown and the heatmap.

The class list is the union of the categories Modern Poker Theory uses in its
c-betting range breakdowns (Tables 113-118, p.684-698): made hands first, then
draws, then A-/K-high, then air. The book's tables don't publish exact
definitions, so these are ours, chosen to match its labels:

  * a hand gets the strongest class that applies (a pair with a draw is a pair);
  * on paired boards the board pair is not counted for "two pair": hitting the
    unpaired card is top/second pair, as in the book's J66 table;
  * draws use at least one hole card; double gutters count as OESD (8 outs);
  * Ace-high / King-high = no pair and no draw, holding an A (resp. K, no A).
"""

from __future__ import annotations

from collections import Counter

from .cards import rank

CLASSES = [
    "Straight Flush", "Quads", "Full House", "Flush", "Straight", "Trips", "Set", "Two Pair",
    "Over Pair", "Top Pair", "Pocket 1-2", "Second Pair", "Pocket 2-3", "Third Pair", "Under Pair",
    "Combo Draw", "Flush Draw", "OESD", "Gutshot", "Ace-high", "King-high", "Air",
]


def _straight_high(ranks: set[int]) -> int:
    """Highest straight in a rank set (ace low allowed), 0 if none."""
    rs = set(ranks) | ({1} if 14 in ranks else set())
    for top in range(14, 4, -1):
        if all(r in rs for r in range(top - 4, top + 1)):
            return top
    return 0


def _flush_suit(cards: list[str], n: int) -> str | None:
    c = Counter(x[1] for x in cards)
    s, k = c.most_common(1)[0]
    return s if k >= n else None


def classify(hole: tuple[str, str], board: list[str]) -> str:
    cards = list(hole) + board
    hr = [rank(c) for c in hole]
    br = sorted((rank(c) for c in board), reverse=True)
    all_r = Counter(rank(c) for c in cards)
    board_r = Counter(br)

    # ── made hands, strongest first ───────────────────────────────────────
    fs = _flush_suit(cards, 5)
    if fs:
        suited = {rank(c) for c in cards if c[1] == fs}
        if _straight_high(suited):
            return "Straight Flush"
    counts = sorted(all_r.values(), reverse=True)
    if counts[0] == 4:
        return "Quads"
    if counts[0] == 3 and counts[1] >= 2:
        return "Full House"
    if fs:
        return "Flush"
    if _straight_high(set(all_r)):
        return "Straight"
    pocket = hr[0] == hr[1]
    if counts[0] == 3:
        # three of a kind: a pocket pair hitting the board is a set; one card to a paired board is trips
        return "Set" if pocket else "Trips"

    distinct_board = sorted(set(br), reverse=True)  # unpaired part of the board, high to low
    hits = sorted({r for r in hr if r in board_r}, reverse=True)
    if not pocket and len(hits) == 2:
        return "Two Pair"
    if pocket:
        p = hr[0]
        top, low = distinct_board[0], distinct_board[-1]
        if p > top:
            return "Over Pair"
        if len(distinct_board) >= 2 and p > distinct_board[1]:
            return "Pocket 1-2"
        if len(distinct_board) == 3 and p > low:
            return "Pocket 2-3"
        return "Under Pair"
    if hits:
        pos = distinct_board.index(hits[0])
        return ("Top Pair", "Second Pair", "Third Pair")[min(pos, 2)]

    # ── draws (need at least one hole card) ───────────────────────────────
    fd = False
    four = _flush_suit(cards, 4)
    if four and any(c[1] == four for c in hole):
        fd = True
    outs = 0
    present = set(all_r)
    for r in range(2, 15):
        if r in present:
            continue
        if _straight_high(present | {r}):
            outs += 1
    sd = "OESD" if outs >= 2 else "Gutshot" if outs == 1 else None
    if fd and sd:
        return "Combo Draw"
    if fd:
        return "Flush Draw"
    if sd:
        return sd
    if 14 in hr:
        return "Ace-high"
    if 13 in hr:
        return "King-high"
    return "Air"
