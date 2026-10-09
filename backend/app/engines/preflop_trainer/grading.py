"""Chart lookup and grading — a port of frontend/lib/ranges/logic.ts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).parent / "data"

ChartKind = Literal["open", "pushfold", "defense"]
Verdict = Literal["correct", "mixed", "wrong"]
ACTIONS = ("fold", "limp", "call", "raise", "allin")


class InvalidHand(ValueError):
    """The chart, hand or action does not describe a hand the trainer can deal."""


@dataclass(frozen=True)
class ChartRef:
    kind: ChartKind
    #: Book page for open and push/fold charts; Hand Range number for defense charts.
    chart_id: int
    #: Stack in bb — only meaningful for push/fold, where one chart covers 2–10bb.
    stack: int | None = None


@dataclass(frozen=True)
class GradeResult:
    verdict: Verdict
    chosen: float
    best_key: str
    best: float


@lru_cache(maxsize=1)
def _charts() -> dict[str, dict[int, dict]]:
    def load(name: str) -> list[dict]:
        return json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))

    return {
        "open": {c["page"]: c for c in load("open")},
        "pushfold": {c["page"]: c for c in load("pushfold")},
        "defense": {c["n"]: c for c in load("defense")},
    }


def push_value(cell: list[str]) -> int:
    """Max stack (bb) a hand is shoved at: printed number, else 10 (black) or 0 (red)."""
    bg, n = cell
    if n != "":
        return int(n)
    return 10 if bg == "black" else 0


def frequencies(ref: ChartRef, hand: str) -> dict[str, float]:
    chart = _charts()[ref.kind].get(ref.chart_id)
    if chart is None:
        raise InvalidHand(f"unknown {ref.kind} chart {ref.chart_id}")
    if hand not in chart["grid"]:
        raise InvalidHand(f"unknown hand {hand!r}")

    if ref.kind == "pushfold":
        if ref.stack is None or not 2 <= ref.stack <= 10:
            raise InvalidHand("push/fold needs a stack of 2–10bb")
        pushed = push_value(chart["grid"][hand]) >= ref.stack
        return {"fold": 0.0 if pushed else 1.0, "allin": 1.0 if pushed else 0.0}

    row = chart["grid"][hand]
    if row is None:
        raise InvalidHand(f"{hand} never reaches this spot")
    base = ("fold", "call", "raise", "allin") if ref.kind == "defense" else ("fold", "limp", "raise", "allin")
    f = {k: 0.0 for k in base}
    for action, freq in zip(chart["actions"], row):
        f[action["key"]] = f.get(action["key"], 0.0) + float(freq)
    return f


def grade_frequencies(f: dict[str, float], action: str) -> GradeResult:
    """Correct at ≥50%, or as the (tied) most frequent action above 5%; mixed at ≥10%."""
    best_key, best = max(f.items(), key=lambda kv: kv[1])  # first max wins, like the TS reduce
    p = f.get(action, 0.0)
    if p >= 0.5 or (p > 0.05 and p >= best - 1e-9):
        verdict: Verdict = "correct"
    elif p >= 0.1:
        verdict = "mixed"
    else:
        verdict = "wrong"
    return GradeResult(verdict=verdict, chosen=p, best_key=best_key, best=best)


def grade_hand(ref: ChartRef, hand: str, action: str) -> GradeResult:
    if action not in ACTIONS:
        raise InvalidHand(f"unknown action {action!r}")
    return grade_frequencies(frequencies(ref, hand), action)
