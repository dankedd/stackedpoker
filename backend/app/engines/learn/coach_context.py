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

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000

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


def extract_concept_ids(context: dict[str, Any]) -> list[str]:
    """Pull concept ids out of whichever context shape is present, for grounding."""
    if context.get("lessonReview"):
        review = context["lessonReview"]
        ids = list(review.get("weakConcepts") or []) + list(review.get("strongConcepts") or [])
        return ids
    ids = context.get("concept_ids") or context.get("conceptIds")
    return list(ids) if ids else []
