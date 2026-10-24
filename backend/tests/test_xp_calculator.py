"""Tests for the XP -> level curve (backend/app/engines/learn/xp_calculator.py).

The curve lives in shared/levels.json; the backend reads its own byte-identical
copy (app/engines/learn/levels.json). These tests check the copy, the table
against the formula, and the milestones the curve was calibrated on.
"""

import json
import math
from pathlib import Path

import pytest

from app.engines.learn.xp_calculator import (
    MAX_LEVEL,
    THRESHOLDS,
    apply_xp_to_user,
    get_level_progress,
    level_for_xp,
    tier_for_level,
    xp_required_for_level,
)

BACKEND_COPY = Path(__file__).resolve().parents[1] / "app" / "engines" / "learn" / "levels.json"
SHARED = Path(__file__).resolve().parents[2] / "shared" / "levels.json"
CONFIG = json.loads(BACKEND_COPY.read_text(encoding="utf-8"))


@pytest.mark.skipif(not SHARED.exists(), reason="shared/ is not part of the backend build")
def test_backend_copy_is_byte_identical_to_shared():
    assert BACKEND_COPY.read_bytes() == SHARED.read_bytes(), "run: python shared/generate_levels.py"


def test_thresholds_follow_the_formula():
    base, exponent = CONFIG["curve"]["base"], CONFIG["curve"]["exponent"]
    expected = [0]
    for level in range(1, MAX_LEVEL):
        expected.append(expected[-1] + math.floor(base * level ** exponent + 0.5))
    assert list(THRESHOLDS) == expected
    assert len(THRESHOLDS) == MAX_LEVEL == 50


def test_each_level_costs_more_than_the_last():
    costs = [xp_required_for_level(level) for level in range(1, MAX_LEVEL)]
    assert all(b > a for a, b in zip(costs, costs[1:]))
    # Polynomial, not exponential: the last level costs ~1,360 XP, not millions.
    assert costs[-1] < 2000


def test_reference_player_milestones():
    """Free limit, preflop only, 65% correct (shared/levels.json reference_player)."""
    days = CONFIG["reference_days"]
    at = lambda level: days[level - 1]  # noqa: E731
    assert at(2) <= 0.3            # first session
    assert at(5) <= 2              # day 1-2
    assert 6 <= at(10) <= 9        # ~1 week
    assert 45 <= at(20) <= 61      # ~1.5-2 months
    assert 150 <= at(30) <= 185    # ~5-6 months
    assert 640 <= at(50) <= 800    # ~2 years


def test_level_for_xp_boundaries():
    assert level_for_xp(0) == 1
    assert level_for_xp(-500) == 1
    assert level_for_xp(1) == 1
    assert level_for_xp(2) == 2
    for level in range(2, MAX_LEVEL + 1):
        threshold = THRESHOLDS[level - 1]
        assert level_for_xp(threshold) == level
        assert level_for_xp(threshold - 1) == level - 1


def test_max_level_is_50():
    assert level_for_xp(10**9) == 50
    p = get_level_progress(10**9)
    assert p.is_max_level and p.title == "Legend"
    assert p.xp_required_for_next_level == 0 and p.next_level_threshold is None and p.progress_percent == 100


def test_get_level_progress_mid_level():
    p = get_level_progress(300)  # level 10 starts at 266, level 11 at 350
    assert (p.level, p.current_level_threshold, p.next_level_threshold) == (10, 266, 350)
    assert (p.current_level_xp, p.xp_required_for_next_level, p.xp_remaining) == (34, 84, 50)
    assert p.progress_percent == 40
    assert (p.title, p.tier_color) == ("Grinder", "emerald")


@pytest.mark.parametrize(
    "level,title",
    [(1, "Fish"), (4, "Fish"), (5, "Calling Station"), (9, "Calling Station"), (10, "Grinder"),
     (15, "Reg"), (20, "Shark"), (29, "Shark"), (30, "Crusher"), (40, "High Roller"), (49, "High Roller"), (50, "Legend")],
)
def test_tier_titles(level, title):
    assert tier_for_level(level)["title"] == title


def test_apply_xp_to_user():
    assert apply_xp_to_user(100, 20) == (120, 7, False)
    assert apply_xp_to_user(260, 10) == (270, 10, True)
    assert apply_xp_to_user(266, 0) == (266, 10, False)
