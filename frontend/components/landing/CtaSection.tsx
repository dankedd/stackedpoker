import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";

const TRUST = [
  "3 free analyses included",
  "No credit card",
  "GGPoker & PokerStars",
  "Instant results",
];

export function CtaSection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-secondary/10">
      {/* Background radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 60%, rgba(124,92,255,0.16) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        {/* Animated border card */}
        <div className="relative">
          {/* Pulsing glow ring */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-3xl border border-violet-500/45 animate-border-pulse pointer-events-none"
          />

          <div className="rounded-3xl border border-violet-500/20 bg-card/50 backdrop-blur-sm text-center px-8 py-14 sm:px-14 sm:py-16">
            {/* Icon */}
            <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/30 shadow-xl shadow-violet-900/30">
              <Zap className="h-6 w-6 text-violet-400" />
            </div>

            <h2 className="mb-5 text-3xl sm:text-4xl lg:text-[3.25rem] font-black text-foreground leading-[1.05] tracking-tight">
              Stop leaving EV{" "}
              <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-400">
                on the table.
              </span>
            </h2>

            <p className="mx-auto mb-9 max-w-lg text-lg text-muted-foreground/70 leading-relaxed">
              Analyze your first hand in seconds — no account, no credit card, no setup.
              Just paste your hand history and let the engine do the work.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                href="/analyze"
                className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:-translate-y-0.5 transition-all duration-200"
              >
                Analyze a hand — free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-border/60 bg-card/40 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border hover:-translate-y-0.5 transition-all duration-200"
              >
                Create free account
              </Link>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground/40">
              {TRUST.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500/55" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
