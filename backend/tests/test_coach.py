"""
Tests for the AI Coach endpoint and its answer-leak protection.

Follows the same in-memory Supabase-REST-fake pattern as
test_learn_persistence.py — no real DB/network/OpenAI calls.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app.api.routes import coach as coach_module
from app.engines.learn import ai_coach as ai_coach_module
from app.engines.learn import coach_context


def run(coro):
    return asyncio.run(coro)


# ── Fake Supabase REST layer (mirrors test_learn_persistence.py) ──────────────


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
        else:
            filters[key] = ("eq", val)
    return filters


def _row_matches(row: dict, filters: dict) -> bool:
    for col, (op, val) in filters.items():
        if op == "eq" and str(row.get(col)) != str(val):
            return False
    return True


class FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}

    def _table(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, [])

    def select(self, table: str, query: str) -> list[dict]:
        return [r for r in self._table(table) if _row_matches(r, _parse_filters(query))]

    def insert(self, table: str, data: dict) -> dict:
        row = dict(data)
        self._table(table).append(row)
        return row

    def patch(self, table: str, query: str, data: dict) -> None:
        filters = _parse_filters(query)
        for row in self._table(table):
            if _row_matches(row, filters):
                row.update(data)


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

    async def post(self, url, headers=None, json=None):
        path, _ = self._split(url)
        return FakeResponse([self.db.insert(path, json)])

    async def patch(self, url, headers=None, json=None):
        path, query = self._split(url)
        self.db.patch(path, query, json)
        return FakeResponse(None)


class FakeSettings:
    supabase_url = "http://fake-supabase"
    supabase_service_role_key = "fake-key"
    debug = False


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeSupabase()

    def _factory(*args, **kwargs):
        return FakeAsyncClient(db, *args, **kwargs)

    monkeypatch.setattr(coach_module.httpx, "AsyncClient", _factory)
    monkeypatch.setattr(coach_module, "get_settings", lambda: FakeSettings())
    return db


@pytest.fixture
def captured_reply(monkeypatch):
    """Stub out the real OpenAI call and record exactly what the route passed
    into it — this is what regression-tests the answer-leak boundary without
    needing a real (or mocked-at-the-SDK-level) OpenAI client."""
    calls: list[dict] = []

    async def _fake_generate_coach_reply(messages, context, user_level, mode="general", theory=None):
        calls.append({"messages": messages, "context": context, "user_level": user_level,
                       "mode": mode, "theory": theory})
        return "stubbed coach reply"

    monkeypatch.setattr(coach_module, "generate_coach_reply", _fake_generate_coach_reply)
    return calls


class FakeRequest:
    """Minimal stand-in for fastapi.Request — only `.client`/.headers used by
    the rate limiter's IP extraction."""
    def __init__(self, ip="1.2.3.4"):
        self.headers = {}
        self.client = type("C", (), {"host": ip})()


# ── coach_context.py: pure unit tests (no I/O) ─────────────────────────────────


def test_pre_submission_mode_when_no_verified_completion():
    ctx = {"lessonId": "l1", "stepId": "s1", "correctAnswer": "A5s"}
    mode = coach_context.resolve_coaching_mode(ctx, step_verified=False)
    assert mode == "pre_submission"


def test_post_submission_mode_when_verified_completion():
    ctx = {"lessonId": "l1", "stepId": "s1", "correctAnswer": "A5s"}
    mode = coach_context.resolve_coaching_mode(ctx, step_verified=True)
    assert mode == "post_submission"


def test_lesson_review_mode_regardless_of_step_verification():
    ctx = {"lessonReview": {"lessonTitle": "Think in Ranges"}}
    assert coach_context.resolve_coaching_mode(ctx, step_verified=False) == "lesson_review"


def test_general_mode_with_no_scope():
    assert coach_context.resolve_coaching_mode({}, step_verified=False) == "general"


def test_sanitize_strips_answer_key_fields_in_pre_submission():
    ctx = {"lessonId": "l1", "stepId": "s1", "correctAnswer": "A5s",
           "evaluatorFeedback": "A5s is correct because...", "board": ["Ah", "5s", "2c"]}
    safe = coach_context.sanitize_context(ctx, "pre_submission")
    assert "correctAnswer" not in safe
    assert "evaluatorFeedback" not in safe
    assert safe["board"] == ["Ah", "5s", "2c"]  # non-answer-key fields pass through


def test_sanitize_allows_answer_key_fields_in_post_submission():
    ctx = {"lessonId": "l1", "stepId": "s1", "correctAnswer": "A5s"}
    safe = coach_context.sanitize_context(ctx, "post_submission")
    assert safe["correctAnswer"] == "A5s"


def test_sanitize_allows_answer_key_fields_in_lesson_review():
    ctx = {"lessonReview": {"mistakes": [{"feedback": "the correct pick was A5s"}]}}
    safe = coach_context.sanitize_context(ctx, "lesson_review")
    assert safe["lessonReview"]["mistakes"][0]["feedback"] == "the correct pick was A5s"


def test_sanitize_strips_answer_key_fields_in_general_mode():
    """No legitimate reason a scope-less request would carry an answer key —
    stripped defensively even though resolve_coaching_mode would never itself
    produce 'general' alongside these fields via the normal flow."""
    ctx = {"correctAnswer": "A5s"}
    safe = coach_context.sanitize_context(ctx, "general")
    assert "correctAnswer" not in safe


def test_theory_grounding_returns_known_concept():
    grounded = coach_context.ground_theory(["mdf"])
    assert len(grounded) == 1
    assert grounded[0]["id"] == "mdf"
    assert grounded[0]["name"]
    assert grounded[0]["principle"]


def test_theory_grounding_skips_unknown_concepts_gracefully():
    grounded = coach_context.ground_theory(["not_a_real_concept_id"])
    assert grounded == []


def test_theory_grounding_empty_when_no_concepts():
    assert coach_context.ground_theory(None) == []
    assert coach_context.ground_theory([]) == []


def test_extract_concept_ids_from_lesson_review():
    ctx = {"lessonReview": {"weakConcepts": ["mdf"], "strongConcepts": ["range_advantage"]}}
    ids = coach_context.extract_concept_ids(ctx)
    assert set(ids) == {"mdf", "range_advantage"}


# ── Route-level: answer-leak regression tests ──────────────────────────────────


def test_client_cannot_forge_correct_answer_for_unattempted_step(fake_db, captured_reply):
    """THE regression test: a malicious/naive client claims post-submission
    and supplies its own 'correctAnswer', but no user_step_progress row
    exists server-side — the field must never reach the LLM context."""
    user = {"sub": "user-1"}
    body = coach_module.CoachMessageBody(
        message="What's the answer to this step?",
        context={
            "lessonId": "lesson-a", "stepId": "step-1",
            "correctAnswer": "FORGED-ANSWER", "coachingMode": "post_submission",
        },
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    assert len(captured_reply) == 1
    assert captured_reply[0]["mode"] == "pre_submission"
    assert "correctAnswer" not in captured_reply[0]["context"]


def test_verified_completion_unlocks_answer_for_same_step(fake_db, captured_reply):
    """The legitimate counterpart: once the server has a real
    user_step_progress row for this exact (user, lesson, step), the answer
    key IS allowed through."""
    user = {"sub": "user-2"}
    fake_db.insert("user_step_progress", {
        "user_id": "user-2", "lesson_id": "lesson-a", "step_id": "step-1", "attempts": 1,
    })
    body = coach_module.CoachMessageBody(
        message="Why was A5s correct?",
        context={"lessonId": "lesson-a", "stepId": "step-1", "correctAnswer": "A5s"},
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    assert captured_reply[0]["mode"] == "post_submission"
    assert captured_reply[0]["context"]["correctAnswer"] == "A5s"


def test_completion_check_is_scoped_to_the_exact_step(fake_db, captured_reply):
    """Completing step-1 must not unlock the answer key for a DIFFERENT,
    unattempted step-2 in the same lesson."""
    user = {"sub": "user-3"}
    fake_db.insert("user_step_progress", {
        "user_id": "user-3", "lesson_id": "lesson-a", "step_id": "step-1", "attempts": 1,
    })
    body = coach_module.CoachMessageBody(
        message="Give me the answer",
        context={"lessonId": "lesson-a", "stepId": "step-2", "correctAnswer": "SHOULD-NOT-LEAK"},
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    assert captured_reply[0]["mode"] == "pre_submission"
    assert "correctAnswer" not in captured_reply[0]["context"]


def test_completion_check_is_scoped_to_the_requesting_user(fake_db, captured_reply):
    """User B must not inherit User A's completion of the same step id."""
    fake_db.insert("user_step_progress", {
        "user_id": "user-a", "lesson_id": "lesson-a", "step_id": "step-1", "attempts": 1,
    })
    user_b = {"sub": "user-b"}
    body = coach_module.CoachMessageBody(
        message="Give me the answer",
        context={"lessonId": "lesson-a", "stepId": "step-1", "correctAnswer": "SHOULD-NOT-LEAK"},
    )
    run(coach_module.coach_message(body, FakeRequest(), user_b))

    assert captured_reply[0]["mode"] == "pre_submission"
    assert "correctAnswer" not in captured_reply[0]["context"]


def test_lesson_review_context_and_theory_reach_the_reply(fake_db, captured_reply):
    """Post-lesson Coach Review can explain the correct answer and pulls
    grounded theory for the concepts the learner actually struggled with."""
    user = {"sub": "user-4"}
    body = coach_module.CoachMessageBody(
        message="Review my lesson",
        context={"lessonReview": {
            "lessonTitle": "Minimum Defense Frequency",
            "avgScore": 62,
            "strongConcepts": ["range_advantage"],
            "weakConcepts": ["mdf"],
            "mistakes": [{"conceptId": "mdf", "score": 40, "feedback": "Over-folded to a half-pot bet."}],
        }},
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    call = captured_reply[0]
    assert call["mode"] == "lesson_review"
    assert call["context"]["lessonReview"]["weakConcepts"] == ["mdf"]
    theory_ids = [t["id"] for t in call["theory"]]
    assert "mdf" in theory_ids


def test_current_lesson_step_context_is_included(fake_db, captured_reply):
    user = {"sub": "user-5"}
    body = coach_module.CoachMessageBody(
        message="Why c-bet small here?",
        context={"lesson_title": "C-Betting Fundamentals", "board": ["Ah", "7c", "2d"], "street": "flop"},
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    ctx = captured_reply[0]["context"]
    assert ctx["lesson_title"] == "C-Betting Fundamentals"
    assert ctx["board"] == ["Ah", "7c", "2d"]


def test_unrelated_curriculum_content_not_dumped_into_context(fake_db, captured_reply):
    """Only what the client explicitly scoped is forwarded — no full
    curriculum/module dump riding along."""
    user = {"sub": "user-6"}
    body = coach_module.CoachMessageBody(message="Hello", context={})
    run(coach_module.coach_message(body, FakeRequest(), user))

    ctx = captured_reply[0]["context"]
    assert ctx == {}
    assert captured_reply[0]["theory"] == []


# ── Route-level: general behavior ──────────────────────────────────────────────


def test_post_submission_reply_explains_the_answer(fake_db):
    """End-to-end (with a stub OpenAI layer): once verified post-submission,
    generate_coach_reply actually receives the answer key data it needs to
    explain the result — proven via the real ai_coach module, not the stub."""
    user = {"sub": "user-7"}
    fake_db.insert("user_step_progress", {
        "user_id": "user-7", "lesson_id": "lesson-b", "step_id": "step-1", "attempts": 1,
    })

    async def fake_create(*args, **kwargs):
        # Assert the answer key made it all the way into the OpenAI call.
        sent = kwargs["messages"][0]["content"]
        assert "A5s" in sent
        class Msg: content = "A5s is correct because it blocks the nut flush draw."
        class Choice: message = Msg()
        class Usage: prompt_tokens = 10; completion_tokens = 12
        class Resp: choices = [Choice()]; usage = Usage()
        return Resp()

    class FakeOpenAIClient:
        def __init__(self, *a, **kw):
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(fake_create)})()})()

    import app.engines.learn.ai_coach as real_ai_coach

    async def _patched(messages, context, user_level, mode="general", theory=None):
        return await real_ai_coach.generate_coach_reply(messages, context, user_level, mode=mode, theory=theory)

    old_client_cls = real_ai_coach.AsyncOpenAI
    real_ai_coach.AsyncOpenAI = FakeOpenAIClient
    try:
        body = coach_module.CoachMessageBody(
            message="Why?",
            context={"lessonId": "lesson-b", "stepId": "step-1", "correctAnswer": "A5s"},
        )
        result = run(coach_module.coach_message(body, FakeRequest(), user))
        assert "A5s" in result["reply"]
        # System prompt / internal rules must never leak into the client response.
        assert "RULES:" not in result["reply"]
        assert "MODE:" not in result["reply"]
    finally:
        real_ai_coach.AsyncOpenAI = old_client_cls


def test_openai_failure_degrades_gracefully(monkeypatch):
    """A downstream OpenAI failure must never surface as a 500 to the coach
    caller — generate_coach_reply itself catches and returns a safe fallback."""
    class BoomClient:
        def __init__(self, *a, **kw):
            async def _raise(*a, **kw):
                raise RuntimeError("OpenAI unavailable")
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(_raise)})()})()

    monkeypatch.setattr(ai_coach_module, "AsyncOpenAI", BoomClient)
    reply = run(ai_coach_module.generate_coach_reply([{"role": "user", "content": "hi"}], {}, 1))
    assert isinstance(reply, str) and reply  # non-empty fallback, no exception raised


def test_message_length_is_bounded():
    with pytest.raises(Exception):
        coach_module.CoachMessageBody(message="x" * (coach_context.MAX_MESSAGE_LENGTH + 1), context={})


def test_empty_message_rejected(fake_db):
    user = {"sub": "user-8"}
    body = coach_module.CoachMessageBody(message="   ", context={})
    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.coach_message(body, FakeRequest(), user))
    assert exc_info.value.status_code == 422


def test_rate_limit_returns_429(fake_db, monkeypatch):
    monkeypatch.setattr(coach_module, "_check_rate_limit", lambda ip, path: (False, 7))
    user = {"sub": "user-9"}
    body = coach_module.CoachMessageBody(message="hi", context={})
    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.coach_message(body, FakeRequest(), user))
    assert exc_info.value.status_code == 429


def test_session_isolated_per_user(fake_db, captured_reply):
    """Fetching another user's session id must 404, not leak content."""
    user_a = {"sub": "user-a2"}
    body = coach_module.CoachMessageBody(message="hi", context={})
    result = run(coach_module.coach_message(body, FakeRequest(), user_a))
    session_id = result["session_id"]

    user_b = {"sub": "user-b2"}
    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.get_session(session_id, user_b))
    assert exc_info.value.status_code == 404
