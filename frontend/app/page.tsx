import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { Stats } from "@/components/landing/Stats";
import { CtaSection } from "@/components/landing/CtaSection";

export default function HomePage() {
  return (
    <>
      <LandingHeader />

      <main>
        {/* 1 · Light hero */}
        <Hero />

        {/* 2 · Dark features grid */}
        <Features />

        {/* 3 · Light — how it works */}
        <HowItWorks />

        {/* 4 · Dark — social proof numbers */}
        <Stats />

        {/* 5 · Light — testimonials */}
        <Testimonials />

        {/* 6 · Dark — final CTA */}
        <CtaSection />
      </main>

      <LandingFooter />
    </>
  );
}
