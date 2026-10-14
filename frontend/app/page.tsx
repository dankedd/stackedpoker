import type { Metadata } from "next";
import { Bento } from "@/components/home/Bento";
import { FaqSection, FinalCta, LeaderboardSection, PricingTeaser, ProgressSection } from "@/components/home/Closing";
import { Hero } from "@/components/home/Hero";
import { HomeHeader } from "@/components/home/HomeHeader";
import { Loop } from "@/components/home/Loop";
import { ReviewShowcase } from "@/components/home/ReviewShowcase";
import { TrainerShowcase } from "@/components/home/TrainerShowcase";
import type { TrustItem } from "@/components/home/TrustStrip";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { bbVsCoChart, btnOpenChart, coOpenChart, trainerChartCount } from "@/lib/home/charts";
import { demoSpots } from "@/lib/home/demoSpots";
import { FAQ } from "@/lib/home/faq";
import { getSiteStats } from "@/lib/home/stats";
import { faqPage } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Poker Training, Preflop Trainer & AI Hand Review",
  description:
    "Poker training that shows you the right play: a preflop trainer graded on real ranges, hand history review with an AI poker coach, and a bankroll tracker. Free to start.",
  path: "/",
  keywords: ["poker training", "preflop trainer", "hand history review", "AI poker coach", "poker hand replayer", "poker bankroll tracker", "StackedPoker"],
});

// Live numbers (players, hands, top 5) are fetched with a one-hour cache.
export const revalidate = 3600;

export default async function HomePage() {
  const stats = await getSiteStats();
  const trust: TrustItem[] = [
    { value: trainerChartCount(), label: "preflop charts in the trainer" },
    { label: "Ranges from Modern Poker Theory" },
    { label: "GGPoker & PokerStars import" },
    ...(stats?.hands != null ? [{ value: stats.hands, label: "hands reviewed" }] : []),
    ...(stats?.players != null ? [{ value: stats.players, label: "players" }] : []),
  ];

  return (
    <div className="bg-[#070A12] text-white">
      <JsonLd data={faqPage(FAQ.map((f) => ({ question: f.q, answer: f.a })), undefined, "/")} />
      <HomeHeader />

      {/* `sp-landing-main` lets the browser skip layout/paint for the sections
          below the fold until they scroll near (globals.css). The hero is the
          first child and is never deferred — it holds the LCP element. */}
      <main className="sp-landing-main">
        <Hero spots={demoSpots()} trust={trust} />
        <Loop />
        <Bento btnOpen={btnOpenChart()} />
        <ReviewShowcase />
        <TrainerShowcase open={coOpenChart()} defend={bbVsCoChart()} />
        <ProgressSection />
        <LeaderboardSection rows={stats?.top ?? []} />
        <PricingTeaser />
        <FaqSection />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  );
}
