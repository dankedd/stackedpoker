"use client";

import { useState, useCallback } from "react";
import { analyzeHand } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { AnalysisResponse } from "@/lib/types";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";

type Status = "idle" | "loading" | "success" | "error";

export function useAnalysis() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const analyze = useCallback(async (handText: string, setup?: AnalysisSetupValue) => {
    setStatus("loading");
    setError(null);
    setResult(null);
    setLimitReached(false);

    try {
      // Singleton client — same instance as AuthContext, shared refresh queue.
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (process.env.NODE_ENV === "development") {
        console.debug("[useAnalysis] session:", session ? "present" : "null",
          "| expires_at:", session?.expires_at,
          "| error:", sessionError?.message ?? "none");
      }

      if (sessionError || !session) {
        console.error("[useAnalysis] No session found — user must sign in.", sessionError);
        setError("Please sign in to analyze hands.");
        setStatus("error");
        return;
      }

      const data = await analyzeHand(handText, session.access_token, setup);
      setResult(data);
      setStatus("success");
    } catch (err) {
      const e = err as Error & { detail?: { code?: string; used?: number; limit?: number } };
      const isLimit = e.detail?.code === "limit_reached";
      setLimitReached(isLimit);

      const rawMsg = e.message ?? "";
      let friendlyMsg: string;
      if (rawMsg.includes("Invalid token") || rawMsg.includes("Token expired") || rawMsg.includes("Not authenticated")) {
        friendlyMsg = "Your session expired. Please sign in again.";
      } else if (rawMsg.includes("fetch") || rawMsg.includes("Failed to fetch") || rawMsg.includes("NetworkError")) {
        friendlyMsg = "Connection failed. Please check your internet and try again.";
      } else if (isLimit) {
        friendlyMsg = rawMsg;
      } else {
        friendlyMsg = rawMsg || "Something went wrong during analysis.";
      }

      setError(friendlyMsg);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setLimitReached(false);
  }, []);

  return { status, result, error, limitReached, analyze, reset };
}
