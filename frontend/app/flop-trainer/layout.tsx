import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { FlopSectionNav } from "@/components/flop-trainer/FlopSectionNav";
import { FLOP_TRAINER_ENABLED } from "@/lib/flopTrainer/feature";

/** /flop-trainer (trainer), /quick-fire and /explorer — behind the Preflop Trainer's flag (lib/flopTrainer/feature.ts). */
export default function FlopTrainerLayout({ children }: { children: React.ReactNode }) {
  if (!FLOP_TRAINER_ENABLED) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <FlopSectionNav />
        {children}
        <p className="mt-10 border-t border-border/50 pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
          Concepts based on Modern Poker Theory by Michael Acevedo. Ranges are the book&apos;s 40bb charts; every equity is
          computed exactly from them, ahead of time.
        </p>
      </main>
      <Footer />
    </div>
  );
}
