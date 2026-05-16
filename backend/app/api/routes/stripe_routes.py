"""
Stripe Billing integration.

Endpoints:
  POST /api/stripe/create-checkout   — create a Checkout Session for Pro
  POST /api/stripe/customer-portal   — create a Billing Portal session
  POST /api/stripe/webhook           — Stripe webhook receiver

All subscription state changes are applied by the webhook handler so that
plan upgrades/downgrades are always authoritative and server-side.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

import httpx
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.config import get_settings
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/stripe", tags=["stripe"])
logger = logging.getLogger(__name__)


# ── Supabase helpers (mirrors usage_service pattern) ──────────────────────────

def _supa_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def _get_profile_stripe_info(user_id: str) -> dict:
    """Return stripe_customer_id for a user (empty dict on any failure)."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        return {}
    url = f"{s.supabase_url}/rest/v1/profiles"
    params = {"id": f"eq.{user_id}", "select": "stripe_customer_id"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=_supa_headers(), params=params)
        if resp.status_code == 200 and resp.json():
            return resp.json()[0]
    except Exception as exc:
        logger.warning("stripe_info fetch failed for %s: %s", user_id, exc)
    return {}


async def _get_profile_by_customer(customer_id: str) -> dict:
    """Return {id} for the profile matching a Stripe customer ID."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        return {}
    url = f"{s.supabase_url}/rest/v1/profiles"
    params = {"stripe_customer_id": f"eq.{customer_id}", "select": "id"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=_supa_headers(), params=params)
        if resp.status_code == 200 and resp.json():
            return resp.json()[0]
    except Exception as exc:
        logger.warning("customer lookup failed for %s: %s", customer_id, exc)
    return {}


async def _update_profile(user_id: str, data: dict) -> None:
    """PATCH profile row via service role (bypasses RLS)."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        return
    url = f"{s.supabase_url}/rest/v1/profiles"
    headers = {**_supa_headers(), "Prefer": "return=minimal"}
    params = {"id": f"eq.{user_id}"}
    # Strip None values — PATCH should only update supplied fields
    payload = {k: v for k, v in data.items() if v is not None or k in (
        "stripe_subscription_id",  # allow explicit null on cancellation
    )}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(url, headers=headers, params=params, json=payload)
        if resp.status_code not in (200, 204):
            logger.error(
                "Profile update failed for %s: %s %s",
                user_id, resp.status_code, resp.text[:200],
            )
        else:
            logger.info("Profile updated for %s: %s", user_id, list(payload.keys()))
    except Exception as exc:
        logger.error("Profile update error for %s: %s", user_id, exc)


# ── Stripe client helper ───────────────────────────────────────────────────────

def _init_stripe() -> None:
    s = get_settings()
    if not s.stripe_secret_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured on this server.",
        )
    stripe.api_key = s.stripe_secret_key


# ── Routes ─────────────────────────────────────────────────────────────────────

class _CheckoutRequest(BaseModel):
    plan: str = "pro"


@router.post("/create-checkout")
async def create_checkout(
    user: Annotated[dict, Depends(get_current_user)],
    body: _CheckoutRequest = _CheckoutRequest(),
):
    """Create a Stripe Checkout Session for a Pro or Premium subscription.

    The client redirects to the returned URL. On success Stripe sends a
    webhook which upgrades the user's profile to the correct tier.
    """
    plan = body.plan if body.plan in ("pro", "premium") else "pro"
    s = get_settings()
    if not s.stripe_secret_key:
        logger.error("Stripe checkout called but STRIPE_SECRET_KEY is not set")
        return {
            "error": "stripe_checkout_failed",
            "message": "Unable to create checkout session",
        }
    _init_stripe()

    price_id = s.stripe_premium_price_id if plan == "premium" else s.stripe_pro_price_id
    price_id_env = "STRIPE_PREMIUM_PRICE_ID" if plan == "premium" else "STRIPE_PRO_PRICE_ID"
    if not price_id:
        logger.error("Stripe checkout called but %s is not set", price_id_env)
        return {
            "error": "stripe_checkout_failed",
            "message": "Unable to create checkout session",
        }

    user_id: str = user.get("sub", "")
    email: str | None = user.get("email")

    # Use server-configured origin — never trust client-supplied redirect URLs.
    origin = s.frontend_url

    # Reuse existing Stripe customer if we already created one
    profile_info = await _get_profile_stripe_info(user_id)
    customer_id: str | None = profile_info.get("stripe_customer_id")

    try:
        kwargs: dict = dict(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{origin}/dashboard?upgraded=1",
            cancel_url=f"{origin}/dashboard",
            metadata={"user_id": user_id, "plan": plan},
            subscription_data={"metadata": {"user_id": user_id, "plan": plan}},
            allow_promotion_codes=True,
        )
        if customer_id:
            kwargs["customer"] = customer_id
        elif email:
            kwargs["customer_email"] = email

        session = stripe.checkout.Session.create(**kwargs)
        logger.info(
            "Checkout session created | user=%s plan=%s customer=%s price=%s session=%s url=%s",
            user_id,
            plan,
            customer_id or "(new)",
            price_id,
            session.id,
            session.url,
        )
    except stripe.StripeError as exc:
        logger.error("Stripe checkout failed | user=%s error=%s", user_id, exc)
        return {
            "error": "stripe_checkout_failed",
            "message": "Unable to create checkout session",
        }
    except Exception as exc:
        logger.error("Unexpected checkout error | user=%s error=%s", user_id, exc)
        return {
            "error": "stripe_checkout_failed",
            "message": "Unable to create checkout session",
        }

    return {"url": session.url}


@router.post("/customer-portal")
async def customer_portal(
    user: Annotated[dict, Depends(get_current_user)],
):
    """Create a Stripe Billing Portal session so the user can manage their plan."""
    s = get_settings()
    _init_stripe()

    user_id: str = user.get("sub", "")
    profile_info = await _get_profile_stripe_info(user_id)
    customer_id: str | None = profile_info.get("stripe_customer_id")

    if not customer_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No billing account found. Please subscribe first.",
        )

    # Use server-configured origin — never trust client-supplied redirect URLs.
    origin = s.frontend_url

    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{origin}/dashboard",
        )
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

    Must use raw body bytes for signature verification — do NOT parse JSON
    before passing to construct_event.
    """
    s = get_settings()
    _init_stripe()
    if not s.stripe_webhook_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook secret not configured.",
        )

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, s.stripe_webhook_secret
        )
    except stripe.errors.SignatureVerificationError:
        logger.warning("Stripe webhook: invalid signature — possible replay/forgery")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid signature.")
    except Exception as exc:
        logger.error("Stripe webhook: bad payload: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid payload.")

    event_type: str = event["type"]
    obj: dict = event["data"]["object"]
    logger.info("Stripe webhook received: %s", event_type)

    try:
        if event_type == "checkout.session.completed":
            await _on_checkout_completed(obj)
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            await _on_subscription_updated(obj)
        elif event_type == "customer.subscription.deleted":
            await _on_subscription_deleted(obj)
        elif event_type == "invoice.payment_failed":
            await _on_payment_failed(obj)
        else:
            logger.debug("Stripe webhook: unhandled event %s", event_type)
    except Exception as exc:
        # Return 200 so Stripe stops retrying — log for investigation
        logger.error("Webhook handler error for %s: %s", event_type, exc)

    return {"received": True}


# ── Webhook event handlers ─────────────────────────────────────────────────────

async def _on_checkout_completed(session: dict) -> None:
    metadata = session.get("metadata", {})
    user_id: str | None = metadata.get("user_id")
    if not user_id:
        logger.warning("checkout.session.completed: missing user_id in metadata — skipping")
        return

    plan = metadata.get("plan", "pro")
    tier = "premium" if plan == "premium" else "pro"

    await _update_profile(user_id, {
        "stripe_customer_id": session.get("customer"),
        "stripe_subscription_id": session.get("subscription"),
        "subscription_tier": tier,
        "subscription_status": "active",
        "analyses_limit": 999999,
    })
    logger.info("User %s upgraded to %s via checkout", user_id, tier)


async def _on_subscription_updated(sub: dict) -> None:
    user_id: str | None = sub.get("metadata", {}).get("user_id")
    customer_id: str | None = sub.get("customer")
    sub_status: str = sub.get("status", "")
    period_end_ts: int | None = sub.get("current_period_end")

    # Fall back to customer lookup if metadata is missing
    if not user_id and customer_id:
        profile = await _get_profile_by_customer(customer_id)
        user_id = profile.get("id")

    if not user_id:
        logger.warning("subscription.updated: cannot resolve user_id for customer %s", customer_id)
        return

    plan = sub.get("metadata", {}).get("plan", "pro")
    active_tier = "premium" if plan == "premium" else "pro"
    tier = active_tier if sub_status in ("active", "trialing") else "free"
    update: dict = {
        "subscription_status": sub_status,
        "subscription_tier": tier,
    }
    if period_end_ts:
        update["current_period_end"] = datetime.fromtimestamp(
            period_end_ts, tz=timezone.utc
        ).isoformat()

    await _update_profile(user_id, update)


async def _on_subscription_deleted(sub: dict) -> None:
    user_id: str | None = sub.get("metadata", {}).get("user_id")
    customer_id: str | None = sub.get("customer")

    if not user_id and customer_id:
        profile = await _get_profile_by_customer(customer_id)
        user_id = profile.get("id")

    if not user_id:
        logger.warning("subscription.deleted: cannot resolve user_id for customer %s", customer_id)
        return

    await _update_profile(user_id, {
        "subscription_tier": "free",
        "subscription_status": "canceled",
        "stripe_subscription_id": None,
        "analyses_limit": 3,
    })
    logger.info("User %s subscription canceled — downgraded to free", user_id)


async def _on_payment_failed(invoice: dict) -> None:
    customer_id: str | None = invoice.get("customer")
    if not customer_id:
        return

    profile = await _get_profile_by_customer(customer_id)
    user_id: str | None = profile.get("id")
    if not user_id:
        return

    await _update_profile(user_id, {"subscription_status": "past_due"})
    logger.warning("Payment failed for user %s (customer %s)", user_id, customer_id)
