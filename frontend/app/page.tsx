import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Hero } from "@/components/landing/Hero";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { HowDecisionsWork } from "@/components/landing/HowDecisionsWork";
import { DecisionShowcase } from "@/components/landing/DecisionShowcase";
import { RangeThinking } from "@/components/landing/RangeThinking";
import { LearningPath } from "@/components/landing/LearningPath";
import { CoachSection } from "@/components/landing/CoachSection";
import { ProgressionSection } from "@/components/landing/ProgressionSection";
import { LeaderboardPreview } from "@/components/landing/LeaderboardPreview";
import { CtaSection } from "@/components/landing/CtaSection";

export default function HomePage() {
  return (
    <>
      <Navbar variant="sticky" />

      {/* `sp-landing-main` lets the browser skip layout/paint for the nine
          below-the-fold sections until they scroll near — see globals.css.
          Content stays fully in the DOM and in the accessibility tree. */}
      <main className="sp-landing-main">
        {/* 1 · Hero — real decision spot, range, and AI coach composition */}
        <Hero />

        {/* 2 · Proof strip — real capabilities, bridges hero into the deeper story */}
        <ProofStrip />

        {/* 3 · How decisions work — Learn / Practice / Understand */}
        <HowDecisionsWork />

        {/* 4 · Interactive decision showcase — a full real decision spot */}
        <DecisionShowcase />

        {/* 5 · Range thinking — real range vs range data */}
        <RangeThinking />

        {/* 6 · Learning path — real curriculum/journey data */}
        <LearningPath />

        {/* 7 · AI Coach — lesson-aware, not a generic chatbot */}
        <CoachSection />

        {/* 8 · Progression — XP, levels, streaks (demo values) */}
        <ProgressionSection />

        {/* 9 · Leaderboard — demo preview, real CTA */}
        <LeaderboardPreview />

        {/* 10 · Final CTA */}
        <CtaSection />
      </main>

      <LandingFooter />
    </>
  );
}
