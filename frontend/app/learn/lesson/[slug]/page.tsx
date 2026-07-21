"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Star,
  BookOpen,
} from "lucide-react";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { XPGain } from "@/components/learn/XPGain";
import { useAuth } from "@/hooks/useAuth";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import {
  LESSONS_BY_SLUG,
  MODULES_BY_SLUG,
  LESSONS_BY_MODULE,
  MODULES_BY_PATH,
} from "@/lib/learn/curriculum";
import type { LessonStep, StepResult } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 90
      ? "#10b981"
      : score >= 70
      ? "#3b82f6"
      : score >= 50
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="relative h-24 w-24">
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{score}%</span>
        <span className="text-[10px] text-muted-foreground">score</span>
      </div>
    </div>
  );
}

// ── Step progress dots (minimal header) ───────────────────────────────────────

function HeaderDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i <= current ? "w-4 bg-violet-500" : "w-2 bg-white/10"
          )}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useAuth();
  const { progress, recordStepResult, recordLessonComplete } = useLearnProgress();

  const lesson = LESSONS_BY_SLUG[slug];
  const [completionData, setCompletionData] = useState<{
    score: number;
    xpEarned: number;
    leveledUp: boolean;
    newLevel?: number;
  } | null>(null);

  const module = lesson ? MODULES_BY_SLUG[lesson.module_id] : undefined;
  const pathId = module?.path_id;

  // Every lesson id across every module in this lesson's path — sent to the
  // server so it can *verify* (never just trust) path-completion achievements.
  const pathLessonIds = useMemo(() => {
    if (!module) return [] as string[];
    const modules = MODULES_BY_PATH[module.path_id] ?? [];
    return modules.flatMap((m) => (LESSONS_BY_MODULE[m.id] ?? []).map((l) => l.id));
  }, [module]);

  const lessonProgress = lesson ? progress.lessons[lesson.id] : undefined;
  const resumeStepIndex =
    lessonProgress?.status === "in_progress" ? lessonProgress.current_step_index ?? 0 : 0;

  const [currentStep, setCurrentStep] = useState(resumeStepIndex);

  // resumeStepIndex is 0 on the very first render (progress is still loading),
  // then becomes accurate once fetched — useState's initial value only applies
  // once, so re-sync the header's step-dot display when loading finishes.
  useEffect(() => {
    if (!progress.loading) setCurrentStep(resumeStepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.loading, lesson?.id]);

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-foreground">Lesson not found</p>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t find the lesson &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to learning hub
          </Link>
        </div>
      </div>
    );
  }

  // Don't mount the player (and bake in a stale initialStepIndex) until real
  // resume position has actually loaded for a signed-in user.
  if (session?.access_token && progress.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  const allLessons = (LESSONS_BY_MODULE[lesson.module_id] ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const lessonIdx = allLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = allLessons[lessonIdx + 1] ?? null;

  const handleStepResult = (
    step: LessonStep,
    stepIndex: number,
    result: StepResult,
    userResponse: unknown,
    timeMs: number,
  ) => {
    setCurrentStep(stepIndex);
    recordStepResult(lesson.id, step.id, result, userResponse, step.concept_ids ?? [], timeMs, {
      moduleId: module?.id,
      pathId,
      stepIndex,
      totalSteps: lesson.steps.length,
    });
  };

  const handleComplete = async (score: number, xpEarned: number) => {
    const { bonusXp, leveledUp, newLevel } = await recordLessonComplete(lesson.id, score, 0, {
      moduleId: module?.id,
      pathId,
      lessonXpReward: lesson.xp_reward,
      pathLessonIds,
    });

    setCompletionData({ score, xpEarned: xpEarned + bonusXp, leveledUp, newLevel });
  };

  // ── Completion screen ──────────────────────────────────────────────────────
  if (completionData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Ambient glows for celebration */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/3 h-64 w-64 rounded-full bg-emerald-500/8 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-violet-500/8 blur-3xl" />
        </div>

        {/* Header */}
        <div className="relative z-40 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border/25 bg-background/90 backdrop-blur-md">
          <Link
            href={module ? `/learn/module/${module.slug}` : "/learn"}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            {module?.title ?? "Modules"}
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/60">
            Complete
          </span>
        </div>

        <div className="relative flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success icon */}
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Lesson complete!</h1>
              <p className="text-muted-foreground text-sm">{lesson.title}</p>
            </div>

            {/* Score + XP */}
            <div className="flex items-center justify-center gap-10">
              <ScoreRing score={completionData.score} />
              <XPGain
                xp={completionData.xpEarned}
                leveled_up={completionData.leveledUp}
                new_level={completionData.newLevel}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              {nextLesson && (
                <Link
                  href={`/learn/lesson/${nextLesson.slug}`}
                  className="group relative overflow-hidden flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  Next: {nextLesson.title}
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
              {!nextLesson && lesson.next_lesson_teaser && (
                <div className="w-full px-5 py-3.5 rounded-xl border border-violet-500/20 bg-violet-500/5 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-1">
                    Next lesson
                  </p>
                  <p className="text-sm font-semibold text-foreground/80">{lesson.next_lesson_teaser}</p>
                </div>
              )}
              <Link
                href={module ? `/learn/module/${module.slug}` : "/learn"}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Back to module
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Lesson player ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient background gradients */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-violet-600/6 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      {/* Sticky header */}
      <div className="relative z-40 sticky top-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-border/25 bg-background/90 backdrop-blur-md">
        {/* Left — back link */}
        <Link
          href={module ? `/learn/module/${module.slug}` : "/learn"}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 group"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">{module?.title ?? "Back"}</span>
          <span className="sm:hidden">Back</span>
        </Link>

        {/* Center — title + step dots */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <p className="text-xs font-semibold text-foreground/80 truncate max-w-xs">{lesson.title}</p>
          <HeaderDots total={lesson.steps.length} current={currentStep} />
        </div>

        {/* Right — XP badge */}
        <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0 text-amber-400 bg-amber-500/8 border border-amber-500/15 px-2.5 py-1 rounded-full">
          <Star className="h-3 w-3 fill-amber-400/50" />
          {lesson.xp_reward} XP
        </div>
      </div>

      {/* Player area */}
      <div className="relative flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-2xl">
          {session?.access_token ? (
            <LessonPlayer
              lesson={lesson}
              initialStepIndex={resumeStepIndex}
              onStepResult={handleStepResult}
              onComplete={handleComplete}
            />
          ) : (
            <div className="space-y-6">
              {/* Guest notice */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-violet-300/70">
                  <span className="font-semibold text-violet-300">Guest preview.</span>{" "}
                  Progress is saved on this device — sign in to sync it and never lose it.
                </p>
                <Link
                  href="/signup"
                  className="shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                >
                  Sign up →
                </Link>
              </div>
              <LessonPlayer
                lesson={lesson}
                initialStepIndex={resumeStepIndex}
                onStepResult={handleStepResult}
                onComplete={handleComplete}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
