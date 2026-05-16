"use client";

import Link from "next/link";
import {
  Brain, AlertTriangle, Map, TrendingUp, BookOpen,
  Lock, Sparkles, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Fake blurred preview cards ─────────────────────────────────────────────

function LockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
      <Lock className="h-2.5 w-2.5" />
      Coming Soon
    </span>
  );
}

function BlurOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 border border-violet-500/30">
          <Lock className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <span className="text-xs font-medium text-foreground/80">{label}</span>
      </div>
    </div>
  );
}

function FakeLeakCard({ title, severity, ev, blurClass }: {
  title: string; severity: string; ev: string; blurClass?: string
}) {
  const color =
    severity === "critical" ? "border-red-500/20 bg-red-500/5" :
    severity === "major"    ? "border-amber-500/20 bg-amber-500/5" :
                              "border-blue-500/20 bg-blue-500/5";
  const textColor =
    severity === "critical" ? "text-red-400" :
    severity === "major"    ? "text-amber-400" : "text-blue-400";

  return (
    <div className={cn("rounded-xl border p-3 flex items-center gap-3", color, blurClass)}>
      <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black bg-background/60 border border-border/40 shrink-0", textColor)}>
        !
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-2.5 rounded bg-foreground/10 w-3/4 mb-1.5" />
        <div className="h-1.5 rounded bg-foreground/6 w-1/2" />
      </div>
      <span className="text-[10px] font-medium text-red-400 shrink-0">{ev}</span>
    </div>
  );
}

function FakeStatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <div className="h-1.5 rounded bg-foreground/6 w-2/3" />
    </div>
  );
}

function FakeTrendLine() {
  // Simple SVG squiggle to hint at a trend chart
  return (
    <svg viewBox="0 0 300 60" className="w-full opacity-60" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cs-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <path
        d="M0,45 C30,40 50,15 80,20 S130,50 160,30 S220,10 260,25 L300,20"
        fill="none" stroke="url(#cs-grad)" strokeWidth={2} strokeLinecap="round"
      />
      <path
        d="M0,45 C30,40 50,15 80,20 S130,50 160,30 S220,10 260,25 L300,20 L300,60 L0,60 Z"
        fill="url(#cs-grad)" opacity={0.08}
      />
    </svg>
  );
}

// ── Feature list ───────────────────────────────────────────────────────────

const FEATURES = [
  { icon: AlertTriangle, label: "Personalized leak detection",    sub: "Ranked by EV impact" },
  { icon: Brain,         label: "AI coaching advice",             sub: "Tailored to your skill level" },
  { icon: Map,           label: "Positional analysis",            sub: "Heatmap by position & score" },
  { icon: TrendingUp,    label: "Score & EV trend tracking",      sub: "See your improvement over time" },
  { icon: BookOpen,      label: "Custom study plan",              sub: "Puzzles, drills & articles per leak" },
  { icon: Sparkles,      label: "Playing style classification",   sub: "TAG · LAG · Nit · Reg · more" },
];

// ── Main component ─────────────────────────────────────────────────────────

export function ComingSoonProfile() {
  return (
    <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

      {/* ── Hero ── */}
      <div className="text-center mb-12 animate-fade-in">
        {/* Glow orb */}
        <div className="relative flex justify-center mb-6">
          <div className="absolute h-40 w-40 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-500/20 border border-violet-500/25 shadow-xl shadow-violet-900/20">
            <Brain className="h-9 w-9 text-violet-400" />
            <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/20 px-2 py-0.5">
              <Sparkles className="h-2.5 w-2.5 text-violet-300" />
              <span className="text-[9px] font-bold text-violet-300 uppercase tracking-wide">Soon</span>
            </div>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-3 tracking-tight">
          AI Player Profile{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
            Analysis
          </span>
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-6">
          Your personal poker coach is coming soon. We're building the most detailed
          player analysis system ever put into a poker training tool.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-semibold text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Coming Soon
          </span>
          <span className="text-xs text-muted-foreground">Pro members get early access</span>
        </div>
      </div>

      {/* ── Feature grid ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
        {FEATURES.map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/20 shrink-0 mt-0.5">
              <Icon className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Blurred preview sections ── */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Preview — coming soon
        </p>

        <div className="grid sm:grid-cols-2 gap-4">

          {/* Biggest Leaks preview */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400/60" />
                <span className="text-sm font-semibold text-foreground/60">Biggest Leaks</span>
              </div>
              <LockedBadge />
            </div>
            <div className="space-y-2 blur-[3px] pointer-events-none select-none">
              <FakeLeakCard title="C-Bet Oversizing" severity="critical" ev="−18bb" />
              <FakeLeakCard title="Missed River Value" severity="major" ev="−11bb" />
              <FakeLeakCard title="BB Overfolding" severity="minor" ev="−6bb" />
            </div>
            <BlurOverlay label="Leak detection unlocking soon" />
          </div>

          {/* AI Coach preview */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-400/60" />
                <span className="text-sm font-semibold text-foreground/60">AI Coach</span>
              </div>
              <LockedBadge />
            </div>
            <div className="blur-[3px] pointer-events-none select-none space-y-2">
              <div className="rounded-lg border border-violet-500/10 bg-violet-500/5 p-3">
                <div className="h-2.5 rounded bg-foreground/10 w-full mb-2" />
                <div className="h-2 rounded bg-foreground/6 w-4/5 mb-1.5" />
                <div className="h-2 rounded bg-foreground/6 w-3/5" />
              </div>
              {["Downsize your flop c-bets on dry boards", "Stop checking back value hands on the river", "Widen your BB defense vs late-position opens"].map((_, i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-card/50 p-3">
                  <div className="h-2.5 rounded bg-foreground/10 w-2/3 mb-1.5" />
                  <div className="h-2 rounded bg-foreground/6 w-4/5" />
                </div>
              ))}
            </div>
            <BlurOverlay label="AI coaching coming soon" />
          </div>

          {/* Position heatmap preview */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-blue-400/60" />
                <span className="text-sm font-semibold text-foreground/60">Position Heatmap</span>
              </div>
              <LockedBadge />
            </div>
            <div className="blur-[3px] pointer-events-none select-none">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { pos: "BTN", score: "81", color: "bg-green-500/20 border-green-500/30" },
                  { pos: "CO",  score: "74", color: "bg-blue-500/15 border-blue-500/20"  },
                  { pos: "HJ",  score: "68", color: "bg-violet-500/15 border-violet-500/20" },
                  { pos: "SB",  score: "59", color: "bg-amber-500/10 border-amber-500/15" },
                  { pos: "BB",  score: "52", color: "bg-amber-500/8 border-amber-500/12"  },
                  { pos: "UTG", score: "61", color: "bg-violet-500/10 border-violet-500/15" },
                  { pos: "EP",  score: "66", color: "bg-violet-500/12 border-violet-500/18" },
                  { pos: "MP",  score: "70", color: "bg-blue-500/12 border-blue-500/18"  },
                ].map(({ pos, score, color }) => (
                  <div key={pos} className={cn("rounded-lg border p-2 text-center", color)}>
                    <p className="text-[9px] font-bold text-muted-foreground">{pos}</p>
                    <p className="text-sm font-black text-foreground/70">{score}</p>
                  </div>
                ))}
              </div>
            </div>
            <BlurOverlay label="Positional analysis coming soon" />
          </div>

          {/* Score trend preview */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400/60" />
                <span className="text-sm font-semibold text-foreground/60">Score Trend</span>
              </div>
              <LockedBadge />
            </div>
            <div className="blur-[3px] pointer-events-none select-none">
              <div className="flex gap-3 mb-3">
                <FakeStatTile label="Best" value="88" color="text-green-400/60" />
                <FakeStatTile label="Avg"  value="71" color="text-violet-400/60" />
                <FakeStatTile label="Worst" value="44" color="text-red-400/60" />
              </div>
              <div className="rounded-lg border border-border/30 bg-background/30 p-3">
                <FakeTrendLine />
              </div>
            </div>
            <BlurOverlay label="EV trend tracking coming soon" />
          </div>

        </div>
      </div>

      {/* ── CTA ── */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-blue-500/5 p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/25">
            <Bell className="h-5 w-5 text-violet-400" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Be the first to know</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Player Profile Analysis is in final development.
          Pro subscribers get priority early access.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-md shadow-violet-900/30"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro — Early Access
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 transition-all"
          >
            Analyse hands in the meantime
          </Link>
        </div>
      </div>

    </main>
  );
}
