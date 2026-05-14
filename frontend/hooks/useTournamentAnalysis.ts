"use client";

import { useState, useCallback } from "react";
import { analyzeTournament } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { TournamentAnalysisResponse } from "@/lib/types";

type Status = "idle" | "loading" | "success" | "error";

export interface TournamentAnalysisState {
  status: Status;
  result: TournamentAnalysisResponse | null;
  error: string | null;
  analyze: (
    tournamentText: string,
    setup?: { tournamentType?: string; fieldSize?: string; buyIn?: string },
  ) => Promise<void>;
  reset: () => void;
}

export function useTournamentAnalysis(): TournamentAnalysisState {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TournamentAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      tournamentText: string,
      setup?: { tournamentType?: string; fieldSize?: string; buyIn?: string },
    ) => {
      const token = session?.access_token;
      if (!token) {
        setError("Please sign in to analyze tournaments.");
        setStatus("error");
        return;
      }

      setStatus("loading");
      setError(null);
      setResult(null);

      try {
        const data = await analyzeTournament(tournamentText, token, setup);
        setResult(data);
        setStatus("success");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Tournament analysis failed.";
        setError(msg);
        setStatus("error");
      }
    },
    [session],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, analyze, reset };
}
