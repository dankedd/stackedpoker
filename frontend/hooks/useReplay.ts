"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { ReplayAnalysis, ReplayAction, ReplayFeedback } from "@/lib/types";

export interface VisibleBoard {
  flop: string[];
  turn: string[];
  river: string[];
}

export interface ReplayState {
  step: number;                        // -1 = before first action
  currentAction: ReplayAction | null;
  currentFeedback: ReplayFeedback | null;
  visibleBoard: VisibleBoard;
  currentPot: number;
  currentHeroStack: number | null;     // hero's stack after current action (BB); null = no data yet
  currentVillainStack: number | null;  // primary villain's stack after current action (BB)
  currentStreet: ReplayAction["street"];
  isPlaying: boolean;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
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

function getVisibleBoard(analysis: ReplayAnalysis, step: number): VisibleBoard {
  const seen = new Set(
    (analysis?.actions ?? []).slice(0, step + 1).map((a) => a.street)
  );
  const b = analysis?.hand_summary?.board ?? { flop: [], turn: [], river: [] };
  return {
    flop: seen.has("flop") || seen.has("turn") || seen.has("river") ? b.flop : [],
    turn: seen.has("turn") || seen.has("river") ? b.turn : [],
    river: seen.has("river") ? b.river : [],
  };
}

export function useReplay(
  analysis: ReplayAnalysis,
  autoPlayMs = 2500
): ReplayState & ReplayControls {
  const [step, setStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Defensive: actions may be undefined if backend returned a partial response
  const actions = analysis?.actions ?? [];
  const totalSteps = actions.length;

  const currentAction = step >= 0 && step < totalSteps ? actions[step] : null;

  // Most recent hero feedback at or before current step
  const currentFeedback = useMemo<ReplayFeedback | null>(() => {
    if (step < 0) return null;
    for (let i = step; i >= 0; i--) {
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

  const currentPot = currentAction?.pot_after ?? 1.5;

  // Dynamic stacks: use the per-action values from the pot engine when available.
  // Walk backwards to find the most recent action with stack data.
  const currentHeroStack = useMemo<number | null>(() => {
    if (step < 0) return null;
    for (let i = step; i >= 0; i--) {
      if (actions[i].hero_stack_after != null) return actions[i].hero_stack_after!;
    }
    return null;
  }, [step, actions]);

  const currentVillainStack = useMemo<number | null>(() => {
    if (step < 0) return null;
    for (let i = step; i >= 0; i--) {
      if (actions[i].villain_stack_after != null) return actions[i].villain_stack_after!;
    }
    return null;
  }, [step, actions]);

  const currentStreet: ReplayAction["street"] = currentAction?.street ?? "preflop";
  // step < 0 means we're in the pre-action state (before any action has been shown).
  // step=0 is the FIRST action and prev should be enabled there so the user
  // can navigate back to the preflop deal state (step=-1).
  const isFirst = step < 0;
  // Guard: when totalSteps=0 treat as isLast only when there truly are no actions.
  // Avoid (-1 >= -1) = TRUE which would permanently show "Replay Hand" on empty data.
  const isLast = totalSteps > 0 ? step >= totalSteps - 1 : false;
  const showVerdict = step >= totalSteps - 1 && totalSteps > 0;

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
    setStep(-1);
    setIsPlaying(false);
  }, [analysis]);

  // Dev-only diagnostics: log replay data on every new analysis
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
        "[Replay] actions array is empty — all replay controls will be inactive. " +
        "Check that the backend returned a populated actions[] in the replay response.",
      );
    } else {
      console.debug("[Replay] Replay initialization SUCCESS — ready to play", actions.length, "actions.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  // Dev-only: log stack/pot updates on every step change
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || step < 0) return;
    const a = actions[step];
    if (!a) return;
    console.debug(
      `[Replay] step ${step} processed — action: ${a.player} ${a.action}${a.amount ? " " + a.amount : ""}`,
      `| pot_after: ${currentPot.toFixed(2)}bb`,
      `| hero_stack: ${currentHeroStack != null ? currentHeroStack.toFixed(2) + "bb" : "n/a"}`,
      `| villain_stack: ${currentVillainStack != null ? currentVillainStack.toFixed(2) + "bb" : "n/a"}`,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goTo = useCallback(
    (n: number) => setStep(Math.max(-1, Math.min(n, totalSteps - 1))),
    [totalSteps]
  );
  const next = useCallback(
    () => setStep((s) => Math.min(s + 1, totalSteps - 1)),
    [totalSteps]
  );
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, -1)), []);
  const play = useCallback(() => {
    if (!isLast) setIsPlaying(true);
  }, [isLast]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const reset = useCallback(() => {
    setStep(-1);
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
