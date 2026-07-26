"""Server-side context resolution for the AI Coach.

Two responsibilities, both enforced here rather than trusted from the client:

1. Answer-leak protection — fields that would reveal a graded step's correct
   answer are only forwarded into the LLM prompt when this module (not the
   client) has established the learner is legitimately entitled to see them.
2. Theory grounding — best-effort retrieval from the existing Acevedo
   knowledge base (the single source of validated theory already used by the
   advice layer) so the coach explains established principles instead of
   inventing them.
"""

from __future__ import annotations

import logging
from typing import Any

from app.engines.theory.acevedo_knowledge import AcevedoConcept, get_concept
from app.ranges.preflop.cash_100bb.registry import get_range

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000

# Position -> open-range (RFI) registry key. Only the five unopened-pot
# positions have a chart — BB has no "open" (it's always facing action).
_OPEN_RANGE_KEYS: dict[str, str] = {
    "UTG": "UTG_OPEN", "HJ": "HJ_OPEN", "CO": "CO_OPEN", "BTN": "BTN_OPEN", "SB": "SB_OPEN",
}

# Any of these keys, if present in a client-supplied context, could reveal the
# graded answer to a step the learner has not (or not verifiably) completed.
# Stripped unless the resolved mode legitimately allows them through.
ANSWER_KEY_FIELDS = frozenset({
    "correctAnswer", "correct_answer", "evaluatorFeedback", "evaluator_feedback",
    "answer_reveal", "correct_feedback", "target", "targetValue", "target_value",
    "solution", "quality",
})


def resolve_coaching_mode(context: dict[str, Any], step_verified: bool) -> str:
    """Determine the coaching mode for this request.

    - "lesson_review": aggregate post-lesson review (client sends `lessonReview`,
      which by construction only exists once every step in the lesson has
      already been scored — there is no "hidden" answer left to protect).
    - "post_submission": a single-step scope (`lessonId` + `stepId`) where the
      server independently verified — via a persisted `user_step_progress`
      row — that the learner already completed that exact step.
    - "pre_submission": a single-step scope where no such server-verified
      completion exists. Answer-key fields are stripped regardless of what
      the client claims.
    - "general": no specific step/lesson scope at all (open-ended chat).
    """
    if context.get("lessonReview"):
        return "lesson_review"
    if context.get("lessonId") and context.get("stepId"):
        return "post_submission" if step_verified else "pre_submission"
    return "general"


def sanitize_context(context: dict[str, Any], mode: str) -> dict[str, Any]:
    """Strip answer-key-shaped fields unless `mode` legitimately allows them.

    Defense in depth: even though the system prompt also instructs the model
    never to reveal an answer in pre-submission mode, the data itself is
    removed here so a leak can't happen through prompt-injection or a model
    mistake — the field simply isn't in the context it sees.
    """
    if mode in ("post_submission", "lesson_review"):
        return dict(context)
    return {k: v for k, v in context.items() if k not in ANSWER_KEY_FIELDS}


def ground_theory(concept_ids: list[str] | None, max_concepts: int = 3) -> list[dict[str, str]]:
    """Best-effort direct lookup of validated theory for the concepts in play.

    Reuses the existing Acevedo knowledge base — the project's single source
    of theory for the advice layer — rather than building a second retrieval
    system. Concepts with no matching entry are silently skipped; grounding
    is additive, never required for the coach to respond.
    """
    if not concept_ids:
        return []
    grounded: list[dict[str, str]] = []
    for cid in concept_ids:
        concept: AcevedoConcept | None = get_concept(cid)
        if concept is None:
            continue
        grounded.append({
            "id": concept.id,
            "name": concept.name,
            "principle": concept.strategic_principle,
            "confidence": concept.confidence.value,
            "hedging": concept.hedging_language,
        })
        if len(grounded) >= max_concepts:
            break
    return grounded


def lookup_canonical_open_range(context: dict[str, Any]) -> dict[str, Any] | None:
    """Best-effort real-data lookup for an unopened-pot (RFI) preflop spot.

    Only returns data when we can trust it: a specific hand, a position that
    actually opens (UTG/HJ/CO/BTN/SB — BB never does), no villain_position
    (this chart only covers the open decision, not a vs-position defend/3bet
    spot), and an effective stack within our single supported chart depth
    (100bb, +/-5bb — this codebase has no other stack-depth chart). Outside
    those conditions, returns None so the coach falls back to general
    reasoning/qualitative estimates rather than misrepresenting a mismatched
    chart as canonical.

    The returned `canonical_strategy` is a true complement ({raise, fold})
    derived from one real weight, not an invented number — an RFI decision's
    only two actions are raise or fold.
    """
    position = context.get("hero_position")
    hand = context.get("hand")
    stack_bb = context.get("effective_stack_bb")
    if context.get("villain_position") or not hand or position not in _OPEN_RANGE_KEYS:
        return None
    if not isinstance(stack_bb, (int, float)) or abs(stack_bb - 100) > 5:
        return None

    try:
        raise_weight = get_range(_OPEN_RANGE_KEYS[position]).get_weight(hand)
    except Exception:
        logger.warning("canonical_range_lookup_failed position=%s hand=%s", position, hand)
        return None

    return {
        "spot": {"position": position, "stack_bb": 100, "action": "RFI"},
        "hand": hand,
        "canonical_strategy": {"raise": raise_weight, "fold": round(1 - raise_weight, 4)},
    }


def extract_concept_ids(context: dict[str, Any]) -> list[str]:
    """Pull concept ids out of whichever context shape is present, for grounding."""
    if context.get("lessonReview"):
        review = context["lessonReview"]
        ids = list(review.get("weakConcepts") or []) + list(review.get("strongConcepts") or [])
        return ids
    ids = context.get("concept_ids") or context.get("conceptIds")
    return list(ids) if ids else []
