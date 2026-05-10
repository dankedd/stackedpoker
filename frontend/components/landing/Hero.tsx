import Link from "next/link";
import { ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-green-glow" />

      {/* Decorative poker chip pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-5">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full border-4 border-poker-green" />
        <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full border-4 border-poker-green" />
        <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-poker-green" />
      </div>

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-poker-green/30 bg-poker-green/10 px-4 py-1.5 text-sm text-poker-green">
            <Zap className="h-3.5 w-3.5" />
            GTO-Inspired Poker Analysis
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Stop Guessing.{" "}
            <span className="text-poker-green">Start Winning.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Paste any GGPoker or PokerStars hand history and get instant
            solver-inspired analysis with AI coaching. Understand exactly
            where you went wrong and why.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="poker" size="xl" asChild>
              <Link href="/analyze">
                Analyze Your Hand
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-poker-green" />
              GGPoker & PokerStars support
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-poker-green" />
              GTO-inspired heuristics
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-poker-green" />
              AI coaching included
            </div>
          </div>
        </div>

        {/* Preview card */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="rounded-xl border border-poker-green/20 bg-card/50 p-6 backdrop-blur-sm shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-poker-green animate-pulse-green" />
              Live Analysis Preview
            </div>
            <div className="space-y-2 font-mono text-xs text-muted-foreground">
              <p className="text-poker-green">✓ Hand parsed: BTN vs BB — SRP</p>
              <p className="text-poker-green/70">✓ Board: A♦ 7♣ 2♠ — A-high dry (rainbow)</p>
              <p className="text-yellow-400/80">△ Flop: Bet 75% pot — use smaller sizing (25-33%)</p>
              <p className="text-blue-400/80">ℹ Range advantage: PFR has strong equity edge</p>
              <p className="text-poker-green/60 mt-3">💬 AI Coach: On dry ace-high boards, the preflop raiser...</p>
            </div>
            <div className="mt-4 text-right text-xs text-muted-foreground/50">
              Score: 72/100
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
