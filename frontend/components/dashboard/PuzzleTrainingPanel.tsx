"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Brain, Flame, ChevronRight, TrendingUp } from "lucide-react";
import { PUZZLES } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

interface PuzzleAttempt {
  id: string;
  score: number;
  timestamp: number;
  difficulty: string;
  category: string;
}

interface PuzzleStats {
  solved: string[];
  scores: Record<string, number>;
  streak: number;
  bestStreak: number;
  lastPlayed?: number;
  attempts?: PuzzleAttempt[];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PuzzleTrainingPanel() {
  const [stats, setStats] = useState<PuzzleStats | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("puzzle_stats");
      if (raw) setStats(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  const totalPuzzles = PUZZLES.length;

  if (!stats || stats.solved.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Brain className="h-6 w-6 text-violet-400/60" />
          </div>
        </div>
        <p className="text-foreground font-medium">No puzzles solved yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Train with multi-street interactive scenarios to sharpen your game.
        </p>
        <Link
          href="/analyze/puzzles"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
        >
          Start Training <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const solved = stats.solved.length;
  const attempts = stats.attempts ?? [];

  const allScores = attempts.length > 0
    ? attempts.map(a => a.score)
    : Object.values(stats.scores);
  const accuracy = allScores.length > 0
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 0;
  const bestScore = Object.values(stats.scores).reduce((m, v) => Math.max(m, v), 0);
  const streak = stats.streak ?? 0;

  // Category performance
  const categoryMap: Record<string, number[]> = {};
  for (const a of attempts) {
    if (!a.category) continue;
    if (!categoryMap[a.category]) categoryMap[a.category] = [];
    categoryMap[a.category].push(a.score);
  }
  // Fallback: derive from solved list if no attempts have categories
  if (Object.keys(categoryMap).length === 0) {
    for (const id of stats.solved) {
      const p = PUZZLES.find(p => p.id === id);
      if (!p) continue;
      if (!categoryMap[p.category]) categoryMap[p.category] = [];
      categoryMap[p.category].push(stats.scores[id] ?? 0);
    }
  }
  const categoryPerf = Object.entries(categoryMap)
    .map(([cat, scores]) => ({
      cat,
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  // Recent activity — newest first
  const recentAttempts = attempts.length > 0
    ? [...attempts].reverse().slice(0, 5)
    : stats.solved.slice(-5).reverse().map(id => ({
        id,
        score: stats.scores[id] ?? 0,
        timestamp: stats.lastPlayed ?? 0,
        difficulty: PUZZLES.find(p => p.id === id)?.difficulty ?? "",
        category: PUZZLES.find(p => p.id === id)?.category ?? "",
      }));

  const strongest = categoryPerf[0];
  const weakest = categoryPerf.length > 1 ? categoryPerf[categoryPerf.length - 1] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Puzzle Training</h2>
        <Link
          href="/analyze/puzzles"
          className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          Continue Training <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-xs text-muted-foreground/60 mb-1">Accuracy</p>
          <p className={cn(
            "text-2xl font-bold",
            accuracy >= 80 ? "text-violet-400" : accuracy >= 60 ? "text-amber-400" : "text-red-400"
          )}>
            {accuracy}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </p>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          streak >= 3 ? "border-orange-500/25 bg-orange-500/5" : "border-border/60 bg-card/40"
        )}>
          <p className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1">
            {streak >= 3 && <Flame className="h-3 w-3 text-orange-400" />}
            Streak
          </p>
          <p className={cn(
            "text-2xl font-bold",
            streak >= 3 ? "text-orange-400" : "text-foreground"
          )}>
            {streak}
            <span className="text-sm font-normal text-muted-foreground"> solved</span>
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs text-muted-foreground/60 mb-1">Solved</p>
          <p className="text-2xl font-bold text-foreground">
            {solved}
            <span className="text-sm font-normal text-muted-foreground">/{totalPuzzles}</span>
          </p>
          <div className="mt-1.5 h-1 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${Math.round((solved / totalPuzzles) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs text-muted-foreground/60 mb-1">Best Score</p>
          <p className={cn(
            "text-2xl font-bold",
            bestScore >= 90 ? "text-emerald-400" : bestScore >= 70 ? "text-blue-400" : "text-foreground"
          )}>
            {bestScore}
          </p>
        </div>
      </div>

      {/* Category performance */}
      {categoryPerf.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">
            Category Performance
          </p>
          <div className="space-y-2.5">
            {categoryPerf.slice(0, 4).map(({ cat, avg }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground/80 capitalize">{cat}</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    avg >= 80 ? "text-emerald-400" : avg >= 60 ? "text-amber-400" : "text-red-400"
                  )}>
                    {avg}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      avg >= 80 ? "bg-emerald-500" : avg >= 60 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${avg}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentAttempts.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">
            Recent Activity
          </p>
          <div className="space-y-1">
            {recentAttempts.map((a, i) => {
              const puzzle = PUZZLES.find(p => p.id === a.id);
              return (
                <Link
                  key={i}
                  href={`/analyze/puzzles/${a.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/30 transition-colors"
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    a.score >= 80 ? "bg-emerald-500" : a.score >= 60 ? "bg-amber-500" : "bg-red-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {puzzle?.title ?? a.id}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 capitalize">
                      {a.difficulty}{a.category ? ` · ${a.category}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-xs font-bold",
                      a.score >= 80 ? "text-emerald-400" : a.score >= 60 ? "text-amber-400" : "text-red-400"
                    )}>
                      {a.score}
                    </span>
                    {a.timestamp > 0 && (
                      <span className="text-[10px] text-muted-foreground/40 w-12 text-right">
                        {timeAgo(a.timestamp)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights chips */}
      {(streak >= 3 || strongest || (weakest && weakest.avg < 70) || accuracy >= 90) && (
        <div className="flex flex-wrap gap-2">
          {streak >= 3 && (
            <div className="flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/8 px-3 py-1.5">
              <Flame className="h-3 w-3 text-orange-400" />
              <span className="text-xs text-orange-300">{streak} puzzle streak!</span>
            </div>
          )}
          {strongest && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-xs text-emerald-300">Best: {strongest.cat}</span>
            </div>
          )}
          {weakest && weakest.avg < 70 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/8 px-3 py-1.5">
              <span className="text-xs text-amber-300">Focus: {weakest.cat}</span>
            </div>
          )}
          {accuracy >= 90 && (
            <div className="flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 px-3 py-1.5">
              <span className="text-xs text-violet-300">Elite accuracy</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
