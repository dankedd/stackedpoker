"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { ReplayAnalysis, ReplayAction, ReplayFeedback, SidePot } from "@/lib/types";

export interface VisibleBoard {
  flop: string[];
  turn: string[];
  river: string[];
}

/**
 * Canonical replay step semantics:
 *
 *   step = 0          Clean table: blinds posted, cards dealt, NO voluntary actions.
 *   step = 1          actions[0] has been applied (first voluntary action shown).
 *   step = N          actions[0..N-1] have been applied.
 *   step = totalSteps All actions applied; verdict is shown.
 *
 * Rendering rule: apply actions[0 : step] (exclusive end).
 *   currentAction = actions[step - 1]  (most recently applied action, or null at step=0)
 *   foldedAtStep   = 0-based index in actions[]
 *   isFoldingNow   = foldedAtStep === step - 1  (fold is the CURRENT action)
 *   isFoldedPast   = foldedAtStep <  step - 1  (fold happened before current action)
 *
 * This eliminates the sentinel step=-1 and makes the clean initial state explicit.
 */
export interface ReplayState {
  step: number;                        // 0 = clean, N = N actions applied
  currentAction: ReplayAction | null;  // actions[step-1], or null at step=0
  currentFeedback: ReplayFeedback | null;
  visibleBoard: VisibleBoard;
  currentPot: number;
  currentHeroStack: number | null;
  currentVillainStack: number | null;
  currentPlayerStacks: Record<string, number> | null;
  currentAllInPlayers: string[];
  currentSidePots: SidePot[];
  currentStreet: ReplayAction["street"];
  isPlaying: boolean;
  totalSteps: number;
  isFirst: boolean;                    // true iff step === 0
  isLast: boolean;                     // true iff step === totalSteps
  showVerdict: boolean;
}

export interface ReplayControls {
  goTo: (n: number) => void;
  next: () => void;
  prev: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
}

// ── Board visibility ───────────────────────────────────────────────────────────
// Reveal streets for the first `step` actions (actions[0..step-1]).

function getVisibleBoard(analysis: ReplayAnalysis, step: number): VisibleBoard {
  const seen = new Set(
    (analysis?.actions ?? []).slice(0, step).map((a) => a.street)
  );
  const b = analysis?.hand_summary?.board ?? { flop: [], turn: [], river: [] };
  return {
    flop:  seen.has("flop")  || seen.has("turn") || seen.has("river") ? b.flop  : [],
    turn:  seen.has("turn")  || seen.has("river") ? b.turn  : [],
    river: seen.has("river") ? b.river : [],
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useReplay(
  analysis: ReplayAnalysis,
  autoPlayMs = 2500
): ReplayState & ReplayControls {
  // step=0 → clean state (no actions applied yet)
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const actions = analysis?.actions ?? [];
  const totalSteps = actions.length;

  // The most recently applied action is at index step-1.
  // At step=0 there is no current action.
  const currentAction = step > 0 && step <= totalSteps ? actions[step - 1] : null;

  // Most recent hero feedback among applied actions (actions[0..step-1])
  const currentFeedback = useMemo<ReplayFeedback | null>(() => {
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].is_hero && actions[i].feedback) {
        return actions[i].feedback!;
      }
    }
    return null;
  }, [step, actions]);

  const visibleBoard = useMemo(
    () => getVisibleBoard(analysis, step),
    [analysis, step]
  );

  // Pot: sum of all applied actions' contributions; fall back to blind pot (1.5bb)
  const currentPot = currentAction?.pot_after ?? 1.5;

  // Dynamic stacks: walk backward through applied actions to find the most recent value
  const currentHeroStack = useMemo<number | null>(() => {
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].hero_stack_after != null) return actions[i].hero_stack_after!;
    }
    return null;
  }, [step, actions]);

  const currentVillainStack = useMemo<number | null>(() => {
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].villain_stack_after != null) return actions[i].villain_stack_after!;
    }
    return null;
  }, [step, actions]);

  const currentPlayerStacks = useMemo<Record<string, number> | null>(() => {
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].player_stacks_after != null) return actions[i].player_stacks_after!;
    }
    return null;
  }, [step, actions]);

  const currentAllInPlayers = useMemo<string[]>(() => {
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].all_in_players && actions[i].all_in_players!.length > 0) {
        return actions[i].all_in_players!;
      }
    }
    return [];
  }, [step, actions]);

  const currentSidePots = useMemo<SidePot[]>(() => {
    return currentAction?.side_pots ?? [];
  }, [currentAction]);

  const currentStreet: ReplayAction["street"] = currentAction?.street ?? "preflop";

  const isFirst = step === 0;
  const isLast  = totalSteps > 0 ? step >= totalSteps : false;
  const showVerdict = step >= totalSteps && totalSteps > 0;

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;
    if (isLast) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), autoPlayMs);
    return () => clearTimeout(t);
  }, [isPlaying, isLast, autoPlayMs]);

  // Reset when analysis changes (new upload)
  useEffect(() => {
    setStep(0);
    setIsPlaying(false);
  }, [analysis]);

  // Dev diagnostics — log analysis on load
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const streets = [...new Set(actions.map((a) => a.street))];
    const hasStackData = actions.some(
      (a) => a.hero_stack_after != null || a.villain_stack_after != null
    );
    console.debug(
      "[Replay] analysis received —",
      "actions:", actions.length,
      "| streets:", streets.join(", ") || "none",
      "| heroCards:", analysis?.hand_summary?.hero_cards?.join(" ") ?? "?",
      "| position:", analysis?.hand_summary?.hero_position ?? "?",
      "| stackDataPresent:", hasStackData,
    );
    if (actions.length === 0) {
      console.warn(
        "[Replay] actions array is empty — all replay controls will be inactive.",
      );
    } else {
      console.debug(
        "[Replay] Replay ready — step=0 (clean state), totalSteps:", actions.length,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  // Dev diagnostics — log each step transition
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || step === 0) return;
    const a = actions[step - 1];
    if (!a) return;
    console.debug(
      `[Replay] step ${step}/${totalSteps} — applied: ${a.player} ${a.action}${a.amount ? " " + a.amount : ""}`,
      `| pot_after: ${currentPot.toFixed(2)}bb`,
      `| hero_stack: ${currentHeroStack != null ? currentHeroStack.toFixed(2) + "bb" : "n/a"}`,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goTo   = useCallback(
    (n: number) => setStep(Math.max(0, Math.min(n, totalSteps))),
    [totalSteps]
  );
  const next   = useCallback(
    () => setStep((s) => Math.min(s + 1, totalSteps)),
    [totalSteps]
  );
  const prev   = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const play   = useCallback(() => {
    if (!isLast) setIsPlaying(true);
  }, [isLast]);
  const pause  = useCallback(() => setIsPlaying(false), []);
  const reset  = useCallback(() => {
    setStep(0);
    setIsPlaying(false);
  }, []);

  return {
    step,
    currentAction,
    currentFeedback,
    visibleBoard,
    currentPot,
    currentHeroStack,
    currentVillainStack,
    currentPlayerStacks,
    currentAllInPlayers,
    currentSidePots,
    currentStreet,
    isPlaying,
    totalSteps,
    isFirst,
    isLast,
    showVerdict,
    goTo,
    next,
    prev,
    play,
    pause,
    reset,
  };
}
