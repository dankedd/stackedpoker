"""Evaluate user responses to lesson steps and produce scores + feedback."""

from typing import Any
from dataclasses import dataclass

@dataclass
class StepEvalResult:
    score: int              # 0-100
    quality: str            # perfect|good|acceptable|mistake|punt
    ev_loss_bb: float
    feedback: str
    concept_triggered: str | None
    xp_base: int

QUALITY_SCORES = {"perfect": 100, "good": 80, "acceptable": 60, "mistake": 30, "punt": 0}
QUALITY_XP     = {"perfect": 50,  "good": 40, "acceptable": 25, "mistake": 10, "punt": 0}

def evaluate_decision_spot(step: dict, user_option_id: str) -> StepEvalResult:
    """Evaluate a decision_spot or bet_size_choose step."""
    options = step.get("options", [])
    chosen = next((o for o in options if o["id"] == user_option_id), None)
    if not chosen:
        return StepEvalResult(0, "punt", 0.0, "Invalid selection.", None, 0)

    quality = chosen.get("quality", "mistake")
    score = QUALITY_SCORES.get(quality, 30)
    return StepEvalResult(
        score=score,
        quality=quality,
        ev_loss_bb=chosen.get("ev_loss_bb", 0.0),
        feedback=chosen.get("feedback", ""),
        concept_triggered=chosen.get("concept_triggered"),
        xp_base=QUALITY_XP.get(quality, 10),
    )

def evaluate_equity_predict(step: dict, user_equity: float) -> StepEvalResult:
    """Score an equity_predict step based on closeness to actual."""
    actual = step.get("equity_actual", 50.0)
    tolerance = step.get("equity_tolerance", 5.0)
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

    feedback = (f"Actual equity: {actual:.1f}%. "
                f"You guessed {user_equity:.1f}% — off by {diff:.1f}pp.")
    return StepEvalResult(score=score, quality=quality, ev_loss_bb=0.0,
                          feedback=feedback, concept_triggered=None,
                          xp_base=QUALITY_XP.get(quality, 10))

def evaluate_range_build(step: dict, user_combos: list[str]) -> StepEvalResult:
    """Score a range_build step by overlap with target range."""
    target = set(step.get("range_combos", []))
    if not target:
        return StepEvalResult(50, "acceptable", 0.0, "No target range defined.", None, 25)

    user_set = set(user_combos)
    intersection = len(target & user_set)
    union = len(target | user_set)
    overlap = intersection / union if union > 0 else 0.0
    score = int(overlap * 100)

    if score >= 90: quality = "perfect"
    elif score >= 75: quality = "good"
    elif score >= 55: quality = "acceptable"
    elif score >= 30: quality = "mistake"
    else: quality = "punt"

    missed = len(target - user_set)
    extra = len(user_set - target)
    feedback = f"Range overlap: {score}%. Missed {missed} combos, added {extra} incorrect combos."
    return StepEvalResult(score=score, quality=quality, ev_loss_bb=0.0,
                          feedback=feedback, concept_triggered=None,
                          xp_base=QUALITY_XP.get(quality, 10))

def evaluate_classification(step: dict, user_answer: str) -> StepEvalResult:
    """Score board_classify, nut_advantage, blocker_id steps."""
    correct = step.get("correct_answer", "")
    is_correct = user_answer.strip().lower() == correct.strip().lower()
    quality = "perfect" if is_correct else "mistake"
    score = 100 if is_correct else 30
    feedback = step.get("correct_feedback" if is_correct else "wrong_feedback",
                        "Correct!" if is_correct else f"The correct answer was: {correct}")
    return StepEvalResult(score=score, quality=quality, ev_loss_bb=0.0,
                          feedback=feedback, concept_triggered=step.get("concept_triggered"),
                          xp_base=QUALITY_XP.get(quality, 10))

def evaluate_step(step: dict, user_response: Any) -> StepEvalResult:
    """Main dispatcher — route by step type."""
    step_type = step.get("type", "")
    if step_type in ("decision_spot", "bet_size_choose", "bluff_pick"):
        return evaluate_decision_spot(step, str(user_response))
    elif step_type == "equity_predict":
        return evaluate_equity_predict(step, float(user_response))
    elif step_type == "range_build":
        return evaluate_range_build(step, list(user_response) if user_response else [])
    elif step_type in ("board_classify", "nut_advantage", "blocker_id", "range_identify"):
        return evaluate_classification(step, str(user_response))
    elif step_type == "concept_reveal":
        # Always pass — user just reads/acknowledges
        return StepEvalResult(100, "perfect", 0.0, "Concept noted.", None, 20)
    else:
        return StepEvalResult(50, "acceptable", 0.0, "Response recorded.", None, 15)
