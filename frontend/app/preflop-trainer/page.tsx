import type { Metadata } from "next";
import { Suspense } from "react";
import { Trainer } from "@/components/preflop-trainer/Trainer";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Preflop Trainer",
  description:
    "Drill preflop decisions hand by hand: opens, defenses and push/fold for MTT and cash, graded against the full range with the exact frequencies shown.",
  path: PREFLOP_TRAINER_PATH,
});

export default function PreflopTrainerPage() {
  return (
    <>
      <header className="mb-6 mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Preflop Trainer</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          A real hand in a real spot — choose your action, then see the whole range and exactly how often it plays
          your hand.
        </p>
      </header>
      <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] via-card/70 to-blue-500/[0.05] p-4 sm:p-6">
        {/* The trainer reads its filters from the query string. */}
        <Suspense fallback={<div className="mx-auto aspect-[16/9.6] max-w-[860px] animate-pulse rounded-[999px] bg-card/40" />}>
          <Trainer />
        </Suspense>
      </section>
    </>
  );
}
