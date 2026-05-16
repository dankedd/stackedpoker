"""Recommend next lessons and concepts based on user state."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Map concept_id → lesson slug that best addresses it
CONCEPT_TO_LESSON: dict[str, str] = {
    "mdf":             "mdf-defense-drill",
    "alpha":           "bluff-frequency-basics",
    "range_advantage": "range-advantage-intro",
    "nut_advantage":   "nut-advantage-reads",
    "cbet_theory":     "cbet-fundamentals",
    "equity_real":     "equity-realization-basics",
    "spr_theory":      "spr-commitment-thresholds",
    "blockers":        "blocker-effects-intro",
    "polarized":       "polarized-vs-merged",
    "pot_odds":        "pot-odds-intuition",
    "board_texture":   "board-texture-classification",
    "position_value":  "position-fundamentals",
    "value_betting":   "value-betting-basics",
    "bluff_basics":    "bluff-fundamentals",
    "hand_ranges":     "range-construction-intro",
    "geometric_sizing":"geometric-sizing-drill",
}

@dataclass
class Recommendation:
    lesson_slug: str | None
    concept_id: str | None
    reason: str

def recommend_next_lesson(
    active_leaks: list[dict],
    weak_concepts: list[dict],
    completed_lessons: list[str],
) -> Recommendation:
    """
    Priority: severe leaks > moderate leaks > weak concepts > generic next lesson.
    """
    # 1. Severe leaks first
    for leak in sorted(active_leaks, key=lambda l: {"severe":0,"moderate":1,"mild":2}.get(l.get("severity","mild"), 2)):
        cid = leak.get("concept_id")
        if cid and cid in CONCEPT_TO_LESSON:
            slug = CONCEPT_TO_LESSON[cid]
            if slug not in completed_lessons:
                return Recommendation(lesson_slug=slug, concept_id=cid,
                                      reason=f"You have a {leak.get('severity','moderate')} leak in {cid.replace('_',' ').title()}")

    # 2. Weak concepts
    for cm in sorted(weak_concepts, key=lambda c: c.get("mastery_level", 0)):
        cid = cm.get("concept_id")
        if cid and cid in CONCEPT_TO_LESSON:
            slug = CONCEPT_TO_LESSON[cid]
            if slug not in completed_lessons:
                return Recommendation(lesson_slug=slug, concept_id=cid,
                                      reason=f"Strengthen your understanding of {cid.replace('_',' ').title()}")

    # 3. Fallback — start of curriculum
    return Recommendation(lesson_slug="positions-fundamentals", concept_id="position_value",
                          reason="Continue your learning journey")

def get_review_concepts(concept_masteries: list[dict]) -> list[dict]:
    """Return concepts due for spaced repetition review."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    due = []
    for cm in concept_masteries:
        nr = cm.get("next_review")
        if nr is None:
            due.append(cm)
            continue
        if isinstance(nr, str):
            try:
                nr_dt = datetime.fromisoformat(nr.replace("Z", "+00:00"))
                if now >= nr_dt:
                    due.append(cm)
            except ValueError:
                due.append(cm)
    return due[:5]  # max 5 reviews at a time
