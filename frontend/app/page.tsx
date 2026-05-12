import { Navbar } from "@/components/layout/Navbar";
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
      <Navbar variant="sticky" />

      <main>
        {/* 1 · Hero — dark cinematic, violet glow */}
        <Hero />

        {/* 2 · Features — dark glass cards */}
        <Features />

        {/* 3 · How it works — dark steps */}
        <HowItWorks />

        {/* 4 · Stats — gradient numbers */}
        <Stats />

        {/* 5 · Testimonials — dark glass cards */}
        <Testimonials />

        {/* 6 · Final CTA */}
        <CtaSection />
      </main>

      <LandingFooter />
    </>
  );
}
