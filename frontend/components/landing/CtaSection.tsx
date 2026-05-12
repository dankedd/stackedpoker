import Link from "next/link";
import { ArrowRight, Spade } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-secondary/20">
      {/* Central radial glow — stronger than other sections */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 60%, rgba(124,92,255,0.14) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/25 to-blue-600/15 border border-violet-500/25 shadow-lg shadow-violet-900/20">
          <Spade className="h-6 w-6 text-violet-400" />
        </div>

        <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
          Ready to play your{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
            best poker?
          </span>
        </h2>

        <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Start for free today. No credit card required. Get your first
          three analyses on us and see the difference for yourself.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/40 px-7 py-3.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border transition-all duration-200"
          >
            Try without account
          </Link>
        </div>

        <p className="mt-7 text-sm text-muted-foreground/35">
          Free plan · 3 analyses included · No card required
        </p>
      </div>
    </section>
  );
}
