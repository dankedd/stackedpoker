import type { Metadata } from "next";
import { Suspense } from "react";
import { FlopTrainer } from "@/components/flop-trainer/FlopTrainer";
import { FLOP_TRAINER_PATH } from "@/lib/flopTrainer/feature";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Flop Equity Trainer",
  description:
    "Guess range-vs-range equity and nut advantage on real flops, then see the exact numbers and how both ranges split into equity buckets.",
  path: FLOP_TRAINER_PATH,
});

export default function FlopTrainerPage() {
  return (
    <>
      <header className="mb-4 mt-4 sm:mb-6 sm:mt-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Flop Equity Trainer</h1>
        <p className="mt-2 hidden max-w-2xl text-[15px] leading-relaxed text-slate-400 sm:block">
          Read a flop the way the ranges see it: how much equity does the opener have, and who holds the strongest hands?
        </p>
      </header>
      <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] via-card/70 to-blue-500/[0.05] p-4 sm:p-6">
        {/* The trainer reads its spot from the query string. */}
        <Suspense fallback={<div className="mx-auto h-[190px] max-w-[860px] animate-pulse rounded-3xl bg-card/40" />}>
          <FlopTrainer />
        </Suspense>
      </section>
    </>
  );
}
