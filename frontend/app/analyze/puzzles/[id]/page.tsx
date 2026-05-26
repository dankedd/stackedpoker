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
import { buildPokerState } from "@/lib/puzzles/pokerState";
import { runGoldenTests, validateAllPuzzles } from "@/lib/puzzles/puzzleValidator";

// ─────────────────────────────────────────────────────────────────────────────
// Puzzle pot & stack engine (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function parseBigBlind(stakes: string): number {
  const m = stakes.match(/[\$€£]?(\d+(?:\.\d+)?)\s*\/\s*[\$€£]?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[2]) : 1;
}

function fmtBb(bb: number): string {
  const rounded = Math.round(bb * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}bb` : `${rounded.toFixed(1)}bb`;
}

function bbifyText(text: string, bbDollars: number): string {
  if (bbDollars <= 0) return text;
  return text.replace(/[$€£](\d+(?:\.\d+)?)/g, (_, amt) => fmtBb(parseFloat(amt) / bbDollars));
}

function extractContextPotBb(context: string, bbDollars: number): number | null {
  const m = context.match(/[Pp]ot[:\s]+[\$€£]?(\d+(?:\.\d+)?)/);
  if (!m || bbDollars <= 0) return null;
  return parseFloat(m[1]) / bbDollars;
}

function extractVillainBetBb(context: string, bbDollars: number): number {
  if (bbDollars <= 0) return 0;
  const m = context.match(
    /(?:bets?|raises?\s*to|raises?|barrels?|fires?|overbets?|jams?|shoves?|leads?)\s+[\$€£]?(\d+(?:\.\d+)?)/i
  );
  return m ? parseFloat(m[1]) / bbDollars : 0;
}

function extractPreflopVillainRaiseBb(context: string, bbDollars: number): number {
  if (bbDollars <= 0) return 2.5;
  const m =
    context.match(/raises?\s+to\s+[\$€£]?(\d+(?:\.\d+)?)/i) ??
    context.match(/opens?\s+to\s+[\$€£]?(\d+(?:\.\d+)?)/i) ??
    context.match(/raises?\s+[\$€£]?(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) / bbDollars : 2.5;
}

function heroInvestBb(optionLabel: string, bbDollars: number, heroAlreadyInBb: number): number {
  const lo = optionLabel.toLowerCase().trim();
  if (/^(fold|check)/.test(lo)) return 0;
  const raiseToM = optionLabel.match(/(?:raise\s+to|3.?bet\s+to)\s+[\$€£]?(\d+(?:\.\d+)?)/i);
  if (raiseToM && bbDollars > 0) {
    const totalBb = parseFloat(raiseToM[1]) / bbDollars;
    return Math.max(0, totalBb - heroAlreadyInBb);
  }
  const amtM = optionLabel.match(/[\$€£](\d+(?:\.\d+)?)/);
  if (amtM && bbDollars > 0) return parseFloat(amtM[1]) / bbDollars;
  if (/(?:jam|all.?in|shove)/i.test(lo)) return Infinity;
  return 0;
}

interface PuzzleStackState {
  potBb: number;
  heroStack: number;
  villainStack: number;
  heroAlreadyIn: number;
}

function computePuzzleState(
  puzzle: { heroPosition: string; villainPosition: string; effectiveStack: number; stakes: string; steps: Array<{ street: string; context: string; board: string[] }> },
  stepIdx: number,
  stepResults: Array<{ option: { label: string } }>
): PuzzleStackState {
  const bbDollars = parseBigBlind(puzzle.stakes);
  const startStack = puzzle.effectiveStack;
  const heroPos = puzzle.heroPosition.toUpperCase();
  const steps = puzzle.steps;

  const sbInPot = heroPos === "SB" ? 0 : 0.5;
  let heroTotalIn = heroPos === "BB" ? 1 : heroPos === "SB" ? 0.5 : 0;

  let heroStreetIn = heroTotalIn;
  let prevStreet = "preflop";

  for (let i = 0; i < Math.min(stepIdx, stepResults.length); i++) {
    const step = steps[i];
    const choice = stepResults[i]?.option;
    if (!choice) break;
    if (step.street !== prevStreet) {
      prevStreet = step.street;
      heroStreetIn = 0;
    }
    const invest = heroInvestBb(choice.label, bbDollars, heroStreetIn);
    const actualInvest = Math.min(invest, Math.max(0, startStack - heroTotalIn));
    heroStreetIn += actualInvest;
    heroTotalIn += actualInvest;
  }

  const currentStep = steps[stepIdx];
  const currentStreet = currentStep.street;

  const heroAlreadyIn =
    currentStreet === "preflop"
      ? heroPos === "BB" ? 1 : heroPos === "SB" ? 0.5 : 0
      : stepIdx > 0 && steps[stepIdx - 1]?.street === currentStreet
      ? heroStreetIn
      : 0;

  let potBb: number;
  const contextPot = extractContextPotBb(currentStep.context, bbDollars);
  const villainBet = extractVillainBetBb(currentStep.context, bbDollars);

  if (currentStreet === "preflop" && contextPot === null) {
    if (heroPos === "BB") {
      const villainRaise = extractPreflopVillainRaiseBb(currentStep.context, bbDollars);
      potBb = 0.5 + 1 + villainRaise;
    } else if (heroPos === "SB") {
      const villainRaise = extractPreflopVillainRaiseBb(currentStep.context, bbDollars);
      potBb = villainRaise > 0 ? 0.5 + 1 + villainRaise : 0.5 + 1;
    } else {
      potBb = 1.5;
    }
  } else if (contextPot !== null) {
    potBb = contextPot + villainBet;
  } else {
    potBb = sbInPot + heroTotalIn + villainBet;
  }

  const heroStack = Math.max(0, startStack - heroTotalIn);
  const villainTotalIn = Math.max(0, potBb - sbInPot - heroTotalIn);
  const villainStack = Math.max(0, startStack - villainTotalIn);

  return {
    potBb: Math.max(0, potBb),
    heroStack: Math.max(0, heroStack),
    villainStack: Math.max(0, villainStack),
    heroAlreadyIn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Table actor parsing (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const CANONICAL_POS_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'MP'];

type PositionStatus = 'hero' | 'villain' | 'active' | 'folded';

interface TableActor {
  pos: string;
  status: PositionStatus;
}

function parseTableActors(
  contexts: string[],
  heroPos: string,
  villainPos: string,
): TableActor[] {
  const heroNorm    = heroPos.toUpperCase();
  const villainNorm = villainPos.toUpperCase();
  const seen        = new Map<string, PositionStatus>();

  seen.set(heroNorm,    'hero');
  seen.set(villainNorm, 'villain');

  for (const ctx of contexts) {
    for (const m of ctx.matchAll(/\b(UTG\+1|UTG\+2|UTG|LJ|HJ|CO|BTN|SB|BB|MP)\s+folds?\b/gi)) {
      const p = m[1].toUpperCase();
      if (p !== heroNorm) seen.set(p, 'folded');
    }
    for (const m of ctx.matchAll(/[Ff]olds?\s+to\s+(UTG\+1|UTG\+2|UTG|LJ|HJ|CO|BTN|SB|BB|MP)/gi)) {
      const p = m[1].toUpperCase();
      if (seen.get(p) !== 'folded') seen.set(p, p === villainNorm ? 'villain' : 'active');
    }
    for (const m of ctx.matchAll(/\b(UTG\+1|UTG\+2|UTG|LJ|HJ|CO|BTN|SB|BB|MP)\s+(?:raises?|re.raises?|opens?|bets?|calls?|cold.calls?|3.bets?|4.bets?|squeezes?|checks?|defends?|jams?|shoves?|leads?|barrels?|fires?)/gi)) {
      const p = m[1].toUpperCase();
      if (p !== heroNorm && seen.get(p) !== 'folded') {
        seen.set(p, p === villainNorm ? 'villain' : 'active');
      }
    }
  }

  return Array.from(seen.entries())
    .map(([pos, status]) => ({ pos, status }))
    .sort((a, b) => {
      const ai = CANONICAL_POS_ORDER.indexOf(a.pos);
      const bi = CANONICAL_POS_ORDER.indexOf(b.pos);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function TablePositionStrip({
  actors,
  heroPos,
  villainPos,
}: {
  actors: TableActor[];
  heroPos: string;
  villainPos: string;
}) {
  if (actors.length <= 2) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-3 flex-wrap">
      {actors.map(({ pos, status }) => {
        const isFolded  = status === 'folded';
        const isHero    = pos === heroPos.toUpperCase();
        const isVillain = pos === villainPos.toUpperCase() && status !== 'folded';
        return (
          <div
            key={pos}
            title={isFolded ? `${pos} folded` : `${pos} in hand`}
            className={cn(
              "h-5 px-2 flex items-center rounded-full text-[9px] font-semibold transition-all select-none",
              isHero
                ? "bg-violet-500/12 text-violet-400/80"
                : isVillain
                ? "bg-white/[0.04] text-muted-foreground/60"
                : isFolded
                ? "opacity-20 text-muted-foreground/30"
                : "bg-white/[0.03] text-muted-foreground/45"
            )}
          >
            {isFolded && <span className="mr-0.5 text-[7px]">✕</span>}
            {pos}
            {isHero && <span className="ml-0.5 text-[7px] opacity-40">YOU</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats persistence (unchanged)
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
// Card components (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

type CardSize = "sm" | "md" | "lg" | "xl";

const CARD_DIMS: Record<CardSize, string> = {
  sm: "w-[38px] h-[54px] rounded-[5px]",
  md: "w-[51px] h-[72px] rounded-[6px]",
  lg: "w-[71px] h-[100px] rounded-[8px]",
  xl: "w-[93px] h-[130px] rounded-[10px]",
};
const CARD_PAD: Record<CardSize, string>  = { sm: "p-[3.5px]", md: "p-[4.5px]", lg: "p-[6px]", xl: "p-[8px]" };
const CARD_RANK: Record<CardSize, string> = { sm: "text-[11px]", md: "text-[15px]", lg: "text-[20px]", xl: "text-[26px]" };
const CARD_SYM: Record<CardSize, string>  = { sm: "text-[9px]",  md: "text-[12px]", lg: "text-[15px]", xl: "text-[19px]" };
const CARD_CTR: Record<CardSize, string>  = { sm: "text-[22px]", md: "text-[29px]", lg: "text-[40px]", xl: "text-[52px]" };

const PZ_RED   = "#B41C22";
const PZ_BLACK = "#1C1917";

function CardFace({ card, size = "md" }: { card: string; size?: CardSize }) {
  const raw   = card.slice(0, -1).toUpperCase();
  const rank  = raw === "T" ? "10" : raw;
  const suit  = card.slice(-1).toLowerCase();
  const isRed = suit === "h" || suit === "d";
  const sym   = ({ h: "♥", d: "♦", c: "♣", s: "♠" } as const)[suit as "h"|"d"|"c"|"s"] ?? "";
  const col   = isRed ? PZ_RED : PZ_BLACK;

  return (
    <div
      className={cn("relative flex flex-col justify-between select-none shrink-0 overflow-hidden", CARD_DIMS[size], CARD_PAD[size])}
      style={{
        background: "linear-gradient(165deg, #FEFEFC 0%, #F9F6F0 40%, #F0EBE1 100%)",
        boxShadow: [
          "0 18px 44px rgba(0,0,0,0.62)",
          "0 6px 14px rgba(0,0,0,0.40)",
          "0 2px 4px rgba(0,0,0,0.22)",
          "inset 0 1.5px 0 rgba(255,255,255,1)",
          "inset 0 -1px 0 rgba(0,0,0,0.08)",
        ].join(", "),
        border: "1px solid rgba(200,193,182,0.80)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "42%", background: "linear-gradient(180deg, rgba(255,255,255,0.36) 0%, transparent 100%)", borderRadius: "inherit" }}
      />
      <div className="relative z-10 flex flex-col items-start leading-none font-black" style={{ color: col }}>
        <span className={cn("leading-none tracking-tight", CARD_RANK[size])}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", CARD_SYM[size])}>{sym}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={cn("leading-none select-none font-black", CARD_CTR[size])} style={{ color: col, opacity: isRed ? 0.11 : 0.08 }}>{sym}</span>
      </div>
      <div className="relative z-10 flex flex-col items-end leading-none font-black rotate-180" style={{ color: col }}>
        <span className={cn("leading-none tracking-tight", CARD_RANK[size])}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", CARD_SYM[size])}>{sym}</span>
      </div>
    </div>
  );
}

function CardBack({ size = "md" }: { size?: CardSize }) {
  return (
    <div
      className={cn("shrink-0 overflow-hidden relative", CARD_DIMS[size])}
      style={{
        background: "linear-gradient(148deg, #2C1B6E 0%, #18103E 38%, #0D0A28 62%, #1A1055 100%)",
        boxShadow: [
          "0 14px 36px rgba(0,0,0,0.58)",
          "0 4px 10px rgba(0,0,0,0.38)",
          "inset 0 1px 0 rgba(255,255,255,0.09)",
          "inset 0 0 0 1.5px rgba(139,92,246,0.14)",
        ].join(", "),
        border: "1px solid rgba(139,92,246,0.28)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "repeating-linear-gradient(45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)",
            "repeating-linear-gradient(-45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)",
          ].join(", "),
          backgroundSize: "8px 8px",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{ width: "42%", height: "58%", border: "1px solid rgba(139,92,246,0.22)", boxShadow: "0 0 0 3px rgba(139,92,246,0.07)", borderRadius: "3px", transform: "rotate(3deg)" }} />
        <div className="absolute" style={{ width: "26%", height: "38%", border: "1px solid rgba(167,139,250,0.18)", borderRadius: "2px", transform: "rotate(3deg)" }} />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 65%)", borderRadius: "inherit" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality & stack helpers
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY = {
  perfect:    { label: "Perfect",     cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  good:       { label: "Good play",   cls: "text-blue-400    bg-blue-500/10    border-blue-500/30" },
  acceptable: { label: "Acceptable",  cls: "text-yellow-400  bg-yellow-500/10  border-yellow-500/30" },
  mistake:    { label: "Mistake",     cls: "text-orange-400  bg-orange-500/10  border-orange-500/30" },
  punt:       { label: "Major punt",  cls: "text-red-400     bg-red-500/10     border-red-500/30" },
} as const;

function stackZone(bb: number): { label: string; textCls: string; bgCls: string } {
  if (bb <= 12)  return { label: "jam/fold",  textCls: "text-red-400",     bgCls: "bg-red-500/10 border-red-500/22" };
  if (bb <= 20)  return { label: "short",     textCls: "text-orange-400",  bgCls: "bg-orange-500/10 border-orange-500/22" };
  if (bb <= 40)  return { label: "medium",    textCls: "text-amber-400",   bgCls: "bg-amber-500/10 border-amber-500/22" };
  if (bb <= 100) return { label: "deep",      textCls: "text-sky-400",     bgCls: "bg-sky-500/10 border-sky-500/22" };
  return               { label: "very deep",  textCls: "text-emerald-400", bgCls: "bg-emerald-500/10 border-emerald-500/22" };
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
// Solver-native visual indicators
// ─────────────────────────────────────────────────────────────────────────────

const HUD_STREETS = {
  preflop: { label: "PRE",   color: "#38BDF8", glow: "rgba(56,189,248,0.30)",  bg: "rgba(56,189,248,0.09)",  border: "rgba(56,189,248,0.24)"  },
  flop:    { label: "FLOP",  color: "#34D399", glow: "rgba(52,211,153,0.30)",  bg: "rgba(52,211,153,0.09)",  border: "rgba(52,211,153,0.24)"  },
  turn:    { label: "TURN",  color: "#FBBF24", glow: "rgba(251,191,36,0.30)",  bg: "rgba(251,191,36,0.09)",  border: "rgba(251,191,36,0.24)"  },
  river:   { label: "RIVER", color: "#F87171", glow: "rgba(248,113,113,0.30)", bg: "rgba(248,113,113,0.09)", border: "rgba(248,113,113,0.24)" },
} as const;

/** Derive solver frequency from quality (approximate). */
function deriveFrequency(quality: ActionOption["quality"]): number {
  switch (quality) {
    case "perfect":    return 0.72;
    case "good":       return 0.28;
    case "acceptable": return 0.10;
    case "mistake":    return 0.02;
    case "punt":       return 0;
  }
}

/** Derive decision pressure from context. */
function derivePressure(
  street: string,
  effectiveStack: number,
  options: ActionOption[],
): { cls: string; label: string } {
  const goodCount = options.filter(o => o.quality === "perfect" || o.quality === "good").length;
  const isLate = street === "river" || street === "turn";
  const isShort = effectiveStack <= 25;

  if (isLate && goodCount > 1) return { cls: "pressure-hard", label: "Critical spot" };
  if (isLate || isShort)       return { cls: "pressure-marginal", label: "High pressure" };
  if (goodCount > 1)           return { cls: "pressure-easy", label: "Mixing region" };
  return                              { cls: "pressure-easy", label: "Standard spot" };
}

/** Derive if this is a mixing spot (multiple solver-approved lines). */
function isMixingSpot(options: ActionOption[]): boolean {
  return options.filter(o => o.quality === "perfect" || o.quality === "good").length > 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Action Layer — action parser, banner, trail, chips
// ─────────────────────────────────────────────────────────────────────────────

interface TableAction {
  actor: string;
  verb: string;
  sizeBb: number | null;
  type: "open" | "bet" | "raise" | "call" | "check" | "fold" | "allin";
}

const POS_RE = '(UTG\\+[12]|UTG|LJ|HJ|CO|BTN|SB|BB|MP)';

/**
 * Extract the action hero is FACING from the current step context.
 * Looks after street markers (Flop:/Turn:/River:) to skip carry-over actions,
 * then returns the LAST meaningful action verb.
 */
function parseFacingAction(context: string, bbDollars: number): TableAction | null {
  const streetIdx = context.search(/(?:Flop|Turn|River)\s*:/i);
  const search = streetIdx >= 0 ? context.slice(streetIdx) : context;

  const patterns: Array<{ re: RegExp; type: TableAction["type"]; verb: string }> = [
    { re: new RegExp(`${POS_RE}\\s+(?:jams?|shoves?|goes?\\s+all.?in)(?:\\s+[\\$€£]?(\\d+(?:\\.\\d+)?))?`, 'gi'), type: "allin", verb: "ALL-IN" },
    { re: new RegExp(`${POS_RE}\\s+check-?raises?\\s*(?:to\\s+)?[\\$€£]?(\\d+(?:\\.\\d+)?)`, 'gi'), type: "raise", verb: "x/raises" },
    { re: new RegExp(`${POS_RE}\\s+(?:3-?bets?|4-?bets?)\\s+(?:to\\s+)?[\\$€£]?(\\d+(?:\\.\\d+)?)`, 'gi'), type: "raise", verb: "3-bets" },
    { re: new RegExp(`${POS_RE}\\s+raises?\\s+(?:to\\s+)?[\\$€£]?(\\d+(?:\\.\\d+)?)`, 'gi'), type: "raise", verb: "raises to" },
    { re: new RegExp(`${POS_RE}\\s+opens?\\s+(?:to\\s+)?[\\$€£]?(\\d+(?:\\.\\d+)?)`, 'gi'), type: "open", verb: "opens" },
    { re: new RegExp(`${POS_RE}\\s+(?:overbets?|bets?|fires?|leads?\\s*(?:out)?|barrels?|double.?barrels?)\\s+[\\$€£]?(\\d+(?:\\.\\d+)?)`, 'gi'), type: "bet", verb: "bets" },
    { re: new RegExp(`${POS_RE}\\s+(?:calls?|defends?)(?:\\s+[\\$€£]?(\\d+(?:\\.\\d+)?))?`, 'gi'), type: "call", verb: "calls" },
    { re: new RegExp(`${POS_RE}\\s+checks?`, 'gi'), type: "check", verb: "checks" },
    { re: new RegExp(`${POS_RE}\\s+folds?`, 'gi'), type: "fold", verb: "folds" },
  ];

  const matches: Array<{ idx: number; action: TableAction }> = [];

  for (const { re, type, verb } of patterns) {
    let m;
    while ((m = re.exec(search)) !== null) {
      const actor = m[1].toUpperCase();
      const sizeBb = m[2] && bbDollars > 0 ? parseFloat(m[2]) / bbDollars : null;
      matches.push({ idx: m.index, action: { actor, verb, sizeBb, type } });
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => a.idx - b.idx);
  const last = matches[matches.length - 1];

  // Fallback: check for aggressive verbs AFTER the last POS-prefixed match.
  // Handles "BB calls turn and leads out $18" where "leads" isn't POS-prefixed.
  const afterLast = search.slice(last.idx + 10);
  const aggrVerb = afterLast.match(
    /(?:leads?\s*(?:out)?|bets?|fires?|barrels?|raises?\s*(?:to\s+)?|jams?|shoves?)\s+[\$€£]?(\d+(?:\.\d+)?)/i
  );
  if (aggrVerb && (last.action.type === "call" || last.action.type === "check")) {
    const sizeBb = aggrVerb[1] && bbDollars > 0 ? parseFloat(aggrVerb[1]) / bbDollars : null;
    const isAllIn = /jams?|shoves?/i.test(aggrVerb[0]);
    const isRaise = /raises?/i.test(aggrVerb[0]);
    return {
      actor: last.action.actor,
      verb: isAllIn ? "ALL-IN" : isRaise ? "raises to" : "bets",
      sizeBb,
      type: isAllIn ? "allin" : isRaise ? "raise" : "bet",
    };
  }

  return last.action;
}

/** Compact trail of all actions in the hand so far. */
interface TrailItem { label: string; isHero: boolean; }

function buildActionTrail(
  puzzle: { heroPosition: string; steps: PuzzleStep[]; stakes: string },
  stepIdx: number,
  stepResults: Array<{ option: ActionOption }>,
  bbDollars: number,
): TrailItem[] {
  const trail: TrailItem[] = [];
  for (let i = 0; i <= stepIdx; i++) {
    const action = parseFacingAction(puzzle.steps[i].context, bbDollars);
    if (action) {
      let label = action.verb;
      if (action.sizeBb !== null) label += ` ${fmtBb(action.sizeBb)}`;
      trail.push({ label, isHero: false });
    }
    if (i < stepIdx && stepResults[i]) {
      trail.push({ label: bbifyText(stepResults[i].option.label, bbDollars), isHero: true });
    }
  }
  return trail;
}

// ── Table Action Banner ─────────────────────────────────────────────────────

function TableActionBanner({
  action, potBb, effectiveStack,
}: {
  action: TableAction | null; potBb: number; effectiveStack: number;
}) {
  if (!action) return null;
  const { sizeBb, type, actor, verb } = action;
  const potPct = sizeBb !== null && potBb > 0 ? Math.round((sizeBb / potBb) * 100) : null;
  const isAggressive = type === "bet" || type === "raise" || type === "allin" || type === "open";

  return (
    <div className="flex items-center justify-center gap-2 animate-action-banner">
      {sizeBb !== null && isAggressive && (
        <ChipStack sizeBb={sizeBb} effectiveStack={effectiveStack} />
      )}
      <div className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all",
        type === "allin"  ? "bg-red-500/10 border border-red-500/20 animate-allin-pulse"
        : type === "raise"  ? "bg-orange-400/[0.07] border border-orange-400/15"
        : type === "bet" || type === "open" ? "bg-amber-400/[0.06] border border-amber-400/12"
        : type === "call"   ? "bg-white/[0.025] border border-white/[0.05]"
        :                     "bg-white/[0.015] border border-white/[0.03]"
      )}>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          type === "allin" ? "text-red-400/70"
          : type === "raise" ? "text-orange-400/60"
          : type === "bet" || type === "open" ? "text-amber-400/55"
          : "text-muted-foreground/25"
        )}>
          {actor}
        </span>
        <span className={cn(
          "text-[11px] font-semibold",
          type === "allin" ? "text-red-300/80 font-black tracking-wider uppercase"
          : type === "raise" ? "text-orange-300/65"
          : type === "bet" || type === "open" ? "text-amber-300/60"
          : "text-muted-foreground/35"
        )}>
          {verb}
        </span>
        {sizeBb !== null && (
          <span className={cn(
            "text-[12px] font-black tabular-nums",
            type === "allin" ? "text-red-200/85"
            : type === "raise" ? "text-orange-200/75"
            : "text-amber-200/65"
          )}>
            {fmtBb(sizeBb)}
          </span>
        )}
        {potPct !== null && type !== "allin" && (
          <span className="text-[9px] text-muted-foreground/20 tabular-nums">
            {potPct}%
          </span>
        )}
      </div>
      {sizeBb !== null && isAggressive && (
        <ChipStack sizeBb={sizeBb} effectiveStack={effectiveStack} />
      )}
    </div>
  );
}

// ── Chip Stack Visualization ────────────────────────────────────────────────

function ChipStack({ sizeBb, effectiveStack }: { sizeBb: number; effectiveStack: number }) {
  const ratio = Math.min(1, sizeBb / effectiveStack);
  const count = ratio >= 0.7 ? 5 : ratio >= 0.4 ? 4 : ratio >= 0.2 ? 3 : ratio >= 0.08 ? 2 : 1;
  const color = ratio >= 0.5 ? "rgba(239,68,68,0.55)" : ratio >= 0.2 ? "rgba(251,191,36,0.55)" : "rgba(56,189,248,0.45)";
  const glow  = ratio >= 0.5 ? "rgba(239,68,68,0.3)"  : ratio >= 0.2 ? "rgba(251,191,36,0.3)"  : "rgba(56,189,248,0.2)";

  return (
    <div className="flex flex-col-reverse items-center gap-[1px] animate-chip-slide">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-full" style={{ width: "7px", height: "3px", background: color, boxShadow: `0 0 4px ${glow}` }} />
      ))}
    </div>
  );
}

// ── Action History Trail ────────────────────────────────────────────────────

function ActionTrail({ trail }: { trail: TrailItem[] }) {
  if (trail.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-none max-w-[360px] mx-auto mt-1.5">
      {trail.map((item, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-[7px] text-white/[0.07]">→</span>}
          <span className={cn(
            "text-[9px] font-medium whitespace-nowrap",
            item.isHero ? "text-violet-400/30" : "text-muted-foreground/20"
          )}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal street progress — replaces vertical StepPip list
// ─────────────────────────────────────────────────────────────────────────────

function StreetProgress({
  steps,
  stepIdx,
  stepResults,
}: {
  steps: PuzzleStep[];
  stepIdx: number;
  stepResults: Array<{ quality: ActionOption["quality"]; score: number }>;
}) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, i) => {
        const isPast   = i < stepIdx;
        const isActive = i === stepIdx;
        const result   = stepResults[i];
        const sm = HUD_STREETS[step.street as keyof typeof HUD_STREETS] ?? HUD_STREETS.preflop;

        return (
          <div key={i} className="flex items-center">
            {/* Street node */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300",
              isActive
                ? "street-glow-active"
                : isPast
                ? "opacity-60"
                : "opacity-25"
            )}>
              {/* Quality dot for completed */}
              {isPast && result && (
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  result.score >= 80 ? "bg-emerald-400" :
                  result.score >= 60 ? "bg-yellow-400" : "bg-red-400"
                )} />
              )}
              {isActive && (
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: sm.color, boxShadow: `0 0 8px ${sm.glow}` }} />
              )}
              <span
                className={cn(
                  "text-[11px] font-bold tracking-[0.15em] uppercase leading-none",
                  isActive ? "font-black" : ""
                )}
                style={{ color: isActive ? sm.color : isPast ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
              >
                {sm.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className="w-8 h-px mx-0.5 shrink-0"
                style={{
                  background: i < stepIdx
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.06)",
                }}
              />
            )}
          </div>
        );
      })}

      {/* Running score — compact */}
      {stepResults.length > 0 && (
        <div className="ml-4 flex items-center gap-1.5">
          <div className="w-px h-4 bg-white/[0.08]" />
          <span className={cn(
            "text-sm font-black tabular-nums",
            Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length) >= 80
              ? "text-emerald-400/80"
              : Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length) >= 60
              ? "text-yellow-400/80"
              : "text-red-400/80"
          )}>
            {Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Neutral label sanitizer — strips strategic hints, keeps action + sizing only
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeLabel(label: string): string {
  // Remove parenthetical hints: "(complete giveup)", "(thin value)", etc.
  let clean = label.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  // Remove trailing descriptive phrases after the core action+sizing
  // e.g. "Fold the flush draw" → "Fold", "Call $6 hero call" → "Call $6"
  clean = clean
    .replace(/^(Fold)\s+(?:the\s+|to\s+|on\s+|here|now).*$/i, "$1")
    .replace(/^(Check)\s+(?:back|behind|through|down).*$/i, "$1")
    .replace(/^(Call\s+[\$€£]?\d+(?:\.\d+)?(?:\s*bb)?)\s+.*$/i, "$1")
    .replace(/^(Raise\s+(?:to\s+)?[\$€£]?\d+(?:\.\d+)?(?:\s*bb)?)\s+.*$/i, "$1")
    .replace(/^(Bet\s+[\$€£]?\d+(?:\.\d+)?(?:\s*\(\d+%\))?)\s+.*$/i, "$1")
    .replace(/^(Jam\s+[\$€£]?\d+(?:\.\d+)?(?:\s*bb)?)\s+.*$/i, "$1")
    .replace(/^(3-bet\s+(?:to\s+)?[\$€£]?\d+(?:\.\d+)?(?:\s*bb)?)\s+.*$/i, "$1")
    .replace(/^(Squeeze\s+(?:to\s+)?[\$€£]?\d+(?:\.\d+)?(?:\s*bb)?)\s+.*$/i, "$1");
  // Remove strategic words that might remain
  clean = clean.replace(/\b(slowplay|trap|bluff|thin value|protection|merge|block|giveup|showdown value|pot control|standard|hero call|bluff catch)\b/gi, "").trim();
  // Collapse multiple spaces
  clean = clean.replace(/\s{2,}/g, " ").trim();
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action button — neutral solver-style decision controls
// ─────────────────────────────────────────────────────────────────────────────

function ActionBtn({
  option, chosen, disabled, onClick, displayLabel,
}: {
  option: ActionOption;
  chosen: ActionOption | null;
  disabled: boolean;
  onClick: (o: ActionOption) => void;
  displayLabel?: string;
}) {
  const isChosen = chosen?.id === option.id;
  const hasChosen = !!chosen;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(option)}
      className={cn(
        "group relative rounded-xl px-5 py-4 text-sm font-semibold transition-all duration-200 border overflow-hidden",
        isChosen
          ? cn(
              "shadow-lg",
              `result-${option.quality}`,
              QUALITY[option.quality].cls,
            )
          : hasChosen
          ? "border-white/[0.04] bg-white/[0.015] text-muted-foreground/30 cursor-default"
          : "border-white/[0.08] bg-white/[0.025] text-foreground hover:bg-white/[0.04] hover:border-white/[0.12] hover:brightness-110 active:scale-[0.98]"
      )}
    >
      {/* Subtle hover shimmer — identical for all buttons */}
      {!hasChosen && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)",
          }}
        />
      )}
      <span className="relative z-10">{displayLabel ?? option.label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Solver coaching indicators
// ─────────────────────────────────────────────────────────────────────────────

function FrequencyBar({ option, maxFreq }: { option: ActionOption; maxFreq: number }) {
  const freq = deriveFrequency(option.quality);
  const pct = maxFreq > 0 ? (freq / maxFreq) * 100 : 0;
  const freqDisplay = Math.round(freq * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full animate-confidence-fill",
            option.quality === "perfect" ? "bg-emerald-400/70" :
            option.quality === "good"    ? "bg-blue-400/60" :
            option.quality === "acceptable" ? "bg-yellow-400/50" :
            "bg-red-400/40"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground/40 w-7 text-right">
        {freqDisplay}%
      </span>
    </div>
  );
}

function EvDelta({ evLoss }: { evLoss: number }) {
  if (evLoss === 0) {
    return <span className="text-[10px] font-semibold text-emerald-400/70">+EV</span>;
  }
  return (
    <span className="text-[10px] font-semibold text-red-400/60 tabular-nums">
      −{evLoss.toFixed(1)}bb
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result screen — refined
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
  const bbD = parseBigBlind(puzzle.stakes);
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
    <div className="mx-auto max-w-xl animate-fade-in">
      {/* Score header */}
      <div className="glass-panel-elevated rounded-2xl p-8 text-center mb-5">
        <div className="flex items-end justify-center gap-3 mb-2">
          <span className={cn("text-6xl font-black tracking-tight", gradeColor)}>{finalScore}</span>
          <span className="text-muted-foreground/40 text-xl mb-1.5">/100</span>
          <span className={cn("text-3xl font-black ml-2 mb-1", gradeColor)}>{grade}</span>
        </div>
        <p className="text-sm text-muted-foreground/50">
          {totalEvLoss > 0 ? `${totalEvLoss.toFixed(1)}bb EV lost · ${puzzle.steps.length} decisions` : "Flawless — zero EV lost"}
        </p>
      </div>

      {/* Street breakdown */}
      <div className="glass-panel rounded-2xl p-5 mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/35 mb-4">Breakdown</p>
        <div className="space-y-2.5">
          {stepResults.map((r, i) => (
            <div key={i} className={cn(
              "flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 border",
              i === bestStep  ? "bg-emerald-500/[0.04] border-emerald-500/15" :
              i === worstStep ? "bg-red-500/[0.04] border-red-500/15" : "bg-white/[0.015] border-white/[0.04]"
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-semibold text-foreground/80 capitalize w-10">{puzzle.steps[i].street}</span>
                <span className="text-xs text-muted-foreground/50 truncate">{bbifyText(r.option.label, bbD)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <QualityBadge quality={r.quality} />
                <span className={cn("text-xs font-bold tabular-nums",
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
      <div className="glass-panel rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-violet-400/70" />
          <span className="text-xs font-semibold text-foreground/70">Summary</span>
        </div>
        <p className="text-sm text-muted-foreground/60 leading-relaxed">{puzzle.summary}</p>
      </div>

      {/* Actions */}
      {isRandom ? (
        <div className="space-y-3">
          {randomStreak > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/15 bg-orange-500/[0.04] px-4 py-2">
              <Flame className="h-3.5 w-3.5 text-orange-400/70" />
              <span className="text-sm font-semibold text-orange-300/80">{randomStreak} streak</span>
            </div>
          )}
          <button
            onClick={onNextRandom}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
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
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
          <Button variant="poker" size="lg" className="flex-1 gap-2" onClick={onNext}>
            Next Puzzle <ChevronRight className="h-4 w-4" />
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

  // ── Derived state ─────────────────────────────────────────────────
  const stackState = useMemo(
    () => computePuzzleState(puzzle, stepIdx, stepResults),
    [puzzle, stepIdx, stepResults]
  );

  const bbDollars = parseBigBlind(puzzle.stakes);

  const tableActors = useMemo(
    () => parseTableActors(
      puzzle.steps.slice(0, stepIdx + 1).map(s => s.context),
      puzzle.heroPosition,
      puzzle.villainPosition,
    ),
    [puzzle, stepIdx]
  );

  const pokerState = useMemo(
    () => buildPokerState(puzzle, stepIdx, stackState.potBb, stackState.heroStack, stackState.villainStack),
    [puzzle, stepIdx, stackState.potBb, stackState.heroStack, stackState.villainStack]
  );

  const pressure = useMemo(
    () => derivePressure(currentStep.street, puzzle.effectiveStack, currentStep.options),
    [currentStep, puzzle.effectiveStack]
  );

  const mixing = useMemo(() => isMixingSpot(currentStep.options), [currentStep.options]);
  const maxFreq = useMemo(
    () => Math.max(...currentStep.options.map(o => deriveFrequency(o.quality))),
    [currentStep.options]
  );

  // ── Live action layer state ────────────────────────────────────────
  const facingAction = useMemo(
    () => parseFacingAction(currentStep.context, bbDollars),
    [currentStep.context, bbDollars]
  );

  const actionTrail = useMemo(
    () => buildActionTrail(puzzle, stepIdx, stepResults, bbDollars),
    [puzzle, stepIdx, stepResults, bbDollars]
  );

  // ── Dev-mode validation ────────────────────────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      runGoldenTests();
      validateAllPuzzles(PUZZLES);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sm = HUD_STREETS[currentStep.street as keyof typeof HUD_STREETS] ?? HUD_STREETS.preflop;
  const isPreflop = currentStep.street === "preflop";

  // ── Short title from puzzle title ─────────────────────────────────
  const titleParts = puzzle.title.split(/\s*[—–-]\s*/);
  const titleMain = titleParts[0]?.trim() ?? puzzle.title;
  const titleSub  = titleParts.slice(1).join(" — ").trim();

  // ── Result screen ──────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-10 sm:py-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mb-8 flex items-center justify-between">
              <Link href="/analyze/puzzles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Puzzles
              </Link>
              <p className="text-xs text-muted-foreground/40">{puzzle.title}</p>
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
      </div>
    );
  }

  // ── Puzzle player ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-5 sm:py-8">
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6">

          {/* ── Compact header ───────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <Link href="/analyze/puzzles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/40 hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>

            <div className="flex flex-col items-center min-w-0">
              <h1 className="text-sm font-semibold text-foreground/90 truncate">
                {titleMain}
              </h1>
              {titleSub && (
                <p className="text-[11px] text-muted-foreground/35 truncate">{titleSub}</p>
              )}
              <p className="text-[10px] text-muted-foreground/25 mt-0.5">
                {puzzle.heroPosition} vs {puzzle.villainPosition} · {puzzle.format} · {puzzle.effectiveStack}bb
                {isRandomMode && (
                  <span className="ml-1.5 text-violet-400/50">· Random</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground/30 tabular-nums">
                {stepIdx + 1}/{puzzle.steps.length}
              </span>
              <button
                onClick={handleRetry}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors"
                title="Restart"
              >
                <RotateCcw className="h-3 w-3 text-muted-foreground/40" />
              </button>
            </div>
          </div>

          {/* ── Horizontal street progress ────────────────────────── */}
          <StreetProgress steps={puzzle.steps} stepIdx={stepIdx} stepResults={stepResults} />

          {/* ── 2-column layout ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

            {/* ═══ MAIN: Table + Actions ═══════════════════════════ */}
            <div className="order-1 animate-street-enter" key={`step-${stepIdx}`}>

              {/* ── CINEMATIC TABLE HUD ─────────────────────────────── */}
              <div
                className={cn("glass-panel-elevated rounded-2xl overflow-hidden mb-5", pressure.cls)}
                style={{ minHeight: "340px" }}
              >
                {/* Chromatic edge */}
                <div
                  className="h-px w-full"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${sm.color}40 30%, rgba(124,92,255,0.4) 70%, transparent 100%)` }}
                />
                {/* Shimmer sweep */}
                <div
                  className="absolute inset-y-0 w-[45%] pointer-events-none animate-hud-shimmer"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.015) 50%, transparent 100%)",
                    transform: "skewX(-14deg)",
                  }}
                />

                <div className="relative flex flex-col items-center py-6 px-6 gap-5">

                  {/* Street badge — top left */}
                  <div className="absolute top-4 left-5">
                    <div
                      className="px-2.5 py-[3px] rounded-md text-[10px] font-black tracking-[0.24em] uppercase leading-none"
                      style={{
                        color: sm.color,
                        background: sm.bg,
                        border: `1px solid ${sm.border}`,
                        boxShadow: `0 0 12px ${sm.glow}`,
                      }}
                    >
                      {sm.label}
                    </div>
                  </div>

                  {/* Pressure tag — only shown after action chosen */}
                  {chosen && (
                    <div className="absolute top-4 right-5">
                      <span className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground/20">
                        {pressure.label}
                      </span>
                    </div>
                  )}

                  {/* ── VILLAIN area ────────────────────────── */}
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex gap-1">
                      <CardBack size="sm" />
                      <CardBack size="sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tracking-wide" style={{ color: "rgba(251,191,36,0.45)" }}>
                        {puzzle.villainPosition}
                      </span>
                      <span className="text-[10px] text-muted-foreground/20 tabular-nums">
                        {fmtBb(stackState.villainStack)}
                      </span>
                    </div>
                  </div>

                  {/* ── BOARD ───────────────────────────────── */}
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="flex gap-1.5 items-center">
                      {isPreflop
                        ? [0,1,2,3,4].map(i => (
                            <div
                              key={i}
                              className="w-[42px] h-[60px] rounded-lg"
                              style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.045)" }}
                            />
                          ))
                        : (
                          <>
                            {currentStep.board.map((card, i) => <CardFace key={i} card={card} size="md" />)}
                            {Array.from({ length: 5 - currentStep.board.length }).map((_, i) => (
                              <div
                                key={`e-${i}`}
                                className="w-[42px] h-[60px] rounded-lg"
                                style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.045)" }}
                              />
                            ))}
                          </>
                        )}
                    </div>

                    {/* Pot badge */}
                    <div
                      className="flex items-center gap-1.5 h-6 px-3 rounded-full"
                      style={{
                        background: "rgba(251,191,36,0.06)",
                        border: "1px solid rgba(251,191,36,0.15)",
                        boxShadow: "0 0 12px rgba(251,191,36,0.05)",
                      }}
                    >
                      <div className="h-1 w-1 rounded-full bg-amber-400/40 shrink-0" />
                      <span className="text-[11px] font-black text-amber-300/70 tabular-nums leading-none">
                        {fmtBb(stackState.potBb)}
                      </span>
                    </div>
                  </div>

                  {/* ── HERO area ───────────────────────────── */}
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {puzzle.heroCards.map((card, i) => <CardFace key={i} card={card} size="xl" />)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: "rgba(124,92,255,0.9)", boxShadow: "0 0 8px rgba(124,92,255,0.6)" }}
                        />
                        <span className="text-[12px] font-black tracking-wide" style={{ color: "rgba(167,139,250,0.9)" }}>
                          {puzzle.heroPosition}
                        </span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(124,92,255,0.1)", color: "rgba(124,92,255,0.5)" }}
                        >
                          {pokerState.heroIsOop ? "OOP" : "IP"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/20 tabular-nums ml-4">
                        {fmtBb(stackState.heroStack)}
                      </span>
                    </div>
                  </div>

                  {/* Multiway strip */}
                  <TablePositionStrip
                    actors={tableActors}
                    heroPos={puzzle.heroPosition}
                    villainPos={puzzle.villainPosition}
                  />
                </div>
              </div>

              {/* Dev-mode validation error */}
              {process.env.NODE_ENV === "development" && pokerState.validationErrors.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 mb-3 text-xs text-red-400">
                  <span className="font-semibold">Actor-order error:</span>{" "}
                  {pokerState.validationErrors[0]}
                </div>
              )}

              {/* ── Context — minimal floating surface ────────────── */}
              <div className="glass-panel rounded-xl px-5 py-3.5 mb-5">
                <p className="text-[13px] text-muted-foreground/50 leading-relaxed">{bbifyText(currentStep.context, bbDollars)}</p>
                <p className="text-[13px] font-semibold text-foreground/85 mt-1">{bbifyText(currentStep.prompt, bbDollars)}</p>
              </div>

              {/* ── Action buttons ────────────────────────────────── */}
              {!chosen ? (
                <div className={cn(
                  "grid gap-3",
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
                        displayLabel={sanitizeLabel(bbifyText(opt.label, bbDollars))}
                      />
                    ))}
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  {/* Chosen action result */}
                  <div className={cn(
                    "glass-panel rounded-xl px-5 py-4 flex items-center justify-between gap-3",
                    `result-${chosen.quality}`
                  )}>
                    <div>
                      <p className="text-sm font-semibold text-foreground/90">{bbifyText(chosen.label, bbDollars)}</p>
                      {chosen.evLoss > 0 && (
                        <p className="text-xs text-muted-foreground/40 mt-0.5">−{chosen.evLoss}bb EV</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <QualityBadge quality={chosen.quality} />
                      <span className={cn("text-lg font-black tabular-nums",
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

            {/* ═══ RIGHT PANEL: Coaching + Meta ════════════════════ */}
            <div className="space-y-4 order-2" ref={coachingRef}>

              {/* ── Coaching panel ─────────────────────────────────── */}
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-3.5 w-3.5 text-violet-400/60" />
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">Coaching</p>
                </div>

                {!chosen ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/[0.06] mb-3">
                      <Target className="h-4 w-4 text-violet-400/30" />
                    </div>
                    <p className="text-xs text-muted-foreground/35">
                      Choose an action to see analysis
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {/* Quality + EV */}
                    <div className="flex items-center justify-between">
                      <QualityBadge quality={chosen.quality} />
                      <EvDelta evLoss={chosen.evLoss} />
                    </div>

                    {/* Coaching text */}
                    <p className="text-[13px] text-muted-foreground/60 leading-relaxed">{bbifyText(chosen.coaching, bbDollars)}</p>

                    {/* Solver frequency breakdown */}
                    <div className="pt-3 border-t border-white/[0.04]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/25 mb-3">
                        Solver Frequency
                      </p>
                      <div className="space-y-2">
                        {currentStep.options
                          .slice()
                          .sort((a, b) => deriveFrequency(b.quality) - deriveFrequency(a.quality))
                          .map(opt => (
                          <div key={opt.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn(
                                "text-[11px] font-medium",
                                opt.id === chosen.id ? "text-foreground/70" : "text-muted-foreground/35"
                              )}>
                                {bbifyText(opt.label, bbDollars)}
                              </span>
                              <EvDelta evLoss={opt.evLoss} />
                            </div>
                            <FrequencyBar option={opt} maxFreq={maxFreq} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coaching for non-chosen options (collapsed) */}
                    {currentStep.options.filter(o => o.id !== chosen.id).length > 0 && (
                      <div className="pt-3 border-t border-white/[0.04]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/25 mb-3">
                          Other Lines
                        </p>
                        <div className="space-y-2">
                          {currentStep.options
                            .filter(o => o.id !== chosen.id)
                            .map(opt => (
                            <div
                              key={opt.id}
                              className="rounded-lg p-2.5 bg-white/[0.015] border border-white/[0.03]"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium text-muted-foreground/40">
                                  {bbifyText(opt.label, bbDollars)}
                                </span>
                                <QualityBadge quality={opt.quality} />
                              </div>
                              <p className="text-[11px] text-muted-foreground/30 leading-relaxed line-clamp-2">
                                {bbifyText(opt.coaching, bbDollars)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Score breakdown ─────────────────────────────────── */}
              {stepResults.length > 0 && (
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/25 mb-3">
                    Score
                  </p>
                  <div className="space-y-2">
                    {stepResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] capitalize text-muted-foreground/35 w-10 truncate">{puzzle.steps[i].street}</span>
                        <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all animate-confidence-fill",
                              r.score >= 80 ? "bg-emerald-500/70" : r.score >= 60 ? "bg-yellow-500/70" : "bg-red-500/70"
                            )}
                            style={{ width: `${r.score}%` }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-bold w-6 text-right tabular-nums",
                          r.score >= 80 ? "text-emerald-400/70" : r.score >= 60 ? "text-yellow-400/70" : "text-red-400/70"
                        )}>
                          {r.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Compact situation card ──────────────────────────── */}
              <div className="glass-panel rounded-xl p-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/35">
                  <span className="font-bold text-sky-300/50 tabular-nums">{puzzle.effectiveStack}bb</span>
                  <span>{puzzle.heroPosition} vs {puzzle.villainPosition}</span>
                  <span>{puzzle.stakes}</span>
                  <span>{puzzle.format}</span>
                  <span className={cn(
                    "text-[9px] font-semibold px-1.5 py-0.5 rounded",
                    stackZone(puzzle.effectiveStack).textCls,
                    stackZone(puzzle.effectiveStack).bgCls
                  )}>
                    {stackZone(puzzle.effectiveStack).label}
                  </span>
                </div>
              </div>

              {/* ── Contextual tip ─────────────────────────────────── */}
              <div className="rounded-xl bg-violet-500/[0.03] border border-violet-500/[0.08] p-3.5">
                <div className="flex items-start gap-2">
                  <Flame className="h-3.5 w-3.5 text-violet-400/30 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground/35 leading-relaxed">
                    {currentStep.street === "preflop"
                      ? "Consider equity, stack depth, and position before acting."
                      : currentStep.street === "flop"
                      ? "Evaluate board texture, range advantage, and pot control."
                      : currentStep.street === "turn"
                      ? "Hand strengths crystallize. Assess ranges and remaining streets."
                      : "Pure hand strength vs pot odds. No more cards coming."}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
