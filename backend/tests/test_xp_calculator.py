"""Tests for the Learn XP -> Level curve (backend/app/engines/learn/xp_calculator.py).

Level 1 -> 2 costs 500 XP; each subsequent level costs 10% more than the one
before it (round(500 * 1.10 ** (level - 1))), never a hardcoded threshold
table. Cumulative thresholds are the running sum of these per-level costs.
"""

from app.engines.learn.xp_calculator import (
    apply_xp_to_user,
    get_level_progress,
    level_for_xp,
    xp_required_for_level,
)


# ── Per-level requirement formula ─────────────────────────────────────────────


def test_level_1_requires_500_xp_to_advance():
    assert xp_required_for_level(1) == 500


def test_per_level_requirement_grows_by_ten_percent():
    # 500, 550, 605, 666(.5->666), 732(.05->732)
    assert xp_required_for_level(2) == 550
    assert xp_required_for_level(3) == 605
    assert xp_required_for_level(4) == 666
    assert xp_required_for_level(5) == 732


def test_xp_required_for_level_is_strictly_increasing():
    prev = xp_required_for_level(1)
    for level in range(2, 30):
        current = xp_required_for_level(level)
        assert current > prev, f"level {level} requirement did not increase"
        prev = current


# ── level_for_xp: exact boundary behavior from the spec ───────────────────────


def test_zero_xp_is_level_1():
    assert level_for_xp(0) == 1


def test_499_xp_is_still_level_1():
    assert level_for_xp(499) == 1


def test_500_xp_is_level_2():
    assert level_for_xp(500) == 2


def test_1049_xp_is_still_level_2():
    assert level_for_xp(1049) == 2


def test_1050_xp_is_level_3():
    assert level_for_xp(1050) == 3


def test_negative_xp_floors_to_level_1():
    assert level_for_xp(-500) == 1


# ── Cumulative thresholds for levels 1-15 (derived, not hardcoded) ────────────


def test_cumulative_thresholds_levels_1_through_15():
    # threshold(level) = sum of xp_required_for_level(1..level-1)
    expected_threshold = 0
    thresholds = {1: 0}
    for level in range(1, 15):
        expected_threshold += xp_required_for_level(level)
        thresholds[level + 1] = expected_threshold

    for level, threshold in thresholds.items():
        assert level_for_xp(threshold) == level, f"level {level} threshold {threshold}"
        if threshold > 0:
            assert level_for_xp(threshold - 1) == level - 1

    # Sanity-check the concrete numbers against the task's worked example.
    assert thresholds[2] == 500
    assert thresholds[3] == 1050
    assert thresholds[4] == 1655


# ── get_level_progress: full derived object ───────────────────────────────────


def test_get_level_progress_worked_example_from_spec():
    # "A user with 1,920 TOTAL XP" -> Level 4, 265/666 XP, 401 XP to Level 5.
    p = get_level_progress(1920)
    assert p.level == 4
    assert p.total_xp == 1920
    assert p.current_level_threshold == 1655
    assert p.xp_required_for_next_level == 666
    assert p.current_level_xp == 265
    assert p.xp_remaining == 401
    assert p.next_level_threshold == 2321


def test_progress_percent_resets_to_zero_right_after_a_level_up():
    threshold = 0
    for level in range(1, 5):
        threshold += xp_required_for_level(level)
    p = get_level_progress(threshold)  # exactly at a level boundary
    assert p.progress_percent == 0
    assert p.current_level_xp == 0


def test_progress_percent_approaches_100_just_before_next_level():
    threshold = xp_required_for_level(1)  # = 500, boundary of level 2
    p = get_level_progress(threshold - 1)
    assert p.level == 1
    assert p.progress_percent >= 99


def test_progress_percent_never_exceeds_100():
    p = get_level_progress(10**9)
    assert 0 <= p.progress_percent <= 100


# ── apply_xp_to_user: pure delta application ──────────────────────────────────


def test_apply_xp_to_user_no_level_up():
    new_total, new_level, leveled_up = apply_xp_to_user(100, 50)
    assert new_total == 150
    assert new_level == 1
    assert leveled_up is False


def test_apply_xp_to_user_crosses_level_boundary():
    new_total, new_level, leveled_up = apply_xp_to_user(480, 20)
    assert new_total == 500
    assert new_level == 2
    assert leveled_up is True


def test_apply_xp_to_user_zero_delta_never_reports_level_up():
    new_total, new_level, leveled_up = apply_xp_to_user(500, 0)
    assert new_total == 500
    assert new_level == 2
    assert leveled_up is False
