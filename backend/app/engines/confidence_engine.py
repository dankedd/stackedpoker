"""
Confidence Engine — Per-classification confidence scoring for poker analysis.

Every classification produced by the engine carries a confidence score (0.0-1.0)
and structured reasoning. Low-confidence results use conservative language and
are flagged for review before publication.

CONFIDENCE FACTORS
==================

HIGH confidence (0.85-1.0):
  - Clean card inputs (no duplicates, valid formats)
  - Deterministic result (e.g., flush draw = exactly 4 of same suit)
  - Standard board (no paired, no monotone board complicating outs)
  - All cards consistent (no contradictions)

MEDIUM confidence (0.60-0.84):
  - Paired board (some outs may be counterfeited)
  - Monotone board (flush already possible, outs picture muddy)
  - Runner-runner equity only (hard to quantify precisely)

LOW confidence (0.30-0.59):
  - Parsing errors or unusual card combos
  - River analysis (draws don't apply)
  - Unknown board state

ZERO confidence (0.0):
  - Invalid card inputs
  - Impossible combinations (duplicate cards)
  - Missing data

SAFETY RULE: if confidence < 0.6, the engine avoids strong strategic labels
and uses conservative, hedged language.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from app.engines.draw_evaluator import DrawAnalysis


@dataclass
class ConfidenceResult:
    """Structured confidence assessment."""
    score: float                    # 0.0-1.0
    grade: str                      # "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"
    reasoning: list[str]            # factors that affected confidence
    is_reliable: bool               # True if score >= 0.60
    publish_safe: bool              # True if score >= 0.75 (safe for coaching content)

    # Per-dimension scores
    card_validity: float = 1.0
    draw_certainty: float = 1.0
    board_clarity: float = 1.0
    outs_accuracy: float = 1.0

    # Recommended label strictness
    label_mode: str = "precise"     # "precise" | "conservative" | "hedged" | "suppress"
    warnings: list[str] = field(default_factory=list)


# ── Public API ─────────────────────────────────────────────────────────────────

def score_confidence(
    draw_analysis: DrawAnalysis,
    hole_cards: Sequence[str] | None = None,
    board_cards: Sequence[str] | None = None,
) -> ConfidenceResult:
    """
    Compute confidence for the given draw analysis.

    Parameters
    ----------
    draw_analysis : Result from draw_evaluator.analyze_draws()
    hole_cards    : Original hole card strings (for validation cross-check)
    board_cards   : Original board card strings

    Returns
    -------
    ConfidenceResult with score, grade, and reasoning.
    """
    reasoning: list[str] = []
    warnings: list[str] = []

    card_score = _score_card_validity(draw_analysis, warnings, reasoning)
    draw_score = _score_draw_certainty(draw_analysis, reasoning)
    board_score = _score_board_clarity(draw_analysis, reasoning)
    outs_score = _score_outs_accuracy(draw_analysis, reasoning)

    # Inherited confidence from draw analysis warnings
    if draw_analysis.confidence < 1.0:
        delta = 1.0 - draw_analysis.confidence
        reasoning.append(
            f"Draw analysis confidence reduced by {delta:.2f} "
            f"({'; '.join(draw_analysis.warnings[:2])})"
        )

    # Weighted composite
    composite = (
        card_score  * 0.35 +
        draw_score  * 0.30 +
        board_score * 0.20 +
        outs_score  * 0.15
    )
    composite = min(composite, draw_analysis.confidence)  # cap at analysis confidence
    composite = round(max(0.0, min(1.0, composite)), 3)

    grade = _grade(composite)
    label_mode = _label_mode(composite)

    if composite < 0.60:
        warnings.append(
            f"Confidence {composite:.2f} is below reliability threshold (0.60). "
            "Using conservative labels."
        )

    return ConfidenceResult(
        score=composite,
        grade=grade,
        reasoning=reasoning,
        is_reliable=composite >= 0.60,
        publish_safe=composite >= 0.75,
        card_validity=card_score,
        draw_certainty=draw_score,
        board_clarity=board_score,
        outs_accuracy=outs_score,
        label_mode=label_mode,
        warnings=warnings,
    )


def apply_confidence_to_label(label: str, confidence: ConfidenceResult) -> str:
    """
    Adjust a strategic label based on confidence level.

    Examples:
      HIGH  → "OESD (8 outs)"           → "OESD (8 outs)"  [unchanged]
      MED   → "Backdoor straight"        → "Possible backdoor straight"
      LOW   → "Gutshot"                  → "Draw unclear — possible gutshot"
      ZERO  → anything                   → "Unable to classify"
    """
    if confidence.label_mode == "precise":
        return label
    if confidence.label_mode == "conservative":
        return f"Likely {label.lower()}"
    if confidence.label_mode == "hedged":
        return f"Possible {label.lower()} (uncertain)"
    return "Unable to classify — insufficient data"


# ── Scoring sub-functions ──────────────────────────────────────────────────────

def _score_card_validity(
    da: DrawAnalysis,
    warnings: list[str],
    reasoning: list[str],
) -> float:
    score = 1.0

    if not da.hole_cards:
        reasoning.append("No hole cards provided.")
        return 0.0
    if len(da.hole_cards) != 2:
        reasoning.append(f"Unexpected hole card count: {len(da.hole_cards)}")
        score -= 0.5

    board_n = len(da.board_cards)
    if board_n not in (0, 3, 4, 5):
        reasoning.append(f"Unusual board size: {board_n}")
        score -= 0.3

    # Duplicate detection
    all_cards = da.hole_cards + da.board_cards
    if len(set(all_cards)) < len(all_cards):
        reasoning.append("Duplicate cards detected in input.")
        score -= 0.6
        warnings.append("Duplicate cards — classification unreliable.")

    if score >= 0.95:
        reasoning.append("Card inputs: valid and complete.")

    return round(max(0.0, score), 3)


def _score_draw_certainty(da: DrawAnalysis, reasoning: list[str]) -> float:
    """Flush and straight draws are binary — either present or not."""
    score = 1.0

    if da.street == "river":
        reasoning.append("River: draws have no realisation value.")
        score = 0.70  # can still describe what was a draw, but less useful

    # Backdoor draws are always lower certainty for strategic advice
    if da.has_backdoor_straight and not da.has_direct_straight_draw:
        reasoning.append("Backdoor straight only — runner-runner equity, low strategic certainty.")
        score = min(score, 0.75)

    if da.has_backdoor_flush and not da.has_flush_draw:
        reasoning.append("Backdoor flush only — runner-runner equity.")
        score = min(score, 0.78)

    # Direct draws are high certainty
    if da.has_flush_draw:
        reasoning.append("Flush draw: deterministic (4 of same suit — high certainty).")
    if da.has_direct_straight_draw:
        for sd in da.straight_draws:
            if sd.draw_type in ("oesd", "double_gutter", "gutshot"):
                reasoning.append(
                    f"Straight draw detected: {sd.draw_type} — high certainty."
                )

    # No draws at all is also certain
    if not any([
        da.has_flush_draw, da.has_direct_straight_draw,
        da.has_backdoor_flush, da.has_backdoor_straight
    ]):
        reasoning.append("No draws detected — deterministic (no draw is also certain).")

    return round(max(0.0, min(1.0, score)), 3)


def _score_board_clarity(da: DrawAnalysis, reasoning: list[str]) -> float:
    """Board texture clarity for outs assessment."""
    score = 1.0
    board = da.board_cards

    if not board:
        reasoning.append("No board cards — preflop analysis only.")
        return 0.80  # preflop is fine but draw analysis limited

    board_rank_vals = []
    for c in board:
        rv = 2 + "23456789TJQKA".index(c[0].upper()) if c[0].upper() in "23456789TJQKA" else 0
        board_rank_vals.append(rv)

    is_paired = len(set(board_rank_vals)) < len(board_rank_vals)
    if is_paired:
        reasoning.append("Paired board: some outs may create villain full house — clarity reduced.")
        score = min(score, 0.82)

    board_suits = [c[1].lower() for c in board if len(c) == 2]
    if len(set(board_suits)) == 1 and len(board_suits) == 3:
        reasoning.append("Monotone flop: made flush already possible for some ranges.")
        score = min(score, 0.80)
    elif len(set(board_suits)) == 1 and len(board_suits) > 3:
        reasoning.append("Monotone board: flush may be already made by villain.")
        score = min(score, 0.75)

    if score >= 0.90:
        reasoning.append("Board texture: clean, draw picture is clear.")

    return round(max(0.0, score), 3)


def _score_outs_accuracy(da: DrawAnalysis, reasoning: list[str]) -> float:
    """Accuracy of outs count given available information."""
    score = 1.0

    if da.street == "river":
        reasoning.append("River: no outs remain — outs count trivially 0.")
        return 1.0

    if da.has_backdoor_flush or da.has_backdoor_straight:
        if not da.has_flush_draw and not da.has_direct_straight_draw:
            reasoning.append(
                "Backdoor only: runner-runner equity is approximate (~1-4%), not exact outs."
            )
            score = min(score, 0.72)

    # Direct draws have exact out counts
    if da.has_flush_draw:
        reasoning.append("Flush draw: exact outs = 9 (minus seen cards).")
    if da.has_direct_straight_draw:
        for sd in da.straight_draws:
            if sd.draw_type == "oesd":
                reasoning.append(f"OESD: exact outs = 8 (minus seen).")
            elif sd.draw_type == "double_gutter":
                reasoning.append(f"Double gutter: exact outs = 8 (minus seen).")
            elif sd.draw_type == "gutshot":
                reasoning.append(f"Gutshot: exact outs = 4 (minus seen).")

    return round(max(0.0, min(1.0, score)), 3)


# ── Grade and mode helpers ────────────────────────────────────────────────────

def _grade(score: float) -> str:
    if score >= 0.85:
        return "HIGH"
    if score >= 0.60:
        return "MEDIUM"
    if score >= 0.30:
        return "LOW"
    return "UNKNOWN"


def _label_mode(score: float) -> str:
    if score >= 0.85:
        return "precise"
    if score >= 0.70:
        return "conservative"
    if score >= 0.45:
        return "hedged"
    return "suppress"
