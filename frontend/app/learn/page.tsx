"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Flame,
  Lock,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Zap,
  Star,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StreakBadge } from "@/components/learn/StreakBadge";
import { useAuth } from "@/hooks/useAuth";
import { fetchLearningDashboard } from "@/lib/learn/api";
import { LEARNING_PATHS } from "@/lib/learn/curriculum";
import type { PersonalizedDashboard } from "@/lib/learn/types";
import { xpToNextLevel } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-white/[0.04]", className)} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ── Path tier badge ───────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  free: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
  pro: "bg-blue-500/10 border-blue-500/25 text-blue-400",
  premium: "bg-violet-500/10 border-violet-500/25 text-violet-400",
};

const PATH_ICONS: Record<string, typeof BookOpen> = {
  foundations: BookOpen,
  "range-thinking": TrendingUp,
  "gto-mastery": Star,
};

// ── Severity badge ────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  mild: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  moderate: "bg-orange-500/10 border-orange-500/25 text-orange-400",
  severe: "bg-red-500/10 border-red-500/25 text-red-400",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const { user, session } = useAuth();
  const [dashboard, setDashboard] = useState<PersonalizedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetchLearningDashboard(session.access_token)
      .then(setDashboard)
      .catch((e) => setError(e.message ?? "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [session]);

  const xpInfo = dashboard
    ? xpToNextLevel(dashboard.skill_progress.total_xp)
    : null;

  // XP daily goal: simple heuristic (50 XP per day)
  const dailyXP = 50;
  const todayXP = Math.min(dailyXP, (dashboard?.skill_progress.total_xp ?? 0) % dailyXP);
  const dailyPct = Math.round((todayXP / dailyXP) * 100);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* ── Header ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-0.5">
                  Learning Hub
                </p>
                <h1 className="text-3xl font-bold text-foreground">Learn Poker</h1>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 ml-[52px]">
              Interactive lessons. Adaptive coaching. Real improvement.
            </p>
          </div>

          {/* ── Auth gate ── */}
          {!user && !loading && (
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-8 text-center mb-8">
              <Brain className="h-10 w-10 text-violet-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Sign in to start learning</h2>
              <p className="text-muted-foreground text-sm mb-5">
                Create a free account to track your progress, earn XP, and get personalized coaching.
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get started free
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-red-400 text-sm mb-8 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── Daily Goal / Streak Row ── */}
              {dashboard && (
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  {/* XP progress */}
                  <div className="flex-1 rounded-2xl border border-border/50 bg-card/60 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 text-amber-400" />
                        <span>Daily goal</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {todayXP} / {dailyXP} XP
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${dailyPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        Total: <span className="font-bold text-amber-400">{dashboard.skill_progress.total_xp} XP</span>
                        {" "}· Level <span className="font-bold text-foreground">{dashboard.skill_progress.level}</span>
                      </span>
                      {xpInfo && (
                        <span className="text-xs text-muted-foreground">
                          {xpInfo.needed - xpInfo.current} XP to level {dashboard.skill_progress.level + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="sm:w-52 rounded-2xl border border-border/50 bg-card/60 p-5 flex flex-col items-center justify-center gap-2">
                    <StreakBadge days={dashboard.streak_status.days} />
                    {dashboard.streak_status.bonus_xp > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +{dashboard.streak_status.bonus_xp} XP bonus
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Continue / Recommended Lesson ── */}
              {dashboard?.recommended_lesson && (
                <div className="mb-10">
                  <h2 className="text-base font-semibold text-foreground mb-3">Continue learning</h2>
                  <Link
                    href={`/learn/lesson/${dashboard.recommended_lesson.slug}`}
                    className="group block"
                  >
                    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/10 via-card/60 to-blue-600/5 p-6 hover:border-violet-500/40 transition-colors relative overflow-hidden">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
                      />
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-1">
                            Recommended
                          </p>
                          <h3 className="text-lg font-bold text-foreground mb-1">
                            {dashboard.recommended_lesson.title}
                          </h3>
                          {dashboard.recommended_lesson.reason && (
                            <p className="text-sm text-muted-foreground">
                              {dashboard.recommended_lesson.reason}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold group-hover:opacity-90 transition-opacity">
                          Continue <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* ── Learning Paths Grid ── */}
              <div className="mb-10">
                <h2 className="text-base font-semibold text-foreground mb-4">Learning paths</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {LEARNING_PATHS.map((path) => {
                    const Icon = PATH_ICONS[path.id] ?? BookOpen;
                    const isLocked = path.tier_required !== "free" && !user;
                    return (
                      <Link
                        key={path.id}
                        href={isLocked ? "/pricing" : `/learn/path/${path.id}`}
                        className="group block"
                      >
                        <div
                          className={cn(
                            "h-full rounded-2xl border bg-card/60 p-5 transition-all duration-200",
                            isLocked
                              ? "border-border/30 opacity-70 hover:opacity-90"
                              : "border-border/50 hover:border-violet-500/30 hover:bg-violet-500/[0.03]"
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
                              <Icon className="h-4.5 w-4.5 text-violet-400" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                                  TIER_BADGE[path.tier_required]
                                )}
                              >
                                {path.tier_required}
                              </span>
                              {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            </div>
                          </div>

                          <h3 className="font-semibold text-foreground mb-1">{path.title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                            {path.description}
                          </p>

                          {/* Progress bar placeholder */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span className="font-medium text-foreground">0%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                              <div className="h-full rounded-full bg-violet-500/60 w-0" />
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 text-xs text-violet-400 group-hover:translate-x-0.5 transition-transform">
                            {isLocked ? "Unlock path" : "Explore path"}{" "}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* ── Weak Spots Panel ── */}
              {dashboard && dashboard.active_leaks.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-base font-semibold text-foreground mb-4">Your weak spots</h2>
                  <div className="rounded-2xl border border-border/50 bg-card/60 divide-y divide-border/30">
                    {dashboard.active_leaks.slice(0, 3).map((leak) => (
                      <div
                        key={leak.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate capitalize">
                              {leak.concept_id.replace(/-/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {leak.evidence_count} spots · {leak.leak_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                              SEVERITY_STYLE[leak.severity]
                            )}
                          >
                            {leak.severity}
                          </span>
                          <Link
                            href="/coach"
                            className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                          >
                            Train Now →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for leaks */}
              {dashboard && dashboard.active_leaks.length === 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center mb-8">
                  <Flame className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                  <p className="font-semibold text-foreground mb-1">No active leaks detected</p>
                  <p className="text-sm text-muted-foreground">
                    Complete lessons and analyze hands to uncover areas to improve.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
