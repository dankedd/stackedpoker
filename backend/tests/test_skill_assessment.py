"""POST /learn/assessment/submit — saving the poker experience level.

The route talks to Supabase over PostgREST. These tests put a small fake
PostgREST behind httpx that behaves like the real one where it matters: an
upsert only merges when `on_conflict` is a query parameter — otherwise it is a
plain INSERT and an existing row gives 409 / 23505. That is exactly the bug
that made every level change in Settings fail on production.
"""

from __future__ import annotations

import asyncio
import json
import logging
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException

from app.api.routes import skill_assessment as route

USER = "11111111-2222-3333-4444-555555555555"
LEVELS = ["beginner", "recreational", "intermediate", "advanced"]


class FakePostgrest:
    def __init__(self, *, assessment: dict | None = None, profile: bool = True, fail: dict | None = None):
        self.assessment = {USER: assessment} if assessment else {}
        self.profiles = {USER: {"assessment_completed": bool(assessment)}} if profile else {}
        self.history: list[dict] = []
        self.fail = fail or {}  # table -> (status, code, message)
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = urlparse(str(request.url))
        table = url.path.rsplit("/", 1)[-1]
        query = parse_qs(url.query)
        if table in self.fail and request.method != "GET":
            status, code, message = self.fail[table]
            return httpx.Response(status, json={"code": code, "message": message, "details": f"Key (user_id)=({USER})"})

        if table == "user_skill_assessment" and request.method == "GET":
            row = self.assessment.get(USER)
            return httpx.Response(200, json=[row] if row else [])
        if table == "user_skill_assessment" and request.method == "POST":
            body = json.loads(request.content)
            merge = "on_conflict" in query and "resolution=merge-duplicates" in request.headers.get("prefer", "")
            if body["user_id"] in self.assessment and not merge:
                return httpx.Response(409, json={"code": "23505", "message": "duplicate key value violates unique constraint \"user_skill_assessment_pkey\""})
            self.assessment[body["user_id"]] = {k: v for k, v in body.items() if k != "user_id"}
            return httpx.Response(201, json=[body])
        if table == "profiles" and request.method == "PATCH":
            row = self.profiles.get(USER)
            if row is None:
                return httpx.Response(200, json=[])  # 0 rows updated, not an error
            row.update(json.loads(request.content))
            return httpx.Response(200, json=[row])
        if table == "skill_check_history" and request.method == "POST":
            self.history.append(json.loads(request.content))
            return httpx.Response(201, json=[self.history[-1]])
        return httpx.Response(404, json={"message": f"unexpected {request.method} {table}"})


@pytest.fixture
def fake(monkeypatch):
    holder: dict[str, FakePostgrest] = {}

    def install(**kw) -> FakePostgrest:
        db = FakePostgrest(**kw)
        holder["db"] = db
        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            route.httpx, "AsyncClient",
            lambda **k: real_client(transport=httpx.MockTransport(db.handler), **k),
        )
        monkeypatch.setattr(
            route, "get_settings",
            lambda: SimpleNamespace(supabase_url="https://db.test", supabase_service_role_key="service-key"),
        )
        return db

    return install


def submit(level: str, module: str | None = "m1"):
    body = route.SubmitAssessmentBody(experience_level=level, recommended_module_id=module)
    return asyncio.run(route.submit_assessment(body, current_user={"sub": USER}))


@pytest.mark.parametrize("level", LEVELS)
def test_new_user_saves_every_level(fake, level):
    db = fake()
    assert submit(level) == {"ok": True}
    assert db.assessment[USER]["experience_level"] == level
    assert db.profiles[USER]["assessment_completed"] is True
    assert db.history[-1]["check_type"] == "initial_onboarding"


@pytest.mark.parametrize("level", LEVELS)
def test_existing_user_can_change_to_every_level(fake, level):
    """The production bug: a second save used to 409 on the primary key."""
    db = fake(assessment={"experience_level": "intermediate" if level != "intermediate" else "beginner", "recommended_module_id": "old"})
    assert submit(level, module="new") == {"ok": True}
    assert db.assessment[USER] == {"experience_level": level, "recommended_module_id": "new"}
    assert db.history[-1]["check_type"] == "periodic_recheck"
    assert db.history[-1]["league_after"] == level


def test_upsert_sends_on_conflict_as_query_param_not_in_prefer(fake):
    db = fake(assessment={"experience_level": "beginner", "recommended_module_id": None})
    submit("advanced")
    post = next(r for r in db.requests if r.method == "POST" and r.url.path.endswith("user_skill_assessment"))
    assert parse_qs(post.url.query.decode())["on_conflict"] == ["user_id"]
    assert "on_conflict" not in post.headers["prefer"]
    assert "resolution=merge-duplicates" in post.headers["prefer"]


def test_account_without_profile_row_still_saves(fake):
    db = fake(profile=False)
    assert submit("recreational") == {"ok": True}
    assert db.assessment[USER]["experience_level"] == "recreational"


def test_invalid_level_is_rejected_before_any_write(fake):
    db = fake()
    with pytest.raises(HTTPException) as exc:
        submit("casual")
    assert exc.value.status_code == 422
    assert db.requests == []


def test_database_error_returns_502_and_logs_the_real_cause_without_ids(fake, caplog):
    fake(fail={"user_skill_assessment": (500, "42P01", 'relation "user_skill_assessment" does not exist')})
    with caplog.at_level(logging.ERROR, logger=route.logger.name), pytest.raises(HTTPException) as exc:
        submit("advanced")
    assert exc.value.status_code == 502
    logged = caplog.text
    assert "user_skill_assessment -> 500 42P01" in logged
    assert "does not exist" in logged
    assert USER not in logged


def test_history_failure_does_not_undo_a_saved_level(fake, caplog):
    db = fake(fail={"skill_check_history": (403, "42501", "permission denied")})
    with caplog.at_level(logging.WARNING, logger=route.logger.name):
        assert submit("advanced") == {"ok": True}
    assert db.assessment[USER]["experience_level"] == "advanced"
    assert "skill_check_history -> 403 42501" in caplog.text
