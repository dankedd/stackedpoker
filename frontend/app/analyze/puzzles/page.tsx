import Link from "next/link";
import { ArrowLeft, Lock, Brain, DollarSign, Waves, Eye } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const PUZZLES = [
  {
    icon: Brain,
    title: "GTO Trainer",
    description: "Practice mixed strategy decisions against a GTO-calibrated range solver.",
    accent: "violet",
  },
  {
    icon: DollarSign,
    title: "ICM Trainer",
    description: "Make correct push/fold and call decisions under tournament equity pressure.",
    accent: "amber",
  },
  {
    icon: Waves,
    title: "River Decisions",
    description: "Face isolated river spots: value bet sizing, bluff frequencies, hero calls.",
    accent: "blue",
  },
  {
    icon: Eye,
    title: "Bluff Catch Trainer",
    description: "Read population tendencies and make +EV hero calls in high-pressure spots.",
    accent: "rose",
  },
] as const;

const ACCENT: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-500/60",
  amber:  "bg-amber-500/10  text-amber-500/60",
  blue:   "bg-blue-500/10   text-blue-500/60",
  rose:   "bg-rose-500/10   text-rose-500/60",
};

export default function PuzzlesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">

          {/* Back */}
          <Link
            href="/analyze"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analyze
          </Link>

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-violet-400/70 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full mb-4">
              Coming soon
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Puzzles</h1>
            <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Interactive decision drills trained on GTO solutions and real hand data. Launching soon.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PUZZLES.map((p) => (
              <div
                key={p.title}
                className="relative rounded-2xl border border-border/40 bg-card/40 p-5 opacity-60"
              >
                <div className="absolute top-3 right-3">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${ACCENT[p.accent]}`}>
                  <p.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-semibold text-foreground/70 text-sm mb-1">{p.title}</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
