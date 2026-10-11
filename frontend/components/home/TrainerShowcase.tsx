"use client";

import { useState } from "react";
import type { CellMix, HomeChart } from "@/lib/home/charts";
import { TryTrainerButton } from "./Cta";
import { InView } from "./InView";
import { ACTION_COLOR, Legend, MiniRangeGrid, handAt } from "./MiniRangeGrid";

function mixFor(chart: HomeChart, hand: string): CellMix | null | undefined {
  for (let i = 0; i < 169; i++) if (handAt(Math.floor(i / 13), i % 13) === hand) return chart.cells[i];
  return undefined;
}

function MixLine({ chart, hand }: { chart: HomeChart; hand: string }) {
  const mix = mixFor(chart, hand);
  const label = (k: string) => chart.legend.find((l) => l.key === k)?.label ?? k;
  return (
    <p className="text-[13px] text-white/80">
      <span className="text-white/55">{chart.title}: </span>
      {!mix ? (
        <span className="text-white/50">not in this spot</span>
      ) : (
        mix.map(([k, f], n) => (
          <span key={k} className="font-mono">
            {n ? " · " : ""}
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: ACTION_COLOR[k] }} />
            {label(k)} {Math.round(f * 100)}%
          </span>
        ))
      )}
    </p>
  );
}

/** Two linked range grids from the trainer: hover/tap a hand to compare it in both. */
export function TrainerShowcase({ open, defend }: { open: HomeChart; defend: HomeChart }) {
  const [hand, setHand] = useState<string | null>("AJo");
  return (
    <section aria-labelledby="trainer-title" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
      <InView className="order-2 lg:order-1">
        <div className="grid gap-4 sm:grid-cols-2">
          {[open, defend].map((c) => (
            <figure key={c.title} className="hp-reveal rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <figcaption className="mb-2 text-xs font-semibold text-white/75">{c.title}</figcaption>
              <MiniRangeGrid chart={c} highlight={hand} onHover={(h) => h && setHand(h)} showLabels />
              <Legend chart={c} className="mt-2" />
            </figure>
          ))}
        </div>
        <div aria-live="polite" className="mt-3 min-h-[44px] space-y-0.5">
          {hand && (
            <>
              <p className="font-mono text-sm font-semibold text-white">{hand}</p>
              <MixLine chart={open} hand={hand} />
              <MixLine chart={defend} hand={hand} />
            </>
          )}
        </div>
      </InView>
      <div className="order-1 lg:order-2">
        <h2 id="trainer-title" className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          See both sides of every spot.
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-white/75">
          The range that opens and the range that defends, side by side. Point at a hand to see how often each side plays it — then drill it until it&apos;s automatic.
        </p>
        <p className="mt-3 text-[13px] text-white/50">Ranges from Modern Poker Theory by Michael Acevedo · cash 6-max, 100 BB</p>
        <TryTrainerButton location="showcase" className="mt-7">
          Try the trainer — no account needed
        </TryTrainerButton>
      </div>
    </section>
  );
}
