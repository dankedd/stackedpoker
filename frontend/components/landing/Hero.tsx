"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Shield, CheckCircle2, Flame, Trophy, GraduationCap } from "lucide-react";
import { getJourneyOverview } from "@/lib/learn/journey";
import { LESSONS } from "@/lib/learn/curriculum";

type PreviewTab = "lesson" | "ranges" | "progress";

const journeyOverview = getJourneyOverview({});

// ── Mini playing card ───────────────────────────────────────────────────────

function PlayingCard({
  rank,
  suit,
  delay = 0,
  size = "md",
}: {
  rank: string;
  suit: string;
  delay?: number;
  size?: "sm" | "md" | "lg";
}) {
  const isRed = suit === "♥" || suit === "♦";
  const dims =
    size === "lg" ? "h-16 w-11" : size === "md" ? "h-13 w-9" : "h-10 w-7";
  const rankCls =
    size === "lg" ? "text-[13px]" : size === "md" ? "text-[11px]" : "text-[9px]";
  const suitCls =
    size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm";
  return (
    <div
      className={`${dims} bg-white rounded-lg shadow-2xl shadow-black/70 flex flex-col items-center justify-between p-1 animate-deal`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <span className={`${rankCls} font-black leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>{rank}</span>
      <span className={`${suitCls} leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>{suit}</span>
    </div>
  );
}

// ── Lesson tab content (predict → reveal) ───────────────────────────────────

function LessonContent() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-5 space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">C-Betting Fundamentals</p>
          <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">
            Lesson 3 · Range Advantage
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-[9px] text-violet-400">
          <GraduationCap className="h-2.5 w-2.5" />
          Predict
        </div>
      </div>

      <div className="rounded-lg border border-border/30 bg-black/20 px-3 py-2.5">
        <div className="flex gap-1 mb-2.5">
          {([["K", "♥", "red"], ["T", "♠", "slate"], ["4", "♦", "red"]] as const).map(([r, s, c]) => (
            <div key={r + s} className="h-8 w-6 bg-white rounded shadow-lg flex flex-col items-center justify-between py-0.5">
              <span className={`text-[8px] font-black leading-none ${c === "red" ? "text-red-600" : "text-slate-900"}`}>{r}</span>
              <span className={`text-xs leading-none ${c === "red" ? "text-red-600" : "text-slate-900"}`}>{s}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-foreground/75 font-mono">
          You raised BTN, BB called. As the range-advantage player, what's your c-bet size here?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Check", correct: false },
          { label: "Bet 33%", correct: true },
          { label: "Bet 75%", correct: false },
          { label: "Bet pot", correct: false },
        ].map(({ label, correct }) => (
          <button
            key={label}
            onClick={() => setSelected(label)}
            className={`text-[11px] font-mono py-1.5 px-2 rounded-lg border transition-all duration-150 text-left ${
              selected === label
                ? correct
                  ? "bg-emerald-500/20 border-emerald-500/45 text-emerald-300"
                  : "bg-amber-500/15 border-amber-500/35 text-amber-300"
                : "bg-black/20 border-border/40 text-muted-foreground/60 hover:text-muted-foreground/80 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected && (
        <div
          className={`rounded-lg px-3 py-2.5 text-[10px] font-mono animate-fade-in border leading-relaxed ${
            selected === "Bet 33%"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/25 text-amber-300"
          }`}
        >
          {selected === "Bet 33%"
            ? "✓ This lesson's target — a small size lets your whole range apply pressure cheaply on a dry, disconnected board."
            : "△ Not quite — on this texture your range has the edge everywhere, so you don't need to risk much to get folds."}
        </div>
      )}
    </div>
  );
}

// ── Range grid tab content ──────────────────────────────────────────────────

const RANGE_ROWS = [
  ["r", "r", "r", "r", "b", "b", "f", "f", "f", "f", "f", "f", "f"],
  ["r", "r", "r", "r", "b", "b", "b", "f", "f", "f", "f", "f", "f"],
  ["b", "b", "r", "r", "b", "b", "f", "f", "f", "f", "f", "f", "f"],
  ["b", "b", "b", "r", "b", "f", "f", "f", "f", "f", "f", "f", "f"],
  ["f", "b", "b", "b", "b", "f", "f", "f", "f", "f", "f", "f", "f"],
  ["f", "f", "f", "f", "f", "f", "f", "f", "f", "f", "f", "f", "f"],
] as const;

const CELL_CLS: Record<string, string> = {
  r: "bg-violet-500/70",
  b: "bg-blue-500/50",
  f: "bg-white/[0.04]",
};

function RangeGridContent() {
  return (
    <div className="p-5 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Range vs Range</p>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] text-blue-400">
          BTN opening range
        </div>
      </div>

      <div className="rounded-lg border border-border/30 bg-black/20 p-3">
        <div className="grid grid-cols-[repeat(13,1fr)] gap-[3px]">
          {RANGE_ROWS.flatMap((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={`aspect-square rounded-[2px] ${CELL_CLS[cell]}`}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 font-mono">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-violet-500/70" /> Raise
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-blue-500/50" /> Call
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-white/[0.08]" /> Fold
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        See and build ranges instead of memorizing disconnected charts — construct the shape yourself.
      </p>
    </div>
  );
}

// ── Progress tab content ────────────────────────────────────────────────────

function ProgressContent() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" strokeWidth="3" className="stroke-white/[0.06]" />
            <circle
              cx="24" cy="24" r="20"
              strokeWidth="3"
              strokeDasharray={`${0.64 * 2 * Math.PI * 20} ${2 * Math.PI * 20}`}
              strokeLinecap="round"
              className="stroke-amber-400"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-foreground">7</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-foreground">Level 7</span>
            <span className="text-[10px] text-muted-foreground/50 font-mono">1,240 XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-2.5 py-2 text-center">
          <Flame className="h-3.5 w-3.5 text-orange-400 mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">6</p>
          <p className="text-[9px] text-muted-foreground/50">day streak</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-black/20 px-2.5 py-2 text-center">
          <Trophy className="h-3.5 w-3.5 text-amber-400/80 mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">9</p>
          <p className="text-[9px] text-muted-foreground/50">badges</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-black/20 px-2.5 py-2 text-center">
          <GraduationCap className="h-3.5 w-3.5 text-violet-400/80 mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">{journeyOverview.availableModules}</p>
          <p className="text-[9px] text-muted-foreground/50">modules</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Every lesson tracks concept mastery — so you always know where you're strong and where to focus next.
      </p>
    </div>
  );
}

// ── Product preview panel ───────────────────────────────────────────────────

function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("lesson");

  const tabs: { id: PreviewTab; label: string }[] = [
    { id: "lesson", label: "Lesson" },
    { id: "ranges", label: "Ranges" },
    { id: "progress", label: "Progress" },
  ];

  return (
    <div className="relative">
      {/* Outer glow ring */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl border border-violet-500/60 animate-border-pulse pointer-events-none"
      />

      <div className="rounded-2xl border border-violet-500/25 bg-card/90 shadow-2xl shadow-violet-900/40 overflow-hidden backdrop-blur-md">
        {/* Browser chrome with tabs */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-black/25">
          <div className="flex gap-1.5 shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500/65" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/65" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/65" />
          </div>
          <div className="flex gap-0.5 ml-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-all duration-150 ${
                  activeTab === tab.id
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 flex justify-end">
            <div className="flex items-center gap-1 bg-black/30 rounded px-2 py-0.5">
              <Shield className="h-2.5 w-2.5 text-emerald-400/50" />
              <span className="text-[9px] text-muted-foreground/30 font-mono">stacked.poker</span>
            </div>
          </div>
        </div>

        {activeTab === "lesson" && <LessonContent />}
        {activeTab === "ranges" && <RangeGridContent />}
        {activeTab === "progress" && <ProgressContent />}
      </div>

      {/* Floating "complete" badge */}
      <div className="absolute -top-3.5 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-1 text-[11px] text-emerald-400 font-medium animate-float">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        Lesson complete
      </div>

      {/* Floating label */}
      <div
        className="absolute -bottom-3 left-5 flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[10px] text-blue-400 font-medium animate-float"
        style={{ animationDelay: "1s" }}
      >
        <Zap className="h-2.5 w-2.5" />
        Interactive &amp; visual
      </div>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section className="relative bg-background overflow-hidden min-h-[92vh] flex items-center">
      {/* Background atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-[30%] w-[900px] h-[700px] rounded-full bg-violet-600/12 blur-[150px] animate-drift-glow" />
        <div className="absolute top-1/2 -translate-y-1/2 -right-64 w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-violet-800/6 blur-[120px]" />
        <div className="absolute top-[15%] left-[8%] w-[320px] h-[320px] rounded-full bg-blue-500/5 blur-[100px] animate-drift-glow" style={{ animationDelay: "-8s" }} />
      </div>

      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* Bottom vignette */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── LEFT ── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-[13px] text-violet-300 animate-fade-in"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>Structured lessons · Interactive tables · Real ranges</span>
            </div>

            {/* Headline */}
            <h1
              className="mb-6 font-black tracking-tight text-foreground leading-[1.0] text-[clamp(2.6rem,6vw,5rem)] animate-reveal-up"
              style={{ animationDelay: "120ms", animationFillMode: "forwards" }}
            >
              Stop memorizing hands.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-500 animate-gradient">
                Start understanding poker.
              </span>
            </h1>

            {/* Sub */}
            <p
              className="mb-9 text-lg sm:text-xl text-muted-foreground/75 leading-relaxed max-w-lg mx-auto lg:mx-0 animate-reveal-up"
              style={{ animationDelay: "240ms", animationFillMode: "forwards" }}
            >
              Structured, interactive lessons that teach real poker strategy —
              predict the decision, see the reveal, and understand{" "}
              <em className="not-italic text-foreground/80">why</em> it works.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-10 animate-reveal-up"
              style={{ animationDelay: "360ms", animationFillMode: "forwards" }}
            >
              <Link
                href="/learn"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/35 hover:shadow-violet-500/55 hover:-translate-y-0.5 active:translate-y-px active:scale-[0.97] transition-all duration-200 btn-poker-hover will-change-transform"
              >
                Start learning
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <Link
                href="/#curriculum"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border/60 bg-card/40 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border/80 hover:-translate-y-0.5 active:translate-y-px active:scale-[0.97] transition-all duration-200 will-change-transform"
              >
                See the learning path
              </Link>
            </div>

            {/* Trust strip */}
            <div
              className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2.5 text-[13px] text-muted-foreground/45 animate-reveal-up"
              style={{ animationDelay: "480ms", animationFillMode: "forwards" }}
            >
              {[
                { icon: CheckCircle2, label: `${LESSONS.length} lessons live` },
                { icon: CheckCircle2, label: `${journeyOverview.availableModules} modules available` },
                { icon: CheckCircle2, label: "Free to start" },
                { icon: CheckCircle2, label: "No credit card" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-emerald-500/60" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT — product preview ── */}
          <div className="hidden lg:block relative pt-6 pb-6">
            <ProductPreview />
          </div>
        </div>

        {/* Mobile preview — simplified static */}
        <div className="lg:hidden mt-14 rounded-2xl border border-border/50 bg-card/70 p-5 text-left shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-foreground">C-Betting Fundamentals</p>
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">Lesson 3 · Range Advantage</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-[10px] font-medium">
              Predict
            </div>
          </div>
          <div className="flex gap-1.5 mb-3">
            {([["K","♥",true],["T","♠",false],["4","♦",true]] as [string,string,boolean][]).map(([r,s,red]) => (
              <div key={r+s} className="h-10 w-7 bg-white rounded shadow-lg flex flex-col items-center justify-between p-0.5">
                <span className={`text-[9px] font-black leading-none ${red ? "text-red-600" : "text-slate-900"}`}>{r}</span>
                <span className={`text-sm leading-none ${red ? "text-red-600" : "text-slate-900"}`}>{s}</span>
              </div>
            ))}
            <span className="ml-2 self-center text-[10px] text-muted-foreground/40 font-mono">BTN raised, BB called</span>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <GraduationCap className="h-3 w-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300">This lesson's target</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
              Small c-bets (25–33%) apply pressure cheaply when your whole range has the edge on a dry board.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
