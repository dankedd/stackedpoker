import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { CurriculumPreview } from "@/components/landing/CurriculumPreview";
import { StudySystemRoadmap } from "@/components/landing/StudySystemRoadmap";
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

        {/* 3 · Curriculum preview — real modules, single source of truth */}
        <CurriculumPreview />

        {/* 4 · Study system roadmap — Learn/Practice/Analyze/Replay */}
        <StudySystemRoadmap />

        {/* 5 · How it works — dark steps */}
        <HowItWorks />

        {/* 6 · Stats — gradient numbers */}
        <Stats />

        {/* 7 · Testimonials — dark glass cards */}
        <Testimonials />

        {/* 8 · Final CTA */}
        <CtaSection />
      </main>

      <LandingFooter />
    </>
  );
}
