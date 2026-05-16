"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, RotateCcw, ChevronRight, Zap, Target,
  CheckCircle2, XCircle, AlertTriangle, Trophy, Flame, Shuffle,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { PUZZLES, QUALITY_SCORE, type ActionOption, type PuzzleStep } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Puzzle pot & stack engine
// Derives pot size and player stacks from puzzle metadata + hero's action history.
// No AI, no hardcoded values — pure chip accounting from context strings + choices.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse the big blind dollar value from a stakes string like "$1/$2" or "€0.50/€1". */
function parseBigBlind(stakes: string): number {
  const m = stakes.match(/[\$€£]?(\d+(?:\.\d+)?)\s*\/\s*[\$€£]?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[2]) : 1;
}

/** Format a BB amount for display: integers show as "80bb", decimals as "24.5bb". */
function fmtBb(bb: number): string {
  const rounded = Math.round(bb * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}bb` : `${rounded.toFixed(1)}bb`;
}

/** Extract explicit "Pot $X" value from a step context string, converting to BB. */
function extractContextPotBb(context: string, bbDollars: number): number | null {
  const m = context.match(/[Pp]ot[:\s]+[\$€£]?(\d+(?:\.\d+)?)/);
  if (!m || bbDollars <= 0) return null;
  return parseFloat(m[1]) / bbDollars;
}

/** Extract villain's bet/raise size in BB from a context string. Returns 0 if villain checked. */
function extractVillainBetBb(context: string, bbDollars: number): number {
  if (bbDollars <= 0) return 0;
  const m = context.match(
    /(?:bets?|raises?\s*to|raises?|barrels?|fires?|overbets?|jams?|shoves?|leads?)\s+[\$€£]?(\d+(?:\.\d+)?)/i
  );
  return m ? parseFloat(m[1]) / bbDollars : 0;
}

/** Extract villain's preflop raise size in BB from a context string. */
function extractPreflopVillainRaiseBb(context: string, bbDollars: number): number {
  if (bbDollars <= 0) return 2.5;
  const m =
    context.match(/raises?\s+to\s+[\$€£]?(\d+(?:\.\d+)?)/i) ??
    context.match(/opens?\s+to\s+[\$€£]?(\d+(?:\.\d+)?)/i) ??
    context.match(/raises?\s+[\$€£]?(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) / bbDollars : 2.5;
}

/**
 * Compute how many BB hero commits for a chosen option.
 * heroAlreadyInBb = chips hero already has in THIS street (1 for BB preflop, 0.5 for SB preflop, 0 post-flop).
 */
function heroInvestBb(optionLabel: string, bbDollars: number, heroAlreadyInBb: number): number {
  const lo = optionLabel.toLowerCase().trim();
  if (/^(fold|check)/.test(lo)) return 0;

  // "Raise to $X" or "3-bet to $X" — total chips committed this street
  const raiseToM = optionLabel.match(/(?:raise\s+to|3.?bet\s+to)\s+[\$€£]?(\d+(?:\.\d+)?)/i);
  if (raiseToM && bbDollars > 0) {
    const totalBb = parseFloat(raiseToM[1]) / bbDollars;
    return Math.max(0, totalBb - heroAlreadyInBb);
  }

  // Dollar amount in label: "Call $3", "Bet $18 (33%)", "Raise $20" — additional chips
  const amtM = optionLabel.match(/[\$€£](\d+(?:\.\d+)?)/);
  if (amtM && bbDollars > 0) return parseFloat(amtM[1]) / bbDollars;

  // All-in / shove with no explicit amount
  if (/(?:jam|all.?in|shove)/i.test(lo)) return Infinity;

  return 0;
}

interface PuzzleStackState {
  potBb: number;         // pot size before hero acts at this step
  heroStack: number;     // hero's stack before hero acts at this step
  villainStack: number;  // villain's stack before hero acts at this step
  heroAlreadyIn: number; // chips hero already has in the pot THIS street
}

/**
 * Deterministic pot + stack calculation for puzzle state.
 *
 * Algorithm:
 *   1. Seed blinds from hero position.
 *   2. Walk through past hero choices, deducting investments.
 *   3. For each past step, extract villain's action from the NEXT step's context pot delta.
 *   4. For the current step, read explicit context pot + villain bet.
 *
 * Villain stack is derived from the canonical pot (from context strings) minus hero's total
 * investment minus third-party blinds (SB from folded players).
 */
function computePuzzleState(
  puzzle: { heroPosition: string; villainPosition: string; effectiveStack: number; stakes: string; steps: Array<{ street: string; context: string; board: string[] }> },
  stepIdx: number,
  stepResults: Array<{ option: { label: string } }>
): PuzzleStackState {
  const bbDollars = parseBigBlind(puzzle.stakes);
  const startStack = puzzle.effectiveStack;
  const heroPos = puzzle.heroPosition.toUpperCase();
  const steps = puzzle.steps;

  // ── Blind seeding ──────────────────────────────────────────────────────────
  // How much each party has posted before any action.
  // sbInPot: chips from a third-party SB who has already folded (not hero, not villain).
  const sbInPot = heroPos === "SB" ? 0 : 0.5; // hero IS the SB → counted in heroTotalIn; else a third party posted
  let heroTotalIn = heroPos === "BB" ? 1 : heroPos === "SB" ? 0.5 : 0;

  // ── Walk through past decisions ────────────────────────────────────────────
  let heroStreetIn = heroTotalIn; // tracks hero's investment in the current-loop street
  let prevStreet = "preflop";

  for (let i = 0; i < Math.min(stepIdx, stepResults.length); i++) {
    const step = steps[i];
    const choice = stepResults[i]?.option;
    if (!choice) break;

    // Street transition → reset per-street tracker
    if (step.street !== prevStreet) {
      prevStreet = step.street;
      heroStreetIn = 0;
    }

    const invest = heroInvestBb(choice.label, bbDollars, heroStreetIn);
    const actualInvest = Math.min(invest, Math.max(0, startStack - heroTotalIn));
    heroStreetIn += actualInvest;
    heroTotalIn += actualInvest;
  }

  // ── Current step pot & stacks ──────────────────────────────────────────────
  const currentStep = steps[stepIdx];
  const currentStreet = currentStep.street;

  // heroAlreadyIn for the CURRENT step (what hero has committed this street before acting now)
  const heroAlreadyIn =
    currentStreet === "preflop"
      ? heroPos === "BB" ? 1 : heroPos === "SB" ? 0.5 : 0
      : // post-flop: if the previous step was the same street, hero invested heroStreetIn
      stepIdx > 0 && steps[stepIdx - 1]?.street === currentStreet
      ? heroStreetIn
      : 0;

  let potBb: number;

  const contextPot = extractContextPotBb(currentStep.context, bbDollars);
  const villainBet = extractVillainBetBb(currentStep.context, bbDollars);

  if (currentStreet === "preflop" && contextPot === null) {
    // Preflop: pot = blinds posted + villain's raise (before hero acts)
    if (heroPos === "BB") {
      // Villain raised to X; hero (BB) already posted 1bb
      const villainRaise = extractPreflopVillainRaiseBb(currentStep.context, bbDollars);
      potBb = 0.5 + 1 + villainRaise; // SB + BB + villain raise
    } else if (heroPos === "SB") {
      // Hero is SB acting first or facing BB, or 3bet situation
      const villainRaise = extractPreflopVillainRaiseBb(currentStep.context, bbDollars);
      potBb = villainRaise > 0 ? 0.5 + 1 + villainRaise : 0.5 + 1;
    } else {
      // Hero is IP (BTN, CO, etc.): pot = just the blinds before hero opens
      potBb = 1.5;
    }
  } else if (contextPot !== null) {
    // Context explicitly states the pot at the start of this street.
    // Add villain's bet on top (villain bet before hero acts this street).
    potBb = contextPot + villainBet;
  } else {
    // Fallback: derive from what we've tracked
    potBb = sbInPot + heroTotalIn + villainBet;
  }

  const heroStack = Math.max(0, startStack - heroTotalIn);

  // Villain stack: derived from canonical pot minus all other contributions.
  // pot = sbInPot + heroTotalIn + villainTotalIn → villainTotalIn = pot - sbInPot - heroTotalIn
  const villainTotalIn = Math.max(0, potBb - sbInPot - heroTotalIn);
  const villainStack = Math.max(0, startStack - villainTotalIn);

  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[Puzzle] step ${stepIdx} (${currentStreet}) — ` +
      `pot: ${potBb.toFixed(2)}bb | hero: ${heroStack.toFixed(2)}bb | villain: ${villainStack.toFixed(2)}bb | ` +
      `heroTotalIn: ${heroTotalIn.toFixed(2)} | villainTotalIn: ${villainTotalIn.toFixed(2)} | sbInPot: ${sbInPot}`
    );
  }

  return {
    potBb: Math.max(0, potBb),
    heroStack: Math.max(0, heroStack),
    villainStack: Math.max(0, villainStack),
    heroAlreadyIn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface PuzzleStats {
  solved: string[];
  scores: Record<string, number>;
  streak: number;
  bestStreak: number;
  randomStreak?: number;
  bestRandomStreak?: number;
  lastRandomId?: string;
  attempts?: Array<{ id: string; score: number; timestamp: number; difficulty: string; category: string }>;
  lastPlayed?: number;
}

function loadStats(): PuzzleStats {
  try {
    const raw = localStorage.getItem("puzzle_stats");
    return raw ? JSON.parse(raw) : { solved: [], scores: {}, streak: 0, bestStreak: 0 };
  } catch { return { solved: [], scores: {}, streak: 0, bestStreak: 0 }; }
}

function saveResult(puzzleId: string, score: number, difficulty: string, category: string, isRandom = false) {
  try {
    const stats = loadStats();
    if (!stats.solved.includes(puzzleId)) {
      stats.solved.push(puzzleId);
      stats.streak = (stats.streak ?? 0) + 1;
      stats.bestStreak = Math.max(stats.bestStreak ?? 0, stats.streak);
    }
    if (!stats.scores[puzzleId] || score > stats.scores[puzzleId]) {
      stats.scores[puzzleId] = score;
    }
    if (isRandom) {
      stats.lastRandomId = puzzleId;
      if (score >= 60) {
        stats.randomStreak = (stats.randomStreak ?? 0) + 1;
        stats.bestRandomStreak = Math.max(stats.bestRandomStreak ?? 0, stats.randomStreak);
      } else {
        stats.randomStreak = 0;
      }
    }
    if (!stats.attempts) stats.attempts = [];
    stats.attempts.push({ id: puzzleId, score, timestamp: Date.now(), difficulty, category });
    if (stats.attempts.length > 50) stats.attempts = stats.attempts.slice(-50);
    stats.lastPlayed = Date.now();
    localStorage.setItem("puzzle_stats", JSON.stringify(stats));
  } catch { /* silent */ }
}

function pickRandomPuzzle(excludeId?: string) {
  const stats = loadStats();
  const candidates = PUZZLES.filter(p => p.id !== excludeId);
  if (candidates.length === 0) return PUZZLES[0] ?? null;
  const weights = candidates.map(p => {
    if (!stats.solved.includes(p.id)) return 3;
    return (stats.scores[p.id] ?? 0) < 60 ? 2 : 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Card component — clean white premium cards
// ─────────────────────────────────────────────────────────────────────────────

type CardSize = "sm" | "md" | "lg";

function CardFace({ card, size = "md" }: { card: string; size?: CardSize }) {
  const rank = card.slice(0, -1).replace("T", "10");
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const sym = ({ h: "♥", d: "♦", c: "♣", s: "♠" } as const)[suit as "h"|"d"|"c"|"s"] ?? "";

  const sizes: Record<CardSize, string> = {
    sm:  "w-9 h-[52px] rounded-lg p-1 text-[10px]",
    md:  "w-11 h-16 rounded-xl p-1.5 text-xs",
    lg:  "w-[52px] h-[76px] rounded-xl p-2 text-sm",
  };
  const symSizes: Record<CardSize, string> = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };

  return (
    <div className={cn("bg-white flex flex-col justify-between shadow-xl shadow-black/50 select-none shrink-0", sizes[size])}>
      <span className={cn("font-black leading-none", isRed ? "text-red-600" : "text-slate-900")}>{rank}</span>
      <span className={cn("text-center leading-none", isRed ? "text-red-600" : "text-slate-900", symSizes[size])}>{sym}</span>
    </div>
  );
}

function CardBack({ size = "md" }: { size?: CardSize }) {
  const sizes: Record<CardSize, string> = {
    sm: "w-9 h-[52px] rounded-lg",
    md: "w-11 h-16 rounded-xl",
    lg: "w-[52px] h-[76px] rounded-xl",
  };
  return (
    <div className={cn("bg-gradient-to-br from-violet-900/50 to-blue-900/40 border border-white/[0.08] shrink-0", sizes[size])} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality badge
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY = {
  perfect:    { label: "Perfect",     cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  good:       { label: "Good play",   cls: "text-blue-400    bg-blue-500/10    border-blue-500/30" },
  acceptable: { label: "Acceptable",  cls: "text-yellow-400  bg-yellow-500/10  border-yellow-500/30" },
  mistake:    { label: "Mistake",     cls: "text-orange-400  bg-orange-500/10  border-orange-500/30" },
  punt:       { label: "Major punt",  cls: "text-red-400     bg-red-500/10     border-red-500/30" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Stack depth HUD helpers
// ─────────────────────────────────────────────────────────────────────────────

function stackZone(bb: number): { label: string; textCls: string; bgCls: string } {
  if (bb <= 12)  return { label: "jam/fold",  textCls: "text-red-400",     bgCls: "bg-red-500/10 border-red-500/22" };
  if (bb <= 20)  return { label: "short",     textCls: "text-orange-400",  bgCls: "bg-orange-500/10 border-orange-500/22" };
  if (bb <= 40)  return { label: "medium",    textCls: "text-amber-400",   bgCls: "bg-amber-500/10 border-amber-500/22" };
  if (bb <= 100) return { label: "deep",      textCls: "text-sky-400",     bgCls: "bg-sky-500/10 border-sky-500/22" };
  return               { label: "very deep",  textCls: "text-emerald-400", bgCls: "bg-emerald-500/10 border-emerald-500/22" };
}

function StackHUD({ bb, className }: { bb: number; className?: string }) {
  const zone = stackZone(bb);
  const display = Number.isInteger(bb) ? `${bb}` : `${bb}`;
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border"
        style={{
          background: "rgba(56,189,248,0.06)",
          borderColor: "rgba(56,189,248,0.16)",
          boxShadow: "0 0 12px rgba(56,189,248,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-sky-400/55 shrink-0" />
        <span className="text-[15px] font-black text-sky-200/90 tabular-nums leading-none">
          {display}
          <span className="text-[11px] font-semibold text-sky-400/55 ml-[2px]">bb</span>
        </span>
        <span className="text-[11px] text-muted-foreground/35 leading-none">effective</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", zone.textCls, zone.bgCls)}>
          {zone.label}
        </span>
      </div>
    </div>
  );
}

function StackPill({ bb }: { bb: number }) {
  return (
    <div
      className="h-6 px-2 flex items-center rounded-full"
      style={{
        background: "rgba(56,189,248,0.07)",
        border: "1px solid rgba(56,189,248,0.16)",
      }}
    >
      <span className="text-[11px] font-bold text-sky-300/80 tabular-nums leading-none">
        {bb}bb
      </span>
    </div>
  );
}

/** Live pot + stack display row shown on the poker table between board and hero cards. */
function PotStackRow({
  potBb,
  heroStack,
  villainStack,
}: {
  potBb: number;
  heroStack: number;
  villainStack: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 w-full px-1 mb-3">
      {/* Villain stack */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/35 shrink-0">
          Villain
        </span>
        <div
          className="flex items-center h-5 px-2 rounded-full shrink-0"
          style={{
            background: "rgba(100,116,139,0.08)",
            border: "1px solid rgba(100,116,139,0.16)",
          }}
        >
          <span className="text-[11px] font-bold text-slate-400/70 tabular-nums leading-none">
            {fmtBb(villainStack)}
          </span>
        </div>
      </div>

      {/* Pot — centered, prominent */}
      <div
        className="flex items-center gap-1.5 h-6 px-3 rounded-full shrink-0"
        style={{
          background: "rgba(251,191,36,0.07)",
          border: "1px solid rgba(251,191,36,0.18)",
          boxShadow: "0 0 10px rgba(251,191,36,0.06)",
        }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-amber-400/50 shrink-0" />
        <span className="text-[11px] font-black text-amber-300/80 tabular-nums leading-none">
          Pot: {fmtBb(potBb)}
        </span>
      </div>

      {/* Hero stack */}
      <div className="flex items-center gap-1.5 min-w-0 justify-end">
        <div
          className="flex items-center h-5 px-2 rounded-full shrink-0"
          style={{
            background: "rgba(124,92,255,0.08)",
            border: "1px solid rgba(124,92,255,0.18)",
          }}
        >
          <span className="text-[11px] font-bold text-violet-300/70 tabular-nums leading-none">
            {fmtBb(heroStack)}
          </span>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/35 shrink-0">
          Hero
        </span>
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: ActionOption["quality"] }) {
  const { label, cls } = QUALITY[quality];
  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action button
// ─────────────────────────────────────────────────────────────────────────────

function ActionBtn({
  option, chosen, disabled, onClick
}: {
  option: ActionOption;
  chosen: ActionOption | null;
  disabled: boolean;
  onClick: (o: ActionOption) => void;
}) {
  const isChosen = chosen?.id === option.id;
  const hasChosen = !!chosen;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(option)}
      className={cn(
        "rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border",
        isChosen
          ? cn("shadow-lg", QUALITY[option.quality].cls.replace("text-", "border-").split(" ").slice(0, 1)[0],
              QUALITY[option.quality].cls)
          : hasChosen
          ? "border-border/30 bg-secondary/20 text-muted-foreground/40 cursor-default"
          : "border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10"
      )}
    >
      {option.label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Street progress pip
// ─────────────────────────────────────────────────────────────────────────────

function StepPip({ step, index, current, result }: {
  step: PuzzleStep;
  index: number;
  current: number;
  result?: { quality: ActionOption["quality"]; score: number };
}) {
  const isPast = index < current;
  const isActive = index === current;

  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 transition-all",
        isPast
          ? result
            ? result.score >= 80
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : result.score >= 60
              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
            : "bg-secondary/60 text-muted-foreground/50 border border-border/30"
          : isActive
          ? "bg-violet-500 text-white shadow-sm shadow-violet-500/40"
          : "bg-secondary/40 border border-border/30 text-muted-foreground/40"
      )}>
        {isPast && result ? (result.score >= 80 ? "✓" : result.score >= 60 ? "~" : "✗") : index + 1}
      </div>
      <div>
        <p className={cn("text-xs font-medium capitalize", index <= current ? "text-foreground" : "text-muted-foreground/40")}>
          {step.street}
        </p>
        {result && <QualityBadge quality={result.quality} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result screen
// ─────────────────────────────────────────────────────────────────────────────

function ResultScreen({
  puzzle,
  stepResults,
  onRetry,
  onNext,
  isRandom = false,
  onNextRandom,
  randomStreak = 0,
}: {
  puzzle: ReturnType<typeof PUZZLES.find>;
  stepResults: Array<{ quality: ActionOption["quality"]; score: number; option: ActionOption }>;
  onRetry: () => void;
  onNext: () => void;
  isRandom?: boolean;
  onNextRandom?: () => void;
  randomStreak?: number;
}) {
  if (!puzzle) return null;
  const finalScore = Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length);
  const totalEvLoss = stepResults.reduce((s, r) => s + r.option.evLoss, 0);

  const grade =
    finalScore >= 90 ? "A" :
    finalScore >= 80 ? "B" :
    finalScore >= 65 ? "C" :
    finalScore >= 45 ? "D" : "F";

  const gradeColor =
    finalScore >= 90 ? "text-emerald-400" :
    finalScore >= 80 ? "text-blue-400" :
    finalScore >= 65 ? "text-yellow-400" :
    finalScore >= 45 ? "text-orange-400" : "text-red-400";

  const bestStep = stepResults.reduce((best, r, i) => r.score > stepResults[best].score ? i : best, 0);
  const worstStep = stepResults.reduce((worst, r, i) => r.score < stepResults[worst].score ? i : worst, 0);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      {/* Score header */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center mb-6">
        <div className="flex justify-center mb-4">
          {finalScore >= 80 ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          ) : finalScore >= 50 ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/15 border border-yellow-500/30">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          )}
        </div>

        <div className="flex items-end justify-center gap-2 mb-1">
          <span className={cn("text-6xl font-black", gradeColor)}>{finalScore}</span>
          <span className="text-muted-foreground text-2xl mb-1">/100</span>
          <span className={cn("text-4xl font-black ml-3 mb-0.5", gradeColor)}>{grade}</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {totalEvLoss > 0 ? `${totalEvLoss.toFixed(1)} BB EV lost across ${puzzle.steps.length} decisions` : "Flawless — no EV lost"}
        </p>
      </div>

      {/* Step breakdown */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Street Breakdown</h3>
        <div className="space-y-3">
          {stepResults.map((r, i) => (
            <div key={i} className={cn(
              "flex items-start justify-between gap-4 rounded-xl px-4 py-3 border",
              i === bestStep  ? "bg-emerald-500/5 border-emerald-500/20" :
              i === worstStep ? "bg-red-500/5 border-red-500/20" : "bg-secondary/20 border-border/30"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-foreground capitalize">{puzzle.steps[i].street}</span>
                  {i === bestStep && <span className="text-[10px] text-emerald-400">Best play</span>}
                  {i === worstStep && stepResults.length > 1 && <span className="text-[10px] text-red-400">Biggest leak</span>}
                </div>
                <p className="text-xs text-muted-foreground/80 truncate">{r.option.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <QualityBadge quality={r.quality} />
                <span className={cn("text-xs font-bold",
                  r.score >= 80 ? "text-emerald-400" : r.score >= 60 ? "text-yellow-400" : "text-red-400"
                )}>
                  {r.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching summary */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-foreground">Coaching Summary</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{puzzle.summary}</p>
      </div>

      {/* Actions */}
      {isRandom ? (
        <div className="space-y-3">
          {/* Random streak banner */}
          {randomStreak > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-2.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-300">{randomStreak} random streak</span>
            </div>
          )}
          <button
            onClick={onNextRandom}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <Shuffle className="h-4 w-4 shrink-0" />
            Next Random Spot
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onNext}>
              Sequential <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry Puzzle
          </Button>
          <Button variant="poker" size="lg" className="flex-1 gap-2" onClick={onNext}>
            Next Puzzle
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PuzzlePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRandomMode = searchParams.get("mode") === "random";

  const puzzleId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const puzzle = PUZZLES.find(p => p.id === puzzleId);
  const currentIdx = PUZZLES.findIndex(p => p.id === puzzleId);

  const [stepIdx, setStepIdx] = useState(0);
  const [chosen, setChosen] = useState<ActionOption | null>(null);
  const [stepResults, setStepResults] = useState<Array<{ quality: ActionOption["quality"]; score: number; option: ActionOption }>>([]);
  const [done, setDone] = useState(false);
  const [savedRandomStreak, setSavedRandomStreak] = useState(0);
  const coachingRef = useRef<HTMLDivElement>(null);

  // Scroll coaching panel into view on mobile after choosing
  useEffect(() => {
    if (chosen && coachingRef.current) {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setTimeout(() => coachingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      }
    }
  }, [chosen]);

  if (!puzzle) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-foreground font-medium">Puzzle not found.</p>
            <Link href="/analyze/puzzles">
              <Button variant="outline">Back to Puzzles</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currentStep = puzzle.steps[stepIdx];
  const isLastStep = stepIdx === puzzle.steps.length - 1;

  function handleAction(option: ActionOption) {
    if (chosen) return;
    setChosen(option);
    setStepResults(prev => [...prev, { quality: option.quality, score: QUALITY_SCORE[option.quality], option }]);
  }

  function handleContinue() {
    if (isLastStep) {
      const finalScore = Math.round(
        [...stepResults].reduce((s, r) => s + r.score, 0) / (puzzle?.steps.length ?? 1)
      );
      saveResult(puzzle?.id ?? "", finalScore, puzzle?.difficulty ?? "", puzzle?.category ?? "", isRandomMode);
      const updated = loadStats();
      setSavedRandomStreak(updated.randomStreak ?? 0);
      setDone(true);
    } else {
      setStepIdx(s => s + 1);
      setChosen(null);
    }
  }

  function handleRetry() {
    setStepIdx(0);
    setChosen(null);
    setStepResults([]);
    setDone(false);
  }

  function handleNext() {
    const nextPuzzle = PUZZLES[(currentIdx + 1) % PUZZLES.length];
    router.push(`/analyze/puzzles/${nextPuzzle.id}`);
  }

  function handleNextRandom() {
    const next = pickRandomPuzzle(puzzleId);
    if (next) router.push(`/analyze/puzzles/${next.id}?mode=random`);
  }

  const runningScore = stepResults.length > 0
    ? Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length)
    : null;

  // ── Live pot & stack state ─────────────────────────────────────────────
  // Derived deterministically from the puzzle metadata and hero's past choices.
  const stackState = useMemo(
    () => computePuzzleState(puzzle, stepIdx, stepResults),
    [puzzle, stepIdx, stepResults]
  );

  // ── Result screen ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-8 flex items-center justify-between">
              <Link href="/analyze/puzzles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Puzzles
              </Link>
              <p className="text-sm text-muted-foreground font-medium">{puzzle.title}</p>
            </div>
            <ResultScreen
              puzzle={puzzle}
              stepResults={stepResults}
              onRetry={handleRetry}
              onNext={handleNext}
              isRandom={isRandomMode}
              onNextRandom={handleNextRandom}
              randomStreak={savedRandomStreak}
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Puzzle player ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">

          {/* Top bar */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link href="/analyze/puzzles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" /> Puzzles
            </Link>
            {isRandomMode ? (
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25">
                  <Shuffle className="h-3 w-3 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-400">Random Spot</span>
                </div>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground/60 truncate">
                  {puzzle.effectiveStack}bb · {puzzle.format} · {puzzle.steps[stepIdx]?.street}
                </span>
              </div>
            ) : (
              <h1 className="text-sm font-semibold text-foreground hidden sm:block truncate">{puzzle.title}</h1>
            )}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">
                {stepIdx + 1}/{puzzle.steps.length} decisions
              </span>
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Restart
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-secondary/50 mb-8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
              style={{ width: `${((stepIdx) / puzzle.steps.length) * 100}%` }}
            />
          </div>

          {/* 3-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_288px] gap-6">

            {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
            <div className="space-y-4 order-3 lg:order-1">

              {/* Puzzle info */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
                <h2 className="font-semibold text-foreground text-sm leading-snug">{puzzle.title}</h2>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">{puzzle.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider",
                    puzzle.difficulty === "beginner"     ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                    puzzle.difficulty === "intermediate" ? "bg-amber-500/10  text-amber-400  border-amber-500/25" :
                    puzzle.difficulty === "advanced"     ? "bg-red-500/10    text-red-400    border-red-500/25" :
                                                          "bg-purple-500/10 text-purple-400 border-purple-500/25"
                  )}>{puzzle.difficulty}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground/60 border border-border/30">
                    {puzzle.format}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground/60 border border-border/30">
                    {puzzle.category}
                  </span>
                </div>
              </div>

              {/* Decision progress */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">
                  Progress
                </p>
                <div className="space-y-3">
                  {puzzle.steps.map((step, i) => (
                    <StepPip
                      key={i}
                      step={step}
                      index={i}
                      current={stepIdx}
                      result={stepResults[i]}
                    />
                  ))}
                </div>
              </div>

              {/* Running score */}
              {runningScore !== null && (
                <div className="rounded-2xl border border-border/50 bg-card/60 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
                    Score so far
                  </p>
                  <p className={cn("text-3xl font-black",
                    runningScore >= 80 ? "text-emerald-400" :
                    runningScore >= 60 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {runningScore}
                    <span className="text-lg text-muted-foreground font-normal">/100</span>
                  </p>
                </div>
              )}

              {/* Hand meta */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
                  Situation
                </p>
                {/* Stack — full-width highlighted row */}
                <div className="mb-3 rounded-xl border px-3 py-2.5"
                  style={{ background: "rgba(56,189,248,0.05)", borderColor: "rgba(56,189,248,0.14)" }}>
                  <p className="text-[10px] text-sky-400/50 mb-0.5">Effective stack</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-sky-200/90 tabular-nums leading-none">
                      {puzzle.effectiveStack}
                    </span>
                    <span className="text-sm font-semibold text-sky-400/55">BB</span>
                    <span className={cn("ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                      stackZone(puzzle.effectiveStack).textCls, stackZone(puzzle.effectiveStack).bgCls
                    )}>
                      {stackZone(puzzle.effectiveStack).label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {[
                    ["Stakes", puzzle.stakes],
                    ["Hero", puzzle.heroPosition],
                    ["Villain", puzzle.villainPosition],
                    ["Type", puzzle.gameType],
                    ["Format", puzzle.format],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground/50 text-[10px]">{k}</p>
                      <p className="text-foreground font-medium">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── CENTER: hand visual ───────────────────────────────────── */}
            <div className="order-1 lg:order-2">
              <div className="rounded-2xl border border-border/50 bg-card/60 p-6">

                {/* Position labels */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="h-7 px-3 flex items-center rounded-full bg-secondary/60 border border-border/40">
                      <span className="text-xs font-semibold text-muted-foreground">{puzzle.villainPosition}</span>
                    </div>
                    <div className="flex gap-1">
                      <CardBack size="sm" />
                      <CardBack size="sm" />
                    </div>
                    {/* Villain stack — dynamic */}
                    <div
                      className="h-6 px-2 flex items-center rounded-full"
                      style={{ background: "rgba(100,116,139,0.07)", border: "1px solid rgba(100,116,139,0.15)" }}
                    >
                      <span className="text-[11px] font-bold text-slate-400/65 tabular-nums leading-none">
                        {fmtBb(stackState.villainStack)}
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Street</p>
                    <p className="text-sm font-semibold text-violet-400 capitalize">{currentStep.street}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Hero stack — dynamic */}
                    <div
                      className="h-6 px-2 flex items-center rounded-full"
                      style={{ background: "rgba(124,92,255,0.08)", border: "1px solid rgba(124,92,255,0.18)" }}
                    >
                      <span className="text-[11px] font-bold text-violet-300/70 tabular-nums leading-none">
                        {fmtBb(stackState.heroStack)}
                      </span>
                    </div>
                    <div className="h-7 px-3 flex items-center rounded-full bg-violet-500/15 border border-violet-500/25">
                      <span className="text-xs font-semibold text-violet-400">{puzzle.heroPosition}</span>
                    </div>
                  </div>
                </div>

                {/* Board */}
                <div className="flex justify-center gap-2 mb-4 min-h-[64px] items-center">
                  {currentStep.street === "preflop" ? (
                    // Preflop: show 5 empty card slots
                    [0,1,2,3,4].map(i => (
                      <div key={i} className="w-11 h-16 rounded-xl bg-secondary/20 border border-border/20" />
                    ))
                  ) : (
                    <>
                      {currentStep.board.map((card, i) => (
                        <CardFace key={i} card={card} size="md" />
                      ))}
                      {/* Placeholder for unrevealed cards */}
                      {Array.from({ length: 5 - currentStep.board.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-11 h-16 rounded-xl bg-secondary/20 border border-border/20" />
                      ))}
                    </>
                  )}
                </div>

                {/* Pot + stack row — live chip accounting */}
                <PotStackRow
                  potBb={stackState.potBb}
                  heroStack={stackState.heroStack}
                  villainStack={stackState.villainStack}
                />

                {/* Divider */}
                <div className="border-t border-border/25 mb-6" />

                {/* Hero cards */}
                <div className="flex flex-col items-center mb-4">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-3">Your hand</p>
                  <div className="flex gap-3">
                    {puzzle.heroCards.map((card, i) => (
                      <CardFace key={i} card={card} size="lg" />
                    ))}
                  </div>
                </div>

                {/* Stack HUD — shows current hero stack (updates as choices are made) */}
                <StackHUD bb={stackState.heroStack} className="mb-5" />

                {/* Situation context */}
                <div className="rounded-xl bg-secondary/20 border border-border/25 px-4 py-3.5 mb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-1.5">{currentStep.context}</p>
                  <p className="text-sm font-semibold text-foreground">{currentStep.prompt}</p>
                </div>

                {/* Action buttons */}
                {!chosen ? (
                  <div className={cn(
                    "grid gap-2.5",
                    currentStep.options.length === 2 ? "grid-cols-2" :
                    currentStep.options.length === 3 ? "grid-cols-3" : "grid-cols-2"
                  )}>
                    {currentStep.options.map(opt => (
                      <ActionBtn
                        key={opt.id}
                        option={opt}
                        chosen={chosen}
                        disabled={false}
                        onClick={handleAction}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Chosen action summary */}
                    <div className={cn(
                      "rounded-xl border px-4 py-3 flex items-center justify-between gap-3",
                      chosen.quality === "perfect"    ? "border-emerald-500/30 bg-emerald-500/8" :
                      chosen.quality === "good"       ? "border-blue-500/30    bg-blue-500/8" :
                      chosen.quality === "acceptable" ? "border-yellow-500/30  bg-yellow-500/8" :
                      chosen.quality === "mistake"    ? "border-orange-500/30  bg-orange-500/8" :
                                                        "border-red-500/30     bg-red-500/8"
                    )}>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{chosen.label}</p>
                        {chosen.evLoss > 0 && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">−{chosen.evLoss} BB EV lost</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <QualityBadge quality={chosen.quality} />
                        <span className={cn("text-lg font-black",
                          QUALITY_SCORE[chosen.quality] >= 80 ? "text-emerald-400" :
                          QUALITY_SCORE[chosen.quality] >= 60 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {QUALITY_SCORE[chosen.quality]}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="poker"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleContinue}
                    >
                      {isLastStep ? (
                        <>
                          <Trophy className="h-4 w-4" /> See Results
                        </>
                      ) : (
                        <>
                          Next Street <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT SIDEBAR: coaching ───────────────────────────────── */}
            <div className="space-y-4 order-2 lg:order-3" ref={coachingRef}>

              {/* Coaching panel */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                    <Zap className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Coaching</p>
                </div>

                {!chosen ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/8 border border-violet-500/15 mb-3">
                      <Target className="h-5 w-5 text-violet-400/40" />
                    </div>
                    <p className="text-sm text-muted-foreground/60">
                      Make a decision to see coaching analysis.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <QualityBadge quality={chosen.quality} />
                    <p className="text-sm text-muted-foreground leading-relaxed">{chosen.coaching}</p>

                    {/* All options breakdown */}
                    <div className="pt-3 border-t border-border/25">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
                        All Options
                      </p>
                      <div className="space-y-2">
                        {currentStep.options.map(opt => (
                          <div
                            key={opt.id}
                            className={cn(
                              "rounded-lg p-3 border text-xs",
                              opt.id === chosen.id
                                ? "bg-secondary/40 border-border/50"
                                : "bg-secondary/15 border-border/20"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={cn("font-semibold", opt.id === chosen.id ? "text-foreground" : "text-muted-foreground/60")}>
                                {opt.label}
                              </span>
                              <QualityBadge quality={opt.quality} />
                            </div>
                            {opt.id !== chosen.id && (
                              <p className="text-muted-foreground/50 text-[11px] leading-relaxed line-clamp-2">
                                {opt.coaching}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Score tracker */}
              {stepResults.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
                    Score breakdown
                  </p>
                  <div className="space-y-2">
                    {stepResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] capitalize text-muted-foreground/60 w-14">{puzzle.steps[i].street}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all",
                              r.score >= 80 ? "bg-emerald-500" : r.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${r.score}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold w-8 text-right",
                          r.score >= 80 ? "text-emerald-400" : r.score >= 60 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {r.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Puzzle tip */}
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <Flame className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-violet-400 mb-1">Tip</p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">
                      {currentStep.street === "preflop"
                        ? "Consider your hand equity, stack depth, and positional advantage before acting."
                        : currentStep.street === "flop"
                        ? "Think about board texture, your range advantage, and whether to build or control the pot."
                        : currentStep.street === "turn"
                        ? "The turn defines hand strengths. Consider your range, villain's range, and remaining streets."
                        : "River decisions are all about hand strength vs pot odds. No more cards are coming."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
