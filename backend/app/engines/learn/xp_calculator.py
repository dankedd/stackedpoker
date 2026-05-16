"""XP calculation for lesson completions and step responses."""

from dataclasses import dataclass

@dataclass
class XPResult:
    base_xp: int
    speed_bonus: int
    streak_bonus: int
    total_xp: int
    level_before: int
    level_after: int
    leveled_up: bool

LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000,
                    5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000, 26000,
                    30500, 35500, 41000, 47000, 54000, 62000, 71000, 81000, 92000]

def xp_for_level(level: int) -> int:
    if level <= 0: return 0
    if level >= len(LEVEL_THRESHOLDS): return LEVEL_THRESHOLDS[-1] + (level - len(LEVEL_THRESHOLDS) + 1) * 10000
    return LEVEL_THRESHOLDS[level]

def level_for_xp(total_xp: int) -> int:
    for i, threshold in enumerate(reversed(LEVEL_THRESHOLDS)):
        if total_xp >= threshold:
            return len(LEVEL_THRESHOLDS) - i
    return 1

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
