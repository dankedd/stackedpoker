"""Adversarial XP integrity tests — verifies that XP awarded through the
canonical award endpoints (backend/app/api/routes/learn.py) is resolved
server-side (backend/app/engines/learn/reward_resolver.py), never trusted
from the client, now that XP determines a public competitive leaderboard.

Uses the same in-memory fake Supabase harness as test_learn_persistence.py,
with reward_resolver's manifest replaced by FAKE_REWARD_MANIFEST (see that
file) — "lesson-adv" has step-canon=20, step-cheap=5, step-expensive=50,
xp_reward=80.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.api.routes import learn as learn_module
from app.api.routes import leaderboard as leaderboard_module
from app.engines.learn import reward_resolver

from .test_learn_persistence import fake_db, run, run_concurrently  # noqa: F401


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ── reward_resolver.py: unit-level resolution ──────────────────────────────


def test_resolve_step_xp_ignores_client_amount_entirely(fake_db):
    """Canonical reward = 20 XP. No matter what a client claims, resolution
    only ever depends on (lesson_id, step_id, quality) — the amount the
    client separately reports is never consulted here at all."""
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "perfect") == 20


def test_resolve_step_xp_scales_by_quality_tier(fake_db):
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "good") == 16  # 20*0.8
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "acceptable") == 10  # 20*0.5
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "mistake") == 4  # 20*0.2
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "punt") == 0


def test_resolve_step_xp_unknown_lesson_resolves_to_zero(fake_db):
    assert reward_resolver.resolve_step_xp("lesson-does-not-exist", "step-canon", "perfect") == 0


def test_resolve_step_xp_unknown_step_resolves_to_zero(fake_db):
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-does-not-exist", "perfect") == 0


def test_resolve_step_xp_unrecognized_quality_resolves_to_zero(fake_db):
    assert reward_resolver.resolve_step_xp("lesson-adv", "step-canon", "definitely-not-a-real-quality") == 0


# ── Section 9's exact adversarial scenarios, via the real endpoint ─────────


def test_client_claiming_5x_the_canonical_amount_is_awarded_only_the_canonical_amount(fake_db):
    """canonical reward = 20 XP; client sends 100 XP -> award 20."""
    user = {"sub": "user-adv-1"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=100, concept_ids=[], step_index=0, total_steps=1,
    )
    result = run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))
    assert result["xp_awarded_this_call"] == 20
    assert result["new_total_xp"] == 20


def test_client_claiming_an_absurd_amount_is_awarded_only_the_canonical_amount(fake_db):
    """canonical reward = 20 XP; client sends 999999 XP -> award 20."""
    user = {"sub": "user-adv-2"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=999_999, concept_ids=[], step_index=0, total_steps=1,
    )
    result = run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))
    assert result["xp_awarded_this_call"] == 20
    assert result["new_total_xp"] == 20


def test_client_sending_negative_xp_cannot_manipulate_total(fake_db):
    """A negative xp_earned must not subtract from the total, nor influence
    the award at all — the awarded amount is always the resolved canonical
    value (20 here), completely independent of the claimed sign/magnitude."""
    user = {"sub": "user-adv-3"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=-999_999, concept_ids=[], step_index=0, total_steps=1,
    )
    result = run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))
    assert result["xp_awarded_this_call"] == 20
    assert result["new_total_xp"] == 20

    skill_rows = fake_db.select("user_skill_progress", "user_id=eq.user-adv-3")
    assert skill_rows[0]["total_xp"] == 20  # never negative, never reduced


def test_completing_a_different_step_never_grants_another_steps_reward(fake_db):
    """'Changing source_id' in this architecture means claiming completion
    of a DIFFERENT (lesson_id, step_id) than what the client actually
    displayed — since resolution keys strictly off those URL-path
    identifiers (not any body field), completing the cheap step can never
    be credited the expensive step's reward, and vice versa."""
    user = {"sub": "user-adv-4"}
    cheap_body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=50, concept_ids=[], step_index=0, total_steps=1,
    )
    result = run(learn_module.submit_step_result("lesson-adv", "step-cheap", cheap_body, user))
    # Client claimed 50 (the EXPENSIVE step's value) while actually
    # completing the CHEAP step — only the cheap step's real value (5) is awarded.
    assert result["xp_awarded_this_call"] == 5
    assert result["new_total_xp"] == 5


def test_fabricated_step_identifier_resolves_to_zero_not_a_borrowed_reward(fake_db):
    """A step_id that doesn't exist in the manifest at all (typo'd or
    fabricated) must resolve to 0 — it can never inherit a real step's value."""
    user = {"sub": "user-adv-5"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=999, concept_ids=[], step_index=0, total_steps=1,
    )
    result = run(learn_module.submit_step_result("lesson-adv", "step-totally-made-up", body, user))
    assert result["xp_awarded_this_call"] == 0
    assert result["new_total_xp"] == 0


def test_same_reward_claimed_twice_sequentially_produces_one_event_one_award(fake_db):
    user = {"sub": "user-adv-6"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=20, concept_ids=[], step_index=0, total_steps=1,
    )
    first = run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))
    second = run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))

    assert first["xp_awarded_this_call"] == 20
    assert second["xp_awarded_this_call"] == 0  # replay — not re-awarded
    assert second["new_total_xp"] == 20

    events = fake_db.select("xp_events", "user_id=eq.user-adv-6")
    assert len(events) == 1
    assert events[0]["amount"] == 20


def test_two_concurrent_claims_for_the_same_step_produce_one_event_one_award(fake_db):
    """Two requests racing to be the "first completion" of the exact same
    (lesson_id, step_id) can't both win: the second's raw INSERT into
    user_step_progress collides with the real (user_id, lesson_id, step_id)
    primary key (see would_conflict) — production's actual protection for
    this race. submit_step_result catches that specific conflict and treats
    the loser as a graceful replay (0 XP, no error) rather than a 502, but
    either way exactly one request is ever credited the XP, and only one
    ledger event is ever recorded."""
    user = {"sub": "user-adv-7"}
    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=20, concept_ids=[], step_index=0, total_steps=1,
    )
    results = run_concurrently(
        learn_module.submit_step_result("lesson-adv", "step-canon", body, user),
        learn_module.submit_step_result("lesson-adv", "step-canon", body, user),
    )
    assert all(not isinstance(r, BaseException) for r in results)
    awarded_amounts = sorted(r["xp_awarded_this_call"] for r in results)
    assert awarded_amounts == [0, 20]  # exactly one of the two won

    skill_rows = fake_db.select("user_skill_progress", "user_id=eq.user-adv-7")
    assert skill_rows[0]["total_xp"] == 20  # never double-credited

    events = fake_db.select("xp_events", "user_id=eq.user-adv-7")
    assert len(events) == 1


# ── Leaderboard sourcing: exactly the canonical total / real ledger ───────


def test_all_time_leaderboard_matches_canonical_total_xp_exactly_after_adversarial_attempts(fake_db):
    user_id = "user-adv-8"
    user = {"sub": user_id}
    fake_db.insert("profiles", {"id": user_id, "username": "Adversary", "created_at": _iso(datetime.now(timezone.utc))})

    # A barrage of tampered claims against the same real step.
    for claimed in (999_999, -500, 1):
        body = learn_module.StepResultBody(
            score=100, quality="perfect", xp_earned=claimed, concept_ids=[], step_index=0, total_steps=1,
        )
        run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))

    resp = run(leaderboard_module.get_leaderboard(period="all", limit=50, offset=0, current_user=user))
    assert resp.rows[0].total_xp == 20  # only the canonical amount, credited once

    progress = run(learn_module.get_full_progress(user))
    assert progress["skill"]["total_xp"] == 20 == resp.rows[0].total_xp


def test_24h_leaderboard_includes_only_real_ledger_events_not_client_claims(fake_db):
    user_id = "user-adv-9"
    user = {"sub": user_id}
    fake_db.insert("profiles", {"id": user_id, "username": "Ledgered", "created_at": _iso(datetime.now(timezone.utc))})

    body = learn_module.StepResultBody(
        score=100, quality="perfect", xp_earned=999_999, concept_ids=[], step_index=0, total_steps=1,
    )
    run(learn_module.submit_step_result("lesson-adv", "step-canon", body, user))

    resp = run(leaderboard_module.get_leaderboard(period="24h", limit=50, offset=0, current_user=user))
    assert resp.rows[0].period_xp == 20  # the real, resolved, ledgered amount

    events = fake_db.select("xp_events", f"user_id=eq.{user_id}")
    assert len(events) == 1
    assert events[0]["amount"] == 20
