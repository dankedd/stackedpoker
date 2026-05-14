"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Brain, Flame, Star, Trophy, ChevronRight, Lock, Shuffle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PUZZLES, type Puzzle } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

// ── Local storage stats ───────────────────────────────────────────────────────

interface PuzzleStats {
  solved: string[];
  scores: Record<string, number>;
  streak: number;
  bestStreak: number;
  randomStreak?: number;
  bestRandomStreak?: number;
  lastRandomId?: string;
}

function loadStats(): PuzzleStats {
  if (typeof window === "undefined") return { solved: [], scores: {}, streak: 0, bestStreak: 0 };
  try {
    const s = localStorage.getItem("puzzle_stats");
    return s ? JSON.parse(s) : { solved: [], scores: {}, streak: 0, bestStreak: 0 };
  } catch { return { solved: [], scores: {}, streak: 0, bestStreak: 0 }; }
}

// ── Weighted random selection ─────────────────────────────────────────────────

function pickRandomPuzzle(stats: PuzzleStats, excludeId?: string): Puzzle | null {
  const candidates = PUZZLES.filter(p => p.id !== excludeId);
  if (candidates.length === 0) return PUZZLES[0] ?? null;

  // Unsolved: 3× weight · low score (<60): 2× · well-solved: 1×
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

// ── Difficulty / category styles ──────────────────────────────────────────────

const DIFF_STYLES: Record<string, string> = {
  beginner:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  intermediate: "bg-amber-500/10  text-amber-400  border-amber-500/25",
  advanced:     "bg-red-500/10    text-red-400    border-red-500/25",
  expert:       "bg-purple-500/10 text-purple-400 border-purple-500/25",
};

const CATEGORY_COLORS: Record<string, string> = {
  "SRP":            "bg-violet-500/10 text-violet-400",
  "3-bet Pot":      "bg-blue-500/10   text-blue-400",
  "Bluff Catching": "bg-rose-500/10   text-rose-400",
  "Value Betting":  "bg-emerald-500/10 text-emerald-400",
  "Turn Barrel":    "bg-cyan-500/10   text-cyan-400",
  "Preflop":        "bg-amber-500/10  text-amber-400",
  "ICM":            "bg-yellow-500/10 text-yellow-400",
  "BvB":            "bg-teal-500/10   text-teal-400",
  "Squeeze":        "bg-orange-500/10 text-orange-400",
  "Check-Raise":    "bg-pink-500/10   text-pink-400",
  "Semi-Bluff":     "bg-indigo-500/10 text-indigo-400",
  "4-bet Pot":      "bg-sky-500/10    text-sky-400",
  "Delayed C-bet":  "bg-cyan-500/10   text-cyan-400",
  "River Bluff":    "bg-rose-500/10   text-rose-400",
  "Multiway":       "bg-purple-500/10 text-purple-400",
  "Overbet":        "bg-red-500/10    text-red-400",
  "PKO":            "bg-yellow-500/10 text-yellow-400",
  "Push/Fold":      "bg-amber-500/10  text-amber-400",
  "Resteal":        "bg-orange-500/10 text-orange-400",
  "Steal":          "bg-emerald-500/10 text-emerald-400",
  "C-bet":          "bg-violet-500/10 text-violet-400",
  "Value Bet":      "bg-emerald-500/10 text-emerald-400",
  "Donk Bet":       "bg-cyan-500/10   text-cyan-400",
  "Double Barrel":  "bg-blue-500/10   text-blue-400",
  "Turn Probe":     "bg-indigo-500/10 text-indigo-400",
  "Float":          "bg-teal-500/10   text-teal-400",
  "Triple Barrel":  "bg-red-500/10    text-red-400",
  "Hero Call":      "bg-rose-500/10   text-rose-400",
  "Thin Value":     "bg-emerald-500/10 text-emerald-400",
  "Pot Control":    "bg-slate-500/10  text-slate-400",
  "Deep Stack":     "bg-purple-500/10 text-purple-400",
  "Short Deck":     "bg-orange-500/10 text-orange-400",
  "Bluff":          "bg-rose-500/10   text-rose-400",
  "Bluff Catch":    "bg-rose-500/10   text-rose-400",
  "Sizing":         "bg-slate-500/10  text-slate-400",
  "Overpair":       "bg-amber-500/10  text-amber-400",
  "Set":            "bg-emerald-500/10 text-emerald-400",
  "Two Pair":       "bg-blue-500/10   text-blue-400",
  "Check-Call":     "bg-teal-500/10   text-teal-400",
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
      <div className="relative rounded-2xl border border-border/50 bg-card/60 p-5 h-full card-lift hover:bg-card/80 hover:border-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/8">
        {solved && (
          <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <span className="text-[10px] text-emerald-400">✓</span>
          </div>
        )}

        <div className="flex items-center gap-1 mb-4">
          {puzzle.heroCards.map((c, i) => <CardFaceMini key={i} card={c} />)}
          <span className="ml-2 text-xs text-muted-foreground/60">{puzzle.heroPosition}</span>
        </div>

        <h3 className="font-semibold text-foreground text-sm mb-1.5 leading-snug group-hover:text-violet-300 transition-colors">
          {puzzle.title}
        </h3>
        <p className="text-xs text-muted-foreground/70 leading-relaxed mb-4 line-clamp-2">
          {puzzle.description}
        </p>

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

        <div className="flex items-center justify-between">
          {score !== undefined ? (
            <span className={cn("text-xs font-semibold",
              score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"
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

const DIFFICULTIES  = ["All", "beginner", "intermediate", "advanced", "expert"] as const;
const GAME_TYPES    = ["All", "cash", "tournament"] as const;
const FORMATS       = ["All", ...Array.from(new Set(PUZZLES.map(p => p.format))).sort()] as const;
const STREETS       = ["All", "preflop", "flop", "turn", "river"] as const;
const STACK_DEPTHS  = ["All", "short (≤20BB)", "medium (21-60BB)", "deep (61-100BB)", "very deep (100+BB)"] as const;
const CATEGORIES    = ["All", ...Array.from(new Set(PUZZLES.map(p => p.category))).sort()] as const;

function getStackDepth(bb: number): string {
  if (bb <= 20) return "short (≤20BB)";
  if (bb <= 60) return "medium (21-60BB)";
  if (bb <= 100) return "deep (61-100BB)";
  return "very deep (100+BB)";
}

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

// ─────────────────────────────────────────────────────────────────────────────

export default function PuzzlesPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PuzzleStats>({ solved: [], scores: {}, streak: 0, bestStreak: 0 });
  const [difficulty, setDifficulty]   = useState<string>("All");
  const [gameType, setGameType]       = useState<string>("All");
  const [format, setFormat]           = useState<string>("All");
  const [street, setStreet]           = useState<string>("All");
  const [stackDepth, setStackDepth]   = useState<string>("All");
  const [category, setCategory]       = useState<string>("All");

  useEffect(() => { setStats(loadStats()); }, []);

  function handleRandomPuzzle() {
    const puzzle = pickRandomPuzzle(stats, stats.lastRandomId);
    if (puzzle) router.push(`/analyze/puzzles/${puzzle.id}?mode=random`);
  }

  const filtered = PUZZLES.filter(p => {
    if (difficulty !== "All" && p.difficulty !== difficulty) return false;
    if (gameType !== "All" && p.gameType !== gameType) return false;
    if (format !== "All" && p.format !== format) return false;
    if (street !== "All" && p.steps[0]?.street !== street) return false;
    if (stackDepth !== "All" && getStackDepth(p.effectiveStack) !== stackDepth) return false;
    if (category !== "All" && p.category !== category) return false;
    return true;
  });

  const avgScore = stats.solved.length > 0
    ? Math.round(stats.solved.reduce((s, id) => s + (stats.scores[id] ?? 0), 0) / stats.solved.length)
    : null;

  const unsolvedCount = PUZZLES.length - stats.solved.length;
  const randomStreak = stats.randomStreak ?? 0;

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Solved",      value: stats.solved.length.toString(), icon: Trophy, color: "text-violet-400" },
              { label: "Avg Score",   value: avgScore !== null ? `${avgScore}` : "—",      icon: Star,   color: "text-amber-400" },
              { label: "Streak",      value: stats.streak.toString(),                      icon: Flame,  color: "text-orange-400" },
              { label: "Best Streak", value: stats.bestStreak.toString(),                  icon: Flame,  color: "text-rose-400" },
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

          {/* ── Random Spot CTA ───────────────────────────────────────────────── */}
          <div className="mb-10 relative rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/8 via-blue-600/6 to-violet-500/8 p-6 overflow-hidden">
            {/* Ambient glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-6 left-1/4 w-72 h-28 bg-violet-500/12 blur-[60px] rounded-full" />
              <div className="absolute top-0 right-1/4 w-48 h-20 bg-blue-500/8 blur-[50px] rounded-full" />
            </div>

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">

              {/* Icon + text */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/35 to-blue-600/25 border border-violet-500/35 shadow-lg shadow-violet-900/25">
                  <Shuffle className="h-5 w-5 text-violet-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h2 className="text-base font-bold text-foreground">Random Spot</h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/70 border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 rounded-full">
                      Instant
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed">
                    Jump into a random poker decision — all streets, formats, and stack depths. Weighted toward your weakest spots.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground/45">
                    <span>{unsolvedCount} unsolved remaining</span>
                    <span className="text-border">·</span>
                    <span>{PUZZLES.length} puzzles total</span>
                    {randomStreak > 0 && (
                      <>
                        <span className="text-border">·</span>
                        <span className="text-orange-400/80 flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {randomStreak} random streak
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA button */}
              {PUZZLES.length > 0 ? (
                <button
                  type="button"
                  onClick={handleRandomPuzzle}
                  className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl
                    bg-gradient-to-r from-violet-600 to-blue-500
                    px-7 py-4 text-sm font-bold text-white shrink-0 w-full sm:w-auto
                    shadow-lg shadow-violet-900/35
                    hover:shadow-xl hover:shadow-violet-500/40 hover:-translate-y-0.5
                    transition-all duration-200 overflow-hidden"
                >
                  <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Shuffle className="h-4 w-4 shrink-0" />
                  Play Random Spot
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <div className="rounded-xl border border-border/40 bg-secondary/30 px-7 py-4 text-sm text-muted-foreground/50 shrink-0">
                  No puzzles available yet
                </div>
              )}
            </div>
          </div>

          {/* ── Filters + grid ────────────────────────────────────────────────── */}
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
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Format</p>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map(f => (
                    <FilterChip key={f} active={format === f} onClick={() => setFormat(f)}>
                      {f}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Starting Street</p>
                <div className="flex flex-wrap gap-1.5">
                  {STREETS.map(s => (
                    <FilterChip key={s} active={street === s} onClick={() => setStreet(s)}>
                      {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Stack Depth</p>
                <div className="flex flex-col gap-1.5">
                  {STACK_DEPTHS.map(s => (
                    <FilterChip key={s} active={stackDepth === s} onClick={() => setStackDepth(s)}>
                      {s}
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
