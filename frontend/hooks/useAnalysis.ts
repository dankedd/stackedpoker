"use client";

import { useState, useCallback } from "react";
import { analyzeHand } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { AnalysisResponse } from "@/lib/types";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";

type Status = "idle" | "loading" | "success" | "error";

export function useAnalysis() {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const analyze = useCallback(async (handText: string, setup?: AnalysisSetupValue) => {
    const token = session?.access_token;
    if (!token) {
      setError("Please sign in to analyze hands.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setResult(null);
    setLimitReached(false);

    try {
      const data = await analyzeHand(handText, token, setup);
      setResult(data);
      setStatus("success");
    } catch (err) {
      const e = err as Error & { detail?: { code?: string; used?: number; limit?: number } };
      const isLimit = e.detail?.code === "limit_reached";
      setLimitReached(isLimit);
      setError(e.message ?? "Analysis failed");
      setStatus("error");
    }
  }, [session]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setLimitReached(false);
  }, []);

  return { status, result, error, limitReached, analyze, reset };
}
