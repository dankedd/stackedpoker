"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  submitSolverJob,
  getSolverJobStatus,
  getSolverStrategy,
  SolverPriority,
  type SolverJobSubmission,
  type SolverStrategy,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type SolverState =
  | "idle"
  | "submitting"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "error";

interface UseSolverReturn {
  state: SolverState;
  strategy: SolverStrategy | null;
  jobId: string | null;
  error: string | null;
  /** Submit a new solve job and start polling. */
  solve: (config: SolverJobSubmission["config"]) => Promise<void>;
  /** Load strategy for an existing completed job. */
  loadStrategy: (jobId: string) => Promise<void>;
  /** Reset to idle state. */
  reset: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200; // 10 minutes at 3s intervals

export function useSolver(): UseSolverReturn {
  const { session } = useAuth();
  const [state, setState] = useState<SolverState>("idle");
  const [strategy, setStrategy] = useState<SolverStrategy | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    attemptRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const fetchStrategy = useCallback(
    async (id: string) => {
      const token = session?.access_token;
      if (!token) return;
      try {
        const data = await getSolverStrategy(id, token);
        if (data.status === "ready") {
          console.log("[Solver] Strategy received:", {
            actions: Object.keys(data.frequencies),
            frequencies: data.frequencies,
            combos: Object.values(data.strategies ?? {}).map(s => s.combo_count),
            mode: data.mode,
          });
          setStrategy(data);
          setState("completed");
          stopPolling();
        } else if (data.status === "solving") {
          console.log("[Solver] Still solving...");
        }
      } catch (err: unknown) {
        // 404/409 = strategy not available — stop polling permanently
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.includes("409") || msg.includes("not available")) {
          console.warn("[Solver] Strategy endpoint returned error, stopping:", msg);
          setState("failed");
          setError(msg || "Strategy data not available");
          stopPolling();
        }
        // Other errors (network) — keep polling
      }
    },
    [session, stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      const token = session?.access_token;
      if (!token) return;

      pollRef.current = setInterval(async () => {
        attemptRef.current += 1;
        if (attemptRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setState("error");
          setError("Solve timed out — took too long to complete");
          return;
        }

        try {
          const status = await getSolverJobStatus(id, token);
          console.log("[Solver] Poll #%d: status=%s", attemptRef.current, status.status);
          if (status.status === "completed") {
            await fetchStrategy(id);
            // fetchStrategy sets state to "completed" on success
          } else if (status.status === "failed" || status.status === "cancelled") {
            setState("failed");
            setError(status.error || "Solve failed");
            stopPolling();
          } else if (status.status === "running") {
            setState("running");
          }
        } catch {
          // Network error — retry on next poll
        }
      }, POLL_INTERVAL_MS);
    },
    [session, stopPolling, fetchStrategy],
  );

  const solve = useCallback(
    async (config: SolverJobSubmission["config"]) => {
      const token = session?.access_token;
      if (!token) {
        setError("Not authenticated");
        return;
      }

      setState("submitting");
      setError(null);
      setStrategy(null);

      try {
        const resp = await submitSolverJob(
          { config, priority: SolverPriority.HIGH },
          token,
        );
        if (!resp.job_id) {
          setState("error");
          setError(resp.message || "Failed to submit job");
          return;
        }
        console.log("[Solver] Job submitted:", resp.job_id, "board:", config.board);
        setJobId(resp.job_id);
        setState("queued");
        startPolling(resp.job_id);
      } catch (e: unknown) {
        setState("error");
        setError(e instanceof Error ? e.message : "Failed to submit solve job");
      }
    },
    [session, startPolling],
  );

  const loadStrategy = useCallback(
    async (id: string) => {
      const token = session?.access_token;
      if (!token) return;

      setJobId(id);
      setState("completed");
      try {
        const data = await getSolverStrategy(id, token);
        setStrategy(data);
      } catch (e: unknown) {
        setState("error");
        setError(e instanceof Error ? e.message : "Failed to load strategy");
      }
    },
    [session],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState("idle");
    setStrategy(null);
    setJobId(null);
    setError(null);
  }, [stopPolling]);

  return { state, strategy, jobId, error, solve, loadStrategy, reset };
}
