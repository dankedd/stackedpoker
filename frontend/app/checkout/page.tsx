import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutRedirect } from "./CheckoutRedirect";

/**
 * /checkout?source=<upgrade moment>[&promo=<code>] — a link that lands
 * straight in Stripe Checkout for Pro (the only plan, €7.99/month). Used
 * where a button can't start checkout itself, e.g. the trial-ending email.
 * `promo` pre-applies a Stripe promotion code (the promo_3m_50 email).
 * Signed-out visitors sign in first and come back here.
 */

export const metadata: Metadata = {
  title: "Upgrade to Pro",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutRedirect />
    </Suspense>
  );
}
