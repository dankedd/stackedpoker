"""Tests for the global XP leaderboard (backend/app/api/routes/leaderboard.py).

Reuses the same in-memory fake Supabase harness as test_learn_persistence.py
(FakeSupabase/FakeAsyncClient/fake_db) so leaderboard reads can be exercised
against XP actually produced by the real award endpoints (learn.py) — this is
what proves the leaderboard reads the SAME ledger those endpoints write, not
a second, independently-computed number.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.api.routes import leaderboard as leaderboard_module
from app.api.routes import learn as learn_module

from .test_learn_persistence import fake_db, run, run_concurrently  # noqa: F401


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _seed_user(fake_db, user_id: str, username: str, total_xp: int, created_at: datetime) -> None:
    fake_db.insert("profiles", {"id": user_id, "username": username, "created_at": _iso(created_at)})
    fake_db.insert("user_skill_progress", {
        "user_id": user_id, "total_xp": total_xp, "level": 1, "streak_days": 0,
    })


def _seed_xp_event(fake_db, user_id: str, amount: int, earned_at: datetime, source_type: str = "step") -> None:
    fake_db.insert("xp_events", {
        "user_id": user_id, "amount": amount, "source_type": source_type,
        "source_id": None, "earned_at": _iso(earned_at),
    })


# Real wall-clock time, not a fixed date: leaderboard_module.get_leaderboard()/
# get_my_leaderboard_rank() call the fake DB's leaderboard_24h/my_rank_24h
# with NO explicit `now=` override (production has no such override either —
# Postgres's real now() is used at query time), so it always evaluates the
# rolling window against actual current time. Any test that goes through
# those endpoints (rather than calling fake_db.leaderboard_24h(..., now=NOW)
# directly) must seed events relative to this same real "now" or the
# boundary math silently drifts against whatever the real clock says.
NOW = datetime.now(timezone.utc)


# ── All-time ordering ──────────────────────────────────────────────────────


def test_all_time_orders_by_total_xp_descending(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-a", "Alex", 5000, base)
    _seed_user(fake_db, "u-b", "Sam", 9000, base)
    _seed_user(fake_db, "u-c", "Chris", 1000, base)

    resp = run(leaderboard_module.get_leaderboard(
        period="all", limit=50, offset=0, current_user={"sub": "u-a"},
    ))

    usernames = [r.username for r in resp.rows]
    assert usernames == ["Sam", "Alex", "Chris"]
    assert [r.rank for r in resp.rows] == [1, 2, 3]
    assert [r.total_xp for r in resp.rows] == [9000, 5000, 1000]


def test_all_time_matches_the_users_own_profile_total_exactly(fake_db):
    """Section 3's acceptance rule: if the profile says 12,450 XP, the
    leaderboard must show 12,450 XP — same source, not recalculated."""
    base = NOW - timedelta(days=10)
    _seed_user(fake_db, "u-match", "Precise", 12450, base)

    resp = run(leaderboard_module.get_leaderboard(
        period="all", limit=50, offset=0, current_user={"sub": "u-match"},
    ))
    assert resp.rows[0].total_xp == 12450

    progress = run(learn_module.get_full_progress({"sub": "u-match"}))
    assert progress["skill"]["total_xp"] == 12450


# ── Rolling 24h window, tested at the exact boundary ──────────────────────


def test_24h_window_includes_event_exactly_at_the_cutoff(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-edge", "EdgeCase", 500, base)
    _seed_xp_event(fake_db, "u-edge", 40, NOW - timedelta(hours=24))  # exactly at cutoff: >=

    rows = fake_db.leaderboard_24h(50, 0, now=NOW)
    assert len(rows) == 1
    assert rows[0]["period_xp"] == 40


def test_24h_window_excludes_event_one_second_older_than_cutoff(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-old", "TooOld", 500, base)
    _seed_xp_event(fake_db, "u-old", 40, NOW - timedelta(hours=24, seconds=1))

    rows = fake_db.leaderboard_24h(50, 0, now=NOW)
    assert rows == []


def test_24h_window_only_counts_xp_earned_inside_the_rolling_window(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-mixed", "Mixed", 1000, base)
    _seed_xp_event(fake_db, "u-mixed", 100, NOW - timedelta(hours=48))  # outside window
    _seed_xp_event(fake_db, "u-mixed", 30, NOW - timedelta(hours=10))   # inside window
    _seed_xp_event(fake_db, "u-mixed", 20, NOW - timedelta(hours=1))    # inside window

    rows = fake_db.leaderboard_24h(50, 0, now=NOW)
    assert rows[0]["period_xp"] == 50  # only the two inside-window events
    assert rows[0]["total_xp"] == 1000  # all-time total is untouched by the window


def test_users_with_no_24h_activity_are_excluded_from_24h_leaderboard(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-active", "Active", 500, base)
    _seed_user(fake_db, "u-dormant", "Dormant", 50000, base)  # huge all-time XP, but earned long ago
    _seed_xp_event(fake_db, "u-active", 30, NOW - timedelta(hours=2))
    _seed_xp_event(fake_db, "u-dormant", 50000, NOW - timedelta(days=90))

    rows = fake_db.leaderboard_24h(50, 0, now=NOW)
    usernames = [r["username"] for r in rows]
    assert usernames == ["Active"]


def test_24h_leaderboard_is_not_since_midnight(fake_db):
    """A true rolling window: an event 20 hours ago counts even if that
    crosses yesterday's midnight, and an event 25 hours ago (even if it was
    "today" in some other timezone framing) must not."""
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-roll", "Roller", 500, base)
    _seed_xp_event(fake_db, "u-roll", 15, NOW - timedelta(hours=20))
    _seed_xp_event(fake_db, "u-roll", 999, NOW - timedelta(hours=25))

    rows = fake_db.leaderboard_24h(50, 0, now=NOW)
    assert rows[0]["period_xp"] == 15


# ── Level derived from total_xp, never from period_xp ─────────────────────


def test_level_uses_total_xp_not_period_xp_on_24h_tab(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-lowlevel", "LowLevel", 10, base)  # level 1 by total_xp
    _seed_xp_event(fake_db, "u-lowlevel", 5000, NOW - timedelta(hours=1))  # huge 24h burst

    resp = run(leaderboard_module.get_leaderboard(
        period="24h", limit=50, offset=0, current_user={"sub": "u-lowlevel"},
    ))
    row = resp.rows[0]
    assert row.period_xp == 5000
    assert row.total_xp == 10
    assert row.level == 1  # not inflated by the 24h burst


def test_all_time_row_never_carries_period_xp(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-plain", "Plain", 500, base)
    resp = run(leaderboard_module.get_leaderboard(
        period="all", limit=50, offset=0, current_user={"sub": "u-plain"},
    ))
    assert resp.rows[0].period_xp is None


# ── Tie-break determinism ──────────────────────────────────────────────────


def test_equal_xp_users_share_the_same_displayed_rank(fake_db):
    """Section 5's competition-ranking rule: account age must NOT affect the
    displayed rank. Two users with equal XP show the SAME rank number,
    regardless of which account is older."""
    _seed_user(fake_db, "u-newer", "Newer", 1000, NOW - timedelta(days=5))
    _seed_user(fake_db, "u-older", "Older", 1000, NOW - timedelta(days=50))
    _seed_user(fake_db, "u-below", "Below", 500, NOW - timedelta(days=5))

    resp = run(leaderboard_module.get_leaderboard(
        period="all", limit=50, offset=0, current_user={"sub": "u-older"},
    ))
    ranks_by_username = {r.username: r.rank for r in resp.rows}
    assert ranks_by_username["Newer"] == ranks_by_username["Older"] == 1
    # Gap after the tie — the next distinct XP value is rank 3, not 2
    # ("1224" competition ranking, not dense "123" ranking).
    assert ranks_by_username["Below"] == 3


def test_equal_xp_ties_produce_the_same_rank_via_my_rank_too(fake_db):
    """The tie-break rule must be applied consistently to ALL TIME, LAST 24
    HOURS, and MY RANK (section 5) — not just the paged listing."""
    _seed_user(fake_db, "u-tie-a", "TieA", 1000, NOW - timedelta(days=5))
    _seed_user(fake_db, "u-tie-b", "TieB", 1000, NOW - timedelta(days=50))
    _seed_user(fake_db, "u-below2", "Below2", 500, NOW - timedelta(days=5))

    rank_a = run(leaderboard_module.get_my_leaderboard_rank(period="all", current_user={"sub": "u-tie-a"}))
    rank_b = run(leaderboard_module.get_my_leaderboard_rank(period="all", current_user={"sub": "u-tie-b"}))
    rank_below = run(leaderboard_module.get_my_leaderboard_rank(period="all", current_user={"sub": "u-below2"}))
    assert rank_a.rank == rank_b.rank == 1
    assert rank_below.rank == 3


def test_ties_are_stable_across_repeated_calls_and_pagination(fake_db):
    """Row ORDER among tied users (which one appears first in the list) must
    be deterministic across repeated requests and stable across pages, even
    though they display the same rank — username is the pagination
    tie-break, never the displayed rank."""
    _seed_user(fake_db, "u-x", "X", 750, NOW - timedelta(days=5))
    _seed_user(fake_db, "u-y", "Y", 750, NOW - timedelta(days=50))  # same xp, different created_at

    first = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-x"}))
    second = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-x"}))
    assert [r.username for r in first.rows] == [r.username for r in second.rows]
    # Both tied rows display rank 1 — created_at is not a rank-breaking factor.
    assert [r.rank for r in first.rows] == [1, 1]


# ── Current user's rank, including outside the visible page ───────────────


def test_my_rank_all_time_correct_when_outside_top_page(fake_db):
    for i in range(60):
        _seed_user(fake_db, f"u-bulk-{i}", f"Bulk{i}", 10000 - i, NOW - timedelta(days=200 - i))
    # u-bulk-59 has the lowest XP (10000-59=9941) of the bunch -> rank 60
    resp = run(leaderboard_module.get_my_leaderboard_rank(
        period="all", current_user={"sub": "u-bulk-59"},
    ))
    assert resp.rank == 60
    assert resp.total_xp == 9941

    # And the top-50 page must NOT include them.
    page = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-bulk-59"}))
    assert all(not r.is_you for r in page.rows)
    assert len(page.rows) == 50
    assert page.has_more is True


def test_my_rank_24h_correct_and_independent_of_all_time_rank(fake_db):
    base = NOW - timedelta(days=100)
    _seed_user(fake_db, "u-grinder", "Grinder", 50, base)     # low all-time XP
    _seed_user(fake_db, "u-veteran", "Veteran", 90000, base)  # huge all-time XP, inactive today
    _seed_xp_event(fake_db, "u-grinder", 80, NOW - timedelta(hours=3))
    _seed_xp_event(fake_db, "u-veteran", 90000, NOW - timedelta(days=99))  # long ago

    resp = run(leaderboard_module.get_my_leaderboard_rank(period="24h", current_user={"sub": "u-grinder"}))
    assert resp.rank == 1
    assert resp.period_xp == 80

    veteran_resp = run(leaderboard_module.get_my_leaderboard_rank(period="24h", current_user={"sub": "u-veteran"}))
    assert veteran_resp.rank is None  # no 24h activity -> unranked on this tab
    assert veteran_resp.total_xp == 90000  # but their real total_xp is still shown


def test_new_user_with_zero_xp_gets_unranked_response_not_an_error(fake_db):
    fake_db.insert("profiles", {"id": "u-fresh", "username": "Fresh", "created_at": _iso(NOW)})
    resp = run(leaderboard_module.get_my_leaderboard_rank(period="all", current_user={"sub": "u-fresh"}))
    assert resp.rank is None
    assert resp.total_xp == 0
    assert resp.username == "Fresh"


# ── Pagination correctness ─────────────────────────────────────────────────


def test_pagination_never_duplicates_or_skips_users(fake_db):
    for i in range(5):
        _seed_user(fake_db, f"u-page-{i}", f"Page{i}", 1000 - i * 10, NOW - timedelta(days=100 + i))

    page1 = run(leaderboard_module.get_leaderboard(period="all", limit=2, offset=0, current_user={"sub": "u-page-0"}))
    page2 = run(leaderboard_module.get_leaderboard(period="all", limit=2, offset=2, current_user={"sub": "u-page-0"}))
    page3 = run(leaderboard_module.get_leaderboard(period="all", limit=2, offset=4, current_user={"sub": "u-page-0"}))

    all_users = [r.username for r in page1.rows] + [r.username for r in page2.rows] + [r.username for r in page3.rows]
    assert all_users == ["Page0", "Page1", "Page2", "Page3", "Page4"]
    assert [r.rank for r in page1.rows] + [r.rank for r in page2.rows] + [r.rank for r in page3.rows] == [1, 2, 3, 4, 5]
    assert page1.has_more is True
    assert page2.has_more is True
    assert page3.has_more is False


# ── Privacy: no raw ids, no email, username-only ───────────────────────────


def test_leaderboard_response_never_exposes_user_id_or_email(fake_db):
    base = NOW - timedelta(days=10)
    _seed_user(fake_db, "u-private", "PrivacyTest", 500, base)

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-other"}))
    dumped = resp.rows[0].model_dump()
    assert "user_id" not in dumped
    assert "email" not in dumped
    assert set(dumped.keys()) == {"rank", "username", "level", "total_xp", "period_xp", "is_you"}


def test_null_username_falls_back_to_player_never_email(fake_db):
    fake_db.insert("profiles", {"id": "u-noname", "username": None, "created_at": _iso(NOW - timedelta(days=1))})
    fake_db.insert("user_skill_progress", {"user_id": "u-noname", "total_xp": 400, "level": 1, "streak_days": 0})

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-noname"}))
    assert resp.rows[0].username == "Player"


def test_is_you_flag_marks_only_the_callers_own_row(fake_db):
    base = NOW - timedelta(days=10)
    _seed_user(fake_db, "u-me", "Me", 2000, base)
    _seed_user(fake_db, "u-other", "Other", 1000, base)

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-me"}))
    flags = {r.username: r.is_you for r in resp.rows}
    assert flags == {"Me": True, "Other": False}


# ── XP integrity: leaderboard must reflect existing guarantees, not add new gaps ──


def test_duplicate_concurrent_lesson_completion_does_not_inflate_leaderboard_total(fake_db):
    """Reuses the exact race from test_learn_persistence.py, then confirms
    the leaderboard reads whatever the award path actually settled on —
    never a second, independently-inflated number."""
    user_id = "u-race-leaderboard"
    fake_db.insert("profiles", {"id": user_id, "username": "Racer", "created_at": _iso(NOW - timedelta(days=1))})
    fake_db.insert("user_lesson_progress", {
        "user_id": user_id, "lesson_id": "lesson-lb-race", "status": "in_progress",
        "best_score": 0, "attempts": 1, "time_spent_sec": 0,
    })
    body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=200, path_lesson_ids=[])

    run_concurrently(
        learn_module.complete_lesson("lesson-lb-race", body, {"sub": user_id}),
        learn_module.complete_lesson("lesson-lb-race", body, {"sub": user_id}),
    )

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": user_id}))
    # 200 lesson bonus + 25 first_lesson + 50 perfect_lesson achievements, exactly once.
    assert resp.rows[0].total_xp == 275


def test_replaying_a_completed_lesson_does_not_add_leaderboard_xp(fake_db):
    user_id = "u-replay-leaderboard"
    fake_db.insert("profiles", {"id": user_id, "username": "Replayer", "created_at": _iso(NOW - timedelta(days=1))})
    body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=150, path_lesson_ids=[])

    run(learn_module.complete_lesson("lesson-lb-replay", body, {"sub": user_id}))
    run(learn_module.complete_lesson("lesson-lb-replay", body, {"sub": user_id}))  # reopen + "complete" again

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": user_id}))
    assert resp.rows[0].total_xp == 150 + 25 + 50  # lesson bonus + first_lesson + perfect_lesson, once


def test_step_xp_award_is_server_resolved_so_leaderboard_total_cannot_be_inflated(fake_db):
    """A tampered client claiming an absurd xp_earned is credited the step's
    REAL canonical amount (20, per FAKE_REWARD_MANIFEST) — the leaderboard
    reads whatever the award path actually resolved, never the claim."""
    user_id = "u-cap-leaderboard"
    fake_db.insert("profiles", {"id": user_id, "username": "Capped", "created_at": _iso(NOW - timedelta(days=1))})
    step_body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=999_999, concept_ids=[], step_index=0, total_steps=1,
    )
    run(learn_module.submit_step_result("lesson-lb-cap", "step-1", step_body, {"sub": user_id}))

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": user_id}))
    assert resp.rows[0].total_xp == 20


# ── Empty states ────────────────────────────────────────────────────────────


def test_no_users_with_xp_yields_empty_all_time_leaderboard(fake_db):
    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user={"sub": "u-anyone"}))
    assert resp.rows == []
    assert resp.has_more is False


def test_no_24h_activity_yields_empty_24h_leaderboard(fake_db):
    base = NOW - timedelta(days=10)
    _seed_user(fake_db, "u-quiet", "Quiet", 500, base)  # has all-time XP but none recent
    resp = run(leaderboard_module.get_leaderboard(period="24h", limit=50, offset=0, current_user={"sub": "u-quiet"}))
    assert resp.rows == []
