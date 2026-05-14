"use client";

import { Brain, BarChart3, Map, Layers, Zap, Play } from "lucide-react";
import { useInView } from "@/hooks/useInView";

function CoachingPreview() {
  return (
    <div className="mt-5 rounded-xl border border-violet-500/20 bg-black/40 p-3.5 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-rose-500/60" />
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-muted-foreground/35 tracking-wider text-[9px] uppercase">
          ai coach · live
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[9px] text-violet-400/50">analyzing</span>
        </div>
      </div>

      <div className="space-y-1.5 mb-2.5">
        <div className="flex items-start gap-2">
          <span className="text-emerald-400 shrink-0">✓</span>
          <span className="text-foreground/60">Preflop 3x open — correct sizing BTN NL100</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-400 shrink-0">△</span>
          <span className="text-amber-300/80">C-bet 75% pot → overbet on dry board, prefer 25–33%</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-red-400 shrink-0">✗</span>
          <span className="text-red-300/70">Turn barrel — range disadvantage, check behind</span>
        </div>
      </div>

      <div className="border-t border-border/20 pt-2.5 text-muted-foreground/60">
        On A♦ 7♣ 2♠ you hold{" "}
        <span className="text-violet-300">strong range advantage</span> as PFR.
        Small sizing (25–33%) protects cheaply while building the pot.
        <span className="inline-block w-px h-3 bg-violet-400/70 ml-0.5 align-middle animate-cursor" />
      </div>
    </div>
  );
}

function ReplayPreview() {
  const board = [
    ["A", "♦", "red"],
    ["7", "♣", "slate"],
    ["2", "♠", "slate"],
    ["K", "♥", "red"],
  ] as const;

  return (
    <div className="mt-5 rounded-xl border border-blue-500/20 bg-black/40 p-3.5 text-[11px]">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-muted-foreground/40 text-[9px] uppercase tracking-wider">
          Hand Replay
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] text-blue-400">
          <Play className="h-2 w-2 fill-current" />
          Turn · street 3/4
        </div>
      </div>

      <div className="relative h-20 bg-black/30 rounded-lg border border-border/20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-3 rounded-full border border-border/15 bg-[#0d1a0d]/80" />
        <div className="relative flex gap-0.5">
          {board.map(([r, s, c]) => (
            <div key={r + s} className="h-7 w-5 bg-white rounded shadow-lg flex flex-col items-center justify-between py-0.5">
              <span className={`text-[7px] font-black leading-none ${c === "red" ? "text-red-600" : "text-slate-900"}`}>{r}</span>
              <span className={`text-[9px] leading-none ${c === "red" ? "text-red-600" : "text-slate-900"}`}>{s}</span>
            </div>
          ))}
        </div>
        <span className="absolute bottom-1 right-2 text-[8px] text-blue-400/50 font-mono">BTN</span>
        <span className="absolute top-1 left-2 text-[8px] text-muted-foreground/30 font-mono">BB</span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <div className="h-1 w-1 rounded-full bg-muted-foreground/25" />
        <div className="flex-1 relative h-0.5 bg-border/30 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-3/4 bg-blue-500/50 rounded-full" />
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400/70" />
        <span className="text-[8px] text-muted-foreground/35 font-mono">Turn</span>
      </div>
    </div>
  );
}

const SMALL_FEATURES = [
  {
    icon: BarChart3,
    title: "Hand Parser",
    description:
      "Automatic detection of GGPoker and PokerStars histories. Every street, every bet, all positions.",
    iconCls: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Map,
    title: "Board Texture",
    description:
      "Classifies every board: A-high dry, wet broadway, monotone, paired, low connected. Know your edge.",
    iconCls: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Layers,
    title: "Spot Classification",
    description:
      "SRP vs 3-bet pot, position matchups, effective stack depth — precise context for every recommendation.",
    iconCls: "text-sky-400",
    iconBg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: Zap,
    title: "GTO Heuristics",
    description:
      "Rules engine evaluates c-bet frequency, sizing, and line choices against solver benchmarks.",
    iconCls: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
];

export function Features() {
  const { ref: headerRef, visible: headerVisible } = useInView();
  const { ref: gridRef, visible: gridVisible } = useInView();

  return (
    <section id="features" className="relative py-24 sm:py-32 overflow-hidden bg-secondary/15">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-violet-600/7 blur-[130px]"
      />

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div
          ref={headerRef}
          className={`mx-auto mb-14 max-w-2xl text-center scroll-reveal ${headerVisible ? "visible" : ""}`}
        >
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 px-4 py-1.5 text-[13px] text-violet-300">
            <Zap className="h-3.5 w-3.5" />
            Features
          </div>
          <h2 className="mb-5 text-4xl font-black tracking-tight text-foreground sm:text-[3.25rem] leading-[1.05]">
            Fix your leaks,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-500 animate-gradient">
              not just your stats
            </span>
          </h2>
          <p className="text-muted-foreground/70 text-lg leading-relaxed">
            From raw hand history to actionable GTO coaching in under 5 seconds. No solver required.
          </p>
        </div>

        {/* Bento grid */}
        <div ref={gridRef} className="grid gap-4 lg:grid-cols-12">
          {/* AI Coaching — hero card */}
          <div className={`lg:col-span-7 rounded-2xl border border-violet-500/25 bg-card/70 p-6 card-lift hover:border-violet-500/40 scroll-reveal ${gridVisible ? "visible" : ""}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Brain className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Coaching</h3>
                <p className="text-[11px] text-muted-foreground/50">
                  Powered by Claude · Explains the why
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed">
              Every mistake comes with a full explanation — range dynamics, board texture, sizing
              rationale. Not just &ldquo;wrong,&rdquo; but{" "}
              <em className="not-italic text-foreground/75">why it costs you</em> and exactly how to
              fix it.
            </p>
            <CoachingPreview />
          </div>

          {/* Replay Engine — hero card */}
          <div className={`lg:col-span-5 rounded-2xl border border-blue-500/20 bg-card/70 p-6 card-lift hover:border-blue-500/35 scroll-reveal scroll-delay-1 ${gridVisible ? "visible" : ""}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Play className="h-5 w-5 text-blue-400 fill-current" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Hand Replay</h3>
                <p className="text-[11px] text-muted-foreground/50">
                  Animated · Street-by-street
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed">
              Step through every street with animated action labels, pot tracking, and synchronized
              coaching callouts. See exactly where the hand went wrong.
            </p>
            <ReplayPreview />
          </div>

          {/* 4 smaller features */}
          {SMALL_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`lg:col-span-3 rounded-2xl border border-border/50 bg-card/60 p-5 card-lift hover:border-border/80 hover:bg-card/80 scroll-reveal scroll-delay-${i + 2} ${gridVisible ? "visible" : ""}`}
            >
              <div className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border ${f.iconBg}`}>
                <f.icon className={`h-4 w-4 ${f.iconCls}`} />
              </div>
              <h3 className="mb-2 text-[14px] font-semibold text-foreground">{f.title}</h3>
              <p className="text-[13px] text-muted-foreground/65 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
