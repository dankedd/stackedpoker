"""Flop Equity Trainer grading — the server's copy of the rules the browser shows.

Mirrors frontend/lib/flopTrainer/logic.ts (gradeAnswer, textureCategory); the
tests pin both to the same cases.

  |guess - exact equity| <= 3  Perfect  2 points
                         <= 7  Good     1 point
                         >  7  Miss     0 points
  nut advantage right          +1 point

Thresholds are the Phase 2 spec's, not the book's. The nut-advantage answer
is the precomputed `nut_adv.leader` (Strong-bucket share, "EQUAL" within 3
points) — see data/mpt/REPORT.md, section 9.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

Verdict = Literal["perfect", "good", "miss"]
NutSide = Literal["IP", "OOP", "EQUAL"]

PERFECT_WITHIN = 3.0
GOOD_WITHIN = 7.0
POINTS = {"perfect": 2, "good": 1, "miss": 0}
NUT_BONUS = 1

CATEGORIES = ("paired", "monotone", "ace_high", "king_high", "high", "connected", "low_dry")


@dataclass(frozen=True)
class Graded:
    verdict: Verdict
    error: float
    nut_correct: bool
    points: int


def grade_answer(guess: float, exact: float, nut_guess: NutSide, nut_actual: NutSide) -> Graded:
    error = round(abs(guess - exact), 2)
    verdict: Verdict = "perfect" if error <= PERFECT_WITHIN else "good" if error <= GOOD_WITHIN else "miss"
    nut_correct = nut_guess == nut_actual
    return Graded(verdict, error, nut_correct, POINTS[verdict] + (NUT_BONUS if nut_correct else 0))


def texture_category(texture: list[str]) -> str:
    """One coarse category per flop, from the precomputed texture labels —
    used to track which kinds of flops a player misjudges.

    Board structure first (paired and trips flops together), then suits, then
    the high card; unpaired boards ten-high or lower split on whether a
    straight is possible (>= 1 flopped straight). Over all 22,100 flops:
    paired 17%, monotone 5%, ace-high 18%, king-high 15%, Q/J-high 22%,
    connected 9%, low dry 14%.
    """
    labels = set(texture)
    if "trips" in labels or "paired" in labels:
        return "paired"
    if "monotone" in labels:
        return "monotone"
    rank = next((t.split(":", 1)[1] for t in texture if t.startswith("rank:")), "")[:1]
    if rank == "A":
        return "ace_high"
    if rank == "K":
        return "king_high"
    if rank in ("Q", "J"):
        return "high"
    straights = next((int(t.split(":", 1)[1]) for t in texture if t.startswith("straights:")), 0)
    return "connected" if straights >= 1 else "low_dry"


# ── C-bet question (Phase 3) ────────────────────────────────────────────────
#
# Modern Poker Theory groups IP's flop c-bets by frequency (high 80%+, mid
# 60-80%, low under 60%) and by size (big = 1/2 or 2/3 pot, small = min-bet or
# 1/3 pot), and prints the average Equity Buckets of both players for each of
# the six groups (Diagrams 56-57, p.675-679). A flop's advice is the group
# whose printed bucket profile is closest to the flop's own buckets (source
# reconstruction, not a per-flop solver result). Where the book prints the
# full strategy for a flop (its six Flop Strategy Examples) those numbers win.
#
# Frequency bands of profiles within 10% of the nearest distance (same size)
# are all accepted: the book's groups overlap and a near-tie is not a mistake.
# Checked against the six book flops: size 6/6; band 4/6 nearest, 6/6 accepted.

#: A copy of data/mpt/cbet_profiles.json inside the package (Railway builds backend/ only).
CBET_FILE = Path(__file__).parent / "cbet_profiles.json"
BAND_TIE = 1.10
BANDS = ("high", "mid", "low")
SIZES = ("small", "big")


@lru_cache(maxsize=1)
def cbet_data() -> dict:
    return json.loads(CBET_FILE.read_text(encoding="utf-8"))


def _book_flop(spot_id: str, flop: str) -> dict | None:
    return next((b for b in cbet_data()["book_flops"] if b["spot_id"] == spot_id and b["flop"] == flop), None)


def band_of(bet_pct: float) -> str:
    return "high" if bet_pct >= 80 else "mid" if bet_pct >= 60 else "low"


def cbet_advice(spot_id: str, flop: str, buckets_ip: dict, buckets_oop: dict, texture: list[str]) -> dict:
    """{"size", "band", "bands" (accepted), "source": "book"|"profile", "strategy"?, "pages", "distance"?, "rule"?}

    On trips, paired and monotone flops the book says small sizes are
    preferred (cbet_profiles.json size_rules), so only the small profiles
    are compared there."""
    data = cbet_data()
    book = _book_flop(spot_id, flop)
    if book:
        s = book["strategy"]
        big = sum(s.get(k, 0) for k in data["sizes"]["big"])
        small = sum(s.get(k, 0) for k in data["sizes"]["small"])
        band = band_of(100 - s.get("check", 0))
        return {"size": "big" if big > small else "small", "band": band, "bands": [band], "source": "book",
                "strategy": s, "pages": book["pages"]}
    rule = next((r for r in data["size_rules"] if r["texture"] in texture), None)
    order = data["bucket_order"]
    v = [buckets_ip[k] for k in order] + [buckets_oop[k] for k in order]
    scored = sorted(
        (sum((a - b) ** 2 for a, b in zip(v, p["ip"] + p["oop"])) ** 0.5, p["band"], p["size"], p["page"])
        for p in data["profiles"]
        if rule is None or p["size"] == rule["size"]
    )
    dist, band, size, page = scored[0]
    bands = [b for d, b, s, _ in scored if s == size and d <= dist * BAND_TIE]
    if rule and rule.get("also_band"):
        bands.append(rule["also_band"])
    out = {"size": size, "band": band, "bands": sorted(set(bands), key=BANDS.index), "source": "profile",
           "pages": sorted({675, page, *(rule["pages"] if rule else [])}), "distance": round(dist, 1)}
    if rule:
        out["rule"] = rule["texture"]
    return out


def grade_cbet(band_guess: str, size_guess: str, advice: dict) -> tuple[bool, bool, int]:
    """(band right, size right, points) — one point each."""
    band_ok = band_guess in advice["bands"]
    size_ok = size_guess == advice["size"]
    return band_ok, size_ok, int(band_ok) + int(size_ok)
