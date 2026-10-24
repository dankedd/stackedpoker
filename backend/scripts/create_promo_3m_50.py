"""Creates the Stripe coupon + promotion code for the 'promo_3m_50' email.

    €4.00 off the Pro price (€7.99, VAT included) for 3 monthly invoices, so
    the first 3 months cost exactly €3.99; then the regular €7.99. A fixed
    amount rather than percent_off: 50% of €7.99 is €3.995, which Stripe would
    round. Redeemable for 7 days from when this runs — run it right before
    the real send. The Pro price itself is not touched.

    The promotion code is restricted to first-time customers, so Stripe also
    refuses it to anyone who paid before; the coupon only applies to the Pro
    product.

    cd backend
    python scripts/create_promo_3m_50.py            # dry run: shows what it would create
    python scripts/create_promo_3m_50.py --create   # creates it in Stripe

Needs STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID (environment or backend/.env).
Safe to re-run: if the code already exists it is shown and nothing is created.
Never prints the key.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import stripe  # noqa: E402

from app.config import get_settings  # noqa: E402

CAMPAIGN = "promo_3m_50"
CODE = "STACKED50"
AMOUNT_OFF_CENTS = 400
MONTHS = 3
VALID_DAYS = 7


def _when(ts: int | None) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if ts else "never"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--create", action="store_true", help="really create the coupon and promotion code")
    args = parser.parse_args()

    s = get_settings()
    missing = [n for n, v in (("STRIPE_SECRET_KEY", s.stripe_secret_key), ("STRIPE_PRO_PRICE_ID", s.stripe_pro_price_id)) if not v]
    if missing:
        print(f"Missing: {', '.join(missing)}. Nothing done.")
        return 1
    stripe.api_key = s.stripe_secret_key
    mode = "LIVE" if s.stripe_secret_key.startswith(("sk_live_", "rk_live_")) else "test"
    print(f"Stripe mode: {mode}")

    existing = stripe.PromotionCode.list(code=CODE, limit=1).data
    if existing:
        pc = existing[0]
        print(f"Promotion code {CODE} already exists ({pc.id}): active={pc.active}, expires {_when(pc.expires_at)}, coupon {pc.coupon.id}.")
        print("Nothing created.")
        return 0

    price = stripe.Price.retrieve(s.stripe_pro_price_id)
    if price.unit_amount is None or price.unit_amount <= AMOUNT_OFF_CENTS:
        print(f"Unexpected Pro price amount {price.unit_amount}. Nothing done.")
        return 1
    first_months = price.unit_amount - AMOUNT_OFF_CENTS
    expires = datetime.now(timezone.utc) + timedelta(days=VALID_DAYS)
    expires_ts = int(expires.timestamp())

    print(f"Pro price {price.id}: {price.unit_amount / 100:.2f} {price.currency.upper()}/{(price.recurring or {}).get('interval')}, "
          f"tax_behavior={price.tax_behavior}, product {price.product}")
    if price.tax_behavior != "inclusive":
        print("WARNING: the price is not tax-inclusive, so the customer would pay more than the amount shown.")
    print(f"Coupon:          {AMOUNT_OFF_CENTS / 100:.2f} {price.currency.upper()} off, {MONTHS} months, Pro product only, redeem by {_when(expires_ts)}")
    print(f"Promotion code:  {CODE}, first-time customers only, expires {_when(expires_ts)}")
    print(f"Customer pays:   {first_months / 100:.2f} for {MONTHS} months, then {price.unit_amount / 100:.2f}")

    if not args.create:
        print("\nDry run — nothing created. Add --create to create it.")
        return 0

    metadata = {"campaign": CAMPAIGN}
    coupon = stripe.Coupon.create(
        name=f"Pro: {MONTHS} months at €{first_months / 100:.2f}",
        amount_off=AMOUNT_OFF_CENTS,
        currency=price.currency,
        duration="repeating",
        duration_in_months=MONTHS,
        redeem_by=expires_ts,
        applies_to={"products": [price.product]},
        metadata=metadata,
    )
    promo = stripe.PromotionCode.create(
        coupon=coupon.id,
        code=CODE,
        expires_at=expires_ts,
        restrictions={"first_time_transaction": True},
        metadata=metadata,
    )
    print(f"\nCreated coupon {coupon.id} and promotion code {promo.code} ({promo.id}), expires {_when(promo.expires_at)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
