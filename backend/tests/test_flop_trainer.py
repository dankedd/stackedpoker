"""Flop Equity Trainer: server-side grading and the answer endpoint.

The SQL state machine (daily cap, session highscore, too-fast guard) lives in
supabase_flop_trainer.sql; these tests fake its RPC and the flop_equity
lookup, and pin what the backend is responsible for — the verdict, points and
category it sends, and how it shapes the response.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.routes import flop_trainer as route
from app.flop_equity.grading import cbet_advice, cbet_data, grade_answer, grade_cbet, texture_category

# ── Grading (mirrors frontend/lib/flopTrainer/__tests__/logic.test.ts) ──────


@pytest.mark.parametrize(
    "guess,exact,verdict,points",
    [(60, 60.0, "perfect", 2), (57, 60.0, "perfect", 2), (63, 60.0, "perfect", 2), (56.9, 60.0, "good", 1),
     (53, 60.0, "good", 1), (52.9, 60.0, "miss", 0), (90, 60.0, "miss", 0)],
)
def test_equity_thresholds(guess, exact, verdict, points):
    g = grade_answer(guess, exact, "OOP", "IP")
    assert (g.verdict, g.points, g.nut_correct) == (verdict, points, False)


def test_nut_advantage_bonus():
    assert grade_answer(60, 60.0, "IP", "IP").points == 3
    assert grade_answer(80, 60.0, "EQUAL", "EQUAL").points == 1


@pytest.mark.parametrize(
    "texture,cat",
    [(["trips", "rainbow", "rank:Kxx", "straights:0"], "paired"),
     (["paired", "two-tone", "rank:Qxx", "straights:0"], "paired"),
     (["unpaired", "monotone", "rank:Axx", "straights:1"], "monotone"),
     (["unpaired", "rainbow", "rank:Axx", "straights:1"], "ace_high"),
     (["unpaired", "two-tone", "rank:Kxx", "straights:2"], "king_high"),
     (["unpaired", "rainbow", "rank:Jxx", "straights:3"], "high"),
     (["unpaired", "rainbow", "rank:Txx", "straights:1"], "connected"),
     (["unpaired", "two-tone", "rank:8xx", "straights:0"], "low_dry")],
)
def test_texture_category(texture, cat):
    assert texture_category(texture) == cat


# ── Example hands ─────────────────────────────────────────────────────────────


def test_bucket_examples_pick_the_most_common_hands_per_bucket():
    hands = {"AA": [1, 90.0], "KK": [1, 80.0], "AKo": [1, 76.0], "72o": [1, 20.0], "54s": [0, 10.0], "QJs": [0.5, 55.0]}
    ex = route.bucket_examples(hands, n=2)
    assert ex["strong"] == ["AKo", "AA"]  # 12 combos before 6
    assert ex["good"] == ["QJs"] and ex["weak"] == [] and ex["trash"] == ["72o"]


# ── Endpoint ──────────────────────────────────────────────────────────────────


class _Settings:
    supabase_url = "https://example.supabase.co"
    supabase_service_role_key = "service"


ROW = {"equity_ip": 62.4, "nut_adv": {"leader": "IP"}, "texture": ["unpaired", "rainbow", "rank:Axx", "straights:0"],
       # The book's high/big profile (p.677), so the c-bet advice is unambiguous.
       "buckets_ip": {"strong": 37, "good": 38, "weak": 22, "trash": 3},
       "buckets_oop": {"strong": 4, "good": 19, "weak": 23, "trash": 54}}


@pytest.fixture
def fake_db(monkeypatch):
    calls = []

    async def rpc(fn, args, settings):
        calls.append((fn, args))
        if fn == "record_flop_versus_answer":
            return {"xp_awarded": int(args["p_correct"]), "daily_xp": 10, "daily_cap": 300, "too_fast": False,
                    "total_xp": 600, "streak": 4, "best_streak": 9}
        if fn == "record_flop_trainer_answer":
            return {"xp_awarded": args["p_points"], "daily_xp": 9, "daily_cap": 300, "too_fast": False, "total_xp": 497 + args["p_points"],
                    "session_answers": 10, "session_points": 21, "session_complete": True, "best_session_points": 21,
                    "new_record": True, "hands_played": 40}
        return {"daily_xp": 9, "daily_cap": 300, "best_session_points": 21, "hands_played": 40, "categories": {"paired": [3, 8.5]}}

    async def select(table, params, settings):
        calls.append((table, params))
        if params.get("flop", "").startswith("in."):
            return [{"flop": "AcQd3h", "equity_ip": 69.1}, {"flop": "7c6d5h", "equity_ip": 52.0}]
        if table == "flop_equity_hands":
            return [{"hands": {"ip": {"AA": [1, 90.0]}, "oop": {"72o": [1, 20.0]}}}]
        return [ROW] if params.get("flop") == "eq.AcQd3h" else []

    async def no_usage(*a, **k):
        return None

    monkeypatch.setattr(route, "_rpc", rpc)
    monkeypatch.setattr(route, "_select", select)
    monkeypatch.setattr(route, "get_settings", lambda: _Settings())
    monkeypatch.setattr(route.billing, "consume_usage", no_usage)
    return calls


USER = {"sub": "11111111-1111-1111-1111-111111111111"}


def test_endpoint_grades_against_the_stored_flop(fake_db):
    body = route.AnswerRequest(spot_id="srp_bb_vs_utg_40", flop="AcQd3h", guess_equity=60, nut_guess="IP", session_id="s1")
    res = asyncio.run(route.record_answer(body, current_user=USER))
    fn, args = fake_db[-1]
    assert fn == "record_flop_trainer_answer"
    assert args == {
        "p_user_id": USER["sub"], "p_spot_id": "srp_bb_vs_utg_40", "p_flop": "AcQd3h", "p_category": "ace_high",
        "p_guess": 60, "p_actual": 62.4, "p_verdict": "perfect", "p_nut_guess": "IP", "p_nut_actual": "IP",
        "p_points": 3, "p_session_id": "s1",
        "p_cbet_band": None, "p_cbet_size": None, "p_cbet_band_ok": None, "p_cbet_size_ok": None,
    }
    assert res.verdict == "perfect" and res.exact_equity == 62.4 and res.nut_correct
    assert res.xp_awarded == 3 and res.total_xp == 500 and res.leveled_up  # 497 -> 500 crosses level 2
    assert res.session_complete and res.new_record and res.best_session_points == 21


def test_endpoint_rejects_an_unknown_flop(fake_db):
    body = route.AnswerRequest(spot_id="srp_bb_vs_utg_40", flop="2c2d2h", guess_equity=60, nut_guess="IP", session_id="s1")
    with pytest.raises(HTTPException) as e:
        asyncio.run(route.record_answer(body, current_user=USER))
    assert e.value.status_code == 422
    assert not any(c[0] == "record_flop_trainer_answer" for c in fake_db)


def test_endpoint_refuses_over_the_daily_limit(fake_db, monkeypatch):
    from app.services.billing import UsageResult

    async def over(*a, **k):
        return UsageResult(allowed=False, used=50, limit=50, plan="free", reset_at="2026-10-21T00:00:00+02:00")

    monkeypatch.setattr(route.billing, "consume_usage", over)
    body = route.AnswerRequest(spot_id="srp_bb_vs_utg_40", flop="AcQd3h", guess_equity=60, nut_guess="IP", session_id="s1")
    with pytest.raises(HTTPException) as e:
        asyncio.run(route.record_answer(body, current_user=USER))
    assert e.value.status_code == 429 and e.value.detail["code"] == "TRAINER_DAILY_LIMIT_REACHED"
    assert not any(c[0] == "record_flop_trainer_answer" for c in fake_db)


def test_state_endpoint(fake_db):
    res = asyncio.run(route.get_state(current_user=USER))
    assert fake_db[0] == ("flop_trainer_state", {"p_user_id": USER["sub"]})
    assert res.best_session_points == 21 and res.categories == {"paired": [3, 8.5]}


# ── C-bet question ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("copy", ["data/mpt/cbet_profiles.json", "frontend/lib/flopTrainer/cbetProfiles.json"])
def test_cbet_profiles_match_every_copy(copy):
    """The browser and the source data must hold exactly what the server grades with."""
    path = Path(__file__).resolve().parents[2] / copy
    assert json.loads(path.read_text(encoding="utf-8")) == cbet_data()


def test_book_flops_use_the_printed_strategy():
    # 8h6d2s BN (p.693-695): bet 2/3 48.6%, check 42.8% -> low band, big size.
    a = cbet_advice("srp_bb_vs_bn_40", "8c6d2h", {}, {}, [])
    assert (a["source"], a["band"], a["size"], a["bands"]) == ("book", "low", "big", ["low"])
    # Q-J-T monotone UTG (p.686-687): min-bet 96.7%.
    a = cbet_advice("srp_bb_vs_utg_40", "QcJcTc", {}, {}, [])
    assert (a["band"], a["size"]) == ("high", "small")


@pytest.mark.parametrize("profile", range(6))
def test_each_book_profile_maps_to_itself(profile):
    p = cbet_data()["profiles"][profile]
    k = cbet_data()["bucket_order"]
    a = cbet_advice("srp_bb_vs_bn_40", "AcKdQh", dict(zip(k, p["ip"])), dict(zip(k, p["oop"])), ["unpaired", "rainbow"])
    assert a["source"] == "profile" and (a["band"], a["size"]) == (p["band"], p["size"]) and a["distance"] == 0


def test_paired_and_monotone_flops_get_a_small_size():
    k = cbet_data()["bucket_order"]
    big = cbet_data()["profiles"][0]  # high / big
    ip, oop = dict(zip(k, big["ip"])), dict(zip(k, big["oop"]))
    assert cbet_advice("srp_bb_vs_bn_40", "KcKd2h", ip, oop, ["paired"])["size"] == "small"
    mono = cbet_advice("srp_bb_vs_bn_40", "KcTc2c", ip, oop, ["unpaired", "monotone"])
    assert mono["size"] == "small" and "high" in mono["bands"] and mono["rule"] == "monotone"


def test_grade_cbet():
    advice = {"band": "mid", "bands": ["mid", "low"], "size": "big"}
    assert grade_cbet("low", "big", advice) == (True, True, 2)
    assert grade_cbet("high", "big", advice) == (False, True, 1)
    assert grade_cbet("mid", "small", advice) == (True, False, 1)


def test_endpoint_adds_cbet_points(fake_db):
    body = route.AnswerRequest(spot_id="srp_bb_vs_utg_40", flop="AcQd3h", guess_equity=60, nut_guess="IP",
                               session_id="s1", cbet_band="high", cbet_size="small")
    res = asyncio.run(route.record_answer(body, current_user=USER))
    args = fake_db[-1][1]
    # AcQd3h UTG is a book flop (p.684): 2/3 pot 84.6% -> high / big.
    assert res.cbet["band_ok"] and not res.cbet["size_ok"] and res.cbet["advice"]["source"] == "book"
    assert args["p_points"] == 4 and args["p_cbet_band"] == "high" and args["p_cbet_size_ok"] is False


# ── Quick fire ────────────────────────────────────────────────────────────────


def test_versus_grades_the_higher_equity_flop(fake_db):
    body = route.VersusRequest(spot_id="srp_bb_vs_utg_40", flop_a="AcQd3h", flop_b="7c6d5h", pick="a")
    res = asyncio.run(route.record_versus(body, current_user=USER))
    fn, args = fake_db[-1]
    assert fn == "record_flop_versus_answer" and args["p_correct"] is True and args["p_gap"] == 17.1
    assert res.correct and res.equity_a == 69.1 and res.streak == 4

    body = route.VersusRequest(spot_id="srp_bb_vs_utg_40", flop_a="AcQd3h", flop_b="7c6d5h", pick="b")
    assert asyncio.run(route.record_versus(body, current_user=USER)).correct is False


def test_versus_needs_two_flops(fake_db):
    body = route.VersusRequest(spot_id="srp_bb_vs_utg_40", flop_a="AcQd3h", flop_b="AcQd3h", pick="a")
    with pytest.raises(HTTPException) as e:
        asyncio.run(route.record_versus(body, current_user=USER))
    assert e.value.status_code == 422


# ── Explorer ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("plan,ok", [("pro", True), ("trial", True), ("free", False)])
def test_explorer_is_pro_only(fake_db, monkeypatch, plan, ok):
    async def fake_plan(user_id, settings):
        return plan

    monkeypatch.setattr(route, "_plan", fake_plan)
    call = route.explorer_hands(spot_id="srp_bb_vs_utg_40", flop="AcQd3h", current_user=USER)
    if ok:
        assert asyncio.run(call)["ip"] == {"AA": [1, 90.0]}
    else:
        with pytest.raises(HTTPException) as e:
            asyncio.run(call)
        assert e.value.status_code == 403 and e.value.detail == {"code": "PRO_REQUIRED"}
