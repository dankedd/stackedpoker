import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/flop-trainer/Explorer";
import { FLOP_EXPLORER_PATH } from "@/lib/flopTrainer/feature";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Flop Explorer",
  description:
    "Pick any flop and see both ranges hand by hand: range equity, equity buckets, nut advantage, c-bet advice and a 13x13 equity heatmap.",
  path: FLOP_EXPLORER_PATH,
});

export default function ExplorerPage() {
  return (
    <>
      <header className="mb-4 mt-4 sm:mb-6 sm:mt-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Flop Explorer</h1>
        <p className="mt-2 hidden max-w-2xl text-[15px] leading-relaxed text-slate-400 sm:block">
          Any flop, both ranges, hand by hand.
        </p>
      </header>
      <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] via-card/70 to-blue-500/[0.05] p-4 sm:p-6">
        <Suspense fallback={<div className="h-[420px] animate-pulse rounded-2xl bg-card/40" />}>
          <Explorer />
        </Suspense>
      </section>
    </>
  );
}
