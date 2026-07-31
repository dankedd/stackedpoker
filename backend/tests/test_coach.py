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
from app.engines.learn import coach_usage as coach_usage_module


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

    # ── ai_coach_usage RPCs — mirrors reserve_coach_usage/release_coach_usage's
    #    real SQL semantics (see supabase_ai_coach_usage_schema.sql). Since this
    #    runs as a single synchronous Python call with no `await` inside, two
    #    "concurrent" asyncio tasks calling it can never interleave mid-check —
    #    exactly the atomicity the real DB's row lock provides.
    def reserve_coach_usage(self, user_id: str, daily_limit: int) -> dict:
        # Return shape mirrors the REAL RPC exactly (message_count, allowed) —
        # `usage_date` was removed from RETURNS TABLE by the ambiguous-column
        # bugfix (see supabase_ai_coach_usage_schema.sql); it's still tracked
        # in the internal row dict below, just never part of what the RPC
        # hands back to the caller.
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        rows = self._table("ai_coach_usage")
        row = next((r for r in rows if r["user_id"] == user_id and r["usage_date"] == today), None)
        if row is None:
            row = {"user_id": user_id, "usage_date": today, "message_count": 1}
            rows.append(row)
            return {"message_count": 1, "allowed": True}
        if row["message_count"] < daily_limit:
            row["message_count"] += 1
            return {"message_count": row["message_count"], "allowed": True}
        return {"message_count": row["message_count"], "allowed": False}

    def release_coach_usage(self, user_id: str) -> None:
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        for row in self._table("ai_coach_usage"):
            if row["user_id"] == user_id and row["usage_date"] == today:
                row["message_count"] = max(row["message_count"] - 1, 0)


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
        if path == "rpc/reserve_coach_usage":
            # The real RPC always returns exactly one row (allowed true or
            # false) via RETURN QUERY in both IF branches — never zero rows.
            result = self.db.reserve_coach_usage(json["p_user_id"], json["p_daily_limit"])
            return FakeResponse([result])
        if path == "rpc/release_coach_usage":
            self.db.release_coach_usage(json["p_user_id"])
            return FakeResponse([])
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

    async def _fake_generate_coach_reply(messages, context, user_level, mode="general", theory=None, action=None):
        calls.append({"messages": messages, "context": context, "user_level": user_level,
                       "mode": mode, "theory": theory, "action": action})
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


# ── coach_context.py: canonical range lookup (real data, Level 1 hierarchy) ────


def test_canonical_open_range_pure_fold_for_hand_outside_utg_chart():
    """A5s is not in our UTG_OPEN list at all — a genuine, real pure fold,
    not an invented number (matches the user-facing 'should I open A5s UTG?'
    example directly)."""
    ctx = {"hero_position": "UTG", "hand": "A5s", "effective_stack_bb": 100}
    result = coach_context.lookup_canonical_open_range(ctx)
    assert result == {
        "spot": {"position": "UTG", "stack_bb": 100, "action": "RFI"},
        "hand": "A5s",
        "canonical_strategy": {"raise": 0.0, "fold": 1.0},
    }


def test_canonical_open_range_preserves_mixed_frequency():
    """88 is a real 0.5-weight entry in UTG_OPEN — must come back as a mixed
    complement, never collapsed into a pure raise or pure fold."""
    ctx = {"hero_position": "UTG", "hand": "88", "effective_stack_bb": 100}
    result = coach_context.lookup_canonical_open_range(ctx)
    assert result["canonical_strategy"] == {"raise": 0.5, "fold": 0.5}


def test_canonical_open_range_none_when_villain_position_present():
    """A vs-position spot (defend/3bet) isn't covered by the open-range
    chart — must not be misrepresented as canonical RFI data."""
    ctx = {"hero_position": "BTN", "villain_position": "CO", "hand": "AKs", "effective_stack_bb": 100}
    assert coach_context.lookup_canonical_open_range(ctx) is None


def test_canonical_open_range_none_when_stack_depth_not_supported():
    """Only the 100bb chart exists — a 40bb spot must fall through to
    general reasoning rather than being labeled canonical."""
    ctx = {"hero_position": "UTG", "hand": "AA", "effective_stack_bb": 40}
    assert coach_context.lookup_canonical_open_range(ctx) is None


def test_canonical_open_range_none_for_bb_position():
    """BB never opens (always facing action) — no chart exists for it."""
    ctx = {"hero_position": "BB", "hand": "AA", "effective_stack_bb": 100}
    assert coach_context.lookup_canonical_open_range(ctx) is None


def test_canonical_open_range_none_without_hand():
    ctx = {"hero_position": "UTG", "effective_stack_bb": 100}
    assert coach_context.lookup_canonical_open_range(ctx) is None


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


def test_canonical_range_reaches_llm_but_not_persisted_session(fake_db, captured_reply):
    """The route enriches the LLM-bound context with real canonical range
    data for a qualifying RFI spot, but the session persisted to Supabase
    stays a faithful record of what the client actually sent."""
    user = {"sub": "user-canonical"}
    body = coach_module.CoachMessageBody(
        message="Should I open A5s UTG?",
        context={"hero_position": "UTG", "hand": "A5s", "effective_stack_bb": 100},
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    llm_ctx = captured_reply[0]["context"]
    assert llm_ctx["canonical_strategy"] == {"raise": 0.0, "fold": 1.0}

    session_row = fake_db.tables["training_sessions"][0]
    assert "canonical_strategy" not in session_row["context"]


def test_unrelated_curriculum_content_not_dumped_into_context(fake_db, captured_reply):
    """Only what the client explicitly scoped is forwarded — no full
    curriculum/module dump riding along."""
    user = {"sub": "user-6"}
    body = coach_module.CoachMessageBody(message="Hello", context={})
    run(coach_module.coach_message(body, FakeRequest(), user))

    ctx = captured_reply[0]["context"]
    assert ctx == {}
    assert captured_reply[0]["theory"] == []


# ── Regression: training_sessions schema drift ─────────────────────────────────
#
# Root cause of a real production incident: coach.py's session-creation INSERT
# sent `created_at`, but the actual `training_sessions` table (see
# supabase_learning_schema.sql) has no such column — only `started_at`. The
# FakeSupabase test double doesn't validate column names against a real
# schema, so this shipped without any test catching it; PostgREST rejected
# every first message with PGRST204, which coach.py mapped to a 502, which
# the frontend displayed as "temporarily unavailable" — OpenAI was never
# reached. Verified directly against production Supabase's live OpenAPI
# schema on 2026-07-24 (insert-then-delete round trip, no data left behind).
REAL_TRAINING_SESSIONS_COLUMNS = {
    "id", "user_id", "session_type", "context", "messages", "started_at", "updated_at",
}


def test_new_session_insert_only_uses_real_training_sessions_columns(fake_db, captured_reply):
    user = {"sub": "user-schema"}
    body = coach_module.CoachMessageBody(message="hi", context={})
    run(coach_module.coach_message(body, FakeRequest(), user))

    inserted = fake_db.tables["training_sessions"][0]
    assert set(inserted.keys()) <= REAL_TRAINING_SESSIONS_COLUMNS, (
        f"session INSERT includes column(s) not in the real schema: "
        f"{set(inserted.keys()) - REAL_TRAINING_SESSIONS_COLUMNS}"
    )
    assert "started_at" in inserted  # the actual timestamp column — not created_at


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


def test_openai_failure_raises_coach_unavailable_error(monkeypatch):
    """A downstream OpenAI failure must NOT be swallowed into a canned string
    that looks like a real reply — generate_coach_reply raises so the caller
    can distinguish a genuine failure from a genuine answer (see requirement
    that fallback behavior never silently fake a Coach response)."""
    class BoomClient:
        def __init__(self, *a, **kw):
            async def _raise(*a, **kw):
                raise RuntimeError("OpenAI unavailable")
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(_raise)})()})()

    monkeypatch.setattr(ai_coach_module, "AsyncOpenAI", BoomClient)
    with pytest.raises(ai_coach_module.CoachUnavailableError):
        run(ai_coach_module.generate_coach_reply([{"role": "user", "content": "hi"}], {}, 1))


def test_openai_failure_returns_503_and_does_not_persist_fake_reply(fake_db, monkeypatch):
    """Route-level: when the LLM call fails, the caller gets a real 503 (not
    a 200 with a fabricated reply), and no fake assistant message is written
    into the session's persisted history."""
    async def _boom(*a, **kw):
        raise ai_coach_module.CoachUnavailableError("boom")

    monkeypatch.setattr(coach_module, "generate_coach_reply", _boom)
    user = {"sub": "user-unavailable"}
    body = coach_module.CoachMessageBody(message="Should I open A5s UTG?", context={})

    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.coach_message(body, FakeRequest(), user))

    assert exc_info.value.status_code == 503
    session_row = fake_db.tables["training_sessions"][0]
    assert session_row["messages"] == []  # never patched with a fake assistant turn


def test_system_prompt_no_longer_socratic_only():
    """Regression for the reported production behavior: after a learner says
    'I don't know', the coach must not keep firing open-ended questions. The
    old prompt explicitly told the model to 'ask one focused question' and
    never give the answer — assert that instruction, and the matching
    Socratic fallback string, are both gone."""
    assert "ask one focused question" not in ai_coach_module.COACH_SYSTEM.lower()
    assert "give one hint" not in ai_coach_module.COACH_SYSTEM.lower()
    assert "what do you think the key factor is in this spot?" not in ai_coach_module.COACH_SYSTEM.lower()
    # teach-first philosophy present
    assert "answer first" in ai_coach_module.COACH_SYSTEM.lower()
    assert "uncertainty rule" in ai_coach_module.COACH_SYSTEM.lower()
    assert "knowledge hierarchy" in ai_coach_module.COACH_SYSTEM.lower()


def test_pre_submission_mode_still_protects_the_exact_answer():
    """The teach-first rewrite must not reopen the answer-leak hole this
    mode exists to close — it may teach concepts richly, but never name the
    specific correct choice for the ungraded step in view."""
    instruction = ai_coach_module.MODE_INSTRUCTIONS["pre_submission"].lower()
    assert "never state or imply the specific correct option" in instruction
    assert "teach" in instruction


def test_canonical_range_block_reaches_the_openai_system_prompt():
    """End-to-end (stubbed OpenAI): canonical_strategy/hand/spot context
    reaches the actual system prompt as a CANONICAL RANGE DATA block, and a
    mixed frequency is preserved rather than collapsed into a pure action."""
    sent_system = {}

    async def fake_create(*args, **kwargs):
        sent_system["content"] = kwargs["messages"][0]["content"]
        class Msg: content = "Mostly fold — A5s isn't in our UTG opening range."
        class Choice: message = Msg()
        class Usage: prompt_tokens = 10; completion_tokens = 12
        class Resp: choices = [Choice()]; usage = Usage()
        return Resp()

    class FakeOpenAIClient:
        def __init__(self, *a, **kw):
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(fake_create)})()})()

    old_client_cls = ai_coach_module.AsyncOpenAI
    ai_coach_module.AsyncOpenAI = FakeOpenAIClient
    try:
        context = {
            "hero_position": "UTG",
            "hand": "88",
            "spot": {"position": "UTG", "stack_bb": 100, "action": "RFI"},
            "canonical_strategy": {"raise": 0.5, "fold": 0.5},
        }
        run(ai_coach_module.generate_coach_reply(
            [{"role": "user", "content": "Should I open 88 UTG?"}], context, 1,
        ))
    finally:
        ai_coach_module.AsyncOpenAI = old_client_cls

    prompt = sent_system["content"]
    assert "CANONICAL RANGE DATA" in prompt
    assert "raise 50%" in prompt and "fold 50%" in prompt  # mixed, not collapsed


def test_lesson_step_question_and_scenario_reach_the_openai_system_prompt():
    """Regression for 'the coach asks which question I'm referring to': the
    full structured lesson-step context the frontend builds (question,
    options, narrative, range_context, module/step identity, and widget
    scenario data) must actually reach the system prompt text — not just
    survive sanitize_context and then get silently dropped by ctx_parts."""
    sent_system = {}

    async def fake_create(*args, **kwargs):
        sent_system["content"] = kwargs["messages"][0]["content"]
        class Msg: content = "stubbed"
        class Choice: message = Msg()
        class Usage: prompt_tokens = 10; completion_tokens = 12
        class Resp: choices = [Choice()]; usage = Usage()
        return Resp()

    class FakeOpenAIClient:
        def __init__(self, *a, **kw):
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(fake_create)})()})()

    old_client_cls = ai_coach_module.AsyncOpenAI
    ai_coach_module.AsyncOpenAI = FakeOpenAIClient
    try:
        context = {
            "lesson_title": "The 3-Bet",
            "moduleId": "preflop-aggression-module",
            "stepId": "tb-s1",
            "step_type": "decision_spot",
            "narrative": "HJ opens to 2.3bb, folds to Hero on the Button.",
            "question": "Facing HJ's open, is this a spot to simply continue, or 3-bet?",
            "options": [{"id": "raise", "label": "Raise"}, {"id": "call", "label": "Call"}],
            "range_context": {
                "a": {"label": "HJ opening range", "range": ["AA", "KK", "AKs"]},
                "b": {"label": "BTN 3-bet range", "range": ["AA", "AKs"]},
            },
            "scenario": {"pot_odds_pot": 20, "pot_odds_bet": 10},
        }
        run(ai_coach_module.generate_coach_reply(
            [{"role": "user", "content": "Why was my answer wrong?"}], context, 1,
        ))
    finally:
        ai_coach_module.AsyncOpenAI = old_client_cls

    prompt = sent_system["content"]
    assert "The 3-Bet" in prompt and "preflop-aggression-module" in prompt
    assert "tb-s1" in prompt
    assert "HJ opens to 2.3bb" in prompt
    assert "Facing HJ's open" in prompt
    assert "raise) Raise" in prompt and "call) Call" in prompt
    assert "HJ opening range" in prompt and "AKs" in prompt
    assert "pot_odds_pot" in prompt and "20" in prompt


def test_correct_feedback_and_widget_answer_key_reach_the_prompt_post_submission():
    """Regression for the correct_feedback/evaluatorFeedback key-name
    mismatch: the frontend sends `correct_feedback`, and the widget-specific
    answer key the generic scenario classifier caught — both must actually
    reach the prompt once sanitize_context has allowed them through."""
    sent_system = {}

    async def fake_create(*args, **kwargs):
        sent_system["content"] = kwargs["messages"][0]["content"]
        class Msg: content = "stubbed"
        class Choice: message = Msg()
        class Usage: prompt_tokens = 10; completion_tokens = 12
        class Resp: choices = [Choice()]; usage = Usage()
        return Resp()

    class FakeOpenAIClient:
        def __init__(self, *a, **kw):
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(fake_create)})()})()

    old_client_cls = ai_coach_module.AsyncOpenAI
    ai_coach_module.AsyncOpenAI = FakeOpenAIClient
    try:
        context = {
            "correct_feedback": "BTN retains more overpair combos on this runout.",
            "evaluator_feedback": "You folded a hand that beats HJ's opening range here.",
            "widget_answer_key": {"pot_odds_correct": 33.3},
        }
        run(ai_coach_module.generate_coach_reply(
            [{"role": "user", "content": "Why was my answer wrong?"}], context, 1,
            mode="post_submission",
        ))
    finally:
        ai_coach_module.AsyncOpenAI = old_client_cls

    prompt = sent_system["content"]
    assert "BTN retains more overpair combos" in prompt
    assert "You folded a hand that beats HJ's opening range" in prompt
    assert "pot_odds_correct" in prompt and "33.3" in prompt


def test_widget_answer_key_stripped_pre_submission(fake_db, captured_reply):
    """The generic widget answer-key bucket must be gated by the SAME
    pre_submission/post_submission mode boundary as correctAnswer — a
    client-sent widget_answer_key must not leak before the server has
    verified the step was actually completed."""
    user = {"sub": "user-widget-leak"}
    body = coach_module.CoachMessageBody(
        message="Give me the answer",
        context={
            "lessonId": "lesson-a", "stepId": "step-1",
            "widget_answer_key": {"pot_odds_correct": "SHOULD-NOT-LEAK"},
        },
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    assert captured_reply[0]["mode"] == "pre_submission"
    assert "widget_answer_key" not in captured_reply[0]["context"]


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


# ── Quick actions (Hint / Explain concept / Walkthrough / Why wrong / Why correct) ──


def test_quick_action_with_blank_message_uses_label_fallback(fake_db, captured_reply):
    """A quick-action button click sends no typed text — the route must
    synthesize a natural-reading stored/sent message from ACTION_LABELS
    instead of rejecting it as empty."""
    user = {"sub": "user-hint"}
    body = coach_module.CoachMessageBody(message="", context={}, action="hint")
    result = run(coach_module.coach_message(body, FakeRequest(), user))

    assert captured_reply[0]["action"] == "hint"
    session_row = fake_db.tables["training_sessions"][0]
    assert session_row["messages"][0]["content"] == "Give me a hint"
    assert result["reply"] == "stubbed coach reply"


def test_action_forwarded_to_generate_coach_reply(fake_db, captured_reply):
    user = {"sub": "user-action"}
    body = coach_module.CoachMessageBody(
        message="", context={"lessonId": "l1", "stepId": "s1"}, action="walkthrough",
    )
    run(coach_module.coach_message(body, FakeRequest(), user))
    assert captured_reply[0]["action"] == "walkthrough"


def test_invalid_action_value_rejected():
    with pytest.raises(Exception):
        coach_module.CoachMessageBody(message="hi", context={}, action="not_a_real_action")


def test_why_wrong_action_cannot_leak_answer_for_unattempted_step(fake_db, captured_reply):
    """Combining a post-answer quick action with an unverified step must not
    bypass the existing answer-leak guardrail — sanitize_context/mode
    resolution run identically regardless of `action`."""
    user = {"sub": "user-why-wrong"}
    body = coach_module.CoachMessageBody(
        message="",
        context={"lessonId": "lesson-a", "stepId": "step-1", "correctAnswer": "FORGED"},
        action="why_wrong",
    )
    run(coach_module.coach_message(body, FakeRequest(), user))

    assert captured_reply[0]["mode"] == "pre_submission"
    assert captured_reply[0]["action"] == "why_wrong"
    assert "correctAnswer" not in captured_reply[0]["context"]


def test_hint_level_reaches_context_string():
    """hint_level travels through context like any other field — no new
    server-side plumbing needed, it's just read by the context-string builder."""
    context = {"hint_level": 2}
    # Directly exercise the context-string assembly via a stubbed OpenAI call.
    async def fake_create(*args, **kwargs):
        sent_system["content"] = kwargs["messages"][0]["content"]
        class Msg: content = "..."
        class Choice: message = Msg()
        class Usage: prompt_tokens = 1; completion_tokens = 1
        class Resp: choices = [Choice()]; usage = Usage()
        return Resp()

    sent_system: dict = {}

    class FakeOpenAIClient:
        def __init__(self, *a, **kw):
            self.chat = type("C", (), {"completions": type("D", (), {"create": staticmethod(fake_create)})()})()

    old_client_cls = ai_coach_module.AsyncOpenAI
    ai_coach_module.AsyncOpenAI = FakeOpenAIClient
    try:
        run(ai_coach_module.generate_coach_reply(
            [{"role": "user", "content": "hint please"}], context, 1, action="hint",
        ))
    finally:
        ai_coach_module.AsyncOpenAI = old_client_cls

    assert "Hint request #2" in sent_system["content"]
    assert "HINT REQUESTED" in sent_system["content"]


def test_walkthrough_action_overrides_answer_first_for_its_own_thread():
    instruction = ai_coach_module.ACTION_INSTRUCTIONS["walkthrough"].lower()
    assert "override" in instruction
    assert "one targeted question" in instruction
    assert "stop asking questions" in instruction


def test_action_instructions_never_ask_for_exact_frequencies_beyond_hierarchy():
    """None of the new action instructions should encourage inventing numbers
    — they lean on the existing COACH_SYSTEM knowledge hierarchy instead."""
    for key in ("hint", "explain_concept", "walkthrough", "why_wrong", "why_correct", "key_takeaway"):
        instruction = ai_coach_module.ACTION_INSTRUCTIONS[key]
        assert "%" not in instruction
        assert "frequency" not in instruction.lower()


# ── Daily quota (10 msgs/UTC day, server-authoritative, concurrency-safe) ──────


def test_first_message_reports_1_of_10_used(fake_db, captured_reply):
    user = {"sub": "user-quota-1"}
    body = coach_module.CoachMessageBody(message="hi", context={})
    result = run(coach_module.coach_message(body, FakeRequest(), user))
    assert result["usage"] == {"limit": 10, "used": 1, "remaining": 9, "reset_at": result["usage"]["reset_at"]}


def test_tenth_message_allowed_eleventh_rejected(fake_db, captured_reply):
    # Distinct IP per multi-request test — the per-IP rate limiter (20/60s,
    # separate from this daily quota) is a global in-memory window shared
    # across the whole test process, not reset per-test.
    req = FakeRequest(ip="10.0.1.1")
    user = {"sub": "user-quota-2"}
    last_result = None
    for _ in range(10):
        body = coach_module.CoachMessageBody(message="hi", context={})
        last_result = run(coach_module.coach_message(body, req, user))
    assert last_result["usage"]["used"] == 10
    assert last_result["usage"]["remaining"] == 0

    body = coach_module.CoachMessageBody(message="one more", context={})
    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.coach_message(body, req, user))
    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["code"] == "AI_COACH_DAILY_LIMIT_REACHED"
    assert exc_info.value.detail["used"] == 10
    assert exc_info.value.detail["remaining"] == 0


def test_quota_rejection_never_reaches_the_llm(fake_db, captured_reply):
    """The 11th request must be rejected before generate_coach_reply is ever
    called — a rejected request costs nothing and never touches the AI."""
    req = FakeRequest(ip="10.0.1.2")
    user = {"sub": "user-quota-3"}
    for _ in range(10):
        run(coach_module.coach_message(
            coach_module.CoachMessageBody(message="hi", context={}), req, user,
        ))
    assert len(captured_reply) == 10

    with pytest.raises(HTTPException):
        run(coach_module.coach_message(
            coach_module.CoachMessageBody(message="one more", context={}), req, user,
        ))
    assert len(captured_reply) == 10  # unchanged — the 11th never reached the stub


def test_concurrent_requests_at_9_of_10_only_one_succeeds(fake_db, captured_reply):
    """The core concurrency-safety guarantee: two simultaneous requests when
    the user is at 9/10 must not both succeed (which would allow 11/10)."""
    req = FakeRequest(ip="10.0.1.3")
    user = {"sub": "user-quota-concurrent"}
    for _ in range(9):
        run(coach_module.coach_message(
            coach_module.CoachMessageBody(message="hi", context={}), req, user,
        ))

    async def _race():
        return await asyncio.gather(
            coach_module.coach_message(coach_module.CoachMessageBody(message="a", context={}), req, user),
            coach_module.coach_message(coach_module.CoachMessageBody(message="b", context={}), req, user),
            return_exceptions=True,
        )

    results = run(_race())
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, HTTPException)]
    assert len(successes) == 1
    assert len(failures) == 1
    assert failures[0].status_code == 429
    assert successes[0]["usage"]["used"] == 10


def test_llm_failure_releases_the_reserved_slot(fake_db, monkeypatch):
    """A request that passes the quota gate but then fails at the LLM call
    itself must cost 0 — the reservation is rolled back."""
    async def _boom(*a, **kw):
        raise ai_coach_module.CoachUnavailableError("boom")

    monkeypatch.setattr(coach_module, "generate_coach_reply", _boom)
    user = {"sub": "user-quota-release"}
    body = coach_module.CoachMessageBody(message="hi", context={})

    with pytest.raises(HTTPException) as exc_info:
        run(coach_module.coach_message(body, FakeRequest(), user))
    assert exc_info.value.status_code == 503

    usage_row = fake_db.tables["ai_coach_usage"][0]
    assert usage_row["message_count"] == 0  # reserved (1) then released back to 0


def test_get_usage_endpoint_has_no_side_effects(fake_db, captured_reply):
    user = {"sub": "user-quota-get"}
    run(coach_module.coach_message(coach_module.CoachMessageBody(message="hi", context={}), FakeRequest(), user))

    first = run(coach_module.coach_usage(user))
    second = run(coach_module.coach_usage(user))
    assert first["usage"]["used"] == 1
    assert second["usage"]["used"] == 1  # calling GET twice doesn't increment anything


def test_get_usage_reflects_zero_before_any_message(fake_db):
    user = {"sub": "user-quota-fresh"}
    result = run(coach_module.coach_usage(user))
    assert result["usage"] == {"limit": 10, "used": 0, "remaining": 10, "reset_at": result["usage"]["reset_at"]}


def test_reset_at_is_next_utc_midnight(fake_db):
    from datetime import datetime, timezone
    reset_at = coach_usage_module.compute_reset_at()
    parsed = datetime.fromisoformat(reset_at)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset().total_seconds() == 0  # UTC, not server-local time
    assert parsed.hour == 0 and parsed.minute == 0 and parsed.second == 0
    assert parsed.date() > datetime.now(timezone.utc).date()


def test_quota_isolated_per_user(fake_db, captured_reply):
    """Two different users' daily usage must never share a counter."""
    req = FakeRequest(ip="10.0.1.4")
    for _ in range(10):
        run(coach_module.coach_message(
            coach_module.CoachMessageBody(message="hi", context={}), req, {"sub": "user-quota-a"},
        ))
    # A different user starts fresh at 0/10, unaffected by user A being maxed out.
    result = run(coach_module.coach_message(
        coach_module.CoachMessageBody(message="hi", context={}), req, {"sub": "user-quota-b"},
    ))
    assert result["usage"]["used"] == 1


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
