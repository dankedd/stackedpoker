"""
Tests for Learn progress persistence idempotency and achievement unlocking.

Uses an in-memory fake of the Supabase PostgREST surface (no real DB/network)
so `backend/app/api/routes/learn.py` and `backend/app/engines/learn/achievements.py`
can be exercised directly. The fake only implements the exact query shapes those
two modules issue — it is not a general-purpose PostgREST emulator.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import pytest

from app.api.routes import learn as learn_module
from app.engines.learn import achievements as achievements_module


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Fake Supabase REST layer ──────────────────────────────────────────────────


def _parse_filters(query: str) -> dict:
    filters: dict[str, tuple[str, object]] = {}
    for part in query.split("&"):
        if not part:
            continue
        key, _, val = part.partition("=")
        if key in ("select", "order", "limit"):
            continue
        if val.startswith("eq."):
            filters[key] = ("eq", val[3:])
        elif val.startswith("gte."):
            filters[key] = ("gte", float(val[4:]))
        elif val.startswith("in."):
            inner = val[3:].strip("()")
            filters[key] = ("in", inner.split(",") if inner else [])
        else:
            filters[key] = ("eq", val)
    return filters


def _row_matches(row: dict, filters: dict) -> bool:
    for col, (op, val) in filters.items():
        rv = row.get(col)
        if op == "eq":
            if isinstance(rv, bool):
                if str(rv).lower() != str(val).lower():
                    return False
            elif str(rv) != str(val):
                return False
        elif op == "gte":
            if rv is None or float(rv) < val:
                return False
        elif op == "in":
            if str(rv) not in val:
                return False
    return True


class FakeResponse:
    def __init__(self, data, headers=None):
        self._data = data
        self.headers = headers or {}

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "achievements": [
                {"id": "first_lesson", "xp_bonus": 25},
                {"id": "ten_lessons", "xp_bonus": 100},
                {"id": "fifty_lessons", "xp_bonus": 500},
                {"id": "perfect_lesson", "xp_bonus": 50},
                {"id": "five_perfects", "xp_bonus": 200},
                {"id": "streak_3", "xp_bonus": 30},
                {"id": "streak_7", "xp_bonus": 100},
                {"id": "streak_30", "xp_bonus": 500},
                {"id": "level_10", "xp_bonus": 250},
                {"id": "level_20", "xp_bonus": 1000},
                {"id": "concept_mastered", "xp_bonus": 75},
                {"id": "ten_concepts_mastered", "xp_bonus": 400},
                {"id": "leak_resolved", "xp_bonus": 100},
                {"id": "path_complete_beginner", "xp_bonus": 300},
                {"id": "path_complete_intermediate", "xp_bonus": 600},
                {"id": "path_complete_advanced", "xp_bonus": 1000},
                {"id": "path_complete_pro", "xp_bonus": 2000},
            ],
        }

    def _table(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, [])

    def select(self, table: str, query: str) -> list[dict]:
        filters = _parse_filters(query)
        return [r for r in self._table(table) if _row_matches(r, filters)]

    def count(self, table: str, query: str) -> int:
        return len(self.select(table, query))

    def insert(self, table: str, data: dict) -> dict:
        row = dict(data)
        if table == "user_leaks" and "id" not in row:
            row["id"] = str(uuid.uuid4())
        self._table(table).append(row)
        return row

    def patch(self, table: str, query: str, data: dict) -> None:
        filters = _parse_filters(query)
        for row in self._table(table):
            if _row_matches(row, filters):
                row.update(data)

    def upsert(self, table: str, data: dict, on_conflict_cols: list[str]) -> dict:
        for row in self._table(table):
            if all(row.get(c) == data.get(c) for c in on_conflict_cols):
                row.update(data)
                return row
        return self.insert(table, data)

    def award_achievement(self, user_id: str, achievement_id: str) -> bool:
        catalog = {a["id"]: a for a in self._table("achievements")}
        if achievement_id not in catalog:
            return False
        already = [
            r for r in self._table("user_achievements")
            if r.get("user_id") == user_id and r.get("achievement_id") == achievement_id
        ]
        if already:
            return False
        # Real Postgres sets earned_at via `DEFAULT NOW()` on INSERT even though
        # the award_achievement() RPC's own INSERT doesn't name the column —
        # mirror that here so get_full_progress's formatting matches production.
        self._table("user_achievements").append({
            "user_id": user_id, "achievement_id": achievement_id, "earned_at": _now_iso(),
        })
        for row in self._table("user_skill_progress"):
            if row.get("user_id") == user_id:
                row["total_xp"] = row.get("total_xp", 0) + catalog[achievement_id]["xp_bonus"]
        return True


class FakeAsyncClient:
    def __init__(self, db: FakeSupabase, *args, **kwargs):
        self.db = db

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @staticmethod
    def _split(url: str) -> tuple[str, str]:
        rest = url.split("/rest/v1/", 1)[1]
        if "?" in rest:
            path, query = rest.split("?", 1)
        else:
            path, query = rest, ""
        return path, query

    async def get(self, url, headers=None):
        path, query = self._split(url)
        return FakeResponse(self.db.select(path, query))

    async def head(self, url, headers=None):
        path, query = self._split(url)
        total = self.db.count(path, query)
        return FakeResponse(None, headers={"content-range": f"0-0/{total}"})

    async def post(self, url, headers=None, json=None):
        path, query = self._split(url)
        if path == "rpc/award_achievement":
            return FakeResponse(self.db.award_achievement(json["p_user_id"], json["p_achievement_id"]))
        prefer = (headers or {}).get("Prefer", "")
        if "resolution=merge-duplicates" in prefer:
            on_conflict = ""
            for part in prefer.split("&"):
                if part.startswith("on_conflict="):
                    on_conflict = part.split("=", 1)[1]
            cols = on_conflict.split(",") if on_conflict else list(json.keys())
            return FakeResponse([self.db.upsert(path, json, cols)])
        return FakeResponse([self.db.insert(path, json)])

    async def patch(self, url, headers=None, json=None):
        path, query = self._split(url)
        self.db.patch(path, query, json)
        return FakeResponse(None)


class FakeSettings:
    supabase_url = "http://fake-supabase"
    supabase_service_role_key = "fake-key"


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeSupabase()

    def _factory(*args, **kwargs):
        return FakeAsyncClient(db, *args, **kwargs)

    monkeypatch.setattr(learn_module.httpx, "AsyncClient", _factory)
    monkeypatch.setattr(achievements_module.httpx, "AsyncClient", _factory)
    monkeypatch.setattr(learn_module, "get_settings", lambda: FakeSettings())
    return db


def run(coro):
    return asyncio.run(coro)


# ── Step submission idempotency ───────────────────────────────────────────────


def test_step_result_awards_xp_once(fake_db):
    user = {"sub": "user-1"}
    body = learn_module.StepResultBody(
        score=90, quality="good", xp_earned=50, concept_ids=[], step_index=0, total_steps=10,
    )

    first = run(learn_module.submit_step_result("lesson-a", "step-1", body, user))
    assert first["xp_awarded_this_call"] == 50
    assert first["new_total_xp"] == 50

    # Replay of the exact same step (refresh, resubmission, etc.)
    second = run(learn_module.submit_step_result("lesson-a", "step-1", body, user))
    assert second["xp_awarded_this_call"] == 0
    assert second["new_total_xp"] == 50  # unchanged — no double credit

    skill_rows = fake_db.select("user_skill_progress", "user_id=eq.user-1")
    assert skill_rows[0]["total_xp"] == 50


def test_step_result_updates_lesson_resume_position(fake_db):
    user = {"sub": "user-1"}
    body = learn_module.StepResultBody(
        score=80, quality="good", xp_earned=10, concept_ids=[], step_index=3, total_steps=10,
    )
    run(learn_module.submit_step_result("lesson-a", "step-4", body, user))

    lesson_rows = fake_db.select("user_lesson_progress", "user_id=eq.user-1&lesson_id=eq.lesson-a")
    assert lesson_rows[0]["status"] == "in_progress"
    assert lesson_rows[0]["current_step_index"] == 3
    assert lesson_rows[0]["current_step_id"] == "step-4"


# ── Lesson completion idempotency ─────────────────────────────────────────────


def test_lesson_complete_awards_bonus_once(fake_db):
    user = {"sub": "user-2"}
    body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=200, path_lesson_ids=[])

    first = run(learn_module.complete_lesson("lesson-b", body, user))
    assert first["already_completed"] is False
    assert first["bonus_xp_earned"] == 200
    # A 100%-score first lesson also unlocks first_lesson (+25) and perfect_lesson
    # (+50) in the same request — the response reflects the true post-achievement total.
    assert first["new_total_xp"] == 275

    # Replaying a completed lesson must not re-award the completion bonus or achievements
    second = run(learn_module.complete_lesson("lesson-b", body, user))
    assert second["already_completed"] is True
    assert second["bonus_xp_earned"] == 0
    assert second["new_total_xp"] == 275

    skill_rows = fake_db.select("user_skill_progress", "user_id=eq.user-2")
    assert skill_rows[0]["total_xp"] == 275


def test_lesson_complete_scales_bonus_by_score(fake_db):
    user = {"sub": "user-3"}
    body = learn_module.LessonCompleteBody(score=50, lesson_xp_reward=200, path_lesson_ids=[])
    result = run(learn_module.complete_lesson("lesson-c", body, user))
    assert result["bonus_xp_earned"] == 100  # 200 * 50%


def test_lesson_complete_persists_completed_at(fake_db):
    """The row itself — not just the response — must carry a real completed_at
    timestamp, and it must never be cleared/moved by a later replay."""
    user_id = "user-3b"
    user = {"sub": user_id}
    body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=100, path_lesson_ids=[])

    run(learn_module.complete_lesson("lesson-cb", body, user))
    row = fake_db.select("user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.lesson-cb")[0]
    assert row["status"] == "completed"
    first_completed_at = row["completed_at"]
    assert first_completed_at  # populated, not None/empty

    # Replaying completion (e.g. reopening an already-finished lesson) must not
    # move completed_at forward — the original completion timestamp is durable.
    run(learn_module.complete_lesson("lesson-cb", body, user))
    row_after = fake_db.select("user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.lesson-cb")[0]
    assert row_after["completed_at"] == first_completed_at

    # And it survives a fresh get_full_progress fetch exactly as stored.
    restored = run(learn_module.get_full_progress(user))
    assert restored["lessons"]["lesson-cb"]["completed_at"] == first_completed_at


# ── Achievement idempotency ───────────────────────────────────────────────────


def test_achievement_awarded_once_across_repeated_checks(fake_db):
    settings = FakeSettings()
    user_id = "user-4"
    fake_db.insert("user_skill_progress", {"user_id": user_id, "total_xp": 0, "level": 1, "streak_days": 0})
    fake_db.insert("user_lesson_progress", {
        "user_id": user_id, "lesson_id": "lesson-x", "status": "completed", "best_score": 100,
    })

    first = run(achievements_module.check_and_award_achievements(user_id, settings))
    assert "first_lesson" in first
    assert "perfect_lesson" in first

    # Re-running the check (e.g. from a second progress write) must not re-award
    second = run(achievements_module.check_and_award_achievements(user_id, settings))
    assert "first_lesson" not in second
    assert "perfect_lesson" not in second

    earned = fake_db.select("user_achievements", f"user_id=eq.{user_id}")
    ids = [e["achievement_id"] for e in earned]
    assert ids.count("first_lesson") == 1
    assert ids.count("perfect_lesson") == 1

    skill_rows = fake_db.select("user_skill_progress", f"user_id=eq.{user_id}")
    # 25 (first_lesson) + 50 (perfect_lesson) credited exactly once each
    assert skill_rows[0]["total_xp"] == 75


def test_path_completion_is_server_verified_not_trusted(fake_db):
    """A client claiming path completion without matching completed rows must not unlock it."""
    settings = FakeSettings()
    user_id = "user-5"
    fake_db.insert("user_skill_progress", {"user_id": user_id, "total_xp": 0, "level": 1, "streak_days": 0})
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "l1", "status": "completed"})
    # l2 is NOT completed server-side, even though the client lists it as part of the path

    awarded = run(achievements_module.check_and_award_achievements(
        user_id, settings, path_id="beginner", path_lesson_ids=["l1", "l2"],
    ))
    assert "path_complete_beginner" not in awarded

    fake_db.patch("user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.l1", {})  # no-op sanity
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "l2", "status": "completed"})
    awarded_after = run(achievements_module.check_and_award_achievements(
        user_id, settings, path_id="beginner", path_lesson_ids=["l1", "l2"],
    ))
    assert "path_complete_beginner" in awarded_after


# ── Guest merge: keeps the higher completion percentage ───────────────────────


def test_guest_merge_keeps_better_account_progress(fake_db):
    user = {"sub": "user-6"}
    # Account already has lesson-d at 100% (2/2 steps)
    fake_db.insert("user_lesson_progress", {
        "user_id": "user-6", "lesson_id": "lesson-d", "status": "completed",
        "best_score": 90, "total_steps": 2,
    })
    fake_db.insert("user_step_progress", {"user_id": "user-6", "lesson_id": "lesson-d", "step_id": "s1"})
    fake_db.insert("user_step_progress", {"user_id": "user-6", "lesson_id": "lesson-d", "step_id": "s2"})

    guest_step = learn_module.GuestStepEvent(
        step_id="s1", score=40, quality="mistake", xp_earned=5, concept_ids=[],
    )
    guest_lesson = learn_module.GuestLessonEvent(
        lesson_id="lesson-d", status="in_progress", last_score=40, best_score=40,
        current_step_index=0, current_step_id="s1", total_steps=2, steps=[guest_step],
    )
    body = learn_module.MergeGuestProgressBody(lessons=[guest_lesson])

    result = run(learn_module.merge_guest_progress(body, user))
    assert "lesson-d" not in result["imported_lessons"]

    # Original account step data must remain untouched (not overwritten by the guest's worse attempt)
    steps = fake_db.select("user_step_progress", "user_id=eq.user-6&lesson_id=eq.lesson-d")
    assert len(steps) == 2


def test_guest_merge_imports_when_guest_is_better(fake_db):
    user = {"sub": "user-7"}
    # Account has lesson-e at 20% (1/5 steps), guest has it fully completed
    fake_db.insert("user_lesson_progress", {
        "user_id": "user-7", "lesson_id": "lesson-e", "status": "in_progress", "total_steps": 5,
    })
    fake_db.insert("user_step_progress", {"user_id": "user-7", "lesson_id": "lesson-e", "step_id": "s1"})

    guest_steps = [
        learn_module.GuestStepEvent(step_id=f"s{i}", score=100, quality="perfect", xp_earned=10, concept_ids=[])
        for i in range(1, 6)
    ]
    guest_lesson = learn_module.GuestLessonEvent(
        lesson_id="lesson-e", status="completed", last_score=100, best_score=100,
        current_step_index=4, current_step_id="s5", total_steps=5, steps=guest_steps,
    )
    body = learn_module.MergeGuestProgressBody(lessons=[guest_lesson])

    result = run(learn_module.merge_guest_progress(body, user))
    assert "lesson-e" in result["imported_lessons"]

    lesson_row = fake_db.select("user_lesson_progress", "user_id=eq.user-7&lesson_id=eq.lesson-e")[0]
    assert lesson_row["status"] == "completed"

    # s1 already existed on the account — must not be double-credited
    steps = fake_db.select("user_step_progress", "user_id=eq.user-7&lesson_id=eq.lesson-e")
    assert len(steps) == 5  # s1 (pre-existing) + s2..s5 (imported)
    # xp only credited for the 4 newly-imported steps, not for the already-existing s1
    assert result["new_total_xp"] == 40


# ── Reproduction of the reported bug: progress must survive a brand-new,
#    stateless "session" — i.e. calling get_full_progress fresh, with zero
#    dependency on any Python-side object left over from the writes. This is
#    the closest a unit test can get to "close the browser and come back
#    tomorrow": the only thing carried over is what's actually in the DB.
# ──────────────────────────────────────────────────────────────────────────


def test_progress_survives_a_fresh_session_fetch(fake_db):
    user = {"sub": "user-8"}

    # Session 1: user answers several steps and completes a lesson, earning XP.
    for i in range(1, 4):
        body = learn_module.StepResultBody(
            score=100, quality="perfect", xp_earned=20, concept_ids=["pot_odds"],
            step_index=i - 1, total_steps=4,
        )
        run(learn_module.submit_step_result("lesson-f", f"step-{i}", body, user))

    complete_body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=150, path_lesson_ids=[])
    run(learn_module.complete_lesson("lesson-f", complete_body, user))

    # "Return the next day": nothing from session 1 is reused except the user id.
    # get_full_progress is the exact endpoint the frontend calls on every fresh load.
    restored = run(learn_module.get_full_progress(user))

    assert restored["lessons"]["lesson-f"]["status"] == "completed"
    assert set(restored["completed_steps"]["lesson-f"]) == {"step-1", "step-2", "step-3"}
    # 3 steps * 20 xp + 150 lesson-completion bonus (100% score) = 210,
    # plus the "first_lesson" (25) and "perfect_lesson" (50) achievements
    # auto-unlocked by a 100%-score first completion.
    assert restored["skill"]["total_xp"] == 210 + 25 + 50
    assert "pot_odds" in restored["concepts"]

    # Simulate logout → login as the SAME user: fetching again must return the
    # identical state, not reset it.
    restored_again = run(learn_module.get_full_progress(user))
    assert restored_again["skill"]["total_xp"] == restored["skill"]["total_xp"]
    assert restored_again["lessons"]["lesson-f"]["status"] == "completed"


def test_user_b_cannot_see_user_a_progress(fake_db):
    user_a = {"sub": "user-a"}
    user_b = {"sub": "user-b"}

    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=30, concept_ids=[], step_index=0, total_steps=1,
    )
    run(learn_module.submit_step_result("lesson-g", "step-1", body, user_a))

    progress_a = run(learn_module.get_full_progress(user_a))
    progress_b = run(learn_module.get_full_progress(user_b))

    assert "lesson-g" in progress_a["lessons"]
    assert progress_a["skill"]["total_xp"] == 30

    # User B must start from a clean slate — none of A's rows, none of A's XP.
    assert "lesson-g" not in progress_b["lessons"]
    assert progress_b["skill"]["total_xp"] == 0
    assert progress_b["completed_steps"] == {}


def test_out_of_order_step_saves_do_not_regress_resume_position(fake_db):
    """Reproduces: Step A's save starts first but finishes after Step B's.
    The later (higher) step index must win regardless of arrival order."""
    user = {"sub": "user-9"}

    # Step B (index 4) is submitted/arrives FIRST at the server...
    body_b = learn_module.StepResultBody(
        score=90, quality="good", xp_earned=10, concept_ids=[], step_index=4, total_steps=10,
    )
    run(learn_module.submit_step_result("lesson-h", "step-5", body_b, user))

    # ...then a slow, now-stale request for an EARLIER step (index 1) lands after it.
    body_a = learn_module.StepResultBody(
        score=80, quality="good", xp_earned=10, concept_ids=[], step_index=1, total_steps=10,
    )
    run(learn_module.submit_step_result("lesson-h", "step-2", body_a, user))

    lesson_row = fake_db.select("user_lesson_progress", "user_id=eq.user-9&lesson_id=eq.lesson-h")[0]
    # The stale, lower step index must NOT have overwritten the further-along position.
    assert lesson_row["current_step_index"] == 4
    assert lesson_row["current_step_id"] == "step-5"


def test_late_step_save_cannot_undo_completion(fake_db):
    """Reproduces the exact race called out in the persistence bug report: the
    final step's save and the lesson-complete call are both in flight, and the
    step save (for whatever reason — retry, network jitter) lands AFTER the
    lesson has already been marked completed. It must not flip status back to
    in_progress, and completed_at must survive untouched."""
    user_id = "user-9b"
    user = {"sub": user_id}

    step_body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=10, concept_ids=[], step_index=9, total_steps=10,
    )
    run(learn_module.submit_step_result("lesson-hb", "step-10", step_body, user))

    complete_body = learn_module.LessonCompleteBody(score=100, lesson_xp_reward=100, path_lesson_ids=[])
    run(learn_module.complete_lesson("lesson-hb", complete_body, user))

    row = fake_db.select("user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.lesson-hb")[0]
    assert row["status"] == "completed"
    completed_at = row["completed_at"]

    # A stale/late duplicate of the SAME final step's save arrives after completion.
    run(learn_module.submit_step_result("lesson-hb", "step-10", step_body, user))

    row_after = fake_db.select("user_lesson_progress", f"user_id=eq.{user_id}&lesson_id=eq.lesson-hb")[0]
    assert row_after["status"] == "completed"
    assert row_after["completed_at"] == completed_at

    # And a fresh session fetch must agree — the lesson is still, durably, complete.
    restored = run(learn_module.get_full_progress(user))
    assert restored["lessons"]["lesson-hb"]["status"] == "completed"


def test_partial_step_update_does_not_erase_other_lessons(fake_db):
    """User has Lesson 1 + Lesson 2 complete, Lesson 3 in progress. Answering a
    step in Lesson 3 must not touch — let alone erase — Lessons 1 and 2."""
    user_id = "user-10"
    user = {"sub": user_id}
    fake_db.insert("user_lesson_progress", {
        "user_id": user_id, "lesson_id": "lesson-1", "status": "completed", "best_score": 100,
    })
    fake_db.insert("user_lesson_progress", {
        "user_id": user_id, "lesson_id": "lesson-2", "status": "completed", "best_score": 90,
    })

    body = learn_module.StepResultBody(
        score=70, quality="acceptable", xp_earned=5, concept_ids=[], step_index=2, total_steps=5,
    )
    run(learn_module.submit_step_result("lesson-3", "step-3", body, user))

    progress = run(learn_module.get_full_progress(user))
    assert progress["lessons"]["lesson-1"]["status"] == "completed"
    assert progress["lessons"]["lesson-2"]["status"] == "completed"
    assert progress["lessons"]["lesson-3"]["status"] == "in_progress"


# ── Module completion: server-verified, idempotent ────────────────────────────


def test_module_complete_rejects_when_lessons_are_not_actually_done(fake_db):
    """A client calling module-complete without every lesson server-verified as
    completed must not be awarded the bonus — mirrors path-completion's
    verify-don't-trust rule (test_path_completion_is_server_verified_not_trusted)."""
    user_id = "user-11"
    user = {"sub": user_id}
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "m1-l1", "status": "completed"})
    # m1-l2 is NOT completed server-side, even though the client claims the module is done

    body = learn_module.ModuleCompleteBody(module_xp_reward=100, lesson_ids=["m1-l1", "m1-l2"])
    result = run(learn_module.complete_module("module-1", body, user))

    assert result["eligible"] is False
    assert result["bonus_xp_earned"] == 0
    assert result["already_completed"] is False

    rows = fake_db.select("user_module_progress", f"user_id=eq.{user_id}&module_id=eq.module-1")
    assert rows == []


def test_module_complete_awards_bonus_once(fake_db):
    user_id = "user-12"
    user = {"sub": user_id}
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "m2-l1", "status": "completed"})
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "m2-l2", "status": "completed"})

    body = learn_module.ModuleCompleteBody(path_id="beginner", module_xp_reward=100, lesson_ids=["m2-l1", "m2-l2"])

    first = run(learn_module.complete_module("module-2", body, user))
    assert first["eligible"] is True
    assert first["already_completed"] is False
    assert first["bonus_xp_earned"] == 100
    # 100 module bonus + 25 for the "first_lesson" achievement (2 lessons were
    # already completed server-side, auto-unlocked in this same request).
    assert first["new_total_xp"] == 125

    # Replay (refresh, reopening the module, clicking through again) must not
    # re-award the bonus a second time.
    second = run(learn_module.complete_module("module-2", body, user))
    assert second["already_completed"] is True
    assert second["bonus_xp_earned"] == 0
    assert second["new_total_xp"] == 125

    skill_rows = fake_db.select("user_skill_progress", f"user_id=eq.{user_id}")
    assert skill_rows[0]["total_xp"] == 125

    module_rows = fake_db.select("user_module_progress", f"user_id=eq.{user_id}&module_id=eq.module-2")
    assert len(module_rows) == 1


def test_module_completion_survives_a_fresh_progress_fetch(fake_db):
    user_id = "user-13"
    user = {"sub": user_id}
    fake_db.insert("user_lesson_progress", {"user_id": user_id, "lesson_id": "m3-l1", "status": "completed"})

    body = learn_module.ModuleCompleteBody(module_xp_reward=50, lesson_ids=["m3-l1"])
    run(learn_module.complete_module("module-3", body, user))

    restored = run(learn_module.get_full_progress(user))
    assert "module-3" in restored["completed_modules"]
