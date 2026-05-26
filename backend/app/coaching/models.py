"""
Coaching models — data structures for the coaching intelligence layer.

Design principle: every model must be JSON-serializable and UI-friendly.
No raw solver artifacts should leak into these models — they represent
the *coaching interpretation* of solver data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Mistake Detection ─────────────────────────────────────────────────────


class MistakeSeverity(str, Enum):
    """Calibrated severity levels — must not over-punish close decisions."""
    NONE = "none"             # Action matches solver preference
    TRIVIAL = "trivial"       # <0.5% EV loss — mixed strategy noise
    MINOR = "minor"           # 0.5-2% EV loss — slight frequency deviation
    MODERATE = "moderate"     # 2-5% EV loss — missed better option
    MAJOR = "major"           # 5-15% EV loss — significant strategic error
    CRITICAL = "critical"     # >15% EV loss — game-changing blunder


class ActionQuality(str, Enum):
    """Human-readable action quality labels for UI display."""
    OPTIMAL = "optimal"       # Highest-frequency solver action
    GOOD = "good"             # Solver mixes this action at >20%
    ACCEPTABLE = "acceptable" # Solver mixes this action at 5-20%
    INACCURACY = "inaccuracy" # Solver mixes at <5% — slight deviation
    MISTAKE = "mistake"       # Solver never uses this action
    BLUNDER = "blunder"       # Action loses significant EV


class MistakeReport(BaseModel):
    """Complete analysis of a single user action vs solver strategy."""

    # ── Action identity ───────────────────────────────────────────────────
    street: str                         # "flop", "turn", "river"
    action_taken: str                   # "bet 75%", "check", "fold"
    action_type: str                    # "bet", "check", "fold", "call", "raise"

    # ── Severity scoring ──────────────────────────────────────────────────
    severity: MistakeSeverity = MistakeSeverity.NONE
    quality: ActionQuality = ActionQuality.GOOD
    ev_loss_pct: float = 0.0            # EV loss as % of pot (0.0 = perfect)
    ev_loss_bb: float = 0.0             # EV loss in big blinds

    # ── Solver comparison ─────────────────────────────────────────────────
    solver_frequency: float = 0.0       # How often solver uses this action [0,1]
    solver_preferred_action: str = ""   # Highest-frequency solver action
    solver_preferred_freq: float = 0.0  # Frequency of preferred action
    solver_confidence: float = 0.0      # Confidence in solver data [0,1]

    # ── Frequency context ─────────────────────────────────────────────────
    # Solver action distribution (simplified for UI)
    action_distribution: dict[str, float] = Field(default_factory=dict)

    # ── Coaching ──────────────────────────────────────────────────────────
    explanation: str = ""               # Human-readable explanation
    concept_tags: list[str] = Field(default_factory=list)  # For leak detection
    difficulty: float = 0.0             # How hard was this decision? [0,1]

    def is_mistake(self) -> bool:
        return self.severity.value not in ("none", "trivial")


class CoachingAdvice(BaseModel):
    """Human-readable coaching output — the primary UI-facing model."""

    # ── Summary ───────────────────────────────────────────────────────────
    headline: str = ""                  # One-line takeaway (≤80 chars)
    verdict: str = ""                   # "well played", "minor inaccuracy", etc.
    score: int = 0                      # 0-100 action quality score

    # ── Explanation blocks (ordered for display) ──────────────────────────
    spot_description: str = ""          # "SRP, BTN vs BB, 100bb deep on A♠K♠3♥"
    what_happened: str = ""             # "You checked the flop"
    why_its_right: str = ""             # Populated when action is good
    why_its_wrong: str = ""             # Populated when action is a mistake
    what_to_do_instead: str = ""        # "Bet 75% pot with this hand"
    transferable_concept: str = ""      # One principle to remember

    # ── Simplified strategy ───────────────────────────────────────────────
    simplified_strategy: str = ""       # "Bet often on dry A-high boards as PFR"
    strategy_reasoning: str = ""        # Why this strategy works
    key_factors: list[str] = Field(default_factory=list)  # 2-3 bullet points

    # ── Metadata ──────────────────────────────────────────────────────────
    confidence: float = 0.0             # How confident is this advice [0,1]
    source: str = "heuristic"           # "solver", "heuristic", "hybrid"


# ── Action Scoring ────────────────────────────────────────────────────────


class ActionScore(BaseModel):
    """Scored action for UI display and tracking."""
    action_index: int                   # Index in hand action sequence
    street: str
    action: str                         # "bet 75%", "check", etc.
    is_hero: bool = True

    # Scoring
    score: int = 50                     # 0-100
    quality: ActionQuality = ActionQuality.GOOD
    difficulty: float = 0.5             # 0=trivial, 1=extremely hard

    # Solver comparison
    mistake: MistakeReport | None = None
    advice: CoachingAdvice | None = None


class HandScore(BaseModel):
    """Aggregate score for an entire hand."""
    overall_score: int = 50             # 0-100, weighted average of action scores
    actions: list[ActionScore] = Field(default_factory=list)
    mistakes_count: int = 0
    worst_mistake: MistakeReport | None = None
    total_ev_loss_bb: float = 0.0

    # Grading
    grade: str = "B"                    # A+, A, B+, B, C+, C, D, F
    grade_label: str = "Solid"          # "Elite", "Solid", "Needs Work", "Poor"


# ── Drill System ──────────────────────────────────────────────────────────


class DrillType(str, Enum):
    CBET_OR_CHECK = "cbet_or_check"       # Decide: bet or check as PFR on flop
    DEFEND_OR_FOLD = "defend_or_fold"     # Defend or fold facing a bet
    BET_SIZE_SELECT = "bet_size_select"   # Pick the right sizing
    BLUFF_OR_GIVE_UP = "bluff_or_give_up" # Bluff candidate selection
    VALUE_BET_THIN = "value_bet_thin"     # Thin value on river
    RANGE_CONSTRUCTION = "range_construction"  # Build a betting/checking range


class DrillDifficulty(str, Enum):
    BEGINNER = "beginner"       # Clear-cut spots, high solver frequency
    INTERMEDIATE = "intermediate"  # Mixed spots, 30-70% frequencies
    ADVANCED = "advanced"       # Thin margins, close EV decisions


class DrillSpec(BaseModel):
    """A generated training drill from the solve database."""
    drill_id: str
    drill_type: DrillType
    difficulty: DrillDifficulty

    # Spot definition
    board: list[str]
    spot_type: str                      # "SRP", "3BET"
    positions: str                      # "BTN_vs_BB"
    stack_depth: int = 100
    street: str = "flop"
    hero_is_ip: bool = True

    # Question
    prompt: str = ""                    # "You are BTN in a SRP vs BB. Board: A♠K♠3♥..."
    options: list[DrillOption] = Field(default_factory=list)
    correct_action: str = ""            # Primary correct answer
    explanation: str = ""               # Why the correct action is best

    # Solver backing
    solver_distribution: dict[str, float] = Field(default_factory=dict)
    concept_tags: list[str] = Field(default_factory=list)

    # Metadata
    board_class: str = ""
    cluster_id: str = ""


class DrillOption(BaseModel):
    """A single option in a drill question."""
    action: str                         # "bet_75", "check", "fold"
    label: str                          # "Bet 75% pot", "Check", "Fold"
    is_correct: bool = False
    is_acceptable: bool = False         # True if solver mixes >5%
    solver_frequency: float = 0.0       # How often solver does this
    feedback: str = ""                  # Shown after answer


class DrillResult(BaseModel):
    """User's performance on a single drill."""
    drill_id: str
    drill_type: DrillType
    action_chosen: str
    is_correct: bool
    is_acceptable: bool
    score: int = 0                      # 0-100
    time_ms: int = 0
    concept_tags: list[str] = Field(default_factory=list)


# ── Skill Model ───────────────────────────────────────────────────────────


class SkillDimension(str, Enum):
    """Strategic dimensions tracked for each user."""
    CBET_ACCURACY = "cbet_accuracy"
    DEFENSE_ACCURACY = "defense_accuracy"
    BET_SIZING = "bet_sizing"
    BLUFF_SELECTION = "bluff_selection"
    VALUE_BETTING = "value_betting"
    RANGE_AWARENESS = "range_awareness"
    POSITION_AWARENESS = "position_awareness"
    BOARD_READING = "board_reading"
    POT_CONTROL = "pot_control"
    SPR_AWARENESS = "spr_awareness"


class SkillSnapshot(BaseModel):
    """User's skill profile at a point in time."""
    user_id: str
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )

    # Per-dimension ratings (0-100)
    dimensions: dict[str, float] = Field(default_factory=dict)

    # Aggregate
    overall_rating: float = 50.0        # Weighted average
    level: int = 1                      # 1-30
    total_xp: int = 0
    hands_analyzed: int = 0
    drills_completed: int = 0

    # Weakest areas (for training prioritization)
    weakest_dimensions: list[str] = Field(default_factory=list)
    strongest_dimensions: list[str] = Field(default_factory=list)

    # Recent trends
    rating_trend: str = "stable"        # "improving", "stable", "declining"
    recent_accuracy_pct: float = 0.0


class LeakProfile(BaseModel):
    """Identified strategic weakness with evidence."""
    concept_id: str
    dimension: SkillDimension
    severity: str                       # "mild", "moderate", "severe"
    frequency: float = 0.0             # How often this leak appears [0,1]
    evidence_count: int = 0
    avg_ev_loss_bb: float = 0.0
    description: str = ""
    recommended_drill_type: DrillType | None = None
    last_seen: datetime | None = None
