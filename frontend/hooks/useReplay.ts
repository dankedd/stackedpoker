"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { ReplayAnalysis, ReplayAction, ReplayFeedback, SidePot } from "@/lib/types";
import type { CanonicalHand } from "@/lib/hand-schema";
import { ReplayEngine, validateReplayability } from "@/lib/replay/replayEngine";
import type { ReplayEngineState } from "@/lib/replay/replayEngine";

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
  // Engine state (present when canonical hand is provided)
  engineState: ReplayEngineState | null;
  /** Villain bet/raise that hero is currently responding to (null if not facing aggression). */
  pendingAggression: ReplayAction | null;
}

export interface ReplayControls {
  goTo: (n: number) => void;
  next: () => void;
  prev: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  jumpToStreet: (street: ReplayAction["street"]) => void;
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

/**
 * useReplay — manages replay playback state.
 *
 * When `canonicalHand` is provided, a `ReplayEngine` drives deterministic state
 * (correct poker action ordering, authoritative pot/stack data from canonical schema).
 * The `engineState` field is populated in this case.
 *
 * Without `canonicalHand`, the legacy step-based behavior is used (unchanged).
 */
export function useReplay(
  analysis: ReplayAnalysis,
  autoPlayMs = 2500,
  canonicalHand?: CanonicalHand,
): ReplayState & ReplayControls {
  // step=0 → clean state (no actions applied yet)
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const actions = analysis?.actions ?? [];
  const totalSteps = actions.length;

  // ── Engine (canonical path) ────────────────────────────────────────────────

  const engine = useMemo<ReplayEngine | null>(() => {
    if (!canonicalHand) return null;
    const validation = validateReplayability(canonicalHand);
    if (!validation.valid) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ReplayEngine] Hand failed replayability validation:", validation.errors);
      }
      return null;
    }
    const eng = new ReplayEngine(canonicalHand, process.env.NODE_ENV === "development");
    eng.initialize();
    return eng;
  }, [canonicalHand]);

  // Sync engine position when step changes (engine tracks independently)
  const engineState = useMemo<ReplayEngineState | null>(() => {
    if (!engine) return null;
    // Engine actionIndex = step - 1 (step=0 → actionIndex=-1, step=N → actionIndex=N-1)
    return engine.jumpToAction(step - 1);
  }, [engine, step]);

  // ── Legacy path (used with or without engine for ReplayAnalysis data) ─────

  const currentAction = step > 0 && step <= totalSteps ? actions[step - 1] : null;

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

  // When engine is present, use its pot/stack data; otherwise use legacy action fields
  const currentPot: number = engineState?.pot_bb
    ?? currentAction?.pot_after
    ?? 1.5;

  const currentHeroStack = useMemo<number | null>(() => {
    if (engineState) {
      const hero = engineState.players.find(p => p.isHero);
      return hero?.stack_bb ?? null;
    }
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].hero_stack_after != null) return actions[i].hero_stack_after!;
    }
    return null;
  }, [step, actions, engineState]);

  const currentVillainStack = useMemo<number | null>(() => {
    if (engineState) {
      const non_hero_active = engineState.players.find(p => !p.isHero && !p.isFolded);
      return non_hero_active?.stack_bb ?? null;
    }
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].villain_stack_after != null) return actions[i].villain_stack_after!;
    }
    return null;
  }, [step, actions, engineState]);

  const currentPlayerStacks = useMemo<Record<string, number> | null>(() => {
    if (engineState) {
      return Object.fromEntries(engineState.players.map(p => [p.playerName, p.stack_bb]));
    }
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].player_stacks_after != null) return actions[i].player_stacks_after!;
    }
    return null;
  }, [step, actions, engineState]);

  const currentAllInPlayers = useMemo<string[]>(() => {
    if (engineState) {
      return engineState.players.filter(p => p.isAllIn).map(p => p.playerName);
    }
    for (let i = step - 1; i >= 0; i--) {
      if (actions[i].all_in_players && actions[i].all_in_players!.length > 0) {
        return actions[i].all_in_players!;
      }
    }
    return [];
  }, [step, actions, engineState]);

  const currentSidePots = useMemo<SidePot[]>(() => {
    return currentAction?.side_pots ?? [];
  }, [currentAction]);

  const currentStreet: ReplayAction["street"] = currentAction?.street ?? "preflop";

  // ── Pending aggression ──────────────────────────────────────────────────
  // When hero is responding to a villain bet/raise, keep the aggression
  // visible on the table so the user understands the decision context.
  const pendingAggression = useMemo<ReplayAction | null>(() => {
    if (!currentAction) return null;
    // Only show pending aggression for hero responses
    if (!currentAction.is_hero) return null;
    if (!["call", "fold", "raise"].includes(currentAction.action)) return null;
    // Walk backward from current action to find the villain bet/raise on same street
    for (let i = step - 2; i >= 0; i--) {  // step-2 because step-1 is currentAction
      const a = actions[i];
      if (a.street !== currentAction.street) break;
      if (!a.is_hero && ["bet", "raise"].includes(a.action)) {
        return a;
      }
    }
    return null;
  }, [step, actions, currentAction]);

  const isFirst = step === 0;
  const isLast  = totalSteps > 0 ? step >= totalSteps : false;
  const showVerdict = step >= totalSteps && totalSteps > 0;

  // ── Auto-advance ────────────────────────────────────────────────────────────

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

  // ── Dev diagnostics ─────────────────────────────────────────────────────────

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
      "| engine:", engine ? `✓ (${engine.totalActions} voluntary actions)` : "✗ legacy mode",
    );
    if (actions.length === 0) {
      console.warn("[Replay] actions array is empty — all replay controls will be inactive.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || step === 0) return;
    if (engineState?.debug) {
      const d = engineState.debug;
      console.debug(
        `[ReplayEngine] step ${step}/${totalSteps} —`,
        d.lastActionSummary ?? "(initial)",
        `| pot: ${d.pot_bb.toFixed(2)}bb`,
        `| active: ${d.activePlayerId ?? "none"}`,
        `| folded: [${d.foldedPlayerIds.join(", ")}]`,
      );
    } else {
      const a = actions[step - 1];
      if (!a) return;
      console.debug(
        `[Replay] step ${step}/${totalSteps} — applied: ${a.player} ${a.action}${a.amount ? " " + a.amount : ""}`,
        `| pot_after: ${currentPot.toFixed(2)}bb`,
        `| hero_stack: ${currentHeroStack != null ? currentHeroStack.toFixed(2) + "bb" : "n/a"}`,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Controls ─────────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (n: number) => setStep(Math.max(0, Math.min(n, totalSteps))),
    [totalSteps],
  );
  const next = useCallback(
    () => setStep((s) => Math.min(s + 1, totalSteps)),
    [totalSteps],
  );
  const prev   = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const play   = useCallback(() => { if (!isLast) setIsPlaying(true); }, [isLast]);
  const pause  = useCallback(() => setIsPlaying(false), []);
  const reset  = useCallback(() => { setStep(0); setIsPlaying(false); }, []);

  const jumpToStreet = useCallback((street: ReplayAction["street"]) => {
    if (engine) {
      const engineIdx = engine.jumpToStreet(street).actionIndex;
      // engine actionIndex N → step N+1
      setStep(Math.max(0, engineIdx + 1));
      return;
    }
    // Legacy: find first action of the given street
    const firstIdx = actions.findIndex(a => a.street === street);
    if (firstIdx !== -1) setStep(firstIdx);
  }, [engine, actions]);

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
    engineState,
    pendingAggression,
    goTo,
    next,
    prev,
    play,
    pause,
    reset,
    jumpToStreet,
  };
}
