"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  submitSolverJob,
  getSolverJobStatus,
  getSolverStrategy,
  getSolverTree,
  getSolverNode,
  SolverPriority,
  type SolverJobSubmission,
  type SolverStrategy,
  type SolverTreeMeta,
  type SolverNodeResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ── Map tree node → SolverStrategy ──────────────────────────────────────────
// Used so SolverPanel reads from the same source of truth as the tree explorer.

function nodeToStrategy(
  node: SolverNodeResponse,
  treeMeta: SolverTreeMeta,
  jobId: string,
): SolverStrategy {
  const player = node.actor ?? "oop";

  const frequencies: Record<string, number> = {};
  for (const a of node.available_actions) {
    frequencies[a.label] = a.frequency ?? 0;
  }

  const combos = Object.entries(node.strategy).map(([hand, freqs]) => {
    const comboActions: Record<string, number> = {};
    node.available_actions.forEach((a, i) => {
      comboActions[a.label] = freqs[i] ?? 0;
    });
    return { hand, actions: comboActions, equity: null as null, ev: null as null };
  });

  const preferred = [...node.available_actions].sort(
    (a, b) => (b.frequency ?? 0) - (a.frequency ?? 0),
  )[0]?.label ?? "";

  return {
    status: "ready",
    mode: "live",
    source: "texassolver",
    job_id: jobId,
    frequencies,
    ev: {},
    preferred_action: preferred,
    hero_action_ev_loss: 0,
    iterations: 0,
    exploitability: 0,
    solve_time_ms: 0,
    node_description: node.metadata.human_path,
    street_supported: true,
    strategies: {
      [player]: {
        position: player.toUpperCase(),
        actions: node.available_actions.map((a) => a.label),
        frequencies,
        preferred_action: preferred,
        combo_count: node.metadata.combo_count,
        combos,
      },
    },
    board: node.board,
    spot_type: "",
    positions: "",
    nodes_parsed: treeMeta.total_nodes,
    nodes_imported: treeMeta.total_nodes,
  };
}

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

      // Primary: use tree API — same source of truth as the tree explorer.
      // This guarantees SolverPanel and SolverReplay show identical frequencies.
      try {
        const treeMeta = await getSolverTree(id, token);
        const rootNode = await getSolverNode(id, treeMeta.root_node_id, token);
        const data = nodeToStrategy(rootNode, treeMeta, id);
        console.log("[Solver] Tree node strategy:", {
          nodeId: rootNode.id,
          street: rootNode.street,
          board: rootNode.board,
          actions: Object.keys(data.frequencies),
          frequencies: data.frequencies,
        });
        setStrategy(data);
        setState("completed");
        stopPolling();
        return;
      } catch (treeErr) {
        // Tree not imported yet — fall back to legacy strategy endpoint.
        console.warn("[Solver] Tree API unavailable, falling back to /strategy:", treeErr);
      }

      // Fallback: legacy parser-based strategy endpoint.
      try {
        const data = await getSolverStrategy(id, token);
        if (data.status === "ready") {
          console.log("[Solver] Legacy strategy received:", {
            actions: Object.keys(data.frequencies),
            frequencies: data.frequencies,
            mode: data.mode,
          });
          setStrategy(data);
          setState("completed");
          stopPolling();
        } else if (data.status === "solving") {
          console.log("[Solver] Still solving...");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.includes("409") || msg.includes("not available")) {
          console.warn("[Solver] Strategy endpoint returned error, stopping:", msg);
          setState("failed");
          setError(msg || "Strategy data not available");
          stopPolling();
        }
        // Network errors — keep polling
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
        const treeMeta = await getSolverTree(id, token);
        const rootNode = await getSolverNode(id, treeMeta.root_node_id, token);
        setStrategy(nodeToStrategy(rootNode, treeMeta, id));
      } catch {
        // Fall back to legacy endpoint
        try {
          const data = await getSolverStrategy(id, token);
          setStrategy(data);
        } catch (e: unknown) {
          setState("error");
          setError(e instanceof Error ? e.message : "Failed to load strategy");
        }
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
