import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative bg-background overflow-hidden pt-36 pb-24 sm:pt-48 sm:pb-32">
      {/* Atmospheric glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="absolute top-40 -left-56 w-[500px] h-[500px] rounded-full bg-blue-600/6 blur-[110px]" />
        <div className="absolute top-28 -right-56 w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[110px]" />
      </div>

      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 text-center">

        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          GTO-inspired analysis · AI coaching included
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-foreground leading-[1.05] sm:text-7xl lg:text-[86px]">
          Stop guessing.{" "}
          <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-400 to-violet-400">
            Start winning.
          </span>
        </h1>

        {/* Subheading */}
        <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed sm:text-xl">
          Paste any hand history from GGPoker or PokerStars. Get instant solver-inspired
          analysis, board texture breakdowns, and AI coaching in seconds.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
          >
            Analyze your hand — free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border/70 bg-card/40 text-foreground text-[15px] font-semibold hover:border-border hover:bg-card/80 hover:-translate-y-0.5 transition-all duration-200"
          >
            See how it works
          </Link>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground/55 mb-16">
          {[
            { color: "bg-emerald-400", label: "GGPoker & PokerStars" },
            { color: "bg-violet-400",  label: "GTO-inspired heuristics" },
            { color: "bg-blue-400",    label: "AI coaching included" },
            { color: "bg-amber-400",   label: "Free to start" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Dark app preview */}
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-border/50 bg-card/60 shadow-2xl shadow-black/60 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-secondary/40">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500/45" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/45" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/45" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="text-[11px] text-muted-foreground/35 font-mono tracking-wide">
                  stacked.poker / analyze
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 text-left space-y-3">
              {/* Result header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div>
                  <p className="text-xs font-semibold text-foreground">Analysis Results</p>
                  <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-mono">
                    BTN vs BB · NL100 · Single Raised Pot
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/15 px-3 py-1">
                  <span className="text-sm font-black text-violet-300">72</span>
                  <span className="text-[10px] text-muted-foreground/50">/ 100</span>
                </div>
              </div>

              {[
                { icon: "✓", color: "text-emerald-400", text: "Hand parsed: BTN vs BB — Single Raised Pot" },
                { icon: "✓", color: "text-emerald-400", text: "Board: A♦ 7♣ 2♠ — A-high dry, rainbow" },
                { icon: "△", color: "text-amber-400",   text: "Flop c-bet 75% pot — recommend 25–33% sizing", bold: true },
                { icon: "ℹ", color: "text-blue-400",    text: "PFR holds a significant range advantage here" },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-2.5 font-mono text-xs">
                  <span className={`font-bold ${row.color} mt-0.5 shrink-0`}>{row.icon}</span>
                  <span className={row.bold ? "text-foreground font-medium" : "text-muted-foreground/65"}>
                    {row.text}
                  </span>
                </div>
              ))}

              {/* AI coaching snippet */}
              <div className="mt-1 rounded-xl border border-violet-500/15 bg-violet-500/5 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-violet-400" />
                  <span className="text-[11px] font-semibold text-violet-300">AI Coach</span>
                </div>
                <p className="text-[11px] text-muted-foreground/65 leading-relaxed font-mono">
                  On dry ace-high boards, the PFR holds a significant range advantage.
                  Small bet sizes (25–33%) are preferred to build pots while
                  protecting your range with minimal risk…
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
