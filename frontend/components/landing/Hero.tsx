"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { getJourneyOverview } from "@/lib/learn/journey";
import { LESSONS } from "@/lib/learn/curriculum";
import { ILLUSTRATIVE_OPENER_RANGE } from "@/lib/learn/rangeVsRangeContent";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { useCursorGlow } from "@/hooks/useCursorGlow";
import { MarketingGridBackground } from "@/components/landing/shared/MarketingGridBackground";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { MarketingEyebrow } from "@/components/landing/shared/MarketingEyebrow";
import { FadeInUp } from "@/components/landing/shared/FadeInUp";
import { AmbientFloat } from "@/components/landing/shared/AmbientFloat";
import { AnimatedPreflopScene } from "@/components/landing/shared/AnimatedPreflopScene";
import { MarketingDecisionSpot, type MarketingDecisionOption } from "@/components/landing/shared/MarketingDecisionSpot";
import { CoachPreviewCard } from "@/components/landing/shared/CoachPreviewCard";

const journeyOverview = getJourneyOverview({});

const HERO_OPTIONS: MarketingDecisionOption[] = [
  { id: "fold", label: "Fold" },
  { id: "call", label: "Call" },
  { id: "raise", label: "Raise", correct: true },
];

function HeroComposition() {
  const [answer, setAnswer] = useState<MarketingDecisionOption | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Primary: the decision */}
      <FadeInUp delayMs={560} className="lg:col-span-3">
        <AmbientFloat durationS={10} delayS={0} distancePx={6} className="relative">
          <MarketingGlassCard elevated className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
                Decision spot
              </span>
              <span className="text-[10px] text-muted-foreground/40 font-mono">stacked.poker/learn</span>
            </div>

            <AnimatedPreflopScene
              tableSize={6}
              heroPosition="BTN"
              finalHeroHand={["Ks", "Qs"]}
              effectiveStackBb={100}
              finalActionBeforeHero={["CO raises to 2.3bb"]}
              heroAction={answer ? { label: answer.label } : undefined}
              result={answer ? (answer.correct ? "correct" : "incorrect") : undefined}
              freeze={answer !== null}
            />

            <div className="mt-4">
              <MarketingDecisionSpot
                options={HERO_OPTIONS}
                question="CO opens to 2.3BB. You're on the button with K♠Q♠ — what's your action?"
                correctExplanation="Raise — KQs plays great as a 3-bet in position: it blocks premium hands like KK/QQ/AK and still flops well when called."
                incorrectExplanation="Reasonable, but this hand is strong enough to apply pressure rather than just see a flop."
                onSelect={setAnswer}
              />
            </div>
          </MarketingGlassCard>

          {/* Decorative floating badge — desktop only, never overlaps interactive content */}
          <div className="hidden lg:flex absolute -top-3.5 right-6 items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 px-3 py-1 text-[11px] text-violet-300 font-medium">
            <Sparkles className="h-3 w-3" />
            Real decision, not a screenshot
          </div>
        </AmbientFloat>
      </FadeInUp>

      {/* Supporting evidence */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <FadeInUp delayMs={680}>
          <AmbientFloat durationS={12} delayS={1.5} distancePx={5}>
            <MarketingGlassCard className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300/80 mb-2.5">
                CO opening range
              </p>
              <PokerRangeGrid range={ILLUSTRATIVE_OPENER_RANGE} size="compact" mode="membership" highlightHand="KQs" />
              <p className="mt-2.5 text-[11px] text-muted-foreground/60 leading-relaxed">
                See the range behind the raise — not just the one hand in front of you.
              </p>
            </MarketingGlassCard>
          </AmbientFloat>
        </FadeInUp>

        <FadeInUp delayMs={780}>
          <AmbientFloat durationS={11} delayS={0.8} distancePx={4}>
            <MarketingGlassCard className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/80 mb-2.5">
                AI Coach
              </p>
              <CoachPreviewCard
                size="compact"
                question="Why is KQs a raise here?"
                hint="Think about what hands you block by holding K and Q — what does that do to CO's continuing range?"
              />
            </MarketingGlassCard>
          </AmbientFloat>
        </FadeInUp>
      </div>
    </div>
  );
}

export function Hero() {
  const glowRef = useRef<HTMLDivElement | null>(null);
  useCursorGlow(glowRef);

  return (
    <section className="relative bg-background overflow-hidden">
      <MarketingGridBackground spotlight />

      {/* Ambient glow — one consolidated drifting layer + one static wash,
          keeping the "one dominant light source" principle. The cursor
          glow nudges this same layer a small amount on fine-pointer
          desktops only (see useCursorGlow — no-ops under touch/reduced
          motion, never triggers a React rerender). */}
      <div ref={glowRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-[30%] w-[900px] h-[700px] rounded-full bg-violet-600/12 blur-[150px] animate-drift-glow"
          style={{
            transform: "translate(calc(var(--sp-cursor-x, 0) * 12px), calc(var(--sp-cursor-y, 0) * 8px))",
          }}
        />
        <div className="absolute top-1/2 -translate-y-1/2 -right-64 w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[130px]" />
      </div>

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-20 lg:py-28">
        <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
          <FadeInUp delayMs={0} variant="fade">
            <MarketingEyebrow className="mb-6">The modern way to learn poker</MarketingEyebrow>
          </FadeInUp>

          <FadeInUp delayMs={120}>
            <h1 className="font-black tracking-tight text-foreground leading-[1.05] text-[clamp(2.4rem,6vw,4.5rem)]">
              Think in ranges.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-500 animate-gradient">
                Play with purpose.
              </span>
            </h1>
          </FadeInUp>

          <FadeInUp delayMs={240}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground/75 leading-relaxed max-w-2xl mx-auto">
              Master poker strategy through interactive lessons, real decision spots, range
              training and an AI coach that helps you understand <em className="not-italic text-foreground/80">why</em>.
            </p>
          </FadeInUp>

          <FadeInUp delayMs={360}>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/learn"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/35 hover:shadow-violet-500/55 hover:-translate-y-0.5 active:translate-y-px active:scale-[0.97] transition-all duration-200 btn-poker-hover will-change-transform"
              >
                Start learning
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <Link
                href="#curriculum"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border/60 bg-card/40 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border/80 hover:-translate-y-0.5 active:translate-y-px active:scale-[0.97] transition-all duration-200 will-change-transform"
              >
                Explore the curriculum
              </Link>
            </div>
          </FadeInUp>

          <FadeInUp delayMs={480}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[13px] text-muted-foreground/45">
              {[
                { label: `${LESSONS.length} lessons live` },
                { label: `${journeyOverview.availableModules} modules available` },
                { label: "Free to start" },
                { label: "No credit card" },
              ].map(({ label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60" />
                  {label}
                </div>
              ))}
            </div>
          </FadeInUp>
        </div>

        <HeroComposition />
      </div>

      <div aria-hidden className="pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
