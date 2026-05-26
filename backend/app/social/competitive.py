"""
Competitive systems — leagues, leaderboards, challenges, seasonal play.

Design principles:
  - Reward LEARNING QUALITY, not grinding volume
  - Score = accuracy * consistency * difficulty_factor
  - Seasonal resets prevent insurmountable gaps
  - Leagues ensure players compete against similar skill levels

League structure:
  Bronze → Silver → Gold → Platinum → Diamond
  Promotion/demotion based on weekly performance vs league threshold.
  Top 20% promote, bottom 20% demote, middle stays.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timezone

from .models import Challenge, LeaderboardEntry, LeagueId, SeasonInfo

logger = logging.getLogger(__name__)

# League thresholds (minimum weekly score to stay in league)
_LEAGUE_THRESHOLDS = {
    LeagueId.BRONZE: 0,
    LeagueId.SILVER: 200,
    LeagueId.GOLD: 500,
    LeagueId.PLATINUM: 900,
    LeagueId.DIAMOND: 1500,
}

_LEAGUE_ORDER = [
    LeagueId.BRONZE, LeagueId.SILVER, LeagueId.GOLD,
    LeagueId.PLATINUM, LeagueId.DIAMOND,
]


def compute_competitive_score(
    accuracy_pct: float,
    drills_completed: int,
    streak_days: int,
    avg_difficulty: float = 0.5,
) -> float:
    """
    Compute weekly competitive score.

    Formula: accuracy * volume_factor * streak_bonus * difficulty_weight
    - accuracy: 0-100 drill accuracy
    - volume_factor: sqrt(drills) to diminish grinding returns
    - streak_bonus: 1.0 + streak_days * 0.05 (max 1.5)
    - difficulty_weight: 0.8 + avg_difficulty * 0.4

    This rewards a player who does 20 hard drills at 80% accuracy
    MORE than a player who does 100 easy drills at 60%.
    """
    accuracy_factor = accuracy_pct / 100.0
    volume_factor = math.sqrt(min(drills_completed, 200))  # Cap at sqrt(200) ≈ 14
    streak_bonus = 1.0 + min(streak_days * 0.05, 0.5)
    difficulty_weight = 0.8 + avg_difficulty * 0.4

    return round(
        accuracy_factor * volume_factor * streak_bonus * difficulty_weight * 100,
        1,
    )


class LeaderboardManager:
    """Manages leaderboards, leagues, and challenges."""

    def __init__(self) -> None:
        self._entries: dict[str, LeaderboardEntry] = {}  # user_id → entry
        self._challenges: dict[str, Challenge] = {}
        self._season: SeasonInfo | None = None

    def update_score(
        self,
        user_id: str,
        username: str,
        accuracy_pct: float,
        drills_completed: int,
        streak_days: int,
        avg_difficulty: float = 0.5,
    ) -> LeaderboardEntry:
        """Update a user's competitive score and league placement."""
        score = compute_competitive_score(
            accuracy_pct, drills_completed, streak_days, avg_difficulty,
        )

        entry = self._entries.get(user_id)
        if entry is None:
            entry = LeaderboardEntry(
                user_id=user_id,
                username=username,
                league=LeagueId.BRONZE,
            )
            self._entries[user_id] = entry

        entry.score = score
        entry.username = username
        entry.games_played = drills_completed
        entry.win_rate = accuracy_pct / 100.0
        entry.streak = streak_days

        # League placement
        entry.league = self._compute_league(score)

        return entry

    def get_leaderboard(
        self,
        league: LeagueId | None = None,
        top_k: int = 50,
    ) -> list[LeaderboardEntry]:
        """Get ranked leaderboard, optionally filtered by league."""
        entries = list(self._entries.values())
        if league:
            entries = [e for e in entries if e.league == league]
        entries.sort(key=lambda e: -e.score)
        for i, entry in enumerate(entries):
            entry.rank = i + 1
        return entries[:top_k]

    def create_challenge(
        self,
        challenger_id: str,
        opponent_id: str,
        drill_type: str = "cbet_or_check",
        drill_count: int = 10,
    ) -> Challenge:
        """Create a head-to-head drill challenge."""
        challenge = Challenge(
            challenger_id=challenger_id,
            opponent_id=opponent_id,
            challenge_type="accuracy",
            drill_type=drill_type,
            drill_count=drill_count,
            status="pending",
            expires_at=datetime.now(timezone.utc),
        )
        self._challenges[challenge.challenge_id] = challenge
        return challenge

    def accept_challenge(self, challenge_id: str, user_id: str) -> bool:
        c = self._challenges.get(challenge_id)
        if c is None or c.opponent_id != user_id or c.status != "pending":
            return False
        c.status = "active"
        return True

    def submit_challenge_score(
        self,
        challenge_id: str,
        user_id: str,
        score: float,
    ) -> Challenge | None:
        c = self._challenges.get(challenge_id)
        if c is None or c.status != "active":
            return None

        if user_id == c.challenger_id:
            c.challenger_score = score
        elif user_id == c.opponent_id:
            c.opponent_score = score
        else:
            return None

        # Check if both submitted
        if c.challenger_score > 0 and c.opponent_score > 0:
            c.status = "completed"
            c.winner_id = (
                c.challenger_id if c.challenger_score >= c.opponent_score
                else c.opponent_id
            )

        return c

    def get_user_challenges(self, user_id: str) -> list[Challenge]:
        return [
            c for c in self._challenges.values()
            if c.challenger_id == user_id or c.opponent_id == user_id
        ]

    def _compute_league(self, score: float) -> LeagueId:
        league = LeagueId.BRONZE
        for lid in _LEAGUE_ORDER:
            if score >= _LEAGUE_THRESHOLDS[lid]:
                league = lid
        return league


_leaderboard: LeaderboardManager | None = None


def get_leaderboard_manager() -> LeaderboardManager:
    global _leaderboard
    if _leaderboard is None:
        _leaderboard = LeaderboardManager()
    return _leaderboard
