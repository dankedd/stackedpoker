"use client";

import { useState, useEffect } from "react";
import {
  MonitorPlay, MousePointerClick, Download, UploadCloud,
  ChevronDown, Archive, Check, ArrowRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    Icon: MonitorPlay,
    title: "Open PokerCraft",
    desc: "GG Poker → PokerCraft → Sessions",
    accent: "violet" as const,
  },
  {
    num: "02",
    Icon: MousePointerClick,
    title: "Select a session",
    desc: "Pick the session or tournament you want to review",
    accent: "blue" as const,
  },
  {
    num: "03",
    Icon: Download,
    title: "Click Download",
    desc: "Export the hand history ZIP file from PokerCraft",
    accent: "violet" as const,
  },
  {
    num: "04",
    Icon: UploadCloud,
    title: "Paste or upload",
    desc: "AI extracts every hand — replays + coaching auto-generated",
    accent: "emerald" as const,
  },
];

const ACCENT = {
  violet: {
    icon:  "bg-violet-500/15 text-violet-400 border-violet-500/25",
    num:   "text-violet-500/35",
    hover: "hover:border-violet-500/30",
  },
  blue: {
    icon:  "bg-blue-500/15 text-blue-400 border-blue-500/25",
    num:   "text-blue-500/35",
    hover: "hover:border-blue-500/30",
  },
  emerald: {
    icon:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    num:   "text-emerald-500/35",
    hover: "hover:border-emerald-500/30",
  },
};

const EXAMPLE_HAND = `Poker Hand #RC0123456789: Hold'em No Limit ($0.50/$1.00) - 2024/01/15 14:22:33
Table 'FastForward' 6-Max Seat #3 is the button
Seat 1: Player1 ($112.30 in chips)
Seat 2: Player2 ($98.50 in chips)
Seat 3: Hero ($87.50 in chips)
Seat 4: Player4 ($145.00 in chips)
*** HOLE CARDS ***
Dealt to Hero [As Kd]
Player4: folds
Hero: raises $2.50 to $3.50
Player1: folds
Player2: calls $3.50
*** FLOP *** [Ah 7c 2d]
Player2: checks
Hero: bets $4.50
Player2: raises $12.00
Hero: calls $7.50
*** TURN *** [Ah 7c 2d] [Ks]
Player2: bets $18.00
Hero: raises $45.00
Player2: folds
Hero collected $71.00 from pot
*** SUMMARY ***
Total pot $71.00 | Rake $3.00
Board [Ah 7c 2d Ks]
Seat 3: Hero showed [As Kd] and won ($68.00)`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface GGPokerGuideProps {
  /** "full" = complete onboarding section. "compact" = single-line helper card. */
  variant?: "full" | "compact";
  className?: string;
  noHeader?: boolean;
}

// ─── Compact variant ──────────────────────────────────────────────────────────

function CompactGuide({ className }: { className?: string }) {
  const [exampleOpen, setExampleOpen] = useState(false);

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card/40 overflow-hidden", className)}>
      <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
            <Zap className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight">
              GG Poker → PokerCraft → Sessions → Download ZIP → paste here
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              ZIP exports, raw hand histories, and multi-hand sessions all supported
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:ml-auto shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400">
            <Archive className="h-2.5 w-2.5" />
            ZIP supported
          </span>
          <button
            type="button"
            onClick={() => setExampleOpen(v => !v)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground px-2 py-0.5 rounded-full border border-border/30 hover:border-border/50 transition-colors"
          >
            Example
            <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", exampleOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {exampleOpen && (
        <div className="border-t border-border/30 px-4 py-3 bg-secondary/10">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2">
            Example GG Poker hand history
          </p>
          <pre className="text-[10px] leading-relaxed text-muted-foreground/50 overflow-x-auto whitespace-pre font-mono">
            {EXAMPLE_HAND}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Full variant ─────────────────────────────────────────────────────────────

function FullGuide({ className, noHeader }: { className?: string; noHeader?: boolean }) {
  const [exampleOpen, setExampleOpen] = useState(false);

  return (
    <div className={cn("space-y-5 animate-fade-in", className)}>

      {/* Header */}
      {!noHeader && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-5 bg-gradient-to-r from-violet-500 to-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/70">
              Getting started
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            How to import from GG Poker
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Download your session from PokerCraft and let the AI rebuild every hand automatically.
          </p>
        </div>
      )}

      {/* 4-step grid — 2×2 on mobile, 4×1 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STEPS.map((step, i) => {
          const { Icon } = step;
          const ac = ACCENT[step.accent];
          return (
            <div
              key={step.num}
              className={cn(
                "relative rounded-xl border border-border/40 bg-card/40 p-4",
                "transition-all duration-200 hover:bg-card/70 hover:-translate-y-0.5 hover:shadow-lg",
                ac.hover,
              )}
            >
              <span className={cn("text-[10px] font-black font-mono mb-2.5 block", ac.num)}>
                {step.num}
              </span>
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border mb-2.5",
                ac.icon,
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-semibold text-foreground mb-1 leading-tight">{step.title}</h3>
              <p className="text-[11px] text-muted-foreground/65 leading-relaxed">{step.desc}</p>

              {/* Connector — desktop only */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute -right-[7px] top-1/2 -translate-y-1/2 z-10 text-border">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom row: formats + sites + mini flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

        {/* Supported formats */}
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2.5">
            Supported uploads
          </p>
          <div className="space-y-1.5">
            {[
              { label: "PokerCraft ZIP export", primary: true },
              { label: "Raw hand history text" },
              { label: "Tournament exports" },
              { label: "Multi-hand session files" },
            ].map(({ label, primary }) => (
              <div key={label} className="flex items-center gap-2">
                <Check className={cn(
                  "h-3 w-3 shrink-0",
                  primary ? "text-violet-400" : "text-muted-foreground/35",
                )} />
                <span className={cn(
                  "text-xs leading-tight",
                  primary ? "font-semibold text-foreground" : "text-muted-foreground/55",
                )}>
                  {primary && (
                    <Archive className="inline h-2.5 w-2.5 text-violet-400 mr-1 -mt-px" />
                  )}
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sites + mini pipeline */}
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3.5 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2.5">
            Optimized for
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 border border-emerald-500/25">
                <Check className="h-2.5 w-2.5 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-foreground">GG Poker</span>
              <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-px rounded-full">
                Primary
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/10 border border-blue-500/20">
                <Check className="h-2.5 w-2.5 text-blue-400" />
              </div>
              <span className="text-xs text-muted-foreground/70">PokerStars</span>
            </div>
          </div>

          {/* Mini pipeline */}
          <div className="mt-auto pt-3 border-t border-border/20">
            <div className="flex items-center gap-1 flex-wrap">
              {["ZIP", "→", "AI", "→", "Replay", "→", "Coaching"].map((t, i) => {
                const isArrow = t === "→";
                if (isArrow) return (
                  <span key={i} className="text-[10px] text-muted-foreground/30">→</span>
                );
                const cls = i === 0
                  ? "border-violet-500/25 bg-violet-500/8 text-violet-400/70"
                  : i === 6
                  ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400/70"
                  : "border-border/30 bg-secondary/20 text-muted-foreground/45";
                return (
                  <span key={i} className={cn(
                    "text-[10px] font-mono px-1.5 py-px rounded border",
                    cls,
                  )}>
                    {t}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible example */}
      <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden">
        <button
          type="button"
          onClick={() => setExampleOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/10 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Archive className="h-3.5 w-3.5 text-muted-foreground/45" />
            <span className="text-xs font-medium text-muted-foreground/60">
              Example GG Poker hand history
            </span>
          </div>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground/35 transition-transform duration-200",
            exampleOpen && "rotate-180",
          )} />
        </button>

        {exampleOpen && (
          <div className="border-t border-border/30 px-4 pb-4 pt-3 bg-secondary/5">
            <p className="text-[10px] text-muted-foreground/40 mb-2 font-medium">
              This is what a GG Poker export looks like. Paste it directly — or upload the ZIP.
            </p>
            <pre className="text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground/50 overflow-x-auto whitespace-pre font-mono bg-black/20 rounded-lg p-3 border border-border/20">
              {EXAMPLE_HAND}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function GGPokerGuide({ variant = "full", className, noHeader }: GGPokerGuideProps) {
  if (variant === "compact") return <CompactGuide className={className} />;
  return <FullGuide className={className} noHeader={noHeader} />;
}

// ─── Accordion wrapper ────────────────────────────────────────────────────────

const SEEN_KEY = "ggpoker_guide_seen";

export function GGPokerAccordion({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) {
      setIsOpen(true);
      localStorage.setItem(SEEN_KEY, "1");
    }
  }, []);

  return (
    <div className={cn("rounded-2xl border border-violet-500/20 bg-card/30 overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-violet-500/5 transition-colors text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/20">
          <Zap className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          How to import from GG Poker
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400">
            <Archive className="h-2.5 w-2.5" />
            ZIP supported
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground/50 transition-transform duration-300",
            isOpen && "rotate-180",
          )} />
        </div>
      </button>

      <div className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}>
        <div className="overflow-hidden">
          <div className="px-4 pb-5 pt-2 border-t border-violet-500/10">
            <FullGuide noHeader />
          </div>
        </div>
      </div>
    </div>
  );
}
