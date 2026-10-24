"use client";

import { createClient } from "@/lib/supabase/client";
import { rememberCheckoutSource } from "@/lib/metaPixel";
import type { UpgradeSource } from "@/lib/billing/entitlements";

// ── Shared checkout helper ─────────────────────────────────────────────────

/** Thrown when the account already has Pro — the caller should refresh, not retry. */
export class AlreadySubscribedError extends Error {}

/**
 * Creates a Stripe Checkout session for Pro and returns its URL. `source` is
 * the upgrade moment (hand_limit, upload_limit, …); the server validates it
 * and stores it with the subscription. `promo` is a Stripe promotion code to
 * pre-apply (campaign emails); the server ignores it unless it is active.
 */
export async function requestCheckoutUrl(source: UpgradeSource = "pricing_page", promo?: string): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated — please sign in again.");

  const res = await fetch("/api/stripe/create-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(promo ? { source, promo } : { source }),
  });

  const data = await res.json().catch(() => ({}));
  if (data.error === "already_subscribed") throw new AlreadySubscribedError(data.message);
  if (!res.ok || data.error) {
    throw new Error(data.message ?? data.detail ?? "Failed to start checkout. Please try again.");
  }

  const url: string | undefined = data.url;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("Checkout failed — invalid redirect URL.");
  }
  rememberCheckoutSource(source);
  return url;
}

/** Opens Stripe Checkout for Pro in a new tab (see requestCheckoutUrl). */
export async function startCheckout(source: UpgradeSource = "pricing_page"): Promise<void> {
  // Open a blank tab NOW, synchronously, while still inside the user-interaction
  // event stack. Popup blockers only fire when window.open() is called after an
  // await (i.e. outside the original user gesture). By opening "about:blank" here
  // we secure a real tab reference before any async work, then navigate it once
  // we have the Stripe URL.
  const tab = window.open("about:blank", "_blank");

  try {
    const url = await requestCheckoutUrl(source);
    if (tab && !tab.closed) {
      // Navigate the pre-opened tab — original tab stays put
      tab.location.href = url;
    } else {
      // True fallback: popup was blocked and the user dismissed the notice
      window.location.href = url;
    }
  } catch (err) {
    // Avoid leaving an orphaned about:blank tab on errors
    if (tab && !tab.closed) tab.close();
    throw err;
  }
}
