"""
Deep user modeling — builds a rich profile for personalized coaching.

Extends the Phase 4 SkillSnapshot with:
  - Learning style detection (visual, analytical, experiential)
  - Tilt susceptibility estimation
  - Reasoning pattern analysis
  - Coaching responsiveness tracking
  - Optimal session length estimation

The user model is assembled from multiple data sources:
  - Skill dimensions (from coaching.skill_model)
  - Long-term memories (from ai_coach.memory)
  - Leak history
  - Session behavior patterns
  - Drill performance metrics
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from .memory import MemoryType, get_memory_store

logger = logging.getLogger(__name__)


class LearningStyle(str, Enum):
    """Detected learning preference — affects explanation approach."""
    ANALYTICAL = "analytical"       # Wants numbers, reasoning chains, theory
    EXPERIENTIAL = "experiential"   # Learns by doing — prefers drills over lectures
    VISUAL = "visual"               # Responds to diagrams, heatmaps, range grids
    SOCRATIC = "socratic"           # Learns best through guided questions
    UNKNOWN = "unknown"


class CoachingTone(str, Enum):
    """Preferred coaching interaction style."""
    SUPPORTIVE = "supportive"       # Gentle, encouraging, patient
    DIRECT = "direct"               # No-nonsense, efficient, to-the-point
    CHALLENGING = "challenging"     # Pushes hard, expects fast thinking
    ADAPTIVE = "adaptive"           # System decides per-interaction


@dataclass
class UserProfile:
    """
    Complete user profile assembled from all data sources.

    Injected into coaching context for personalization.
    """
    user_id: str

    # ── Skill ─────────────────────────────────────────────────────────────
    level: int = 1
    overall_rating: float = 50.0
    weakest_areas: list[str] = field(default_factory=list)
    strongest_areas: list[str] = field(default_factory=list)

    # ── Learning patterns ─────────────────────────────────────────────────
    learning_style: LearningStyle = LearningStyle.UNKNOWN
    preferred_tone: CoachingTone = CoachingTone.ADAPTIVE
    avg_session_minutes: float = 0.0
    drills_per_session: float = 0.0
    asks_for_detail: bool = False       # True if user often asks "why" or "explain more"
    gets_frustrated: bool = False       # True if user shows frustration patterns

    # ── Performance ───────────────────────────────────────────────────────
    drill_accuracy: float = 0.5
    hands_analyzed: int = 0
    drills_completed: int = 0
    sessions_completed: int = 0
    total_ev_loss_bb: float = 0.0

    # ── Active issues ─────────────────────────────────────────────────────
    active_leaks: list[str] = field(default_factory=list)
    recurring_mistakes: list[str] = field(default_factory=list)

    # ── Engagement ────────────────────────────────────────────────────────
    days_active: int = 0
    current_streak: int = 0
    last_active: datetime | None = None

    def to_prompt_summary(self) -> str:
        """
        Compact summary for injection into coaching system prompt.

        Kept under 200 words to conserve context budget.
        """
        parts = [f"Level {self.level} player (rating {self.overall_rating:.0f}/100)."]

        if self.weakest_areas:
            parts.append(f"Weakest: {', '.join(self.weakest_areas[:3])}.")
        if self.strongest_areas:
            parts.append(f"Strongest: {', '.join(self.strongest_areas[:2])}.")

        if self.learning_style != LearningStyle.UNKNOWN:
            parts.append(f"Learning style: {self.learning_style.value}.")

        if self.asks_for_detail:
            parts.append("Often asks for deeper explanations.")
        if self.gets_frustrated:
            parts.append("Can get frustrated — be encouraging.")

        if self.active_leaks:
            parts.append(f"Active leaks: {', '.join(self.active_leaks[:3])}.")
        if self.recurring_mistakes:
            parts.append(f"Recurring: {', '.join(self.recurring_mistakes[:2])}.")

        if self.drill_accuracy > 0.8:
            parts.append("High drill accuracy — ready for harder challenges.")
        elif self.drill_accuracy < 0.4:
            parts.append("Low drill accuracy — simplify and build confidence.")

        return " ".join(parts)

    def select_persona(self) -> str:
        """Select best coaching persona based on user profile."""
        if self.preferred_tone == CoachingTone.CHALLENGING:
            return "performance"
        if self.preferred_tone == CoachingTone.DIRECT:
            return "analyst"
        if self.preferred_tone == CoachingTone.SUPPORTIVE:
            return "mentor"

        # Adaptive: choose based on profile
        if self.gets_frustrated or self.level <= 5:
            return "mentor"
        if self.level >= 20 and self.drill_accuracy > 0.7:
            return "analyst"
        return "mentor"


def build_user_profile(user_id: str) -> UserProfile:
    """
    Assemble a UserProfile from all available data sources.

    In production, this queries Supabase/PostgreSQL tables.
    For MVP, uses in-memory data from the coaching and memory systems.
    """
    profile = UserProfile(user_id=user_id)
    memory_store = get_memory_store()

    # Load skill data
    try:
        from app.coaching.skill_model import UserSkillModel
        model = UserSkillModel(user_id)
        snap = model.snapshot
        profile.level = snap.level
        profile.overall_rating = snap.overall_rating
        profile.weakest_areas = snap.weakest_dimensions[:3]
        profile.strongest_areas = snap.strongest_dimensions[:3]
        profile.hands_analyzed = snap.hands_analyzed
        profile.drills_completed = snap.drills_completed
    except Exception:
        pass

    # Load memories for behavioral patterns
    memories = memory_store.retrieve_all(user_id, top_k=20)

    preference_memories = [m for m in memories if m.memory_type == MemoryType.PREFERENCE]
    mistake_memories = [m for m in memories if m.memory_type == MemoryType.MISTAKE_PATTERN]

    for mem in preference_memories:
        content_lower = mem.content.lower()
        if "simpler" in content_lower or "confused" in content_lower:
            profile.asks_for_detail = False
            profile.gets_frustrated = True
        if "deeper" in content_lower or "technical" in content_lower:
            profile.asks_for_detail = True

    # Detect learning style from memory patterns
    if profile.asks_for_detail:
        profile.learning_style = LearningStyle.ANALYTICAL
    elif profile.drills_completed > profile.hands_analyzed * 2:
        profile.learning_style = LearningStyle.EXPERIENTIAL
    elif profile.hands_analyzed > 0:
        profile.learning_style = LearningStyle.SOCRATIC

    # Active leaks
    profile.active_leaks = list({
        tag for mem in mistake_memories for tag in mem.concept_tags
    })[:5]

    # Recurring mistakes
    from collections import Counter
    mistake_concepts = Counter(
        tag for mem in mistake_memories for tag in mem.concept_tags
    )
    profile.recurring_mistakes = [
        concept for concept, count in mistake_concepts.most_common(3) if count >= 2
    ]

    return profile
