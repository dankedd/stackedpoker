"""Evaluate user responses to lesson steps and produce scores + feedback.

Evaluation source taxonomy:
  theory_engine — structured logic from curriculum-authored step definitions
                  (options carry explicit quality/EV/feedback; maths is exact)
  heuristic     — lightweight approximation for step types without full spec
  failed        — evaluation could not complete (parse error, missing data)

XP is ONLY produced for theory_engine results. Heuristic results carry reduced
XP. Failed results produce zero XP — the caller must never fabricate a score.
"""

import logging
from typing import Any, Literal
from dataclasses import dataclass

logger = logging.getLogger(__name__)

EvaluationSource = Literal["theory_engine", "heuristic", "failed"]
EvaluationConfidence = Literal["high", "medium", "low"]


@dataclass
class StepEvalResult:
    score: int                          # 0-100; meaningless when source=failed
    quality: str                        # perfect|good|acceptable|mistake|punt
    ev_loss_bb: float
    feedback: str
    concept_triggered: str | None
    xp_base: int                        # 0 when source=failed

    # ── Evaluation pipeline metadata ──────────────────────────────────────────
    evaluation_source: EvaluationSource = "theory_engine"
    confidence: EvaluationConfidence = "high"
    evaluation_valid: bool = True        # False when source=failed
    fallback_used: bool = False
    error_type: str | None = None


# ── Sentinel for failed evaluations ──────────────────────────────────────────

def _failed(error_type: str, detail: str = "") -> StepEvalResult:
    """Return an explicit failed result. Never fabricates a score or quality."""
    if detail:
        logger.warning("Step evaluation failed [%s]: %s", error_type, detail)
    return StepEvalResult(
        score=0,
        quality="punt",         # unused — UI checks evaluation_valid first
        ev_loss_bb=0.0,
        feedback="",            # UI shows its own failure message
        concept_triggered=None,
        xp_base=0,              # NO XP for failed evaluation
        evaluation_source="failed",
        confidence="high",      # irrelevant for failed
        evaluation_valid=False,
        fallback_used=False,
        error_type=error_type,
    )


# ── Quality ↔ score / XP tables ───────────────────────────────────────────────

QUALITY_SCORES = {"perfect": 100, "good": 80, "acceptable": 60, "mistake": 30, "punt": 0}
QUALITY_XP     = {"perfect": 50,  "good": 40, "acceptable": 25, "mistake": 10, "punt": 0}


# ── Step-type evaluators ──────────────────────────────────────────────────────

def evaluate_decision_spot(step: dict, user_option_id: str) -> StepEvalResult:
    """Evaluate a decision_spot or bet_size_choose step.

    Options are curriculum-authored with explicit quality and EV data, so this
    is theory_engine / high confidence.
    """
    options = step.get("options") or []

    if not options:
        return _failed("missing_options", f"step id={step.get('id')}")

    chosen = next((o for o in options if o.get("id") == user_option_id), None)
    if chosen is None:
        # Option id not found — could be a bad client payload
        return _failed("unknown_option_id", f"option={user_option_id!r}")

    quality = chosen.get("quality", "mistake")
    score = QUALITY_SCORES.get(quality, 30)
    return StepEvalResult(
        score=score,
        quality=quality,
        ev_loss_bb=float(chosen.get("ev_loss_bb", 0.0)),
        feedback=chosen.get("feedback", ""),
        concept_triggered=chosen.get("concept_triggered"),
        xp_base=QUALITY_XP.get(quality, 10),
        evaluation_source="theory_engine",
        confidence="high",
        evaluation_valid=True,
        fallback_used=False,
    )


def evaluate_equity_predict(step: dict, user_equity: float) -> StepEvalResult:
    """Score an equity_predict step by deviation from the correct value.

    Mathematical — theory_engine / medium confidence (equity values are
    curriculum-authored, not solver-computed).
    """
    actual = step.get("equity_actual")
    if actual is None:
        return _failed("missing_equity_actual", f"step id={step.get('id')}")

    try:
        actual = float(actual)
        tolerance = float(step.get("equity_tolerance", 5.0))
    except (TypeError, ValueError) as exc:
        return _failed("bad_equity_data", str(exc))

    diff = abs(user_equity - actual)

    if diff <= tolerance * 0.5:
        quality, score = "perfect", 100
    elif diff <= tolerance:
        quality, score = "good", 80
    elif diff <= tolerance * 2:
        quality, score = "acceptable", 60
    elif diff <= tolerance * 3:
        quality, score = "mistake", 30
    else:
        quality, score = "punt", 0

    feedback = (
        f"Correct equity: {actual:.1f}%. "
        f"Your estimate: {user_equity:.1f}% — off by {diff:.1f} percentage points."
    )
    return StepEvalResult(
        score=score,
        quality=quality,
        ev_loss_bb=0.0,
        feedback=feedback,
        concept_triggered=None,
        xp_base=QUALITY_XP.get(quality, 10),
        evaluation_source="theory_engine",
        confidence="medium",    # authored values, not solver
        evaluation_valid=True,
        fallback_used=False,
    )


def evaluate_range_build(step: dict, user_combos: list[str]) -> StepEvalResult:
    """Score a range_build step by Jaccard overlap with the target range.

    Theory_engine / medium confidence.
    """
    target_raw = step.get("range_combos")
    if not target_raw:
        return _failed("missing_range_combos", f"step id={step.get('id')}")

    target = set(target_raw)
    user_set = set(user_combos) if user_combos else set()

    intersection = len(target & user_set)
    union = len(target | user_set)
    overlap = intersection / union if union > 0 else 0.0
    score = int(overlap * 100)

    if score >= 90:
        quality = "perfect"
    elif score >= 75:
        quality = "good"
    elif score >= 55:
        quality = "acceptable"
    elif score >= 30:
        quality = "mistake"
    else:
        quality = "punt"

    missed = len(target - user_set)
    extra = len(user_set - target)
    feedback = (
        f"Range overlap: {score}%. "
        f"Missed {missed} combo{'s' if missed != 1 else ''}; "
        f"included {extra} extra combo{'s' if extra != 1 else ''}."
    )
    return StepEvalResult(
        score=score,
        quality=quality,
        ev_loss_bb=0.0,
        feedback=feedback,
        concept_triggered=None,
        xp_base=QUALITY_XP.get(quality, 10),
        evaluation_source="theory_engine",
        confidence="medium",
        evaluation_valid=True,
        fallback_used=False,
    )


def evaluate_classification(step: dict, user_answer: str) -> StepEvalResult:
    """Score board_classify, nut_advantage, blocker_id, range_identify steps.

    Binary correct/incorrect — theory_engine / high confidence.
    """
    correct = step.get("correct_answer")
    if correct is None:
        return _failed("missing_correct_answer", f"step id={step.get('id')}")

    is_correct = user_answer.strip().lower() == str(correct).strip().lower()
    quality = "perfect" if is_correct else "mistake"
    score = 100 if is_correct else 30

    feedback_key = "correct_feedback" if is_correct else "wrong_feedback"
    default_feedback = "Correct!" if is_correct else f"Correct answer: {correct}"
    feedback = step.get(feedback_key) or default_feedback

    return StepEvalResult(
        score=score,
        quality=quality,
        ev_loss_bb=0.0,
        feedback=feedback,
        concept_triggered=step.get("concept_triggered"),
        xp_base=QUALITY_XP.get(quality, 10),
        evaluation_source="theory_engine",
        confidence="high",
        evaluation_valid=True,
        fallback_used=False,
    )


# ── Main dispatcher ───────────────────────────────────────────────────────────

def evaluate_step(step: dict, user_response: Any) -> StepEvalResult:
    """Route by step type. Never returns a fake score for unknown types."""
    step_type = step.get("type", "")

    try:
        if step_type in ("decision_spot", "bet_size_choose", "bluff_pick"):
            return evaluate_decision_spot(step, str(user_response))

        if step_type == "equity_predict":
            try:
                equity = float(user_response)
            except (TypeError, ValueError):
                return _failed("bad_equity_response", f"got {user_response!r}")
            return evaluate_equity_predict(step, equity)

        if step_type == "range_build":
            combos = list(user_response) if user_response else []
            return evaluate_range_build(step, combos)

        if step_type in (
            "board_classify", "nut_advantage", "blocker_id",
            "range_identify", "bluff_pick",
        ):
            return evaluate_classification(step, str(user_response))

        if step_type == "concept_reveal":
            # Acknowledgement — always perfect, no answer to evaluate
            return StepEvalResult(
                score=100,
                quality="perfect",
                ev_loss_bb=0.0,
                feedback="Concept reviewed.",
                concept_triggered=None,
                xp_base=20,
                evaluation_source="theory_engine",
                confidence="high",
                evaluation_valid=True,
                fallback_used=False,
            )

        # Unknown step type — heuristic fallback, clearly labelled
        logger.warning("Unknown step type %r — returning heuristic result", step_type)
        return StepEvalResult(
            score=60,
            quality="acceptable",
            ev_loss_bb=0.0,
            feedback="Response recorded.",
            concept_triggered=None,
            xp_base=10,
            evaluation_source="heuristic",
            confidence="low",
            evaluation_valid=True,   # technically valid, just approximate
            fallback_used=True,
            error_type="unknown_step_type",
        )

    except Exception as exc:
        logger.exception("Unexpected error in evaluate_step type=%r", step_type)
        return _failed("evaluator_exception", str(exc))
