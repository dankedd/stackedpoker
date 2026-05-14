"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Shield, CheckCircle2 } from "lucide-react";

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
  const colorCls = isRed ? "text-red-600" : "text-slate-900";
  return (
    <div
      className={`${dims} bg-white rounded-lg shadow-2xl shadow-black/70 flex flex-col items-center justify-between p-1 animate-deal`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <span className={`${rankCls} font-black leading-none ${colorCls}`}>{rank}</span>
      <span className={`${suitCls} leading-none ${colorCls}`}>{suit}</span>
    </div>
  );
}

// ── Animated preview panel ──────────────────────────────────────────────────

function AnalysisPreview() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const target = 74;
      const dur = 1000;
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        setScore(Math.round(target * (1 - Math.pow(1 - p, 2))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* Outer glow ring */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl border border-violet-500/60 animate-border-pulse pointer-events-none"
      />

      <div className="rounded-2xl border border-violet-500/25 bg-card/90 shadow-2xl shadow-violet-900/40 overflow-hidden backdrop-blur-md">
        {/* Browser chrome */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60 bg-black/25">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500/65" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/65" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/65" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 bg-black/30 rounded px-2.5 py-0.5">
              <Shield className="h-2.5 w-2.5 text-emerald-400/50" />
              <span className="text-[10px] text-muted-foreground/40 font-mono tracking-wide">
                stacked.ai/analyze
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Header row */}
          <div
            className="flex items-center justify-between animate-reveal-up"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <div>
              <p className="text-sm font-bold text-foreground">Analysis Results</p>
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">
                BTN vs BB · NL100 · Single Raised Pot
              </p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/35">
              <span className="text-lg font-black text-violet-300 tabular-nums w-6 text-right">
                {score}
              </span>
              <span className="text-[10px] text-muted-foreground/40">/100</span>
            </div>
          </div>

          {/* Hero cards */}
          <div
            className="flex items-center gap-3 animate-reveal-up"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
          >
            <div className="flex gap-1.5 items-end">
              <PlayingCard rank="K" suit="♠" delay={500} size="md" />
              <PlayingCard rank="Q" suit="♠" delay={660} size="md" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/50 font-mono">Hero · BTN</p>
              <p className="text-[10px] text-violet-400/60 font-mono">250bb eff</p>
            </div>
          </div>

          {/* Board */}
          <div
            className="flex items-center gap-2 animate-reveal-up"
            style={{ animationDelay: "700ms", animationFillMode: "forwards" }}
          >
            <div className="flex gap-1.5">
              <PlayingCard rank="A" suit="♦" delay={820} size="sm" />
              <PlayingCard rank="7" suit="♣" delay={940} size="sm" />
              <PlayingCard rank="2" suit="♠" delay={1060} size="sm" />
            </div>
            <span className="text-[10px] text-muted-foreground/35 font-mono ml-1">
              Flop · Dry · A-high
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border/25" />

          {/* Findings */}
          <div className="space-y-1.5">
            {[
              {
                icon: "✓",
                cls: "text-emerald-400",
                text: "Preflop 3x open — optimal sizing",
                textCls: "text-foreground/65",
                delay: 1500,
              },
              {
                icon: "△",
                cls: "text-amber-400",
                text: "Flop c-bet 75% pot → prefer 25–33%",
                textCls: "text-amber-300/85",
                delay: 1700,
              },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[11px] font-mono animate-reveal-up"
                style={{ animationDelay: `${f.delay}ms`, animationFillMode: "forwards" }}
              >
                <span className={`font-bold shrink-0 ${f.cls}`}>{f.icon}</span>
                <span className={f.textCls}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* AI Coach */}
          <div
            className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-3.5 py-3 animate-reveal-up"
            style={{ animationDelay: "2100ms", animationFillMode: "forwards" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3 w-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300">AI Coach</span>
              <div className="ml-auto flex items-center gap-1">
                <div className="h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[9px] text-violet-400/50">Live</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/65 font-mono leading-relaxed">
              Dry ace-high boards strongly favor the PFR. Use small c-bet
              sizes (25–33%) — you protect cheaply while extracting from weaker pairs.
              <span className="inline-block w-px h-3 bg-violet-400/80 ml-0.5 align-middle animate-cursor-blink" />
            </p>
          </div>
        </div>
      </div>

      {/* Floating "complete" badge */}
      <div className="absolute -top-3.5 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-1 text-[11px] text-emerald-400 font-medium animate-float">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        Analysis complete
      </div>

      {/* Floating EV label */}
      <div className="absolute -bottom-3 left-5 flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[10px] text-blue-400 font-medium animate-float" style={{ animationDelay: "1s" }}>
        <Zap className="h-2.5 w-2.5" />
        GTO-inspired heuristics
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

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── LEFT ── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-[13px] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Replay engine · AI coaching · Puzzle training</span>
            </div>

            {/* Headline */}
            <h1 className="mb-6 font-black tracking-tight text-foreground leading-[1.0] text-[clamp(2.6rem,6vw,5rem)]">
              Every poker leak
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-300 to-violet-400">
                has a pattern.
              </span>
            </h1>

            {/* Sub */}
            <p className="mb-9 text-lg sm:text-xl text-muted-foreground/75 leading-relaxed max-w-lg mx-auto lg:mx-0">
              AI-powered hand analysis with animated replay, GTO-inspired heuristics,
              and coaching that explains the <em className="not-italic text-foreground/80">why</em> — not just the mistake.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-10">
              <Link
                href="/analyze"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/35 hover:shadow-violet-500/55 hover:-translate-y-0.5 transition-all duration-200"
              >
                Analyze a hand — free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/analyze/puzzles"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border/60 bg-card/40 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border hover:-translate-y-0.5 transition-all duration-200"
              >
                Try a puzzle
              </Link>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2.5 text-[13px] text-muted-foreground/45">
              {[
                { icon: CheckCircle2, label: "GGPoker & PokerStars" },
                { icon: CheckCircle2, label: "GTO-inspired engine" },
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

          {/* ── RIGHT — animated preview ── */}
          <div className="hidden lg:block relative pt-6 pb-6">
            <AnalysisPreview />
          </div>
        </div>

        {/* Mobile preview — simplified static */}
        <div className="lg:hidden mt-14 rounded-2xl border border-border/50 bg-card/70 p-5 text-left shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-foreground">Analysis Results</p>
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">BTN vs BB · NL100</p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 font-black text-sm">
              74<span className="text-[10px] text-muted-foreground/40 font-normal">/100</span>
            </div>
          </div>
          <div className="flex gap-1.5 mb-3">
            {([["K","♠",false],["Q","♠",false]] as [string,string,boolean][]).map(([r,s,red]) => (
              <div key={r+s} className="h-10 w-7 bg-white rounded shadow-lg flex flex-col items-center justify-between p-0.5">
                <span className={`text-[9px] font-black leading-none ${red ? "text-red-600" : "text-slate-900"}`}>{r}</span>
                <span className={`text-sm leading-none ${red ? "text-red-600" : "text-slate-900"}`}>{s}</span>
              </div>
            ))}
            <span className="ml-2 self-center text-[10px] text-muted-foreground/40 font-mono">Board: A♦ 7♣ 2♠</span>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3 w-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300">AI Coach</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
              Use small c-bets (25–33%) on dry ace-high boards — you hold strong range advantage here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
