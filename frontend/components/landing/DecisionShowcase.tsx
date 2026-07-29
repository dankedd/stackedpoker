"use client";

import { useState } from "react";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { RevealOnScroll } from "@/components/landing/shared/RevealOnScroll";
import { AnimatedPreflopScene } from "@/components/landing/shared/AnimatedPreflopScene";
import { MarketingDecisionSpot, type MarketingDecisionOption } from "@/components/landing/shared/MarketingDecisionSpot";

const SHOWCASE_OPTIONS: MarketingDecisionOption[] = [
  { id: "fold", label: "Fold" },
  { id: "call", label: "Call" },
  { id: "raise", label: "Raise" },
];

/** Marketing demo only — local component state, no XP, no persistence, no
 *  network calls. Real correctness grading lives inside the actual Learn
 *  lesson pipeline, not here. */
export function DecisionShowcase() {
  const [answer, setAnswer] = useState<MarketingDecisionOption | null>(null);

  return (
    <section className="relative py-20 md:py-28 bg-card/10">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <RevealOnScroll>
          <MarketingSectionHeader
            eyebrow="Make the call"
            heading="StackedPoker teaches through decisions — not walls of text."
            body="Every concept starts with a real spot. Predict the action, then see why it's right."
          />
        </RevealOnScroll>

        <RevealOnScroll variant="scale" delayMs={80}>
          <MarketingGlassCard elevated className="p-5 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
                Defending the Open
              </span>
              <span className="text-[10px] text-muted-foreground/40 font-mono">stacked.poker/learn</span>
            </div>

            <AnimatedPreflopScene
              tableSize={6}
              heroPosition="BB"
              finalHeroHand={["Ad", "5d"]}
              effectiveStackBb={100}
              finalActionBeforeHero={["CO raises to 2.3bb"]}
              heroAction={answer ? { label: answer.label } : undefined}
              result={answer ? (answer.id === "call" ? "correct" : "incorrect") : undefined}
              freeze={answer !== null}
            />

            <div className="mt-5">
              <MarketingDecisionSpot
                options={SHOWCASE_OPTIONS.map((o) => ({ ...o, correct: o.id === "call" }))}
                question="CO opens to 2.3BB. You're in the big blind with A♦5♦ — what's your action?"
                correctExplanation="Call — you're getting a great price to see a flop, and the ace-five blocks some of CO's strongest continuing hands."
                incorrectExplanation="A5s is strong enough to see a flop here — the price and the blocker effect both favor continuing."
                size="full"
                onSelect={setAnswer}
              />
            </div>
          </MarketingGlassCard>
        </RevealOnScroll>
      </div>
    </section>
  );
}
