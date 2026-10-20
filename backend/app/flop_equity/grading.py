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

from dataclasses import dataclass
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
