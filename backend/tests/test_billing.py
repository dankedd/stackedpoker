"""Free / Pro billing: Stripe webhook processing, checkout and the trainer limit.

The plan/limit rules themselves (effective_plan, consume_usage, Amsterdam
days, the 3-day grace window, RLS) are SQL and are tested against a real
Postgres in supabase/tests/subscriptions.test.sql. These tests pin what the
backend is responsible for: verifying Stripe's signature, applying each event
exactly once and in order, and refusing work when the database says no.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.routes import preflop_trainer as trainer_route
from app.api.routes import stripe_routes as sr
from app.services import billing

WEBHOOK_SECRET = "whsec_test_secret"


def run(coro):
    return asyncio.run(coro)


# ── In-memory store (stands in for Supabase) ──────────────────────────────────


class FakeStore:
    def __init__(self):
        self.subs: dict[str, dict] = {}
        self.profiles: dict[str, dict] = {}
        self.events: set[str] = set()
        self.fail_upsert = False

    async def subscription_for_user(self, user_id):
        return dict(self.subs[user_id]) if user_id in self.subs else None

    async def subscription_for_customer(self, customer_id):
        row = next((r for r in self.subs.values() if r.get("stripe_customer_id") == customer_id), None)
        return dict(row) if row else None

    async def legacy_profile_customer(self, user_id):
        return self.profiles.get(user_id, {}).get("stripe_customer_id")

    async def user_for_legacy_customer(self, customer_id):
        return next((uid for uid, p in self.profiles.items() if p.get("stripe_customer_id") == customer_id), None)

    async def upsert_subscription(self, user_id, data):
        if self.fail_upsert:
            raise RuntimeError("database down")
        self.subs.setdefault(user_id, {"user_id": user_id}).update(data)

    async def mirror_profile(self, user_id, data):
        p = self.profiles.setdefault(user_id, {"subscription_tier": "free"})
        if p.get("subscription_tier") != "admin":
            p.update(data)

    async def claim_event(self, event_id, event_type):
        if event_id in self.events:
            return False
        self.events.add(event_id)
        return True

    async def release_event(self, event_id):
        self.events.discard(event_id)


@pytest.fixture
def store(monkeypatch):
    s = FakeStore()
    monkeypatch.setattr(sr, "store", s)
    return s


@pytest.fixture
def settings(monkeypatch):
    fake = SimpleNamespace(
        stripe_secret_key="sk_test_x", stripe_webhook_secret=WEBHOOK_SECRET, stripe_pro_price_id="price_pro_799",
        frontend_url="https://stackedpokerai.com", supabase_url="http://fake", supabase_service_role_key="k",
    )
    monkeypatch.setattr(sr, "get_settings", lambda: fake)
    return fake


# ── Signed webhook requests (what Stripe / `stripe trigger` sends) ────────────


def _signed(payload: bytes, secret: str = WEBHOOK_SECRET, ts: int | None = None) -> str:
    ts = ts or int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


class FakeRequest:
    def __init__(self, body: bytes):
        self._body = body

    async def body(self):
        return self._body


def _event(event_type: str, obj: dict, event_id: str = "evt_1", created: int = 1_760_000_000) -> dict:
    return {"id": event_id, "object": "event", "type": event_type, "created": created, "data": {"object": obj}}


def deliver(event: dict, secret: str = WEBHOOK_SECRET):
    body = json.dumps(event).encode()
    return run(sr.stripe_webhook(FakeRequest(body), _signed(body, secret)))


def _sub(status: str, **kw) -> dict:
    return {
        "id": "sub_1", "object": "subscription", "customer": "cus_1", "status": status,
        "cancel_at_period_end": False, "metadata": {"user_id": "user-1", "plan": "pro", "source": "hand_limit"},
        "items": {"data": [{"price": {"id": "price_pro_799"}, "current_period_end": 1_762_000_000}]},
        **kw,
    }


CHECKOUT = {
    "id": "cs_1", "object": "checkout.session", "mode": "subscription", "customer": "cus_1", "subscription": "sub_1",
    "payment_status": "paid", "client_reference_id": "user-1",
    "metadata": {"user_id": "user-1", "plan": "pro", "source": "upload_limit"},
}


# ── Webhook ───────────────────────────────────────────────────────────────────


def test_bad_signature_is_rejected(store, settings):
    with pytest.raises(HTTPException) as e:
        deliver(_event("checkout.session.completed", CHECKOUT), secret="whsec_wrong")
    assert e.value.status_code == 400
    assert store.subs == {}


def test_checkout_completed_activates_pro_and_stores_the_source(store, settings):
    assert deliver(_event("checkout.session.completed", CHECKOUT)) == {"received": True}
    row = store.subs["user-1"]
    assert row["status"] == "active"
    assert row["stripe_customer_id"] == "cus_1"
    assert row["stripe_subscription_id"] == "sub_1"
    assert row["upgrade_source"] == "upload_limit"
    assert store.profiles["user-1"]["subscription_tier"] == "pro"


def test_unknown_source_is_not_stored(store, settings):
    bad = {**CHECKOUT, "metadata": {**CHECKOUT["metadata"], "source": "<script>"}}
    deliver(_event("checkout.session.completed", bad))
    assert "upgrade_source" not in store.subs["user-1"]


def test_unpaid_checkout_does_not_unlock_pro(store, settings):
    """A delayed payment method: status comes later from subscription.updated."""
    deliver(_event("checkout.session.completed", {**CHECKOUT, "payment_status": "unpaid"}))
    assert "status" not in store.subs["user-1"]


def test_same_event_twice_is_applied_once(store, settings):
    deliver(_event("checkout.session.completed", CHECKOUT, event_id="evt_dup"))
    store.subs["user-1"]["status"] = "canceled"  # changed after the first delivery
    assert deliver(_event("checkout.session.completed", CHECKOUT, event_id="evt_dup")) == {"received": True, "duplicate": True}
    assert store.subs["user-1"]["status"] == "canceled"


def test_handler_failure_returns_500_and_releases_the_claim(store, settings):
    store.fail_upsert = True
    resp = deliver(_event("checkout.session.completed", CHECKOUT, event_id="evt_retry"))
    assert resp.status_code == 500
    assert "evt_retry" not in store.events  # Stripe's retry will run it
    store.fail_upsert = False
    assert deliver(_event("checkout.session.completed", CHECKOUT, event_id="evt_retry")) == {"received": True}
    assert store.subs["user-1"]["status"] == "active"


def test_subscription_lifecycle(store, settings):
    deliver(_event("customer.subscription.created", _sub("active"), "evt_a", 100))
    row = store.subs["user-1"]
    assert row["status"] == "active"
    assert row["price_id"] == "price_pro_799"
    assert row["current_period_end"].startswith("2025-11-01")  # from items[0] (newer API versions)
    assert row["upgrade_source"] == "hand_limit"

    deliver(_event("customer.subscription.updated", _sub("active", cancel_at_period_end=True), "evt_b", 200))
    assert store.subs["user-1"]["cancel_at_period_end"] is True

    deliver(_event("customer.subscription.deleted", _sub("canceled"), "evt_c", 300))
    assert store.subs["user-1"]["status"] == "canceled"
    assert store.profiles["user-1"]["subscription_tier"] == "free"


def test_out_of_order_events_are_ignored(store, settings):
    deliver(_event("customer.subscription.deleted", _sub("canceled"), "evt_new", 500))
    deliver(_event("customer.subscription.updated", _sub("active"), "evt_old", 400))
    assert store.subs["user-1"]["status"] == "canceled"


def test_payment_failed_starts_grace_once(store, settings):
    deliver(_event("customer.subscription.created", _sub("active"), "evt_a", 100))
    invoice = {"id": "in_1", "object": "invoice", "customer": "cus_1", "subscription": "sub_1"}
    deliver(_event("invoice.payment_failed", invoice, "evt_f1", 200))
    first = store.subs["user-1"]["past_due_since"]
    assert store.subs["user-1"]["status"] == "past_due"
    assert first

    # Stripe's own past_due update and a second failure keep the original start.
    deliver(_event("customer.subscription.updated", _sub("past_due"), "evt_u", 210))
    deliver(_event("invoice.payment_failed", {**invoice, "id": "in_2"}, "evt_f2", 300))
    assert store.subs["user-1"]["past_due_since"] == first

    # Paid on retry: grace cleared.
    deliver(_event("customer.subscription.updated", _sub("active"), "evt_paid", 400))
    assert store.subs["user-1"]["status"] == "active"
    assert store.subs["user-1"]["past_due_since"] is None


def test_failed_first_payment_never_grants_grace(store, settings):
    deliver(_event("customer.subscription.created", _sub("incomplete"), "evt_a", 100))
    deliver(_event("invoice.payment_failed", {"id": "in_1", "customer": "cus_1", "subscription": "sub_1"}, "evt_f", 200))
    assert store.subs["user-1"]["status"] == "incomplete"
    assert store.subs["user-1"].get("past_due_since") is None


def test_user_resolved_by_customer_when_metadata_is_missing(store, settings):
    store.subs["user-9"] = {"user_id": "user-9", "stripe_customer_id": "cus_9"}
    deliver(_event("customer.subscription.updated", _sub("active", customer="cus_9", metadata={}), "evt_x", 100))
    assert store.subs["user-9"]["status"] == "active"


def test_unresolvable_user_is_retried_not_dropped(store, settings):
    resp = deliver(_event("customer.subscription.updated", _sub("active", customer="cus_nobody", metadata={}), "evt_y"))
    assert resp.status_code == 500
    assert "evt_y" not in store.events


def test_admin_profile_is_never_downgraded(store, settings):
    store.profiles["user-1"] = {"subscription_tier": "admin"}
    deliver(_event("customer.subscription.deleted", _sub("canceled"), "evt_z"))
    assert store.profiles["user-1"]["subscription_tier"] == "admin"


def test_unhandled_event_types_are_acknowledged(store, settings):
    assert deliver(_event("customer.created", {"id": "cus_1"})) == {"received": True}
    assert store.events == set()


# ── Checkout session ──────────────────────────────────────────────────────────


@pytest.fixture
def captured_checkout(monkeypatch):
    calls: list[dict] = []

    def _create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(id="cs_test", url="https://checkout.stripe.com/c/pay/cs_test")

    monkeypatch.setattr(sr.stripe.checkout.Session, "create", _create)
    return calls


def _entitlements(monkeypatch, ent: dict):
    async def _get(user_id, settings):
        return ent
    monkeypatch.setattr(sr.billing, "get_entitlements", _get)


def test_checkout_uses_the_one_pro_price_tax_and_source(store, settings, captured_checkout, monkeypatch):
    _entitlements(monkeypatch, {"plan": "trial", "subscription": {"status": None}})
    out = run(sr.create_checkout({"sub": "user-1", "email": "a@b.c"}, sr._CheckoutRequest(source="ai_limit")))
    assert out == {"url": "https://checkout.stripe.com/c/pay/cs_test"}
    kw = captured_checkout[0]
    assert kw["line_items"] == [{"price": "price_pro_799", "quantity": 1}]
    assert kw["automatic_tax"] == {"enabled": True}
    assert "payment_method_types" not in kw  # card/iDEAL/Bancontact/wallets come from the dashboard
    assert kw["metadata"] == {"user_id": "user-1", "plan": "pro", "source": "ai_limit"}
    assert kw["subscription_data"]["metadata"]["source"] == "ai_limit"
    assert kw["success_url"] == "https://stackedpokerai.com/dashboard?upgraded=1&source=ai_limit"
    assert kw["customer_email"] == "a@b.c"


def test_checkout_ignores_unknown_sources_and_reuses_the_customer(store, settings, captured_checkout, monkeypatch):
    _entitlements(monkeypatch, {"plan": "free", "subscription": {"status": "canceled"}})
    store.subs["user-1"] = {"user_id": "user-1", "stripe_customer_id": "cus_1"}
    run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest(source="https://evil")))
    kw = captured_checkout[0]
    assert kw["metadata"]["source"] == "pricing_page"
    assert kw["customer"] == "cus_1"
    assert kw["customer_update"] == {"address": "auto", "name": "auto"}


def test_checkout_refused_for_existing_subscribers(store, settings, captured_checkout, monkeypatch):
    _entitlements(monkeypatch, {"plan": "pro", "subscription": {"status": "active"}})
    out = run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest()))
    assert out["error"] == "already_subscribed"
    assert captured_checkout == []


@pytest.fixture
def promo_codes(monkeypatch):
    """Fake Stripe promotion codes: code → id; looked-up codes are recorded."""
    codes = {"STACKED50": "promo_123"}
    lookups: list[dict] = []

    def _list(**kwargs):
        lookups.append(kwargs)
        hit = codes.get(kwargs["code"]) if kwargs.get("active") else None
        return SimpleNamespace(data=[{"id": hit}] if hit else [])

    monkeypatch.setattr(sr.stripe.PromotionCode, "list", _list)
    return lookups


def test_checkout_pre_applies_an_active_promo_code(store, settings, captured_checkout, promo_codes, monkeypatch):
    _entitlements(monkeypatch, {"plan": "free", "subscription": {"status": None}})
    out = run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest(source="promo_3m_50", promo="stacked50")))
    assert out == {"url": "https://checkout.stripe.com/c/pay/cs_test"}
    kw = captured_checkout[0]
    assert promo_codes == [{"code": "STACKED50", "active": True, "limit": 1}]
    assert kw["discounts"] == [{"promotion_code": "promo_123"}]
    assert "allow_promotion_codes" not in kw  # Stripe refuses both together
    assert kw["line_items"] == [{"price": "price_pro_799", "quantity": 1}]  # the regular price, unchanged
    assert kw["metadata"]["source"] == "promo_3m_50"


def test_checkout_with_an_unknown_or_malformed_promo_opens_at_the_regular_price(store, settings, captured_checkout, promo_codes, monkeypatch):
    _entitlements(monkeypatch, {"plan": "free", "subscription": {"status": None}})
    run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest(promo="EXPIRED1")))
    run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest(promo="x; drop")))
    assert [l["code"] for l in promo_codes] == ["EXPIRED1"]  # the malformed one never reaches Stripe
    for kw in captured_checkout:
        assert "discounts" not in kw
        assert kw["allow_promotion_codes"] is True


def test_checkout_falls_back_when_stripe_refuses_the_promo_for_this_customer(store, settings, promo_codes, monkeypatch):
    _entitlements(monkeypatch, {"plan": "free", "subscription": {"status": None}})
    calls: list[dict] = []

    def _create(**kwargs):
        calls.append(dict(kwargs))
        if "discounts" in kwargs:
            raise sr.stripe.InvalidRequestError("This promotion code cannot be redeemed", "discounts")
        return SimpleNamespace(id="cs_test", url="https://checkout.stripe.com/c/pay/cs_test")

    monkeypatch.setattr(sr.stripe.checkout.Session, "create", _create)
    out = run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest(promo="STACKED50")))
    assert out == {"url": "https://checkout.stripe.com/c/pay/cs_test"}
    assert len(calls) == 2
    assert "discounts" not in calls[1] and calls[1]["allow_promotion_codes"] is True


# ── Preflop Trainer: hand 51 is refused server-side ───────────────────────────


@pytest.fixture
def trainer(monkeypatch):
    """Fake consume_usage with a 50-hand limit and a fake record RPC."""
    state = {"used": 0, "limit": 50, "recorded": 0}

    async def _consume(user_id, metric, settings):
        assert metric == "trainer_hand"
        if state["limit"] is not None and state["used"] >= state["limit"]:
            return billing.UsageResult(False, state["used"], state["limit"], "free", "2026-10-13T22:00:00+00:00")
        state["used"] += 1
        return billing.UsageResult(True, state["used"], state["limit"], "free", "2026-10-13T22:00:00+00:00")

    async def _rpc(fn, args, settings):
        state["recorded"] += 1
        return {"streak": 1, "best_streak": 1, "daily_xp": 1, "daily_cap": 300, "xp_per_correct": 1,
                "next_tier_at": 10, "xp_awarded": 1, "total_xp": 10, "too_fast": False}

    monkeypatch.setattr(trainer_route.billing, "consume_usage", _consume)
    monkeypatch.setattr(trainer_route, "_rpc", _rpc)
    monkeypatch.setattr(trainer_route, "get_settings", lambda: SimpleNamespace())
    return state


def _hand():
    return trainer_route.HandRequest(kind="open", chart_id=327, hand="AA", action="raise")


def test_trainer_hands_49_50_allowed_51_refused(trainer):
    user = {"sub": "user-1"}
    trainer["used"] = 48
    assert run(trainer_route.record_hand(_hand(), user)).usage["used"] == 49
    assert run(trainer_route.record_hand(_hand(), user)).usage == {"used": 50, "limit": 50, "reset_at": "2026-10-13T22:00:00+00:00"}
    with pytest.raises(HTTPException) as e:
        run(trainer_route.record_hand(_hand(), user))
    assert e.value.status_code == 429
    assert e.value.detail["code"] == "TRAINER_DAILY_LIMIT_REACHED"
    assert e.value.detail["reset_at"] == "2026-10-13T22:00:00+00:00"
    assert trainer["recorded"] == 2  # hand 51 earned nothing and recorded nothing


def test_trainer_unlimited_for_pro(trainer):
    trainer["limit"] = None
    trainer["used"] = 500
    assert run(trainer_route.record_hand(_hand(), {"sub": "user-1"})).usage["limit"] is None


def test_invalid_hand_costs_nothing(trainer):
    with pytest.raises(HTTPException):
        run(trainer_route.record_hand(trainer_route.HandRequest(kind="open", chart_id=327, hand="ZZ", action="raise"), {"sub": "u"}))
    assert trainer["used"] == 0


def test_checkout_failure_says_what_is_missing(store, settings, captured_checkout):
    settings.stripe_pro_price_id = ""
    out = run(sr.create_checkout({"sub": "user-1"}, sr._CheckoutRequest()))
    assert out["error"] == "stripe_checkout_failed"
    assert out["reason"] == "not_configured: STRIPE_PRO_PRICE_ID"
    assert "sk_test" not in json.dumps(out)
