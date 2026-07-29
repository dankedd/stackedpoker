"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PreflopTable } from "@/components/learn/visuals/PreflopTable";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Phase = "initial" | "revealed";

interface AnimatedPreflopSceneProps {
  tableSize: number;
  heroPosition: string;
  finalHeroHand: string[];
  finalActionBeforeHero: string[];
  effectiveStackBb?: number;
  heroAction?: { label: string; betBb?: number };
  result?: "correct" | "incorrect";
  /** Stop the idle replay loop once the user has answered — never yanks
   *  the cards back to face-down under an already-visible result badge. */
  freeze?: boolean;
  revealDelayMs?: number;
  /** Idle time before the scene quietly replays. `0` disables the loop. */
  replayAfterMs?: number;
  className?: string;
}

/**
 * Wraps the real, unmodified `PreflopTable` for a marketing-only phased
 * reveal: mounts with hole cards face-down and no action history (a real,
 * honest "before it happened" state — PreflopTable's own prop docs say
 * omitting `heroHand`/`actionBeforeHero` renders face-down placeholders /
 * no fold row, never a guessed state), then after a short delay reveals
 * the real hand and the real action history together. A decorative
 * pulse-ring sibling marks the moment — it never targets PreflopTable's
 * internal DOM, so PreflopTable itself needs zero changes.
 */
export function AnimatedPreflopScene({
  tableSize,
  heroPosition,
  finalHeroHand,
  finalActionBeforeHero,
  effectiveStackBb,
  heroAction,
  result,
  freeze = false,
  revealDelayMs = 550,
  replayAfterMs = 25000,
  className,
}: AnimatedPreflopSceneProps) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("initial");
  const [pulseKey, setPulseKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const freezeRef = useRef(freeze);

  useEffect(() => {
    freezeRef.current = freeze;
  }, [freeze]);

  useEffect(() => {
    function clearAll() {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    }

    if (reducedMotion) {
      setPhase("revealed");
      return clearAll;
    }

    function reveal() {
      setPhase("revealed");
      setPulseKey((k) => k + 1);
      if (!freezeRef.current && replayAfterMs > 0) {
        timers.current.push(setTimeout(restart, replayAfterMs));
      }
    }

    function restart() {
      if (freezeRef.current) return;
      setPhase("initial");
      timers.current.push(setTimeout(reveal, revealDelayMs));
    }

    timers.current.push(setTimeout(reveal, revealDelayMs));
    return clearAll;
    // revealDelayMs/replayAfterMs are fixed per call site; freeze is read
    // live via freezeRef so an in-flight timer sees the latest value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const revealed = phase === "revealed";

  return (
    <div className={cn("relative", className)}>
      <PreflopTable
        tableSize={tableSize}
        heroPosition={heroPosition}
        heroHand={revealed ? finalHeroHand : undefined}
        effectiveStackBb={effectiveStackBb}
        actionBeforeHero={revealed ? finalActionBeforeHero : undefined}
        heroAction={heroAction}
        result={result}
      />
      {revealed && (
        <div
          key={pulseKey}
          aria-hidden
          className="sp-pulse-ring pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-violet-400/40"
        />
      )}
    </div>
  );
}
