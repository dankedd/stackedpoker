"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscription, type Subscription } from "@/lib/entitlements";

/**
 * The one client-side hook for "what plan is this user on" — used by any
 * client component that needs to lock/unlock UI by tier (the module
 * overview's per-lesson locking, PlanBadge, etc.). Server Components should
 * keep reading profiles.subscription_tier directly (as dashboard/settings/
 * pricing already do) rather than pulling this hook in unnecessarily.
 */
export function useSubscription() {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user || !session) {
      setSubscription(null);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();
      setSubscription(getSubscription(data?.subscription_tier));
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { subscription, loading, refetch };
}
