"""XP → level, and XP for Learn step responses.

Level curve
-----------
The curve is defined once, in shared/levels.json (curve parameters, tiers,
XP rules). shared/generate_levels.py derives the cumulative threshold table
from it and copies the file here (Railway builds backend/ only), to
frontend/lib/levels/levels.json and into SQL (supabase_xp_levels_data.sql).
This module only reads the table — it never rounds or computes the curve
itself, so Python, TypeScript and SQL cannot disagree.

    xp_to_next(level) = round_half_up(base * level ** exponent)

Polynomial, not exponential: level 10 comes in about a week of free-limit
trainer play, level 50 (the max, "Legend") in about two years.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

_CONFIG = json.loads((Path(__file__).with_name("levels.json")).read_text(encoding="utf-8"))

#: THRESHOLDS[i] = total XP needed to reach level i + 1.
THRESHOLDS: tuple[int, ...] = tuple(_CONFIG["thresholds"])
MAX_LEVEL: int = _CONFIG["curve"]["max_level"]
TIERS: tuple[dict, ...] = tuple(_CONFIG["tiers"])
XP_RULES: dict = _CONFIG["xp"]


@dataclass
class XPResult:
    base_xp: int
    speed_bonus: int
    streak_bonus: int
    total_xp: int
    level_before: int
    level_after: int
    leveled_up: bool


@dataclass
class LevelProgress:
    level: int
    total_xp: int
    current_level_xp: int
    #: 0 at the max level.
    xp_required_for_next_level: int
    xp_remaining: int
    progress_percent: int
    current_level_threshold: int
    #: None at the max level.
    next_level_threshold: int | None
    title: str
    tier_color: str
    is_max_level: bool


def tier_for_level(level: int) -> dict:
    level = min(max(1, level), MAX_LEVEL)
    return next(t for t in TIERS if t["min"] <= level <= t["max"])


def xp_required_for_level(level: int) -> int:
    """XP needed to advance from `level` to `level + 1` (0 at the max level)."""
    level = max(1, level)
    if level >= MAX_LEVEL:
        return 0
    return THRESHOLDS[level] - THRESHOLDS[level - 1]


def level_for_xp(total_xp: int) -> int:
    total_xp = max(0, total_xp)
    level = 1
    while level < MAX_LEVEL and THRESHOLDS[level] <= total_xp:
        level += 1
    return level


def get_level_progress(total_xp: int) -> LevelProgress:
    """Derives level + all display fields from total_xp, the only stored value."""
    total_xp = max(0, total_xp)
    level = level_for_xp(total_xp)
    tier = tier_for_level(level)
    threshold = THRESHOLDS[level - 1]
    is_max = level >= MAX_LEVEL
    required = xp_required_for_level(level)
    current = total_xp - threshold
    return LevelProgress(
        level=level,
        total_xp=total_xp,
        current_level_xp=current,
        xp_required_for_next_level=required,
        xp_remaining=0 if is_max else threshold + required - total_xp,
        progress_percent=100 if is_max else min(100, round(current / required * 100)),
        current_level_threshold=threshold,
        next_level_threshold=None if is_max else threshold + required,
        title=tier["title"],
        tier_color=tier["color"],
        is_max_level=is_max,
    )


def level_fields(row: dict, xp_awarded: int) -> dict:
    """level / leveled_up / bonus_xp / previous_level for a trainer response,
    from a grant RPC row (supabase_xp_rebalance.sql). The RPC decides the
    level-up against the highest level the user has seen (level_seen), so the
    rebalance never shows one. Before that migration the row has no
    `leveled_up`; then it is "this award crossed a boundary"."""
    total = row.get("total_xp", 0)
    level = level_for_xp(total)
    if "leveled_up" in row:
        return {
            "level": level,
            "leveled_up": bool(row["leveled_up"]),
            "bonus_xp": row.get("bonus_xp") or 0,
            "previous_level": row.get("previous_level"),
        }
    before = level_for_xp(total - xp_awarded)
    return {"level": level, "leveled_up": xp_awarded > 0 and level > before, "bonus_xp": 0, "previous_level": before}


def calculate_step_xp(base: int, score: int, time_ms: int, streak: int) -> XPResult:
    """Calculate XP for a single lesson step response."""
    # score 0-100 scales XP
    earned = int(base * (score / 100))

    # Speed bonus: under 10s = +20%, under 20s = +10%
    speed_bonus = 0
    if time_ms < 10_000:
        speed_bonus = int(earned * 0.20)
    elif time_ms < 20_000:
        speed_bonus = int(earned * 0.10)

    # Streak bonus
    streak_bonus = min(int(earned * 0.05 * streak), int(earned * 0.50))

    total = earned + speed_bonus + streak_bonus
    return XPResult(base_xp=earned, speed_bonus=speed_bonus, streak_bonus=streak_bonus,
                    total_xp=total, level_before=1, level_after=1, leveled_up=False)


def apply_xp_to_user(current_xp: int, xp_earned: int) -> tuple[int, int, bool]:
    """Returns (new_total_xp, new_level, leveled_up)."""
    new_total = current_xp + xp_earned
    old_level = level_for_xp(current_xp)
    new_level = level_for_xp(new_total)
    return new_total, new_level, new_level > old_level
