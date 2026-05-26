"""
AI content generator — creates personalized lessons, drills, and explanations.

Generates:
  1. Micro-lessons targeting user's weakest areas
  2. Conversational drill feedback
  3. Hand review narratives
  4. Study plan recommendations
  5. Concept explanations adapted to skill level

All generated content is grounded via the context assembly system.
No strategic content is generated from LLM training data alone.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

from .context import build_coaching_context
from .prompts import LESSON_GENERATOR_SYSTEM, build_system_prompt
from .user_model import build_user_profile
from .safety import check_output

logger = logging.getLogger(__name__)


async def generate_micro_lesson(
    user_id: str,
    concept_focus: str | None = None,
) -> dict:
    """
    Generate a personalized micro-lesson targeting the user's weakest area.

    Returns a structured lesson dict:
      {title, concept, example, question, takeaway, target_concept}
    """
    profile = build_user_profile(user_id)

    # Determine target concept
    if concept_focus:
        target = concept_focus
    elif profile.weakest_areas:
        target = profile.weakest_areas[0]
    elif profile.active_leaks:
        target = profile.active_leaks[0]
    else:
        target = "range_awareness"

    # Build context
    ctx = build_coaching_context(
        user_id,
        concept_tags=[target],
        extra_context={
            "target_concept": target,
            "user_summary": profile.to_prompt_summary(),
        },
    )

    system_prompt = build_system_prompt(
        LESSON_GENERATOR_SYSTEM,
        persona="mentor",
        level=profile.level,
        max_words=250,
        context_text=ctx.render(),
    )

    try:
        settings = get_settings()
        import openai
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate a micro-lesson about {target.replace('_', ' ')} for me."},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        raw = response.choices[0].message.content or ""
        sanitized, warnings = check_output(raw, context_has_solver=False)

        # Parse structured output
        lesson = _parse_lesson_output(sanitized, target)
        lesson["warnings"] = warnings
        return lesson

    except Exception as exc:
        logger.error("[Generator] Micro-lesson generation failed: %s", exc)
        return _fallback_lesson(target, profile.level)


def _parse_lesson_output(text: str, target_concept: str) -> dict:
    """Parse the structured lesson output from LLM."""
    result = {
        "title": "",
        "concept": "",
        "example": "",
        "question": "",
        "takeaway": "",
        "target_concept": target_concept,
        "raw": text,
    }

    current_key = None
    current_lines: list[str] = []

    for line in text.split("\n"):
        line_stripped = line.strip()
        lower = line_stripped.lower()

        if lower.startswith("title:"):
            if current_key:
                result[current_key] = "\n".join(current_lines).strip()
            current_key = "title"
            current_lines = [line_stripped[6:].strip()]
        elif lower.startswith("concept:"):
            if current_key:
                result[current_key] = "\n".join(current_lines).strip()
            current_key = "concept"
            current_lines = [line_stripped[8:].strip()]
        elif lower.startswith("example:"):
            if current_key:
                result[current_key] = "\n".join(current_lines).strip()
            current_key = "example"
            current_lines = [line_stripped[8:].strip()]
        elif lower.startswith("question:"):
            if current_key:
                result[current_key] = "\n".join(current_lines).strip()
            current_key = "question"
            current_lines = [line_stripped[9:].strip()]
        elif lower.startswith("takeaway:"):
            if current_key:
                result[current_key] = "\n".join(current_lines).strip()
            current_key = "takeaway"
            current_lines = [line_stripped[9:].strip()]
        elif current_key:
            current_lines.append(line_stripped)

    if current_key:
        result[current_key] = "\n".join(current_lines).strip()

    return result


def _fallback_lesson(target: str, level: int) -> dict:
    """Deterministic fallback when LLM is unavailable."""
    concept_map = {
        "cbet_accuracy": {
            "title": "When to C-Bet",
            "concept": "C-betting frequency depends on your range advantage on the board.",
            "example": "On Ah 7d 2c, the PFR has a strong range advantage and should bet frequently.",
            "question": "On 8s 7d 6c, should the PFR c-bet as often? Why or why not?",
            "takeaway": "C-bet more on boards that favor your range, check more on boards that connect with the caller.",
        },
        "defense_accuracy": {
            "title": "Defending Against C-Bets",
            "concept": "You need to defend enough to prevent the bettor from profiting with any two cards.",
            "example": "Against a half-pot bet, you need to continue with at least 67% of your range.",
            "question": "If someone bets full pot, what percentage of your range should you defend?",
            "takeaway": "The bigger the bet, the less you need to defend — but never fold too much.",
        },
    }

    lesson = concept_map.get(target, {
        "title": f"Improving Your {target.replace('_', ' ').title()}",
        "concept": "Focus on this strategic dimension in your next training session.",
        "example": "Look at your recent hands for patterns in this area.",
        "question": "What do you think is the most important factor in this type of decision?",
        "takeaway": "Consistent practice with targeted drills accelerates improvement.",
    })

    return {**lesson, "target_concept": target, "warnings": ["fallback_used"]}


async def generate_study_plan(user_id: str, days: int = 7) -> dict:
    """
    Generate a personalized study plan for the next N days.

    Returns a structured plan with daily focus areas and drill recommendations.
    """
    profile = build_user_profile(user_id)

    # Build plan from profile weaknesses
    plan_days = []
    focus_rotation = (profile.weakest_areas or ["cbet_accuracy", "defense_accuracy"]) * days

    drill_map = {
        "cbet_accuracy": "cbet_or_check",
        "defense_accuracy": "defend_or_fold",
        "bet_sizing": "bet_size_select",
        "bluff_selection": "bluff_or_give_up",
        "value_betting": "value_bet_thin",
        "range_awareness": "range_construction",
    }

    for i in range(days):
        focus = focus_rotation[i % len(focus_rotation)]
        plan_days.append({
            "day": i + 1,
            "focus_area": focus,
            "recommended_drill": drill_map.get(focus, "cbet_or_check"),
            "drill_count": 10 if i < 3 else 5,
            "review_hands": max(1, 3 - i // 3),
            "estimated_minutes": 15 if i < 3 else 10,
        })

    return {
        "user_id": user_id,
        "days": days,
        "level": profile.level,
        "primary_focus": profile.weakest_areas[:2] if profile.weakest_areas else [],
        "plan": plan_days,
        "total_estimated_minutes": sum(d["estimated_minutes"] for d in plan_days),
    }
