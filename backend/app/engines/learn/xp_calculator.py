"""XP calculation for lesson completions and step responses.

Level curve
-----------
Levels are NOT a hardcoded threshold table — they're derived from one
deterministic formula, mirrored exactly in `frontend/lib/learn/levelCurve.ts`
(the two must stay in lockstep; there is no shared package between the Python
backend and the TS frontend, so "shared" means "same formula, verified by
tests in both languages," not literally one file).

    xp_required_for_level(level) = round(LEVEL_BASE_XP * LEVEL_GROWTH_RATE ** (level - 1))

This is the XP needed to advance FROM `level` TO `level + 1` — level 1 needs
500 XP to reach level 2, level 2 needs 550 to reach level 3, etc. (+10% per
level). Cumulative thresholds are the running sum of these per-level costs,
never authored/guessed directly.
"""

from dataclasses import dataclass

LEVEL_BASE_XP = 500
LEVEL_GROWTH_RATE = 1.10


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
    xp_required_for_next_level: int
    xp_remaining: int
    progress_percent: int
    current_level_threshold: int
    next_level_threshold: int


def xp_required_for_level(level: int) -> int:
    """XP needed to advance from `level` to `level + 1`."""
    level = max(1, level)
    return round(LEVEL_BASE_XP * (LEVEL_GROWTH_RATE ** (level - 1)))


def get_level_progress(total_xp: int) -> LevelProgress:
    """Single source of truth: derives level + all display fields from total_xp.

    Never stores/increments level independently — always recomputed from the
    persisted total_xp ledger. O(level) — fine since level grows very slowly
    against XP under a 10%-compounding curve.
    """
    total_xp = max(0, total_xp)
    level = 1
    threshold = 0
    while True:
        required = xp_required_for_level(level)
        if threshold + required > total_xp:
            break
        threshold += required
        level += 1

    required_for_next = xp_required_for_level(level)
    next_threshold = threshold + required_for_next
    current_level_xp = total_xp - threshold
    xp_remaining = next_threshold - total_xp
    progress_percent = (
        round((current_level_xp / required_for_next) * 100) if required_for_next else 0
    )

    return LevelProgress(
        level=level,
        total_xp=total_xp,
        current_level_xp=current_level_xp,
        xp_required_for_next_level=required_for_next,
        xp_remaining=xp_remaining,
        progress_percent=progress_percent,
        current_level_threshold=threshold,
        next_level_threshold=next_threshold,
    )


def level_for_xp(total_xp: int) -> int:
    return get_level_progress(total_xp).level


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
