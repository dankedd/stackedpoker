"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Flame, Star, Trophy, ChevronRight, Lock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PUZZLES, type Puzzle } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

// ── Local storage stats ───────────────────────────────────────────────────
interface PuzzleStats {
  solved: string[];
  scores: Record<string, number>;
  streak: number;
  bestStreak: number;
}

function loadStats(): PuzzleStats {
  if (typeof window === "undefined") return { solved: [], scores: {}, streak: 0, bestStreak: 0 };
  try {
    const s = localStorage.getItem("puzzle_stats");
    return s ? JSON.parse(s) : { solved: [], scores: {}, streak: 0, bestStreak: 0 };
  } catch { return { solved: [], scores: {}, streak: 0, bestStreak: 0 }; }
}

// ── Difficulty badge ──────────────────────────────────────────────────────
const DIFF_STYLES = {
  beginner:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  intermediate: "bg-amber-500/10  text-amber-400  border-amber-500/25",
  advanced:     "bg-red-500/10    text-red-400    border-red-500/25",
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  "SRP":           "bg-violet-500/10 text-violet-400",
  "3-bet Pot":     "bg-blue-500/10   text-blue-400",
  "Bluff Catching":"bg-rose-500/10   text-rose-400",
  "Value Betting": "bg-emerald-500/10 text-emerald-400",
  "Turn Barrel":   "bg-cyan-500/10   text-cyan-400",
  "Preflop":       "bg-amber-500/10  text-amber-400",
  "ICM":           "bg-yellow-500/10 text-yellow-400",
};

function CardFaceMini({ card }: { card: string }) {
  const rank = card.slice(0, -1).replace("T", "10");
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const sym = { h: "♥", d: "♦", c: "♣", s: "♠" }[suit] ?? "";
  return (
    <div className="inline-flex h-8 w-6 flex-col items-center justify-between rounded bg-white p-0.5 shadow-md shadow-black/40 text-[9px] leading-none select-none">
      <span className={cn("font-black", isRed ? "text-red-600" : "text-slate-900")}>{rank}</span>
      <span className={cn("text-base leading-none", isRed ? "text-red-600" : "text-slate-900")}>{sym}</span>
    </div>
  );
}

function PuzzleCard({ puzzle, score, solved }: { puzzle: Puzzle; score?: number; solved?: boolean }) {
  return (
    <Link href={`/analyze/puzzles/${puzzle.id}`} className="block group">
      <div className="relative rounded-2xl border border-border/50 bg-card/60 p-5 h-full transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/80 hover:border-violet-500/25 hover:shadow-xl hover:shadow-violet-500/5">
        {solved && (
          <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <span className="text-[10px] text-emerald-400">✓</span>
          </div>
        )}

        {/* Cards preview */}
        <div className="flex items-center gap-1 mb-4">
          {puzzle.heroCards.map((c, i) => <CardFaceMini key={i} card={c} />)}
          <span className="ml-2 text-xs text-muted-foreground/60">{puzzle.heroPosition}</span>
        </div>

        {/* Title + description */}
        <h3 className="font-semibold text-foreground text-sm mb-1.5 leading-snug group-hover:text-violet-300 transition-colors">
          {puzzle.title}
        </h3>
        <p className="text-xs text-muted-foreground/70 leading-relaxed mb-4 line-clamp-2">
          {puzzle.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider", DIFF_STYLES[puzzle.difficulty])}>
            {puzzle.difficulty}
          </span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", CATEGORY_COLORS[puzzle.category] ?? "bg-secondary/60 text-muted-foreground")}>
            {puzzle.category}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground/60">
            {puzzle.steps.length} decisions
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {score !== undefined ? (
            <span className={cn("text-xs font-semibold",
              score >= 80 ? "text-emerald-400" :
              score >= 60 ? "text-amber-400" : "text-red-400"
            )}>
              Score: {score}/100
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">{puzzle.format} · {puzzle.stakes}</span>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground/50 group-hover:text-violet-400 transition-colors">
            Play
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

const DIFFICULTIES = ["All", "beginner", "intermediate", "advanced"] as const;
const GAME_TYPES = ["All", "cash", "tournament"] as const;
const CATEGORIES = ["All", ...Array.from(new Set(PUZZLES.map(p => p.category)))] as const;

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
        active
          ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
          : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-border/60"
      )}
    >
      {children}
    </button>
  );
}

export default function PuzzlesPage() {
  const [stats, setStats] = useState<PuzzleStats>({ solved: [], scores: {}, streak: 0, bestStreak: 0 });
  const [difficulty, setDifficulty] = useState<string>("All");
  const [gameType, setGameType] = useState<string>("All");
  const [category, setCategory] = useState<string>("All");

  useEffect(() => { setStats(loadStats()); }, []);

  const filtered = PUZZLES.filter(p => {
    if (difficulty !== "All" && p.difficulty !== difficulty) return false;
    if (gameType !== "All" && p.gameType !== gameType) return false;
    if (category !== "All" && p.category !== category) return false;
    return true;
  });

  const avgScore = stats.solved.length > 0
    ? Math.round(stats.solved.reduce((s, id) => s + (stats.scores[id] ?? 0), 0) / stats.solved.length)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Back */}
          <Link
            href="/analyze"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analyze
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
                <Brain className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Poker Puzzles</h1>
            </div>
            <p className="text-muted-foreground">
              Train real decision-making with interactive AI coaching.
            </p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {[
              { label: "Solved", value: stats.solved.length.toString(), icon: Trophy,  color: "text-violet-400" },
              { label: "Avg Score", value: avgScore !== null ? `${avgScore}` : "—",   icon: Star,   color: "text-amber-400" },
              { label: "Streak",   value: stats.streak.toString(),                    icon: Flame,  color: "text-orange-400" },
              { label: "Best Streak", value: stats.bestStreak.toString(),             icon: Flame,  color: "text-rose-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-border/50 bg-card/60 px-5 py-4">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                  <span className="text-xs">{label}</span>
                </div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters + grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">

            {/* Filters sidebar */}
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Difficulty</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIFFICULTIES.map(d => (
                    <FilterChip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                      {d === "All" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Game Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {GAME_TYPES.map(g => (
                    <FilterChip key={g} active={gameType === g} onClick={() => setGameType(g)}>
                      {g === "All" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Category</p>
                <div className="flex flex-col gap-1.5">
                  {CATEGORIES.map(c => (
                    <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                      {c}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>

            {/* Puzzle grid */}
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {filtered.length} puzzle{filtered.length !== 1 ? "s" : ""}
              </p>
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-border/40 bg-card/40 p-12 text-center">
                  <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No puzzles match these filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(p => (
                    <PuzzleCard
                      key={p.id}
                      puzzle={p}
                      score={stats.scores[p.id]}
                      solved={stats.solved.includes(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
