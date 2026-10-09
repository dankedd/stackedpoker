import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SectionNav } from "@/components/preflop-trainer/SectionNav";
import { SOURCE_CREDIT } from "@/lib/ranges/data";
import { PREFLOP_RANGES_ENABLED } from "@/lib/ranges/feature";

/**
 * The Preflop Trainer section: /preflop-trainer (the trainer itself) and
 * /preflop-trainer/ranges (the charts). Behind NEXT_PUBLIC_FEATURE_PREFLOP_RANGES
 * — with the flag off every route here 404s (lib/ranges/feature.ts).
 */
export default function PreflopTrainerLayout({ children }: { children: React.ReactNode }) {
  if (!PREFLOP_RANGES_ENABLED) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionNav />
        {children}
        <p className="mt-10 border-t border-border/50 pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
          Source: {SOURCE_CREDIT}. Each chart names its Hand Range and page. Per-hand frequencies are read from the
          book&apos;s charts; the totals are the book&apos;s own printed figures.
        </p>
      </main>
      <Footer />
    </div>
  );
}
