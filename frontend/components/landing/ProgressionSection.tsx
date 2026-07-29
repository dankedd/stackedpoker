"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, GraduationCap } from "lucide-react";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { RevealOnScroll } from "@/components/landing/shared/RevealOnScroll";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Demo values only — illustrative, not a real user's progress.
const DEMO_LEVEL = 12;
const DEMO_XP = 8420;
const DEMO_XP_TO_NEXT = 580;
const DEMO_PROGRESS_PCT = 72;
const COUNT_UP_MS = 900;

/** Animates the XP number from 0 to its target once, via rAF — skipped
 *  (jumps straight to the target) under reduced motion or before the
 *  section is visible. */
function useCountUp(target: number, active: boolean, durationMs = COUNT_UP_MS) {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion, target, durationMs]);

  return value;
}

export function ProgressionSection() {
  const { ref, visible } = useInView(0.3);
  const xp = useCountUp(DEMO_XP, visible);

  return (
    <section className="relative py-20 md:py-28 bg-card/10">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <RevealOnScroll>
          <MarketingSectionHeader
            eyebrow="Keep moving forward"
            heading="Progress you can see."
            body="Every lesson earns XP, tracks concept mastery, and moves you toward the next level — illustrative example below."
          />
        </RevealOnScroll>

        <RevealOnScroll variant="scale" delayMs={80}>
          <MarketingGlassCard elevated className="p-6 sm:p-8">
            <div ref={ref} className="flex items-center gap-5">
              <div className="relative h-20 w-20 shrink-0">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" strokeWidth="3" className="stroke-white/[0.06]" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    strokeWidth="3"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeLinecap="round"
                    className={visible ? "stroke-amber-400 animate-score-ring" : "stroke-amber-400"}
                    style={
                      {
                        "--ring-offset": visible ? 100 - DEMO_PROGRESS_PCT : 100,
                        strokeDashoffset: visible ? undefined : 100,
                      } as React.CSSProperties
                    }
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-foreground">
                  {DEMO_LEVEL}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-foreground">Level {DEMO_LEVEL}</span>
                  <span className="text-xs text-muted-foreground/50 font-mono tabular-nums">{xp.toLocaleString()} XP</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 ${visible ? "animate-bar-grow" : ""}`}
                    style={{ width: visible ? `${DEMO_PROGRESS_PCT}%` : "0%" }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground/50">
                  {DEMO_XP_TO_NEXT} XP to Level {DEMO_LEVEL + 1} · demo values
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <RevealOnScroll delayMs={0}>
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-3 text-center">
                  <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-foreground">14</p>
                  <p className="text-[10px] text-muted-foreground/50">day streak</p>
                </div>
              </RevealOnScroll>
              <RevealOnScroll delayMs={60}>
                <div className="rounded-xl border border-border/30 bg-black/20 px-3 py-3 text-center">
                  <Trophy className="h-4 w-4 text-amber-400/80 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-foreground">11</p>
                  <p className="text-[10px] text-muted-foreground/50">badges</p>
                </div>
              </RevealOnScroll>
              <RevealOnScroll delayMs={120}>
                <div className="rounded-xl border border-border/30 bg-black/20 px-3 py-3 text-center">
                  <GraduationCap className="h-4 w-4 text-violet-400/80 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-foreground">10</p>
                  <p className="text-[10px] text-muted-foreground/50">modules</p>
                </div>
              </RevealOnScroll>
            </div>
          </MarketingGlassCard>
        </RevealOnScroll>
      </div>
    </section>
  );
}
