"use client";

import { useState, useCallback } from "react";
import { analyzeSession } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { SessionAnalysisResponse } from "@/lib/types";

type Status = "idle" | "loading" | "success" | "error";

export interface SessionAnalysisState {
  status: Status;
  result: SessionAnalysisResponse | null;
  error: string | null;
  analyze: (sessionText: string, setup?: { gameType?: string; playerCount?: number }) => Promise<void>;
  reset: () => void;
}

export function useSessionAnalysis(): SessionAnalysisState {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SessionAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (
    sessionText: string,
    setup?: { gameType?: string; playerCount?: number },
  ) => {
    const token = session?.access_token;
    if (!token) {
      setError("Please sign in to analyze sessions.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const data = await analyzeSession(sessionText, token, setup);
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Session analysis failed.";
      setError(msg);
      setStatus("error");
    }
  }, [session]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, analyze, reset };
}
