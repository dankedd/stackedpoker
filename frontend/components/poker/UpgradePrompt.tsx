"use client";

import { createClient } from "@/lib/supabase/client";

// ── Shared checkout helper ─────────────────────────────────────────────────

export async function startCheckout(plan: "pro" | "premium" = "pro"): Promise<void> {
  // Open a blank tab NOW, synchronously, while still inside the user-interaction
  // event stack. Popup blockers only fire when window.open() is called after an
  // await (i.e. outside the original user gesture). By opening "about:blank" here
  // we secure a real tab reference before any async work, then navigate it once
  // we have the Stripe URL.
  const tab = window.open("about:blank", "_blank");
  console.log("[checkout] blank tab opened:", !!tab);

  try {
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
      body: JSON.stringify({ origin: window.location.origin, plan }),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[checkout] response:", data);

    if (!res.ok || data.error) {
      throw new Error(data.message ?? data.detail ?? "Failed to start checkout. Please try again.");
    }

    const url: string | undefined = data.url;
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      console.error("[checkout] invalid or missing URL in response:", data);
      throw new Error("Checkout failed — invalid redirect URL.");
    }

    if (tab && !tab.closed) {
      // Navigate the pre-opened tab — original tab stays put
      tab.location.href = url;
      console.log("[checkout] external tab navigated to Stripe");
    } else {
      // True fallback: popup was blocked and the user dismissed the notice
      console.warn("[checkout] popup blocked — same-tab fallback");
      window.location.href = url;
    }
  } catch (err) {
    // Avoid leaving an orphaned about:blank tab on errors
    if (tab && !tab.closed) tab.close();
    throw err;
  }
}
