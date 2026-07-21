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
  Trophy,
  Target,
  Crown,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StreakBadge } from "@/components/learn/StreakBadge";
import { AchievementsPanel } from "@/components/learn/AchievementBadge";
import { useAuth } from "@/hooks/useAuth";
import { fetchLearningDashboard } from "@/lib/learn/api";
import { LEARNING_PATHS } from "@/lib/learn/curriculum";
import { ACHIEVEMENTS } from "@/lib/learn/types";
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ── Path config ───────────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  free:    "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
  pro:     "bg-blue-500/10 border-blue-500/25 text-blue-400",
  premium: "bg-violet-500/10 border-violet-500/25 text-violet-400",
};

const PATH_ICONS: Record<string, typeof BookOpen> = {
  beginner:     BookOpen,
  intermediate: TrendingUp,
  advanced:     Star,
  pro:          Crown,
};

const PATH_CARD_BG: Record<string, string> = {
  beginner:     "bg-gradient-to-br from-emerald-950/60 via-card/80 to-card/50 border-emerald-900/40",
  intermediate: "bg-gradient-to-br from-blue-950/60 via-card/80 to-card/50 border-blue-900/40",
  advanced:     "bg-gradient-to-br from-violet-950/60 via-card/80 to-card/50 border-violet-900/40",
  pro:          "bg-gradient-to-br from-amber-950/50 via-card/80 to-card/50 border-amber-900/30",
};

const PATH_HOVER: Record<string, string> = {
  beginner:     "hover:border-emerald-500/40 hover:shadow-emerald-900/20",
  intermediate: "hover:border-blue-500/40 hover:shadow-blue-900/20",
  advanced:     "hover:border-violet-500/40 hover:shadow-violet-900/20",
  pro:          "hover:border-amber-500/40 hover:shadow-amber-900/20",
};

const PATH_GLOW_TOP: Record<string, string> = {
  beginner:     "bg-emerald-500/8",
  intermediate: "bg-blue-500/8",
  advanced:     "bg-violet-500/10",
  pro:          "bg-amber-500/8",
};

const PATH_ICON_BG: Record<string, string> = {
  beginner:     "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
  intermediate: "bg-blue-500/15 border-blue-500/25 text-blue-400",
  advanced:     "bg-violet-500/15 border-violet-500/25 text-violet-400",
  pro:          "bg-amber-500/15 border-amber-500/25 text-amber-400",
};

const PATH_ARROW: Record<string, string> = {
  beginner:     "text-emerald-400",
  intermediate: "text-blue-400",
  advanced:     "text-violet-400",
  pro:          "text-amber-400",
};

const PATH_XP_TOTAL: Record<string, number> = {
  beginner: 700,
  intermediate: 1150,
  advanced: 1400,
  pro: 950,
};

const MODULE_COUNTS: Record<string, number> = {
  beginner: 5,
  intermediate: 5,
  advanced: 5,
  pro: 4,
};

// ── Severity badge ────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  mild:     "bg-amber-500/10 border-amber-500/25 text-amber-400",
  moderate: "bg-orange-500/10 border-orange-500/25 text-orange-400",
  severe:   "bg-red-500/10 border-red-500/25 text-red-400",
};

// ── XP level ring ─────────────────────────────────────────────────────────────

function LevelRing({ level, pct }: { level: number; pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r={r} strokeWidth="3" className="stroke-secondary/50" />
        <circle
          cx="24" cy="24" r={r}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="stroke-amber-400 transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-foreground">
        {level}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const { user, session } = useAuth();
  const [dashboard, setDashboard] = useState<PersonalizedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

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

  const xpInfo = dashboard ? xpToNextLevel(dashboard.skill_progress.total_xp) : null;
  const dailyXP = 50;
  const todayXP = Math.min(dailyXP, (dashboard?.skill_progress.total_xp ?? 0) % dailyXP);
  const dailyPct = Math.round((todayXP / dailyXP) * 100);

  const unlockedIds = new Set<string>(
    dashboard?.skill_progress.achievements ?? []
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* ── Hero ── */}
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/50 via-background/70 to-blue-950/25 px-8 py-10 sm:px-12 sm:py-12">
            {/* Ambient glows */}
            <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl animate-drift-glow" />
            <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-20 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute top-1/2 right-1/3 h-40 w-40 rounded-full bg-violet-400/8 blur-2xl" />

            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60 mb-3">
                Learning Hub
              </p>
              <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-3 leading-tight tracking-tight">
                Master the{" "}
                <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-violet-300 bg-clip-text text-transparent animate-gradient">
                  Mental Game
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                Adaptive micro-lessons, GTO concept training, and AI coaching — engineered to turn theory into real profit.
              </p>

              {/* Stats strip */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {[
                  { icon: BookOpen, value: "18+", label: "lessons" },
                  { icon: Brain,    value: "22",  label: "concepts" },
                  { icon: Target,   value: "3",   label: "learning paths" },
                  { icon: Zap,      value: "4,200+", label: "XP available" },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-violet-400/50" />
                    <span className="font-semibold text-foreground">{value}</span>
                    <span className="text-muted-foreground/60">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Auth gate ── */}
          {!user && !loading && (
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-900/25 via-card/80 to-blue-900/15 p-8 text-center mb-10">
              <div aria-hidden className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 mx-auto mb-4">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Start your poker education</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                  The Foundations path is free to start right now — no account needed. Create one anytime to save your XP and unlock personalized AI coaching.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link
                    href="/learn/path/beginner"
                    className="group relative overflow-hidden inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    Start free — no sign-in required
                  </Link>
                  <Link
                    href="/signup"
                    className="px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {!loading && (
            <>
              {error && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-400/80 text-xs mb-6 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Personalised data unavailable — run the database migration to enable progress tracking.
                </div>
              )}

              {/* ── Stats row: Level ring + daily XP + streak ── */}
              {dashboard && (
                <div className="flex flex-col sm:flex-row gap-4 mb-8">

                  {/* Level + XP */}
                  <div className="flex-1 rounded-2xl border border-border/50 bg-card/60 p-5">
                    <div className="flex items-center gap-4">
                      <LevelRing
                        level={dashboard.skill_progress.level}
                        pct={xpInfo?.pct ?? 0}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-foreground">
                            Level {dashboard.skill_progress.level}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {dashboard.skill_progress.total_xp.toLocaleString()} XP
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                            style={{ width: `${xpInfo?.pct ?? 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground/40">
                            Daily goal
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {(xpInfo?.needed ?? 0) - (xpInfo?.current ?? 0)} XP to next level
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Daily XP bar */}
                    <div className="mt-4 pt-4 border-t border-border/20">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                          Today's XP
                        </span>
                        <span>{todayXP} / {dailyXP}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                          style={{ width: `${dailyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="sm:w-52 rounded-2xl border border-border/50 bg-card/60 p-5 flex flex-col items-center justify-center gap-2">
                    <StreakBadge days={dashboard.streak_status.days} />
                    {dashboard.streak_status.bonus_xp > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +{dashboard.streak_status.bonus_xp} XP streak bonus
                      </p>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="sm:w-44 rounded-2xl border border-border/50 bg-card/60 p-5 flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-amber-400/70" />
                      <span className="text-muted-foreground">Achievements</span>
                      <span className="ml-auto font-bold text-foreground">{unlockedIds.size}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-orange-400/70" />
                      <span className="text-muted-foreground">Leaks</span>
                      <span className="ml-auto font-bold text-foreground">{dashboard.active_leaks.length}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="h-4 w-4 text-violet-400/70" />
                      <span className="text-muted-foreground">Reviews due</span>
                      <span className="ml-auto font-bold text-foreground">{dashboard.review_concepts.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Continue / Recommended Lesson ── */}
              {dashboard?.recommended_lesson && (
                <div className="mb-10">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-3">
                    Continue learning
                  </p>
                  <Link href={`/learn/lesson/${dashboard.recommended_lesson.slug}`} className="group block">
                    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-card/80 to-blue-900/20 p-6 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/20 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
                      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
                      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
                      <div className="relative flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30">
                            <Brain className="h-5.5 w-5.5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/60 mb-0.5">
                              Recommended for you
                            </p>
                            <h3 className="text-base font-bold text-foreground truncate">
                              {dashboard.recommended_lesson.title}
                            </h3>
                            {dashboard.recommended_lesson.reason && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {dashboard.recommended_lesson.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 group-hover:opacity-95 transition-all">
                          Continue
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* ── Learning Paths Grid (4 paths) ── */}
              <div className="mb-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-4">Learning paths</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {LEARNING_PATHS.map((path) => {
                    const Icon = PATH_ICONS[path.id] ?? BookOpen;
                    const isLocked = path.tier_required !== "free" && !user;
                    const moduleCount = MODULE_COUNTS[path.id] ?? 0;
                    return (
                      <Link
                        key={path.id}
                        href={isLocked ? "/pricing" : `/learn/path/${path.id}`}
                        className="group block"
                      >
                        <div
                          className={cn(
                            "h-full rounded-2xl border p-5 transition-all duration-200 relative overflow-hidden hover:shadow-lg hover:-translate-y-0.5",
                            isLocked
                              ? "border-border/25 bg-card/40 opacity-60 cursor-default hover:translate-y-0 hover:shadow-none"
                              : cn(PATH_CARD_BG[path.id], PATH_HOVER[path.id]),
                          )}
                        >
                          {/* Card ambient glow top-right */}
                          {!isLocked && (
                            <div
                              aria-hidden
                              className={cn(
                                "pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl opacity-60",
                                PATH_GLOW_TOP[path.id],
                              )}
                            />
                          )}

                          <div className="relative flex items-start justify-between mb-4">
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl border shrink-0",
                                isLocked ? "bg-secondary/30 border-border/30 text-muted-foreground/30" : PATH_ICON_BG[path.id],
                              )}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                                  isLocked ? "bg-secondary/20 border-border/20 text-muted-foreground/30" : TIER_BADGE[path.tier_required],
                                )}
                              >
                                {path.tier_required}
                              </span>
                              {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/30" />}
                            </div>
                          </div>

                          <h3 className="relative font-bold text-foreground mb-1.5 text-[15px]">{path.title}</h3>
                          <p className="relative text-xs text-muted-foreground leading-relaxed mb-5">
                            {path.description}
                          </p>

                          {/* Module + XP row */}
                          <div className="relative flex items-center justify-between text-[10px] text-muted-foreground/50 mb-3">
                            <span>{moduleCount} modules</span>
                            <span className="flex items-center gap-1 text-amber-400/60">
                              <Zap className="h-2.5 w-2.5" />
                              {PATH_XP_TOTAL[path.id]?.toLocaleString() ?? "—"} XP
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-4">
                            <div className={cn("h-full rounded-full w-0", isLocked ? "" : "bg-gradient-to-r from-current opacity-40")} style={{ color: PATH_ARROW[path.id] }} />
                          </div>

                          <div
                            className={cn(
                              "relative flex items-center gap-1.5 text-xs font-semibold group-hover:translate-x-0.5 transition-transform",
                              isLocked ? "text-muted-foreground/30" : PATH_ARROW[path.id],
                            )}
                          >
                            {isLocked ? "Unlock path" : "Explore path"}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* ── Achievements Panel ── */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground">Achievements</h2>
                  <button
                    type="button"
                    onClick={() => setShowAchievements((v) => !v)}
                    className="text-xs text-violet-400/70 hover:text-violet-300 transition-colors"
                  >
                    {showAchievements ? "Show less" : "Show all"}
                  </button>
                </div>

                {/* Quick unlocked summary */}
                {!showAchievements && (
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                    {unlockedIds.size === 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <Trophy className="h-5 w-5 text-amber-400/70" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">No achievements yet</p>
                          <p className="text-xs text-muted-foreground">
                            Complete your first lesson to earn your first badge.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAchievements(true)}
                          className="ml-auto text-xs text-violet-400/70 hover:text-violet-300 transition-colors whitespace-nowrap"
                        >
                          View all →
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2 flex-wrap">
                          {ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id))
                            .slice(0, 6)
                            .map((a) => (
                              <span
                                key={a.id}
                                className="text-xl"
                                title={a.title}
                                role="img"
                                aria-label={a.title}
                              >
                                {a.icon}
                              </span>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground ml-2">
                          {unlockedIds.size} of {ACHIEVEMENTS.length} earned
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAchievements(true)}
                          className="ml-auto text-xs text-violet-400/70 hover:text-violet-300 transition-colors whitespace-nowrap"
                        >
                          View all →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {showAchievements && (
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                    <AchievementsPanel
                      achievements={ACHIEVEMENTS}
                      unlockedIds={unlockedIds}
                      showLocked
                    />
                  </div>
                )}
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
                              SEVERITY_STYLE[leak.severity],
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
                    Complete lessons and analyse hands to uncover areas to improve.
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
