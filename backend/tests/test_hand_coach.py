"""Hand-review coach: the context built from a stored hand, and ownership —
a user can never make the coach read another user's hand."""
import json
import re
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import hand_coach
from app.engines.hand_review.context import build_hand_context, describe_step, timeline_steps
from app.middleware.auth import get_current_user

ROWS = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "handHistory" / "__tests__" / "fixtures" / "coach-rows.json"
HEX = re.compile(r"\b[0-9a-f]{8}\b")

# ── Context (needs the private export; rows written by coachRows.test.ts) ────

needs_rows = pytest.mark.skipif(not ROWS.exists(), reason="coach-rows.json not generated (private export missing)")


def _rows() -> dict:
    return json.loads(ROWS.read_text(encoding="utf8"))


@needs_rows
def test_lj_55_fold_context_has_the_push_fold_range_and_the_all_in():
    ctx = build_hand_context(_rows()["TM6510944780"], [], None)
    assert "Verdict: too tight" in ctx
    assert "LJ push/fold chart at 10 BB" in ctx
    assert "Range says: all-in. Hero: fold." in ctx
    assert "hand 55" in ctx
    assert "effective stack 11.4 BB" in ctx


@needs_rows
def test_aq_vs_jj_context_has_our_equity_and_pot_odds():
    ctx = build_hand_context(_rows()["TM6510945691"], [], None)
    assert "HJ shove vs LJ-open · 15 BB" in ctx
    assert "APPROXIMATION: the trainer has no range for this exact spot" in ctx and "opener UTG+2 as LJ" in ctx
    assert "Preflop: Hero equity 49.9%" in ctx
    assert "To call 8.1 BB into a pot of 13.5 BB → needs 37.4% equity; Hero had 49.9%." in ctx
    assert "Villain (HJ) shows Js Jd" in ctx
    assert "net -9.2 BB" in ctx


@needs_rows
def test_context_is_anonymised_and_has_no_page_numbers():
    for row in _rows().values():
        ctx = build_hand_context(row, [{"street": "hand", "body": "vs 922e16a4 again"}], 5)
        assert not HEX.search(ctx), HEX.search(ctx)
        assert not re.search(r"\bp\. ?\d", ctx) and "Hand Range" not in ctx  # the coach never cites a source


@needs_rows
def test_current_step_matches_the_replayer_timeline():
    row = _rows()["TM6510945691"]
    steps = timeline_steps(row["data"])
    # start, antes, SB, BB, then the actions in order (frontend/lib/handHistory/timeline.ts)
    assert [s["kind"] for s in steps[:4]] == ["start", "antes", "post", "post"]
    shove = next(i for i, s in enumerate(steps) if s["events"] and s["events"][0].get("player") != "Hero" and s["events"][0].get("allIn"))
    assert "Villain (HJ) raises to 16 BB (all-in)" in describe_step(row["data"], shove)
    assert describe_step(row["data"], 10_000) is None


# ── Ownership ────────────────────────────────────────────────────────────────

OWNER, INTRUDER = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"
HAND = "33333333-3333-3333-3333-333333333333"


def _client(monkeypatch, user_id: str, calls: dict) -> TestClient:
    async def fake_get(table, query, settings):
        calls.setdefault("queries", []).append((table, query))
        if table == "hh_hands":
            # The database filter is what enforces ownership: only the owner's id matches.
            return [{"data": {"players": [], "events": []}, "raw_text": "secret"}] if f"user_id=eq.{OWNER}" in query and f"id=eq.{HAND}" in query else []
        return []

    async def fake_reserve(user_id, settings):
        calls["reserve"] = calls.get("reserve", 0) + 1
        raise AssertionError("quota must not be touched for a foreign hand")

    async def fake_reply(*a, **k):
        raise AssertionError("the model must not be called for a foreign hand")

    monkeypatch.setattr(hand_coach, "_supabase_get", fake_get)
    monkeypatch.setattr(hand_coach, "reserve_coach_usage", fake_reserve)
    monkeypatch.setattr(hand_coach, "generate_coach_reply", fake_reply)
    app = FastAPI()
    app.include_router(hand_coach.router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    return TestClient(app)


def test_another_users_hand_is_a_404_and_costs_nothing(monkeypatch):
    calls: dict = {}
    c = _client(monkeypatch, INTRUDER, calls)
    r = c.post("/api/hand-coach/message", json={"hand_id": HAND, "message": "Was my preflop play right?", "step_index": 3})
    assert r.status_code == 404
    assert "secret" not in r.text
    assert "reserve" not in calls
    # Every hand lookup was scoped to the caller.
    assert all(f"user_id=eq.{INTRUDER}" in q for t, q in calls["queries"] if t == "hh_hands")
    assert c.get(f"/api/hand-coach/{HAND}").status_code == 404
    assert c.post(f"/api/hand-coach/{HAND}/new").status_code == 404


def test_hand_id_must_be_a_uuid(monkeypatch):
    c = _client(monkeypatch, INTRUDER, {})
    r = c.post("/api/hand-coach/message", json={"hand_id": f"{HAND}&user_id=eq.{OWNER}", "message": "hi"})
    assert r.status_code == 422


def test_no_token_is_401():
    app = FastAPI()
    app.include_router(hand_coach.router, prefix="/api")
    r = TestClient(app).post("/api/hand-coach/message", json={"hand_id": HAND, "message": "hi"})
    assert r.status_code == 401
