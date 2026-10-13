"""
Live integration check for the ai_coach_usage RPCs against a REAL configured
Supabase project — the one gap the fully-mocked FakeSupabase suite in
test_coach.py cannot cover.

THE BUG THIS WOULD HAVE CAUGHT: reserve_coach_usage's original SQL declared
`RETURNS TABLE(message_count integer, usage_date date, allowed boolean)`.
In PL/pgSQL, every RETURNS TABLE column becomes an implicitly-declared
variable in the function body's own scope — so `usage_date` collided with
the ai_coach_usage table's own `usage_date` column, and an unqualified
`usage_date` reference in the fallback SELECT's WHERE clause became
ambiguous (Postgres error 42702, PostgREST maps this to HTTP 400). Every
single call to the RPC failed, no matter how much usage the user had — the
Coach was completely broken in production despite the entire quota test
suite passing, because that suite exercises a hand-written Python mirror of
the *intended* semantics, not the actual deployed SQL. This test calls the
real RPC end to end and would fail exactly the way the production bug did.

Uses a disposable auth user (created via the Supabase Admin API and deleted
afterward) rather than a real registered user or an arbitrary UUID —
ai_coach_usage.user_id has a foreign key to auth.users, so a random UUID is
rejected (correctly) with a 23503 constraint violation, and reusing a real
user's id would risk corrupting their actual daily usage. Deleting the
disposable auth user cascades to remove its ai_coach_usage row too (see the
table's ON DELETE CASCADE in supabase_ai_coach_usage_schema.sql), so no
explicit table cleanup is needed beyond that.

Skipped automatically when real Supabase credentials aren't configured
(e.g. most CI environments) — this is a deliberate, narrow exception to the
project's fully-mocked test convention, not a replacement for it.
"""

from __future__ import annotations

import asyncio
import uuid

import httpx
import pytest

from app.config import get_settings
from app.engines.learn import coach_usage


def run(coro):
    return asyncio.run(coro)


def _real_supabase_configured() -> bool:
    settings = get_settings()
    return bool(settings.supabase_url) and bool(settings.supabase_service_role_key)


pytestmark = pytest.mark.skipif(
    not _real_supabase_configured(),
    reason="Real Supabase credentials not configured in this environment.",
)


def _admin_headers(settings) -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }


async def _create_disposable_user(settings) -> str:
    email = f"coach-rpc-test-{uuid.uuid4().hex[:12]}@example.invalid"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=_admin_headers(settings),
            json={"email": email, "email_confirm": True, "password": uuid.uuid4().hex},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("id") or data["user"]["id"]


async def _delete_disposable_user(user_id: str, settings) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers=_admin_headers(settings),
        )


async def _end_trial(user_id: str, settings) -> None:
    """New accounts start a 7-day Pro trial (start_reverse_trial in
    supabase_subscriptions.sql); end it so the Free limits apply."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(
            f"{settings.supabase_url}/rest/v1/subscriptions",
            headers={**_admin_headers(settings), "Content-Type": "application/json"},
            params={"user_id": f"eq.{user_id}"},
            json={"trial_ends_at": "2000-01-01T00:00:00+00:00"},
        )
        r.raise_for_status()


@pytest.fixture
def new_user_id():
    settings = get_settings()
    user_id = run(_create_disposable_user(settings))
    yield user_id
    run(_delete_disposable_user(user_id, settings))


@pytest.fixture
def disposable_user_id(new_user_id):
    """A Free account (trial already over)."""
    run(_end_trial(new_user_id, get_settings()))
    return new_user_id


def test_new_account_is_on_the_pro_trial(new_user_id):
    usage = run(coach_usage.get_coach_usage(new_user_id, get_settings()))
    assert usage.unlimited is True


def test_reserve_coach_usage_rpc_succeeds_against_real_supabase(disposable_user_id):
    settings = get_settings()
    usage, allowed = run(coach_usage.reserve_coach_usage(disposable_user_id, settings))
    assert allowed is True
    assert usage.used == 1
    # Trial ended → Free: 3/day (plan_limits.free_ai_questions_per_day).
    assert usage.limit == 3
    assert usage.remaining == 2


def test_reserve_then_release_nets_to_zero_against_real_supabase(disposable_user_id):
    settings = get_settings()
    usage, allowed = run(coach_usage.reserve_coach_usage(disposable_user_id, settings))
    assert allowed is True
    assert usage.used == 1

    run(coach_usage.release_coach_usage(disposable_user_id, settings))

    current = run(coach_usage.get_coach_usage(disposable_user_id, settings))
    assert current.used == 0


def test_reserve_at_the_limit_is_rejected_against_real_supabase(disposable_user_id):
    """With the trial ended the database resolves the real free-tier limit (3/day) —
    this drives the user to the actual default limit rather than a synthetic
    one, so it also catches any issue specific to hitting exactly the
    3rd/4th call."""
    settings = get_settings()
    for _ in range(3):
        usage, allowed = run(coach_usage.reserve_coach_usage(disposable_user_id, settings))
        assert allowed is True
    usage, allowed = run(coach_usage.reserve_coach_usage(disposable_user_id, settings))
    assert allowed is False
    assert usage.used == 3
    assert usage.remaining == 0
