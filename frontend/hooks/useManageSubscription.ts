"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPortalSession } from "@/lib/api";

/** Opens Stripe's billing portal in a new tab. Shared by every "manage
 *  subscription" entry point (billing card button, account dropdown, ...)
 *  so there's exactly one implementation of the popup-blocker-safe
 *  open-then-navigate dance. */
export function useManageSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManage() {
    setError(null);
    setLoading(true);

    // Open blank tab synchronously (within user-interaction event stack) to
    // avoid popup blockers, then navigate it once we have the portal URL.
    const tab = window.open("about:blank", "_blank");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const { url } = await createPortalSession(token);

      if (tab && !tab.closed) {
        tab.location.href = url;
        setLoading(false);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      setError(err instanceof Error ? err.message : "Failed to open billing portal.");
      setLoading(false);
    }
  }

  return { handleManage, loading, error };
}
