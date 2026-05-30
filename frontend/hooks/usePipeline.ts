"use client";

import { useState, useCallback } from "react";
import { prepareHand, analyzeCanonical } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { PipelineResult } from "@/lib/hand-schema";
import type { AnalysisResponse } from "@/lib/types";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";

// Confidence threshold: below this, we show repair UI even if no hard errors.
const MIN_AUTO_ANALYZE_CONFIDENCE = 0.72;

export type PipelineStage =
  | "idle"          // nothing submitted
  | "preparing"     // POST /pipeline/prepare in flight
  | "repairing"     // repair UI shown (validation failed or low confidence)
  | "analyzing"     // POST /pipeline/analyze in flight
  | "success"       // analysis complete
  | "error";        // unrecoverable error

export interface UsePipelineReturn {
  stage: PipelineStage;
  pipeline: PipelineResult | null;    // last prepare result
  result: AnalysisResponse | null;    // last analysis result
  error: string | null;

  // Actions
  prepare: (handText: string, debug?: boolean) => Promise<void>;
  analyze: (
    pipeline: PipelineResult,
    setup?: AnalysisSetupValue,
  ) => Promise<void>;
  acceptRepair: (repaired: PipelineResult) => void;
  reset: () => void;
}

/**
 * Manages the full 2-step pipeline state machine:
 *
 *   prepare → [auto-analyze if valid] OR [show repair UI]
 *         ↓ after repair
 *   analyze → success | error
 *
 * Pass { skipAnalyze: true } to skip the heuristic analyze step entirely.
 * In that mode, prepare() advances to "success" with result=null as soon as
 * the canonical hand is validated. The caller is responsible for driving the
 * next step (e.g. launching the solver). analyze() becomes a no-op that only
 * sets stage="success", so repair-UI callers work unchanged.
 */
export function usePipeline(options?: { skipAnalyze?: boolean }): UsePipelineReturn {
  const skipAnalyze = options?.skipAnalyze ?? false;
  const [stage, setStage]       = useState<PipelineStage>("idle");
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [result, setResult]     = useState<AnalysisResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setPipeline(null);
    setResult(null);
    setError(null);
  }, []);

  // ── Step 1: Prepare ────────────────────────────────────────────────────────
  const prepare = useCallback(async (
    handText: string,
    debug = false,
  ): Promise<void> => {
    setStage("preparing");
    setError(null);
    setPipeline(null);
    setResult(null);

    // ── Frontend guard: reject obviously empty/short input ────────────
    const trimmed = handText.trim();
    if (!trimmed) {
      setError("Please paste a hand history before analyzing.");
      setStage("error");
      return;
    }
    if (trimmed.length < 30) {
      setError("Input is too short to be a valid hand history. Please paste the complete hand.");
      setStage("error");
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setError("Please sign in to analyze hands.");
        setStage("error");
        return;
      }
      const token = session.access_token;
      const pipelineResult = await prepareHand(trimmed, token, debug);
      setPipeline(pipelineResult);

      const { validation } = pipelineResult;

      // Decide: auto-analyze, skip to success, or show repair UI
      if (
        validation.can_analyze &&
        validation.confidence >= MIN_AUTO_ANALYZE_CONFIDENCE
      ) {
        if (skipAnalyze) {
          // Solver-first mode: skip heuristic analysis, jump straight to success.
          // The caller's useEffect watches stage === "success" and fires the solver.
          setStage("success");
        } else {
          // High-quality hand → auto-proceed to analyze (reuse same token)
          setStage("analyzing");
          await _runAnalysis(pipelineResult, token, undefined, setResult, setStage, setError);
        }
      } else {
        // Needs user review
        setStage("repairing");
      }
    } catch (err) {
      const msg = _extractErrorMessage(err);
      setError(msg);
      setStage("error");
    }
  }, []);

  // ── Step 2: Analyze (from repair UI or direct call) ───────────────────────
  const analyze = useCallback(async (
    pipelineResult: PipelineResult,
    setup?: AnalysisSetupValue,
  ): Promise<void> => {
    setPipeline(pipelineResult);

    if (!pipelineResult.validation.can_analyze) {
      setError(
        "Analysis is blocked. Please fix all validation errors in the repair UI before proceeding.",
      );
      setStage("repairing");
      return;
    }

    // Solver-first mode: repair UI calls analyze() to confirm the hand.
    // Skip the backend call — just advance to success so the solver can start.
    if (skipAnalyze) {
      setError(null);
      setStage("success");
      return;
    }

    setStage("analyzing");
    setError(null);

    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setError("Session expired. Please sign in again.");
      setStage("error");
      return;
    }

    await _runAnalysis(pipelineResult, session.access_token, setup, setResult, setStage, setError);
  }, [skipAnalyze]);

  // ── Accept a repair from the UI ───────────────────────────────────────────
  const acceptRepair = useCallback((repaired: PipelineResult) => {
    setPipeline(repaired);
    // Caller should call analyze() next if they want to proceed
  }, []);

  return { stage, pipeline, result, error, prepare, analyze, acceptRepair, reset };
}

// ── Shared analysis runner ────────────────────────────────────────────────────

async function _runAnalysis(
  pipelineResult: PipelineResult,
  token: string,
  setup: AnalysisSetupValue | undefined,
  setResult: (r: AnalysisResponse) => void,
  setStage: (s: PipelineStage) => void,
  setError: (e: string) => void,
): Promise<void> {
  try {
    const analysisResult = await analyzeCanonical(
      pipelineResult.canonical,
      pipelineResult.validation,
      token,
      setup ? { gameType: setup.gameType, playerCount: setup.playerCount } : undefined,
    );
    setResult(analysisResult);
    setStage("success");
  } catch (err) {
    const msg = _extractErrorMessage(err);
    // If blocked by validation gate (422 with blocked:true), go to repair
    if (_isValidationBlock(err)) {
      setError(msg);
      setStage("repairing");
    } else {
      setError(msg);
      setStage("error");
    }
  }
}

function _extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Try to extract the structured detail.message if present
    const detail = (err as Error & { detail?: unknown }).detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return (detail as { message: string }).message;
    }
    return err.message;
  }
  return String(err);
}

function _isValidationBlock(err: unknown): boolean {
  if (err instanceof Error) {
    const detail = (err as Error & { detail?: unknown }).detail;
    if (detail && typeof detail === "object" && "blocked" in detail) {
      return (detail as { blocked: boolean }).blocked === true;
    }
  }
  return false;
}
