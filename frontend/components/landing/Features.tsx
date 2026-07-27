"use client";

import { BookOpen, LayoutGrid, Layers, Map, Zap, BarChart3, CheckCircle2, Circle, Lock } from "lucide-react";
import { useInView } from "@/hooks/useInView";

function CurriculumPreview() {
  const rows = [
    { label: "Poker Fundamentals", status: "complete" as const },
    { label: "Preflop Aggression", status: "current" as const },
    { label: "C-Betting Fundamentals", status: "locked" as const },
  ];
  const ICONS = { complete: CheckCircle2, current: Circle, locked: Lock };
  const STYLES = {
    complete: "border-emerald-500/25 bg-emerald-500/[0.04] text-emerald-400",
    current: "border-violet-500/30 bg-violet-500/[0.05] text-violet-400",
    locked: "border-border/25 bg-black/20 text-muted-foreground/35",
  };

  return (
    <div className="mt-5 rounded-xl border border-violet-500/20 bg-black/40 p-3.5 space-y-2">
      {rows.map((r) => {
        const Icon = ICONS[r.status];
        return (
          <div
            key={r.label}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[11px] font-medium ${STYLES[r.status]}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className={r.status === "locked" ? "" : "text-foreground/80"}>{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TablePreview() {
  const board = [
    ["A", "♦", "red"],
    ["7", "♣", "slate"],
    ["2", "♠", "slate"],
  ] as const;

  return (
    <div className="mt-5 rounded-xl border border-blue-500/20 bg-black/40 p-3.5 text-[11px]">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-muted-foreground/40 text-[9px] uppercase tracking-wider">
          Postflop Decision
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] text-blue-400">
          BTN vs BB · Flop
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

      <p className="mt-2.5 text-[10px] text-muted-foreground/50 leading-relaxed">
        Every decision is taught in the context of real stacks, pots, and positions — not an abstract chart.
      </p>
    </div>
  );
}

const SMALL_FEATURES = [
  {
    icon: Layers,
    title: "Range Training",
    description:
      "See and construct ranges rather than memorizing disconnected charts. Build the shape yourself, street by street.",
    iconCls: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Map,
    title: "Visual Strategy",
    description:
      "Range grids, boards, and equity concepts made visual — see why a strategy changes, not just that it does.",
    iconCls: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Zap,
    title: "Active Learning",
    description:
      "Predict, commit, reveal, understand. Every concept is taught through interaction, not passive reading.",
    iconCls: "text-sky-400",
    iconBg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: BarChart3,
    title: "Adaptive Review",
    description:
      "Concept mastery is tracked lesson by lesson, with extra reinforcement whenever you need it.",
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
            Learn poker{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-500 animate-gradient">
              the way it's actually played
            </span>
          </h2>
          <p className="text-muted-foreground/70 text-lg leading-relaxed">
            A structured curriculum taught through interactive tables and real ranges — not articles to skim.
          </p>
        </div>

        {/* Bento grid */}
        <div ref={gridRef} className="grid gap-4 lg:grid-cols-12">
          {/* Structured Learning Path — hero card */}
          <div className={`lg:col-span-7 rounded-2xl border border-violet-500/25 bg-card/70 p-6 card-lift hover:border-violet-500/40 scroll-reveal ${gridVisible ? "visible" : ""}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <BookOpen className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Structured Learning Path</h3>
                <p className="text-[11px] text-muted-foreground/50">
                  Concept by concept, in order
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed">
              Progress through poker concepts deliberately — each module unlocks the next,
              building from fundamentals to advanced postflop strategy without gaps.
            </p>
            <CurriculumPreview />
          </div>

          {/* Interactive Poker Tables — hero card */}
          <div className={`lg:col-span-5 rounded-2xl border border-blue-500/20 bg-card/70 p-6 card-lift hover:border-blue-500/35 scroll-reveal scroll-delay-1 ${gridVisible ? "visible" : ""}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <LayoutGrid className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Interactive Poker Tables</h3>
                <p className="text-[11px] text-muted-foreground/50">
                  Real stacks, pots, positions
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed">
              Learn decisions in the context of real table states — not abstract theory.
            </p>
            <TablePreview />
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
