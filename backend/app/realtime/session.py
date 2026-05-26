"""
Live session copilot — tracks multi-hand sessions with rolling analysis.

Maintains aggregate statistics across hands, detects session-level patterns,
and generates coaching summaries. Operates in three modes:

  TRAINING:     Full live feedback (private study sessions)
  OBSERVATION:  Delayed feedback (watching live play, ethical compliance)
  POST_SESSION: Analysis only after session ends

Session-level intelligence:
  - Rolling VPIP, PFR, aggression stats
  - Leak accumulation across hands
  - Tilt detection from behavioral patterns
  - Dynamic coaching priority shifts
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .engine import AnalysisMode, RealtimeAnalysisEngine

logger = logging.getLogger(__name__)


@dataclass
class SessionStats:
    """Rolling statistics for the current session."""
    hands_played: int = 0
    hands_won: int = 0

    # Aggression / passivity
    vpip_count: int = 0        # Hands where hero voluntarily put money in
    pfr_count: int = 0         # Hands where hero raised preflop
    cbet_opportunities: int = 0
    cbet_made: int = 0
    fold_to_cbet_count: int = 0
    fold_to_cbet_opportunities: int = 0

    # Mistakes
    total_mistakes: int = 0
    total_ev_loss_bb: float = 0.0
    mistake_streets: dict[str, int] = field(default_factory=lambda: {
        "preflop": 0, "flop": 0, "turn": 0, "river": 0,
    })

    # Concept leaks (concept_tag → count)
    leak_accumulator: dict[str, int] = field(default_factory=dict)

    # Behavioral signals
    actions_per_hand: list[int] = field(default_factory=list)
    decision_times_ms: list[float] = field(default_factory=list)

    @property
    def vpip_pct(self) -> float:
        return (self.vpip_count / max(self.hands_played, 1)) * 100

    @property
    def pfr_pct(self) -> float:
        return (self.pfr_count / max(self.hands_played, 1)) * 100

    @property
    def cbet_pct(self) -> float:
        return (self.cbet_made / max(self.cbet_opportunities, 1)) * 100

    @property
    def avg_ev_loss_per_hand(self) -> float:
        return self.total_ev_loss_bb / max(self.hands_played, 1)

    @property
    def top_leaks(self) -> list[tuple[str, int]]:
        return sorted(self.leak_accumulator.items(), key=lambda x: -x[1])[:5]


class LiveSessionCopilot:
    """
    Manages a multi-hand live coaching session.

    Usage:
        copilot = LiveSessionCopilot(user_id="u1", mode=AnalysisMode.INSTANT)
        copilot.start_session()

        # For each hand:
        copilot.start_hand(hand_id="h1", hero_position="BTN", ...)
        result = copilot.process_action(street="flop", ...)
        summary = copilot.end_hand()

        # End of session:
        recap = copilot.end_session()
    """

    def __init__(
        self,
        user_id: str,
        mode: AnalysisMode = AnalysisMode.INSTANT,
        session_id: str = "",
    ) -> None:
        self._user_id = user_id
        self._session_id = session_id
        self._mode = mode
        self._engine = RealtimeAnalysisEngine(mode=mode)
        self._stats = SessionStats()
        self._started_at = datetime.now(timezone.utc)
        self._hand_summaries: list[dict] = []

    @property
    def stats(self) -> SessionStats:
        return self._stats

    def start_session(self) -> None:
        self._started_at = datetime.now(timezone.utc)
        self._stats = SessionStats()
        self._hand_summaries = []
        logger.info("[Copilot] session started for user %s (mode=%s)", self._user_id, self._mode.value)

    def start_hand(self, **kwargs) -> None:
        self._engine.start_hand(**kwargs)

    def process_action(self, **kwargs):
        return self._engine.process_action(**kwargs)

    def end_hand(self) -> dict:
        summary = self._engine.end_hand()
        self._hand_summaries.append(summary)

        # Update session stats
        self._stats.hands_played += 1
        mistakes = summary.get("mistakes", 0)
        ev_loss = summary.get("total_ev_loss_bb", 0)
        self._stats.total_mistakes += mistakes
        self._stats.total_ev_loss_bb += ev_loss

        # Accumulate leaks from the engine's state
        if self._engine.state:
            for mistake in self._engine.state.mistakes:
                for tag in mistake.concept_tags:
                    self._stats.leak_accumulator[tag] = (
                        self._stats.leak_accumulator.get(tag, 0) + 1
                    )
                street = mistake.street
                if street in self._stats.mistake_streets:
                    self._stats.mistake_streets[street] += 1

        return summary

    def end_session(self) -> dict:
        """Generate session recap with aggregate analysis."""
        duration = (datetime.now(timezone.utc) - self._started_at).total_seconds()

        # Detect tilt signals
        tilt_warning = self._detect_tilt()

        # Session coaching priorities
        priorities = self._compute_coaching_priorities()

        recap = {
            "session_id": self._session_id,
            "user_id": self._user_id,
            "mode": self._mode.value,
            "duration_seconds": round(duration),
            "hands_played": self._stats.hands_played,

            # Performance
            "total_mistakes": self._stats.total_mistakes,
            "total_ev_loss_bb": round(self._stats.total_ev_loss_bb, 2),
            "avg_ev_loss_per_hand": round(self._stats.avg_ev_loss_per_hand, 2),

            # Tendencies
            "vpip_pct": round(self._stats.vpip_pct, 1),
            "pfr_pct": round(self._stats.pfr_pct, 1),
            "cbet_pct": round(self._stats.cbet_pct, 1),

            # Leaks
            "top_leaks": [
                {"concept": tag, "count": count}
                for tag, count in self._stats.top_leaks
            ],
            "mistake_by_street": self._stats.mistake_streets,

            # Behavioral
            "tilt_warning": tilt_warning,
            "coaching_priorities": priorities,

            # Hand summaries
            "worst_hands": sorted(
                self._hand_summaries,
                key=lambda h: h.get("total_ev_loss_bb", 0),
                reverse=True,
            )[:3],
        }

        logger.info(
            "[Copilot] session ended: %d hands, %d mistakes, %.1fbb lost",
            self._stats.hands_played, self._stats.total_mistakes,
            self._stats.total_ev_loss_bb,
        )
        return recap

    def _detect_tilt(self) -> str | None:
        """
        Detect potential tilt from session patterns.

        Signals: increasing mistake rate, shortening decision times,
        escalating aggression after losses.
        """
        if self._stats.hands_played < 5:
            return None

        # Check if mistake rate is accelerating
        recent = self._hand_summaries[-5:]
        recent_mistakes = sum(h.get("mistakes", 0) for h in recent)
        early = self._hand_summaries[:5] if len(self._hand_summaries) >= 10 else []
        early_mistakes = sum(h.get("mistakes", 0) for h in early)

        if recent_mistakes > early_mistakes * 2 and recent_mistakes >= 3:
            return (
                "Your mistake rate has increased in recent hands. "
                "Consider taking a short break to reset."
            )

        if self._stats.avg_ev_loss_per_hand > 3.0:
            return (
                "Average EV loss is high this session. "
                "Focus on the fundamentals and avoid marginal spots."
            )

        return None

    def _compute_coaching_priorities(self) -> list[str]:
        """Rank coaching priorities based on session leaks."""
        priorities = []
        for tag, count in self._stats.top_leaks:
            if count >= 2:
                priorities.append(
                    f"Focus on {tag.replace('_', ' ')} — appeared {count} times this session"
                )
        if not priorities:
            priorities.append("No major leaks detected — keep up the good work!")
        return priorities[:3]
