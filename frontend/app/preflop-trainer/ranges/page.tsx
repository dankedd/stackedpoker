import type { Metadata } from "next";
import { Suspense } from "react";
import { RangesBrowser } from "@/components/preflop-trainer/RangesBrowser";
import { PREFLOP_RANGES_PATH } from "@/lib/ranges/feature";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Preflop Ranges",
  description:
    "Preflop range charts by position and stack depth: MTT opens from 12 to 60bb, defenses, push/fold under 10bb and 100bb six-max cash.",
  path: PREFLOP_RANGES_PATH,
});

export default function PreflopRangesPage() {
  return (
    <>
      <header className="mb-6 mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Preflop Ranges</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          Every chart the trainer grades against. Pick a spot, then hover or tap a hand for its exact distribution.
        </p>
      </header>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        {/* The selected chart lives in the query string, so it can be linked to. */}
        <Suspense fallback={<div className="h-[520px] animate-pulse rounded-xl bg-card/40" />}>
          <RangesBrowser />
        </Suspense>
      </section>
    </>
  );
}
