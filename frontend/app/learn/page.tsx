"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Flame,
  Lock,
  CheckCircle,
  Circle,
  Clock as ClockIcon,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  BookOpen,
  Zap,
  Trophy,
  Target,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StreakBadge } from "@/components/learn/StreakBadge";
import { AchievementsPanel } from "@/components/learn/AchievementBadge";
import { useAuth } from "@/hooks/useAuth";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { LESSONS_BY_SLUG, LEARNING_MODULES, LESSONS, LEARNING_PATHS } from "@/lib/learn/curriculum";
import { ACHIEVEMENTS } from "@/lib/learn/types";
import { xpToNextLevel } from "@/lib/learn/types";
import type { ModuleDisplayStatus } from "@/lib/learn/journey";
import {
  JOURNEY_STAGES,
  DEV_TESTING_MODE,
  getCompletedModuleIds,
  getModuleDisplayStatus,
  getStageStatus,
  getNextLessonTarget,
  getNextPlannedModule,
  getJourneyOverview,
} from "@/lib/learn/journey";
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

// ── Journey status styling ───────────────────────────────────────────────────

const MODULE_STATUS_ICON: Record<ModuleDisplayStatus, typeof Circle> = {
  complete: CheckCircle,
  available: Circle,
  test_unlocked: FlaskConical,
  locked: Lock,
  coming_soon: ClockIcon,
};

const MODULE_STATUS_STYLE: Record<ModuleDisplayStatus, { badge: string; icon: string; row: string }> = {
  complete: {
    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    icon: "text-emerald-400",
    row: "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/35",
  },
  available: {
    badge: "bg-violet-500/10 border-violet-500/25 text-violet-400",
    icon: "text-violet-400",
    row: "border-violet-500/25 bg-violet-500/[0.03] hover:border-violet-500/40",
  },
  test_unlocked: {
    badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    icon: "text-amber-400",
    row: "border-amber-500/25 bg-amber-500/[0.03] hover:border-amber-500/40",
  },
  locked: {
    badge: "bg-secondary/30 border-border/30 text-muted-foreground/40",
    icon: "text-muted-foreground/40",
    row: "border-border/25 bg-card/30 opacity-60",
  },
  coming_soon: {
    badge: "bg-secondary/20 border-border/20 text-muted-foreground/50",
    icon: "text-muted-foreground/30",
    row: "border-border/20 bg-card/20 opacity-50",
  },
};

const MODULE_STATUS_LABEL: Record<ModuleDisplayStatus, string> = {
  complete: "Complete",
  available: "Available",
  test_unlocked: "Test",
  locked: "Locked",
  coming_soon: "Coming soon",
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
  const { user } = useAuth();
  const { progress } = useLearnProgress();
  const [showAchievements, setShowAchievements] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const loading = progress.loading;
  const error = progress.error;

  const xpInfo = xpToNextLevel(progress.skill.total_xp);
  const dailyXP = 50;
  const todayXP = Math.min(dailyXP, progress.skill.total_xp % dailyXP);
  const dailyPct = Math.round((todayXP / dailyXP) * 100);

  const unlockedIds = progress.achievementIds;

  const reviewsDueCount = Object.values(progress.concepts).filter(
    (c) => !c.next_review || new Date(c.next_review) <= new Date()
  ).length;

  const continueLesson = progress.continueTarget
    ? LESSONS_BY_SLUG[progress.continueTarget.lesson_id]
    : undefined;

  // ── Poker Journey derived state ──────────────────────────────────────────
  const completedModuleIds = useMemo(
    () => getCompletedModuleIds(progress.lessons),
    [progress.lessons]
  );
  const journeyOverview = useMemo(
    () => getJourneyOverview(progress.lessons),
    [progress.lessons]
  );
  const nextLessonTarget = useMemo(
    () => getNextLessonTarget(progress.lessons),
    [progress.lessons]
  );
  const nextPlannedModule = useMemo(
    () => getNextPlannedModule(completedModuleIds),
    [completedModuleIds]
  );
  const currentStageId = useMemo(() => {
    const current = JOURNEY_STAGES.find(
      (s) => getStageStatus(s, completedModuleIds) === "current"
    );
    return current?.id ?? JOURNEY_STAGES[0].id;
  }, [completedModuleIds]);
  const activeStageId = expandedStageId ?? currentStageId;

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
                  { icon: BookOpen, value: String(LESSONS.length), label: "lessons live" },
                  { icon: Sparkles, value: `${journeyOverview.availableModules}`, label: "modules available" },
                  { icon: Target,   value: "28",  label: "modules planned" },
                  { icon: Zap,      value: "13",  label: "stages" },
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
                  Couldn&apos;t reach your saved progress right now — showing your last known state. It will
                  retry automatically.
                </div>
              )}

              {/* ── Stats row: Level ring + daily XP + streak ── */}
              {user && (
                <div className="flex flex-col sm:flex-row gap-4 mb-8">

                  {/* Level + XP */}
                  <div className="flex-1 rounded-2xl border border-border/50 bg-card/60 p-5">
                    <div className="flex items-center gap-4">
                      <LevelRing
                        level={progress.skill.level}
                        pct={xpInfo.pct}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-foreground">
                            Level {progress.skill.level}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {progress.skill.total_xp.toLocaleString()} XP
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                            style={{ width: `${xpInfo.pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground/40">
                            Daily goal
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {xpInfo.needed - xpInfo.current} XP to next level
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
                    <StreakBadge days={progress.skill.streak_days} />
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
                      <span className="ml-auto font-bold text-foreground">{progress.leaks.length}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="h-4 w-4 text-violet-400/70" />
                      <span className="text-muted-foreground">Reviews due</span>
                      <span className="ml-auto font-bold text-foreground">{reviewsDueCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Continue Learning ── */}
              <div className="mb-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-3">
                  Continue learning
                </p>

                {continueLesson && progress.continueTarget ? (
                  <Link href={`/learn/lesson/${continueLesson.slug}`} className="group block">
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
                              Pick up where you left off
                            </p>
                            <h3 className="text-base font-bold text-foreground truncate">
                              {continueLesson.title}
                            </h3>
                            {progress.continueTarget.total_steps && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                Step {progress.continueTarget.step_index + 1} of {progress.continueTarget.total_steps}
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
                ) : nextLessonTarget ? (
                  <Link href={`/learn/lesson/${nextLessonTarget.lesson.slug}`} className="group block">
                    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-card/80 to-blue-900/20 p-6 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/20 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
                      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
                      <div className="relative flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30">
                            <Sparkles className="h-5.5 w-5.5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/60 mb-0.5">
                              {nextLessonTarget.module.title}
                            </p>
                            <h3 className="text-base font-bold text-foreground truncate">
                              {nextLessonTarget.lesson.title}
                            </h3>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 group-hover:opacity-95 transition-all">
                          Start
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                        <CheckCircle className="h-5.5 w-5.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground">You&apos;re caught up!</h3>
                        {nextPlannedModule ? (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Next: <span className="text-foreground/80 font-medium">{nextPlannedModule.title}</span>{" "}
                            <span className="text-muted-foreground/50">· Coming soon</span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            You&apos;ve completed everything available in the Poker Journey so far.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Poker Journey (stage-grouped roadmap) ── */}
              <div className="mb-10">
                {DEV_TESTING_MODE && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-2.5">
                    <FlaskConical className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300/80">
                      <span className="font-semibold text-amber-300">Developer testing mode</span> — every
                      implemented module is open regardless of prerequisites. Real progress is unaffected.
                    </p>
                  </div>
                )}
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-1">
                      Poker Journey
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {journeyOverview.availableCompleted} of {journeyOverview.availableModules} available modules
                      complete · {journeyOverview.totalRoadmapModules} planned in total
                    </p>
                  </div>
                  <Link
                    href="/learn/journey"
                    className="text-xs text-violet-400/70 hover:text-violet-300 transition-colors whitespace-nowrap"
                  >
                    Full roadmap →
                  </Link>
                </div>

                {/* Overall progress bar (based only on released content) */}
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-6">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400 transition-all duration-700"
                    style={{
                      width: `${
                        journeyOverview.availableModules
                          ? Math.round((journeyOverview.availableCompleted / journeyOverview.availableModules) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {JOURNEY_STAGES.map((stage) => {
                    const stageModules = LEARNING_MODULES.filter((m) => stage.moduleIds.includes(m.id)).sort(
                      (a, b) => (a.order ?? 0) - (b.order ?? 0)
                    );
                    const stageStatus = getStageStatus(stage, completedModuleIds);
                    const isOpen = activeStageId === stage.id;

                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          "rounded-2xl border transition-all duration-200 overflow-hidden",
                          stageStatus === "current"
                            ? "border-violet-500/30 bg-violet-500/[0.03]"
                            : "border-border/40 bg-card/50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedStageId(isOpen ? "" : stage.id)}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                                stageStatus === "complete"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : stageStatus === "current"
                                  ? "border-violet-500/40 bg-violet-500/10 text-violet-400"
                                  : "border-border/30 bg-secondary/20 text-muted-foreground/40"
                              )}
                            >
                              {stage.order}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{stage.title}</p>
                              {stage.subtitle && (
                                <p className="text-xs text-muted-foreground/70 truncate">{stage.subtitle}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                              {stageModules.length} module{stageModules.length !== 1 ? "s" : ""}
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground/40 transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-4 space-y-2">
                            {stageModules.map((mod) => {
                              const status = getModuleDisplayStatus(mod, completedModuleIds);
                              const styles = MODULE_STATUS_STYLE[status];
                              const StatusIcon = MODULE_STATUS_ICON[status];
                              const clickable = status !== "coming_soon" && status !== "locked";

                              const row = (
                                <div
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150",
                                    styles.row,
                                    clickable && "cursor-pointer hover:-translate-y-0.5"
                                  )}
                                >
                                  <StatusIcon className={cn("h-4 w-4 shrink-0", styles.icon)} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">{mod.title}</p>
                                    {mod.subtitle && (
                                      <p className="text-xs text-muted-foreground/60 truncate">{mod.subtitle}</p>
                                    )}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
                                      styles.badge
                                    )}
                                  >
                                    {MODULE_STATUS_LABEL[status]}
                                  </span>
                                </div>
                              );

                              return clickable ? (
                                <Link key={mod.id} href={`/learn/module/${mod.slug}`} className="block">
                                  {row}
                                </Link>
                              ) : (
                                <div key={mod.id}>{row}</div>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
              {user && progress.leaks.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-base font-semibold text-foreground mb-4">Your weak spots</h2>
                  <div className="rounded-2xl border border-border/50 bg-card/60 divide-y divide-border/30">
                    {progress.leaks.slice(0, 3).map((leak) => (
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
              {user && progress.leaks.length === 0 && (
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
