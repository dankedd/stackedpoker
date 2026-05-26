"""
User skill model — tracks strategic proficiency across dimensions.

Each user has a SkillSnapshot updated after every hand analysis and drill.
The model identifies weakest areas for targeted training and tracks
improvement over time.

Skill dimensions:
  10 strategic dimensions (SkillDimension enum), each rated 0-100.
  Overall rating is a weighted average.

Update algorithm:
  Uses Exponential Moving Average (EMA) to smooth ratings and prevent
  single-hand variance from dominating:
    new_rating = alpha * action_score + (1 - alpha) * old_rating
    alpha = 0.15 for analysis, 0.10 for drills (drills are less noisy)

Leak detection:
  A dimension with rating < 40 and > 5 data points is flagged as a leak.
  Leaks are prioritized by severity (lowest rating first) for drill generation.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from .models import (
    DrillResult,
    DrillType,
    LeakProfile,
    MistakeReport,
    SkillDimension,
    SkillSnapshot,
)

logger = logging.getLogger(__name__)

# EMA smoothing factors
_ANALYSIS_ALPHA = 0.15     # Weight of new observation from hand analysis
_DRILL_ALPHA = 0.10        # Weight of new observation from drills (less noisy)
_MIN_OBSERVATIONS = 5      # Before flagging leaks

# Leak thresholds
_LEAK_THRESHOLD = 40        # Below this rating → leak
_SEVERE_LEAK_THRESHOLD = 25 # Below this → severe leak

# Dimension weights for overall rating (sum to 1.0)
_DIMENSION_WEIGHTS: dict[SkillDimension, float] = {
    SkillDimension.CBET_ACCURACY: 0.15,
    SkillDimension.DEFENSE_ACCURACY: 0.15,
    SkillDimension.BET_SIZING: 0.10,
    SkillDimension.BLUFF_SELECTION: 0.10,
    SkillDimension.VALUE_BETTING: 0.10,
    SkillDimension.RANGE_AWARENESS: 0.10,
    SkillDimension.POSITION_AWARENESS: 0.08,
    SkillDimension.BOARD_READING: 0.08,
    SkillDimension.POT_CONTROL: 0.07,
    SkillDimension.SPR_AWARENESS: 0.07,
}

# Map concept tags to skill dimensions
_TAG_TO_DIMENSION: dict[str, SkillDimension] = {
    "cbet_theory": SkillDimension.CBET_ACCURACY,
    "range_advantage": SkillDimension.RANGE_AWARENESS,
    "mdf": SkillDimension.DEFENSE_ACCURACY,
    "fold_too_much": SkillDimension.DEFENSE_ACCURACY,
    "over_aggression": SkillDimension.POT_CONTROL,
    "bet_sizing": SkillDimension.BET_SIZING,
    "nut_advantage": SkillDimension.RANGE_AWARENESS,
    "pot_control": SkillDimension.POT_CONTROL,
    "spr_theory": SkillDimension.SPR_AWARENESS,
    "blocker_effects": SkillDimension.BLUFF_SELECTION,
}

# Map drill types to skill dimensions
_DRILL_TO_DIMENSION: dict[DrillType, SkillDimension] = {
    DrillType.CBET_OR_CHECK: SkillDimension.CBET_ACCURACY,
    DrillType.DEFEND_OR_FOLD: SkillDimension.DEFENSE_ACCURACY,
    DrillType.BET_SIZE_SELECT: SkillDimension.BET_SIZING,
    DrillType.BLUFF_OR_GIVE_UP: SkillDimension.BLUFF_SELECTION,
    DrillType.VALUE_BET_THIN: SkillDimension.VALUE_BETTING,
    DrillType.RANGE_CONSTRUCTION: SkillDimension.RANGE_AWARENESS,
}


class UserSkillModel:
    """
    Tracks and updates a user's skill profile.

    Maintains an in-memory SkillSnapshot. In production, load/save from
    the user_progress table in PostgreSQL/Supabase.
    """

    def __init__(self, user_id: str, snapshot: SkillSnapshot | None = None) -> None:
        self._user_id = user_id
        self._snapshot = snapshot or SkillSnapshot(
            user_id=user_id,
            dimensions={dim.value: 50.0 for dim in SkillDimension},
        )
        self._observation_counts: dict[str, int] = {
            dim.value: 0 for dim in SkillDimension
        }

    @property
    def snapshot(self) -> SkillSnapshot:
        return self._snapshot

    def update_from_mistake(self, mistake: MistakeReport) -> None:
        """Update skill model from a mistake report (hand analysis)."""
        if not mistake.concept_tags:
            return

        score = {
            "optimal": 95, "good": 82, "acceptable": 68,
            "inaccuracy": 45, "mistake": 25, "blunder": 10,
        }.get(mistake.quality.value, 50)

        for tag in mistake.concept_tags:
            dim = _TAG_TO_DIMENSION.get(tag)
            if dim is None:
                continue
            self._update_dimension(dim.value, score, _ANALYSIS_ALPHA)

        self._recompute_overall()

    def update_from_drill(self, result: DrillResult) -> None:
        """Update skill model from a drill result."""
        dim = _DRILL_TO_DIMENSION.get(result.drill_type)
        if dim is None:
            # Try concept tags
            for tag in result.concept_tags:
                dim = _TAG_TO_DIMENSION.get(tag)
                if dim:
                    break

        if dim is None:
            return

        self._update_dimension(dim.value, result.score, _DRILL_ALPHA)
        self._snapshot.drills_completed += 1
        self._recompute_overall()

    def update_from_hand_analysis(self, mistakes: list[MistakeReport]) -> None:
        """Batch update from a full hand analysis."""
        for mistake in mistakes:
            self.update_from_mistake(mistake)
        self._snapshot.hands_analyzed += 1

    def _update_dimension(self, dim_key: str, score: int, alpha: float) -> None:
        """EMA update for a single dimension."""
        old = self._snapshot.dimensions.get(dim_key, 50.0)
        new = alpha * score + (1 - alpha) * old
        self._snapshot.dimensions[dim_key] = round(new, 1)
        self._observation_counts[dim_key] = self._observation_counts.get(dim_key, 0) + 1

    def _recompute_overall(self) -> None:
        """Recompute overall rating from dimension ratings."""
        total = 0.0
        weight_sum = 0.0
        for dim, weight in _DIMENSION_WEIGHTS.items():
            rating = self._snapshot.dimensions.get(dim.value, 50.0)
            total += rating * weight
            weight_sum += weight
        self._snapshot.overall_rating = round(total / weight_sum, 1)

        # Update weakest/strongest
        sorted_dims = sorted(
            self._snapshot.dimensions.items(),
            key=lambda x: x[1],
        )
        self._snapshot.weakest_dimensions = [d for d, _ in sorted_dims[:3]]
        self._snapshot.strongest_dimensions = [d for d, _ in sorted_dims[-3:]]
        self._snapshot.timestamp = datetime.now(timezone.utc)

    def detect_leaks(self) -> list[LeakProfile]:
        """Identify skill dimensions that qualify as leaks."""
        leaks = []
        for dim in SkillDimension:
            rating = self._snapshot.dimensions.get(dim.value, 50.0)
            obs = self._observation_counts.get(dim.value, 0)

            if obs < _MIN_OBSERVATIONS:
                continue
            if rating >= _LEAK_THRESHOLD:
                continue

            severity = "severe" if rating < _SEVERE_LEAK_THRESHOLD else "moderate"
            recommended_drill = _dimension_to_drill(dim)

            leaks.append(LeakProfile(
                concept_id=dim.value,
                dimension=dim,
                severity=severity,
                frequency=0.0,  # Populated from historical data
                evidence_count=obs,
                avg_ev_loss_bb=0.0,
                description=f"Consistently scoring below threshold in {dim.value.replace('_', ' ')}",
                recommended_drill_type=recommended_drill,
            ))

        leaks.sort(key=lambda l: self._snapshot.dimensions.get(l.concept_id, 50))
        return leaks

    def get_training_priority(self) -> list[tuple[SkillDimension, float]]:
        """
        Get skill dimensions ranked by training priority (weakest first).

        Returns list of (dimension, priority_score) tuples.
        """
        priorities = []
        for dim in SkillDimension:
            rating = self._snapshot.dimensions.get(dim.value, 50.0)
            weight = _DIMENSION_WEIGHTS.get(dim, 0.05)
            # Priority = weight * (100 - rating) — higher weight + lower rating = more urgent
            priority = weight * (100.0 - rating)
            priorities.append((dim, round(priority, 2)))

        priorities.sort(key=lambda x: -x[1])
        return priorities


def _dimension_to_drill(dim: SkillDimension) -> DrillType | None:
    """Map skill dimension to the best drill type for improvement."""
    return {
        SkillDimension.CBET_ACCURACY: DrillType.CBET_OR_CHECK,
        SkillDimension.DEFENSE_ACCURACY: DrillType.DEFEND_OR_FOLD,
        SkillDimension.BET_SIZING: DrillType.BET_SIZE_SELECT,
        SkillDimension.BLUFF_SELECTION: DrillType.BLUFF_OR_GIVE_UP,
        SkillDimension.VALUE_BETTING: DrillType.VALUE_BET_THIN,
        SkillDimension.RANGE_AWARENESS: DrillType.RANGE_CONSTRUCTION,
    }.get(dim)
