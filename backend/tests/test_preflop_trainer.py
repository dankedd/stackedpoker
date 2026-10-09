"""Preflop Trainer: server-side grading and the XP endpoint.

The SQL state machine (streak tiers, daily cap, too-fast guard) lives in
supabase_preflop_trainer_xp.sql; these tests fake its RPC and pin what the
backend is responsible for — the verdict it sends, the hand reference, and
how it shapes the response.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.routes import preflop_trainer as route
from app.engines.preflop_trainer import ChartRef, InvalidHand, grade_hand
from app.engines.preflop_trainer.grading import DATA_DIR, frequencies, grade_frequencies, push_value

FRONTEND_DATA = Path(__file__).resolve().parents[2] / "frontend" / "data" / "ranges"


def _defense(pred):
    charts = json.loads((DATA_DIR / "defense.json").read_text(encoding="utf-8"))
    return next(c for c in charts if pred(c))


# ── Data ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("name", ["open", "pushfold", "defense"])
def test_backend_charts_match_frontend(name):
    """The server must grade against exactly the charts the browser shows."""
    assert (DATA_DIR / f"{name}.json").read_bytes() == (FRONTEND_DATA / f"{name}.json").read_bytes()


# ── Grading (mirrors frontend/lib/ranges/__tests__/logic.test.ts) ─────────────


def test_grade_thresholds():
    assert grade_frequencies({"fold": 0.5, "raise": 0.5}, "raise").verdict == "correct"
    assert grade_frequencies({"fold": 0.3, "call": 0.3, "raise": 0.4}, "raise").verdict == "correct"
    assert grade_frequencies({"fold": 0.35, "call": 0.35, "raise": 0.3}, "call").verdict == "correct"
    assert grade_frequencies({"fold": 0.7, "raise": 0.3}, "raise").verdict == "mixed"
    assert grade_frequencies({"fold": 0.9, "raise": 0.1}, "raise").verdict == "mixed"
    assert grade_frequencies({"fold": 0.95, "raise": 0.05}, "raise").verdict == "wrong"
    assert grade_frequencies({"fold": 1.0, "raise": 0.0}, "raise").verdict == "wrong"


def test_push_values():
    assert push_value(["red", "7"]) == 7
    assert push_value(["black", ""]) == 10
    assert push_value(["red", ""]) == 0


def test_pushfold_grading_uses_the_stack():
    # SB K2o: empty black cell → shoved at every stack ≤10bb (p.298).
    assert grade_hand(ChartRef("pushfold", 298, 10), "K2o", "allin").verdict == "correct"
    # SB 94s is printed "8": a shove at 8bb, a fold at 9bb.
    assert grade_hand(ChartRef("pushfold", 298, 8), "94s", "allin").verdict == "correct"
    assert grade_hand(ChartRef("pushfold", 298, 9), "94s", "allin").verdict == "wrong"


def test_open_chart_grading():
    # BN 25bb (Hand Range 113, p.327): AA is a pure 2x raise.
    assert grade_hand(ChartRef("open", 327, None), "AA", "raise").verdict == "correct"
    assert grade_hand(ChartRef("open", 327, None), "AA", "fold").verdict == "wrong"


def test_null_cells_are_rejected():
    c = _defense(lambda c: any(v is None for v in c["grid"].values()))
    hand = next(h for h, v in c["grid"].items() if v is None)
    with pytest.raises(InvalidHand):
        grade_hand(ChartRef("defense", c["n"]), hand, "call")


@pytest.mark.parametrize(
    "ref,hand,action",
    [
        (ChartRef("open", 9999), "AA", "raise"),
        (ChartRef("open", 327), "XX", "raise"),
        (ChartRef("open", 327), "AA", "dance"),
        (ChartRef("pushfold", 298, None), "AA", "allin"),
        (ChartRef("pushfold", 298, 11), "AA", "allin"),
    ],
)
def test_invalid_requests(ref, hand, action):
    with pytest.raises(InvalidHand):
        grade_hand(ref, hand, action)


def test_every_row_sums_to_one():
    for name, key in (("open", "page"), ("defense", "n")):
        for c in json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8")):
            for hand, row in c["grid"].items():
                if row is None:
                    continue
                f = frequencies(ChartRef(name, c[key]), hand)
                assert abs(sum(f.values()) - 1) < 0.005, (name, c[key], hand)


# ── Endpoint ──────────────────────────────────────────────────────────────────


class _Settings:
    supabase_url = "https://example.supabase.co"
    supabase_service_role_key = "service"


@pytest.fixture
def fake_rpc(monkeypatch):
    calls = []

    async def rpc(fn, args, settings):
        calls.append((fn, args))
        if fn == "record_preflop_trainer_hand":
            # Pretend the user was at 495 XP; a correct hand crosses level 2 (500).
            xp = {"correct": 4, "mixed": 1, "wrong": 0}[args["p_verdict"]]
            return {
                "xp_awarded": xp, "streak": 31, "best_streak": 40, "daily_xp": 12, "daily_cap": 300,
                "xp_per_correct": 4, "next_tier_at": None, "too_fast": False, "total_xp": 495 + xp,
            }
        return {"streak": 3, "best_streak": 9, "daily_xp": 20, "daily_cap": 300, "xp_per_correct": 1, "next_tier_at": 10}

    monkeypatch.setattr(route, "_rpc", rpc)
    monkeypatch.setattr(route, "get_settings", lambda: _Settings())
    return calls


USER = {"sub": "11111111-1111-1111-1111-111111111111"}


def test_endpoint_sends_the_servers_verdict(fake_rpc):
    body = route.HandRequest(kind="open", chart_id=327, hand="AA", action="raise")
    res = asyncio.run(route.record_hand(body, current_user=USER))
    fn, args = fake_rpc[0]
    assert fn == "record_preflop_trainer_hand"
    assert args == {"p_user_id": USER["sub"], "p_verdict": "correct", "p_hand_ref": "open:327::AA"}
    assert res.verdict == "correct" and res.xp_awarded == 4 and res.total_xp == 499
    assert res.leveled_up is False


def test_endpoint_reports_a_level_up(fake_rpc, monkeypatch):
    async def rpc(fn, args, settings):
        return {"xp_awarded": 4, "streak": 1, "best_streak": 1, "daily_xp": 4, "daily_cap": 300,
                "xp_per_correct": 1, "next_tier_at": 10, "too_fast": False, "total_xp": 502}

    monkeypatch.setattr(route, "_rpc", rpc)
    body = route.HandRequest(kind="open", chart_id=327, hand="AA", action="raise")
    res = asyncio.run(route.record_hand(body, current_user=USER))
    assert res.level == 2 and res.leveled_up is True


def test_endpoint_rejects_an_undealable_hand(fake_rpc):
    body = route.HandRequest(kind="pushfold", chart_id=298, hand="AA", action="allin")  # no stack
    with pytest.raises(HTTPException) as e:
        asyncio.run(route.record_hand(body, current_user=USER))
    assert e.value.status_code == 422
    assert fake_rpc == []


def test_state_endpoint(fake_rpc):
    res = asyncio.run(route.get_state(current_user=USER))
    assert fake_rpc[0] == ("preflop_trainer_state", {"p_user_id": USER["sub"]})
    assert res.streak == 3 and res.daily_xp == 20 and res.next_tier_at == 10
