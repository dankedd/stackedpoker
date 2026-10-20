"""
Stripe Billing integration — one Pro plan (€7.99/month incl. VAT).

Endpoints:
  POST /api/stripe/create-checkout   — Checkout Session for Pro
  POST /api/stripe/customer-portal   — Billing Portal session (cancel, payment details)
  POST /api/stripe/webhook           — Stripe webhook receiver

Subscription state lives in public.subscriptions (supabase_subscriptions.sql)
and is written ONLY here, by the webhook, with the service role. What a user
may do is decided in the database (effective_plan / get_entitlements) from
that row — never from anything the browser sends.

Webhook guarantees:
  * idempotent: every event id is claimed in stripe_events before it is applied
  * order-safe: an event older than the last one applied to a subscription is ignored
  * retried: if applying fails, the claim is released and Stripe gets a 500,
    so it delivers the event again
  * past_due: payment_failed starts a 3-day grace window (plan_limits); after
    that effective_plan() treats the user as Free until Stripe reports active
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

import httpx
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.services import billing

router = APIRouter(prefix="/stripe", tags=["stripe"])
logger = logging.getLogger(__name__)

UPGRADE_SOURCES = {"hand_limit", "upload_limit", "ai_limit", "trial_ending", "trial_ended", "pricing_page", "flop_explorer"}
DEFAULT_SOURCE = "pricing_page"

# Stripe statuses that mean "paying customer" for the legacy profiles mirror.
# The grace period for past_due is applied by effective_plan(), not here.
_PAID_STATUSES = {"active", "trialing", "past_due"}


def _iso(ts: int | None) -> str | None:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Supabase store (service role) ─────────────────────────────────────────────


class SupabaseStore:
    """The few reads/writes billing needs. Tests swap in an in-memory fake."""

    def _headers(self, **extra: str) -> dict[str, str]:
        key = get_settings().supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", **extra}

    def _url(self, path: str) -> str:
        return f"{get_settings().supabase_url}/rest/v1/{path}"

    async def _get_one(self, table: str, params: dict) -> dict | None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(self._url(table), headers=self._headers(), params={**params, "limit": "1"})
            r.raise_for_status()
            rows = r.json()
        return rows[0] if rows else None

    async def subscription_for_user(self, user_id: str) -> dict | None:
        return await self._get_one("subscriptions", {"user_id": f"eq.{user_id}", "select": "*"})

    async def subscription_for_customer(self, customer_id: str) -> dict | None:
        return await self._get_one("subscriptions", {"stripe_customer_id": f"eq.{customer_id}", "select": "*"})

    async def legacy_profile_customer(self, user_id: str) -> str | None:
        row = await self._get_one("profiles", {"id": f"eq.{user_id}", "select": "stripe_customer_id"})
        return (row or {}).get("stripe_customer_id")

    async def user_for_legacy_customer(self, customer_id: str) -> str | None:
        row = await self._get_one("profiles", {"stripe_customer_id": f"eq.{customer_id}", "select": "id"})
        return (row or {}).get("id")

    async def upsert_subscription(self, user_id: str, data: dict) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                self._url("subscriptions"),
                headers=self._headers(Prefer="resolution=merge-duplicates,return=minimal"),
                params={"on_conflict": "user_id"},
                json={**data, "user_id": user_id, "updated_at": _now_iso()},
            )
            r.raise_for_status()

    async def mirror_profile(self, user_id: str, data: dict) -> None:
        """Keeps profiles.subscription_tier/stripe_* in step for code that still
        reads them (PlanBadge, Learn, /community). Never touches the admin row."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.patch(
                self._url("profiles"),
                headers=self._headers(Prefer="return=minimal"),
                params={"id": f"eq.{user_id}", "subscription_tier": "neq.admin"},
                json=data,
            )
            r.raise_for_status()

    async def claim_event(self, event_id: str, event_type: str) -> bool:
        """True when this call is the first to see the event."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                self._url("stripe_events"),
                headers=self._headers(Prefer="resolution=ignore-duplicates,return=representation"),
                params={"on_conflict": "event_id"},
                json={"event_id": event_id, "type": event_type},
            )
            r.raise_for_status()
            return bool(r.json())

    async def release_event(self, event_id: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.delete(self._url("stripe_events"), headers=self._headers(), params={"event_id": f"eq.{event_id}"})
            r.raise_for_status()


store = SupabaseStore()


async def _customer_id_for(user_id: str) -> str | None:
    sub = await store.subscription_for_user(user_id)
    return (sub or {}).get("stripe_customer_id") or await store.legacy_profile_customer(user_id)


# ── Stripe client helper ───────────────────────────────────────────────────────

def _init_stripe() -> None:
    s = get_settings()
    if not s.stripe_secret_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured on this server.")
    stripe.api_key = s.stripe_secret_key


def _checkout_failed(reason: str) -> dict:
    """`reason` says which step failed (never a key or secret): not_configured,
    lookup_failed, or Stripe's own error code and message — so a broken
    setup shows up in the response, not only in the server log."""
    return {"error": "stripe_checkout_failed", "message": "Unable to create checkout session", "reason": reason}


# ── Routes ─────────────────────────────────────────────────────────────────────

class _CheckoutRequest(BaseModel):
    # hand_limit | upload_limit | ai_limit | trial_ending | trial_ended | pricing_page | flop_explorer
    source: str | None = None


@router.post("/create-checkout")
async def create_checkout(
    user: Annotated[dict, Depends(get_current_user)],
    body: _CheckoutRequest = _CheckoutRequest(),
):
    """Create a Stripe Checkout Session for Pro.

    The client redirects to the returned URL. Payment methods (card, iDEAL,
    Bancontact, Apple Pay / Google Pay) come from the Stripe dashboard —
    deliberately not listed here — and VAT is computed by Stripe Tax on a
    tax-inclusive price, so €7.99 is what the customer pays.
    """
    s = get_settings()
    if not s.stripe_secret_key or not s.stripe_pro_price_id:
        logger.error("Stripe checkout called but STRIPE_SECRET_KEY / STRIPE_PRO_PRICE_ID is not set")
        missing = [n for n, v in (("STRIPE_SECRET_KEY", s.stripe_secret_key), ("STRIPE_PRO_PRICE_ID", s.stripe_pro_price_id)) if not v]
        return _checkout_failed(f"not_configured: {', '.join(missing)}")
    _init_stripe()

    user_id: str = user.get("sub", "")
    email: str | None = user.get("email")
    source = body.source if body.source in UPGRADE_SOURCES else DEFAULT_SOURCE

    try:
        ent = await billing.get_entitlements(user_id, s)
        if ent.get("plan") == "pro" and (ent.get("subscription") or {}).get("status") in ("active", "trialing", "past_due"):
            return {"error": "already_subscribed", "message": "You already have Pro."}
        customer_id = await _customer_id_for(user_id)
    except httpx.HTTPError as exc:
        logger.error("Checkout: entitlement lookup failed | user=%s error=%s", user_id, exc)
        return _checkout_failed("lookup_failed")

    # Server-configured origin — never a client-supplied redirect URL.
    origin = s.frontend_url
    metadata = {"user_id": user_id, "plan": "pro", "source": source}
    kwargs: dict = dict(
        mode="subscription",
        line_items=[{"price": s.stripe_pro_price_id, "quantity": 1}],
        automatic_tax={"enabled": True},
        client_reference_id=user_id,
        success_url=f"{origin}/dashboard?upgraded=1&source={source}",
        cancel_url=f"{origin}/pricing",
        metadata=metadata,
        subscription_data={"metadata": metadata},
        allow_promotion_codes=True,
    )
    if customer_id:
        kwargs["customer"] = customer_id
        # Stripe Tax needs the customer's address; let Checkout save what it collects.
        kwargs["customer_update"] = {"address": "auto", "name": "auto"}
    elif email:
        kwargs["customer_email"] = email

    try:
        session = stripe.checkout.Session.create(**kwargs)
    except stripe.StripeError as exc:
        logger.error("Stripe checkout failed | user=%s error=%s", user_id, exc)
        return _checkout_failed(f"stripe: {exc.code or type(exc).__name__}: {exc.user_message or ''}".strip())
    except Exception as exc:
        logger.error("Unexpected checkout error | user=%s error=%s", user_id, exc)
        return _checkout_failed(f"unexpected: {type(exc).__name__}")

    logger.info("Checkout session created | user=%s source=%s customer=%s session=%s", user_id, source, customer_id or "(new)", session.id)
    return {"url": session.url}


@router.post("/customer-portal")
async def customer_portal(user: Annotated[dict, Depends(get_current_user)]):
    """Stripe Billing Portal: cancel, change payment method, invoices."""
    s = get_settings()
    _init_stripe()
    user_id: str = user.get("sub", "")
    try:
        customer_id = await _customer_id_for(user_id)
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Failed to open billing portal.")
    if not customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No billing account found. Please subscribe first.")

    try:
        portal = stripe.billing_portal.Session.create(customer=customer_id, return_url=f"{s.frontend_url}/settings")
    except stripe.StripeError as exc:
        logger.error("Stripe portal error for user %s: %s", user_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Failed to open billing portal.")
    return {"url": portal.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header(alias="stripe-signature")] = None,
):
    """Receive and process Stripe webhook events.

    Uses the raw body bytes for signature verification — never parsed JSON.
    """
    s = get_settings()
    if not s.stripe_webhook_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook secret not configured.")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, s.stripe_webhook_secret)
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook: invalid signature — possible replay/forgery")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid signature.")
    except Exception as exc:
        logger.error("Stripe webhook: bad payload: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid payload.")

    return await process_event(event)


async def process_event(event) -> JSONResponse | dict:
    event_id: str = event["id"]
    event_type: str = event["type"]
    handler = _HANDLERS.get(event_type)
    if handler is None:
        logger.debug("Stripe webhook: unhandled event %s", event_type)
        return {"received": True}

    try:
        if not await store.claim_event(event_id, event_type):
            logger.info("Stripe webhook: duplicate %s %s — already applied", event_type, event_id)
            return {"received": True, "duplicate": True}
    except httpx.HTTPError as exc:
        logger.error("Stripe webhook: could not claim %s: %s", event_id, exc)
        return JSONResponse({"received": False}, status_code=500)

    try:
        await handler(event["data"]["object"], event.get("created"))
    except Exception as exc:
        logger.exception("Stripe webhook: handler failed for %s %s: %s", event_type, event_id, exc)
        try:
            await store.release_event(event_id)
        except Exception:
            logger.exception("Stripe webhook: could not release claim on %s", event_id)
        # 500 → Stripe retries with backoff; the released claim lets the retry run.
        return JSONResponse({"received": False}, status_code=500)

    logger.info("Stripe webhook applied: %s %s", event_type, event_id)
    return {"received": True}


# ── Webhook event handlers ─────────────────────────────────────────────────────

async def _resolve_user(metadata: dict | None, customer_id: str | None) -> tuple[str | None, dict | None]:
    """(user_id, current subscriptions row)."""
    user_id = (metadata or {}).get("user_id")
    if user_id:
        return user_id, await store.subscription_for_user(user_id)
    if customer_id:
        row = await store.subscription_for_customer(customer_id)
        if row:
            return row["user_id"], row
        user_id = await store.user_for_legacy_customer(customer_id)
        if user_id:
            return user_id, await store.subscription_for_user(user_id)
    return None, None


def _is_stale(row: dict | None, event_created: int | None) -> bool:
    if not row or not row.get("stripe_event_at") or not event_created:
        return False
    applied = datetime.fromisoformat(str(row["stripe_event_at"]).replace("Z", "+00:00"))
    return datetime.fromtimestamp(event_created, tz=timezone.utc) < applied


def _past_due_since(new_status: str, row: dict | None) -> str | None:
    if new_status != "past_due":
        return None
    return (row or {}).get("past_due_since") or _now_iso()


async def _apply(user_id: str, row: dict | None, data: dict, event_created: int | None) -> None:
    if event_created:
        data["stripe_event_at"] = _iso(event_created)
    await store.upsert_subscription(user_id, data)
    if "status" in data:
        profile: dict = {"subscription_tier": "pro" if data["status"] in _PAID_STATUSES else "free", "subscription_status": data["status"]}
        if data.get("stripe_customer_id"):
            profile["stripe_customer_id"] = data["stripe_customer_id"]
        if "stripe_subscription_id" in data:
            profile["stripe_subscription_id"] = data["stripe_subscription_id"]
        if data.get("current_period_end"):
            profile["current_period_end"] = data["current_period_end"]
        await store.mirror_profile(user_id, profile)


async def _on_checkout_completed(session: dict, event_created: int | None) -> None:
    if session.get("mode") not in (None, "subscription"):
        return
    metadata = {**(session.get("metadata") or {})}
    metadata.setdefault("user_id", session.get("client_reference_id"))
    user_id, row = await _resolve_user(metadata, session.get("customer"))
    if not user_id:
        # Raise, not return: a retry may succeed once the row exists.
        raise RuntimeError(f"checkout.session.completed {session.get('id')}: cannot resolve user")
    if _is_stale(row, event_created):
        return

    data: dict = {
        "stripe_customer_id": session.get("customer"),
        "stripe_subscription_id": session.get("subscription"),
        "plan": "pro",
    }
    source = metadata.get("source")
    if source in UPGRADE_SOURCES:
        data["upgrade_source"] = source
    # Paid right away (card, iDEAL, Bancontact, wallets). A delayed method
    # leaves the status to customer.subscription.updated.
    if session.get("payment_status") in ("paid", "no_payment_required"):
        data["status"] = "active"
        data["past_due_since"] = None
    await _apply(user_id, row, data, event_created)
    logger.info("User %s subscribed via checkout (source=%s)", user_id, source)


def _period_end(sub: dict) -> str | None:
    # Newer API versions moved current_period_end onto the subscription items.
    ts = sub.get("current_period_end")
    if not ts:
        items = (sub.get("items") or {}).get("data") or []
        ts = items[0].get("current_period_end") if items else None
    return _iso(ts)


def _price_id(sub: dict) -> str | None:
    items = (sub.get("items") or {}).get("data") or []
    return ((items[0].get("price") or {}).get("id")) if items else None


async def _on_subscription_updated(sub: dict, event_created: int | None) -> None:
    user_id, row = await _resolve_user(sub.get("metadata"), sub.get("customer"))
    if not user_id:
        raise RuntimeError(f"subscription event {sub.get('id')}: cannot resolve user for customer {sub.get('customer')}")
    if _is_stale(row, event_created):
        logger.info("Stripe webhook: stale subscription event for %s ignored", user_id)
        return

    new_status: str = sub.get("status") or ""
    data: dict = {
        "stripe_customer_id": sub.get("customer"),
        "stripe_subscription_id": sub.get("id"),
        "status": new_status,
        "plan": "pro",
        "price_id": _price_id(sub),
        "current_period_end": _period_end(sub),
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
        "past_due_since": _past_due_since(new_status, row),
    }
    source = (sub.get("metadata") or {}).get("source")
    if source in UPGRADE_SOURCES and not (row or {}).get("upgrade_source"):
        data["upgrade_source"] = source
    await _apply(user_id, row, data, event_created)


async def _on_subscription_deleted(sub: dict, event_created: int | None) -> None:
    user_id, row = await _resolve_user(sub.get("metadata"), sub.get("customer"))
    if not user_id:
        raise RuntimeError(f"subscription.deleted {sub.get('id')}: cannot resolve user")
    if _is_stale(row, event_created):
        return
    await _apply(user_id, row, {
        "stripe_customer_id": sub.get("customer"),
        "status": sub.get("status") or "canceled",
        "cancel_at_period_end": False,
        "past_due_since": None,
    }, event_created)
    logger.info("User %s subscription ended — back to Free", user_id)


async def _on_payment_failed(invoice: dict, event_created: int | None) -> None:
    if not invoice.get("subscription") and not (invoice.get("parent") or {}).get("subscription_details"):
        return  # not a subscription invoice
    user_id, row = await _resolve_user(None, invoice.get("customer"))
    if not user_id:
        raise RuntimeError(f"invoice.payment_failed {invoice.get('id')}: cannot resolve user")
    # Grace is for subscribers who were paying. A failed FIRST payment
    # (status incomplete) never unlocks Pro.
    if (row or {}).get("status") not in ("active", "trialing", "past_due"):
        return
    # Not stamped with stripe_event_at: the status itself still comes from
    # customer.subscription.updated, which Stripe sends alongside.
    await store.upsert_subscription(user_id, {"status": "past_due", "past_due_since": _past_due_since("past_due", row)})
    await store.mirror_profile(user_id, {"subscription_status": "past_due"})
    logger.warning("Payment failed for user %s — 3-day grace started", user_id)


_HANDLERS = {
    "checkout.session.completed": _on_checkout_completed,
    "customer.subscription.created": _on_subscription_updated,
    "customer.subscription.updated": _on_subscription_updated,
    "customer.subscription.deleted": _on_subscription_deleted,
    "invoice.payment_failed": _on_payment_failed,
}
