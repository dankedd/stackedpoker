"""Range-vs-range flop analysis for one spot and one flop.

For every combo in each player's range: its hand-vs-range equity against the
other player's whole range, enumerating every turn and river exactly (ties
count half), with card removal (board, both hole cards) and each opponent combo
weighted by its range frequency. Everything else is derived from those
per-combo equities:

  * range equity (pairs weighted by both frequencies),
  * Equity Bucket shares (Modern Poker Theory p.597: >=75 / 50-75 / 33-50 / <33),
  * nut advantage (book p.20 glossary): the player whose range holds the larger
    share of strong hands (the book's top equity bucket),
  * breakdown per hand class and per starting hand (heatmap).

eval7 is used only here, offline; the app reads the stored results.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .cards import DECK, split, texture, texture_labels
from .classes import CLASSES, classify

DATA = Path(__file__).resolve().parents[3] / "data" / "mpt"
BUCKETS = (("strong", 0.75), ("good", 0.50), ("weak", 0.33), ("trash", 0.0))
# Nut advantage is "equal" when the strong-hand shares are this close (percentage points).
# Implementation decision: the book defines nut advantage without a threshold.
NUT_EQUAL_PP = 3.0

RANKS = "AKQJT98765432"


def expand(hand: str) -> list[tuple[str, str]]:
    """'AKs' -> suited combos, 'AKo' -> offsuit, 'QQ' -> pairs."""
    s = "cdhs"
    if len(hand) == 2:
        r = hand[0]
        return [(r + s[i], r + s[j]) for i in range(4) for j in range(i + 1, 4)]
    a, b, kind = hand[0], hand[1], hand[2]
    if kind == "s":
        return [(a + x, b + x) for x in s]
    return [(a + x, b + y) for x in s for y in s if x != y]


def hand_of(c1: str, c2: str) -> str:
    r1, r2 = sorted((c1[0], c2[0]), key=RANKS.index)
    if r1 == r2:
        return r1 + r2
    return r1 + r2 + ("s" if c1[1] == c2[1] else "o")


@dataclass
class Spot:
    spot_id: str
    ip: dict
    oop: dict

    @classmethod
    def load(cls, spot_id: str) -> "Spot":
        d = json.loads((DATA / "ranges" / f"{spot_id}.json").read_text(encoding="utf-8"))
        return cls(spot_id, d["ip"], d["oop"])


def _combos(rng: dict[str, float], dead: set[str]):
    cards, weights = [], []
    for hand, f in rng.items():
        if f <= 0:
            continue
        for c in expand(hand):
            if c[0] in dead or c[1] in dead:
                continue
            cards.append(c)
            weights.append(f)
    return cards, np.array(weights, dtype=np.float64)


def _hand_vs_range(board: list[str], a_cards, a_w, b_cards, b_w):
    """Per-combo equity of A vs B's range and of B vs A's range, plus range equity."""
    import eval7

    idx = {c: i for i, c in enumerate(DECK)}
    dead = set(board)
    rest = [c for c in DECK if c not in dead]
    ev = {c: eval7.Card(c) for c in DECK}
    bcards = [ev[c] for c in board]

    def masks(cards):
        m = np.zeros((len(cards), 52), dtype=bool)
        for i, (x, y) in enumerate(cards):
            m[i, idx[x]] = True
            m[i, idx[y]] = True
        return m

    ma, mb = masks(a_cards), masks(b_cards)
    ok_pair = (ma.astype(np.int16) @ mb.T.astype(np.int16)) == 0  # [nA, nB] no shared card
    aw = a_w.astype(np.float32)
    bw = b_w.astype(np.float32)

    num_a = np.zeros(len(a_cards))
    den_a = np.zeros(len(a_cards))
    num_b = np.zeros(len(b_cards))
    den_b = np.zeros(len(b_cards))
    hole_a = [[ev[x], ev[y]] for x, y in a_cards]
    hole_b = [[ev[x], ev[y]] for x, y in b_cards]

    for i in range(len(rest)):
        for j in range(i + 1, len(rest)):
            t, r = rest[i], rest[j]
            base = bcards + [ev[t], ev[r]]
            ti, ri = idx[t], idx[r]
            va = ~(ma[:, ti] | ma[:, ri])
            vb = ~(mb[:, ti] | mb[:, ri])
            sa = np.array([eval7.evaluate(h + base) if v else 0 for h, v in zip(hole_a, va)], dtype=np.int32)
            sb = np.array([eval7.evaluate(h + base) if v else 0 for h, v in zip(hole_b, vb)], dtype=np.int32)
            m = (ok_pair & np.logical_and.outer(va, vb)).astype(np.float32)
            # 1 win, 0.5 tie, 0 loss for A; B gets the rest of every legal pair.
            w = (np.sign(sa[:, None] - sb[None, :]).astype(np.float32) + 1.0) * 0.5 * m
            num_a += w @ bw
            den_a += m @ bw
            num_b += (m - w).T @ aw
            den_b += m.T @ aw

    pair_num = float(a_w @ num_a)
    pair_den = float(a_w @ den_a)
    eq_a = np.divide(num_a, den_a, out=np.zeros_like(num_a), where=den_a > 0)
    eq_b = np.divide(num_b, den_b, out=np.zeros_like(num_b), where=den_b > 0)
    return eq_a, eq_b, pair_num / pair_den


def _side(sa, va, sb, vb, bw, conflict, cmask):
    """A's wins vs B's valid combos: sorted-prefix sums, minus card-sharing B combos."""
    keyed = np.where(vb, sb, np.iinfo(np.int64).max)  # invalid combos sort to the end
    order = np.argsort(keyed, kind="stable")
    sbs = keyed[order]
    wsorted = np.where(vb[order], bw[order], 0.0)
    cum = np.concatenate(([0.0], np.cumsum(wsorted)))
    total = cum[-1]
    lo = np.searchsorted(sbs, sa, side="left")
    hi = np.searchsorted(sbs, sa, side="right")
    # only valid B combos have finite scores below sa; invalid ones were pushed to the end
    num = cum[lo] + 0.5 * (cum[hi] - cum[lo])
    # card-sharing B combos (padded with -1): remove them from the counts
    cw = np.where(cmask & vb[conflict], bw[conflict], 0.0)
    cs = sb[conflict]
    out = (np.sign(sa[:, None] - cs) + 1.0) * 0.5
    num = num - (out * cw).sum(axis=1)
    den = total - cw.sum(axis=1)
    return np.where(va, num, 0.0), np.where(va, den, 0.0)


def _conflicts(a_cards, b_cards):
    """For each A combo, the indices of B combos sharing a card (each listed once)."""
    by_card: dict[str, list[int]] = {}
    for j, (x, y) in enumerate(b_cards):
        by_card.setdefault(x, []).append(j)
        by_card.setdefault(y, []).append(j)
    rows = []
    for x, y in a_cards:
        rows.append(sorted(set(by_card.get(x, [])) | set(by_card.get(y, []))))
    k = max((len(r) for r in rows), default=1) or 1
    idx = np.zeros((len(a_cards), k), dtype=np.int64)
    mask = np.zeros((len(a_cards), k), dtype=bool)
    for i, r in enumerate(rows):
        idx[i, : len(r)] = r
        mask[i, : len(r)] = True
    return idx, mask


def _hand_vs_range_fast(board: list[str], a_cards, a_w, b_cards, b_w):
    """Same result as _hand_vs_range, ~10x less work per runout."""
    import eval7

    idx = {c: i for i, c in enumerate(DECK)}
    rest = [c for c in DECK if c not in set(board)]
    ev = {c: eval7.Card(c) for c in DECK}
    bcards = [ev[c] for c in board]
    cards_a = np.array([[idx[x], idx[y]] for x, y in a_cards])
    cards_b = np.array([[idx[x], idx[y]] for x, y in b_cards])
    ca, cam = _conflicts(a_cards, b_cards)
    cb, cbm = _conflicts(b_cards, a_cards)
    hole_a = [[ev[x], ev[y]] for x, y in a_cards]
    hole_b = [[ev[x], ev[y]] for x, y in b_cards]
    num_a = np.zeros(len(a_cards)); den_a = np.zeros(len(a_cards))
    num_b = np.zeros(len(b_cards)); den_b = np.zeros(len(b_cards))
    for i in range(len(rest)):
        for j in range(i + 1, len(rest)):
            t, r = idx[rest[i]], idx[rest[j]]
            base = bcards + [ev[rest[i]], ev[rest[j]]]
            va = ~((cards_a == t) | (cards_a == r)).any(axis=1)
            vb = ~((cards_b == t) | (cards_b == r)).any(axis=1)
            sa = np.array([eval7.evaluate(h + base) if v else 0 for h, v in zip(hole_a, va)], dtype=np.int64)
            sb = np.array([eval7.evaluate(h + base) if v else 0 for h, v in zip(hole_b, vb)], dtype=np.int64)
            n, d = _side(sa, va, sb, vb, b_w, ca, cam)
            num_a += n; den_a += d
            n, d = _side(sb, vb, sa, va, a_w, cb, cbm)
            num_b += n; den_b += d
    eq_a = np.divide(num_a, den_a, out=np.zeros_like(num_a), where=den_a > 0)
    eq_b = np.divide(num_b, den_b, out=np.zeros_like(num_b), where=den_b > 0)
    return eq_a, eq_b, float(a_w @ num_a) / float(a_w @ den_a)


def _bucket(e: float) -> str:
    for name, lo in BUCKETS:
        if e >= lo:
            return name
    return "trash"


def _summaries(cards, w, eq, board):
    total = w.sum()
    buckets = {name: 0.0 for name, _ in BUCKETS}
    classes: dict[str, list[float]] = {}
    hands: dict[str, list[float]] = {}
    for (c1, c2), wi, e in zip(cards, w, eq):
        buckets[_bucket(e)] += wi
        k = classify((c1, c2), board)
        acc = classes.setdefault(k, [0.0, 0.0])
        acc[0] += wi
        acc[1] += wi * e
        h = hand_of(c1, c2)
        hacc = hands.setdefault(h, [0.0, 0.0])
        hacc[0] += wi
        hacc[1] += wi * e
    pct = lambda x: round(float(100 * x / total), 2)
    return (
        {k: pct(v) for k, v in buckets.items()},
        {k: [pct(v[0]), round(float(100 * v[1] / v[0]), 1)] for k, v in sorted(classes.items(), key=lambda kv: CLASSES.index(kv[0]))},
        {h: [round(float(v[0] / len(expand(h))), 3), round(float(100 * v[1] / v[0]), 1)] for h, v in hands.items()},
    )


def analyse(spot: Spot, flop: str) -> dict:
    """Everything stored for one spot and one (canonical) flop."""
    board = split(flop)
    dead = set(board)
    ip_cards, ip_w = _combos(spot.ip["range"], dead)
    oop_cards, oop_w = _combos(spot.oop["range"], dead)
    # Same numbers either way (tested); the sorted kernel wins on wide ranges.
    kernel = _hand_vs_range_fast if len(ip_cards) * len(oop_cards) > 250_000 else _hand_vs_range
    eq_ip, eq_oop, range_eq_ip = kernel(board, ip_cards, ip_w, oop_cards, oop_w)
    b_ip, cls_ip, hands_ip = _summaries(ip_cards, ip_w, eq_ip, board)
    b_oop, cls_oop, hands_oop = _summaries(oop_cards, oop_w, eq_oop, board)
    diff = round(float(b_ip["strong"] - b_oop["strong"]), 2)
    leader = "EQUAL" if abs(diff) < NUT_EQUAL_PP else ("IP" if diff > 0 else "OOP")
    return {
        "spot_id": spot.spot_id,
        "flop": flop,
        "equity_ip": round(100 * range_eq_ip, 2),
        "equity_oop": round(100 - 100 * range_eq_ip, 2),
        "buckets_ip": b_ip,
        "buckets_oop": b_oop,
        "nut_adv": {"metric": "strong_share", "ip": b_ip["strong"], "oop": b_oop["strong"], "diff": diff, "leader": leader,
                    "equal_within_pp": NUT_EQUAL_PP},
        "hand_classes": {"ip": cls_ip, "oop": cls_oop},
        "hands": {"ip": hands_ip, "oop": hands_oop},
        "texture": texture_labels(flop),
        "texture_detail": texture(flop),
    }
