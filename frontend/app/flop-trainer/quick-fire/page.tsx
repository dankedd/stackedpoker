import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickFire } from "@/components/flop-trainer/QuickFire";
import { FLOP_QUICK_FIRE_PATH } from "@/lib/flopTrainer/feature";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Flop Quick Fire",
  description: "Two flops, one tap: which board is better for the preflop raiser? Instant feedback with the exact range equities.",
  path: FLOP_QUICK_FIRE_PATH,
});

export default function QuickFirePage() {
  return (
    <>
      <header className="mb-4 mt-4 sm:mb-6 sm:mt-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Quick fire</h1>
        <p className="mt-2 hidden max-w-2xl text-[15px] leading-relaxed text-slate-400 sm:block">
          Two flops, one tap. Build a feel for which boards favour the player who raised preflop.
        </p>
      </header>
      <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] via-card/70 to-blue-500/[0.05] p-4 sm:p-6">
        <Suspense fallback={<div className="mx-auto h-[260px] max-w-[860px] animate-pulse rounded-3xl bg-card/40" />}>
          <QuickFire />
        </Suspense>
      </section>
    </>
  );
}
