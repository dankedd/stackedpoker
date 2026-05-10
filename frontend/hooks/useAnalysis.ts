"use client";

import { useState, useCallback } from "react";
import { analyzeHand } from "@/lib/api";
import type { AnalysisResponse } from "@/lib/types";

type Status = "idle" | "loading" | "success" | "error";

export function useAnalysis() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (handText: string) => {
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const data = await analyzeHand(handText);
      setResult(data);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, analyze, reset };
}
