"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { ILLUSTRATIVE_CALLER_RANGE } from "@/lib/learn/rangeVsRangeContent";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { CoachPreviewCard } from "@/components/landing/shared/CoachPreviewCard";
import { RevealOnScroll } from "@/components/landing/shared/RevealOnScroll";

const QUIZ_OPTIONS = [
  { label: "Check", correct: false },
  { label: "Bet 33%", correct: true },
  { label: "Bet pot", correct: false },
];

function LearnPreview() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground/60 font-mono">
        You raised BTN, BB called. Range advantage is yours — what&apos;s your c-bet size?
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {QUIZ_OPTIONS.map(({ label, correct }) => (
          <button
            key={label}
            onClick={() => setSelected(label)}
            className={`text-[11px] font-mono py-1.5 px-1.5 rounded-lg border transition-all duration-150 ${
              selected === label
                ? correct
                  ? "bg-emerald-500/20 border-emerald-500/45 text-emerald-300"
                  : "bg-amber-500/15 border-amber-500/35 text-amber-300"
                : "bg-black/20 border-border/40 text-muted-foreground/60 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed animate-fade-in">
          {selected === "Bet 33%"
            ? "Correct — a small size lets your whole range apply pressure cheaply on a dry board."
            : "Not quite — your range has the edge everywhere here, so you don't need to risk much."}
        </p>
      )}
    </div>
  );
}

const SURFACES = [
  {
    eyebrow: "01 · Learn",
    title: "Learn",
    body: "Structured interactive lessons introduce each concept progressively — never a wall of text.",
    content: <LearnPreview />,
  },
  {
    eyebrow: "02 · Practice",
    title: "Practice",
    body: "Make decisions, build ranges, compare strategies and work through real poker situations.",
    content: (
      <div>
        <PokerRangeGrid range={ILLUSTRATIVE_CALLER_RANGE} size="compact" mode="membership" />
        <p className="mt-2.5 text-[11px] text-muted-foreground/60 leading-relaxed">
          Build and compare ranges yourself instead of memorizing someone else&apos;s chart.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "03 · Understand",
    title: "Understand",
    body: "Get immediate explanation, and reach for the AI Coach whenever you need more depth.",
    content: (
      <CoachPreviewCard
        size="compact"
        question="Why does the small size work here?"
        hint="What happens to a bluff-catcher's decision when the bet is small but the range behind it is wide?"
      />
    ),
  },
];

// scroll-mt tracks the real measured header height (--sp-header-height, see
// Navbar.tsx/useMeasuredHeightVar) so a same-page #how-it-works link clears
// the fixed nav exactly, not a hardcoded guess.
export function HowDecisionsWork() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28 bg-background scroll-mt-[var(--sp-header-height,6rem)]">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <RevealOnScroll>
          <MarketingSectionHeader
            eyebrow="Built for understanding"
            heading={
              <>
                Don&apos;t just memorize charts.
                <br />
                Learn how poker decisions actually work.
              </>
            }
          />
        </RevealOnScroll>

        <div className="grid md:grid-cols-3 gap-5">
          {SURFACES.map(({ eyebrow, title, body, content }, i) => (
            <RevealOnScroll key={title} delayMs={i * 100}>
              <MarketingGlassCard interactive className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-4 w-4 text-violet-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70">
                    {eyebrow}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground/70 leading-relaxed mb-4">{body}</p>
                <div className="mt-auto rounded-xl border border-border/30 bg-black/20 p-3.5">{content}</div>
              </MarketingGlassCard>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
