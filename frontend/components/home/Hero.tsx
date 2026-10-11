import type { DemoSpot } from "@/lib/home/demoLogic";
import { FrictionLine, StartFreeButton, TryTrainerButton } from "./Cta";
import { HeroDemo } from "./HeroDemo";
import { TrustStrip, type TrustItem } from "./TrustStrip";

/** H1 variants for A/B testing; A ships by default (see HERO_HEADLINE). */
export const HERO_HEADLINES = {
  A: "Stop guessing. Know the right play.",
  B: "Learn it. Drill it. Review your hands. Win more.",
  C: "Your poker coach that explains why.",
} as const;
export const HERO_HEADLINE: keyof typeof HERO_HEADLINES = "A";

/**
 * Above the fold. The H1 is the LCP element, so it is never opacity-animated
 * (components/landing/__tests__/homepagePerformanceBudget.test.tsx).
 */
export function Hero({ spots, trust }: { spots: DemoSpot[]; trust: TrustItem[] }) {
  return (
    <section className="relative overflow-hidden pb-14 pt-28 sm:pt-32">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.22),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
            Poker training · Hand review · Bankroll — in one place
          </p>
          <h1 className="text-[40px] font-black leading-[1.04] tracking-tight text-white sm:text-6xl">{HERO_HEADLINES[HERO_HEADLINE]}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
            A preflop trainer graded on real ranges, hand-history review with an AI coach, and a bankroll tracker — free to start.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <StartFreeButton location="hero" size="lg" />
            <TryTrainerButton location="hero" className="h-12 text-base" />
          </div>
          <FrictionLine className="mt-3" />
        </div>
        <HeroDemo spots={spots} />
      </div>
      <TrustStrip items={trust} />
    </section>
  );
}
