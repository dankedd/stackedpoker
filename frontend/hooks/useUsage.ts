"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UsageData {
  plan: string;          // 'free' | 'pro' | 'admin'
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  isOverLimit: boolean;
}

export function useUsage() {
  const { user, session } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!user || !session) {
      setUsage(null);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, hands_analyzed_count, analyses_limit")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        setUsage(null);
        return;
      }

      const plan: string = data.subscription_tier ?? "free";
      const used: number = data.hands_analyzed_count ?? 0;
      const limit: number = data.analyses_limit ?? 3;
      const isUnlimited = plan === "admin" || plan === "pro";

      setUsage({
        plan,
        used,
        limit,
        remaining: isUnlimited ? Infinity : Math.max(0, limit - used),
        isUnlimited,
        isOverLimit: !isUnlimited && used >= limit,
      });
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { usage, loading, refetch: fetchUsage };
}
