"""Spaced Repetition System for concept mastery decay and review scheduling."""

from datetime import datetime, timedelta, timezone

def compute_next_review(
    score: int,
    current_ease: float,
    current_interval: float,
    mastery_level: int,
) -> tuple[datetime, float, float, int]:
    """
    SM-2 variant for poker concept mastery.
    Returns (next_review_dt, new_ease_factor, new_interval_days, new_mastery_level).
    """
    if score >= 90:
        new_ease = min(2.8, current_ease + 0.1)
        new_interval = max(1.0, current_interval * new_ease)
        new_mastery = min(5, mastery_level + 1)
    elif score >= 70:
        new_ease = current_ease
        new_interval = max(1.0, current_interval * 1.2)
        new_mastery = min(5, mastery_level + 1) if mastery_level < 3 else mastery_level
    elif score >= 50:
        new_ease = max(1.3, current_ease - 0.1)
        new_interval = max(1.0, current_interval * 0.8)
        new_mastery = mastery_level
    else:
        new_ease = max(1.3, current_ease - 0.2)
        new_interval = 1.0
        new_mastery = max(0, mastery_level - 1)

    next_review = datetime.now(timezone.utc) + timedelta(days=new_interval)
    return next_review, new_ease, new_interval, new_mastery

def is_due_for_review(next_review: datetime | None) -> bool:
    if next_review is None:
        return True
    return datetime.now(timezone.utc) >= next_review
