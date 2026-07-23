"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Sparkles,
  Zap,
  BookOpen,
  Layers,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import {
  MODULES_BY_SLUG,
  LEARNING_PATHS,
  LESSONS_BY_MODULE,
} from "@/lib/learn/curriculum";
import { getStageForModule } from "@/lib/learn/journey";
import type { Lesson } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

// ── Lesson type badge ─────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  micro: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  range_trainer: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  puzzle_drill: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  concept_reveal: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  simulation: "bg-orange-500/10 border-orange-500/20 text-orange-400",
};

const TYPE_LABEL: Record<string, string> = {
  micro: "Micro lesson",
  range_trainer: "Range trainer",
  puzzle_drill: "Puzzle drill",
  concept_reveal: "Concept",
  simulation: "Simulation",
};

// ── Lesson card ───────────────────────────────────────────────────────────────

type LessonStatus = "not_started" | "in_progress" | "completed";

function LessonCard({
  lesson,
  idx,
  status,
}: {
  lesson: Lesson;
  idx: number;
  status: LessonStatus;
}) {
  const complete = status === "completed";
  const inProgress = status === "in_progress";
  return (
    <Link href={`/learn/lesson/${lesson.slug}`} className="group block">
      <div className={cn(
        "flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        complete
          ? "border-emerald-500/20 bg-gradient-to-r from-emerald-950/25 via-card/70 to-card/60 hover:border-emerald-500/35 hover:shadow-emerald-900/15"
          : inProgress
          ? "border-violet-500/30 bg-gradient-to-r from-violet-950/20 via-card/70 to-card/60 hover:border-violet-500/45 hover:shadow-violet-900/15"
          : "border-border/40 bg-card/60 hover:border-violet-500/30 hover:bg-violet-500/[0.03] hover:shadow-violet-900/15"
      )}>
        {/* Step number / check */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums",
            complete
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : inProgress
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
              : "border-border/25 bg-secondary/5 text-muted-foreground/50"
          )}
        >
          {complete ? (
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
          ) : (
            idx + 1
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                TYPE_STYLE[lesson.lesson_type] ?? "bg-secondary/30 border-border/30 text-muted-foreground"
              )}
            >
              {TYPE_LABEL[lesson.lesson_type] ?? lesson.lesson_type}
            </span>
            {complete && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                ✓ Completed
              </span>
            )}
            {inProgress && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300">
                In progress
              </span>
            )}
          </div>
          <p className="font-semibold text-foreground text-sm truncate">{lesson.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              {lesson.estimated_min} min
            </span>
            <span className="flex items-center gap-1 text-xs text-amber-400/80">
              <Zap className="h-3 w-3" />
              {lesson.xp_reward} XP
            </span>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 text-[11px] font-semibold hidden sm:inline",
            complete ? "text-emerald-400/70" : inProgress ? "text-violet-300/70" : "text-muted-foreground/30"
          )}
        >
          {complete ? "Review" : inProgress ? "Continue" : "Not started"}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModulePage() {
  const { slug } = useParams<{ slug: string }>();
  const { progress, recordModuleComplete } = useLearnProgress();

  const module = MODULES_BY_SLUG[slug];

  // Computed unconditionally (module may be undefined) so the effect below —
  // a hook, which must run in the same order every render — can sit above
  // the "module not found" early return.
  const lessons = module
    ? (LESSONS_BY_MODULE[module.id] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const completedLessonIds = new Set<string>(
    lessons.filter((l) => progress.lessons[l.id]?.status === "completed").map((l) => l.id)
  );

  // Self-healing module-completion: normally the completion bonus fires the
  // instant the triggering lesson finishes (see lesson/[slug]/page.tsx), but
  // that client-side check only sees lessons already reflected in local
  // state at that moment. Re-checking here means a module that's genuinely
  // fully complete never permanently misses its one-time bonus just because
  // the triggering completion happened before all its siblings had hydrated
  // (e.g. lessons finished across different sessions/devices) — the display
  // of "complete" itself never depended on this (see journey.ts), only the XP.
  useEffect(() => {
    if (!module || progress.loading || !progress.hydrated || progress.isGuest) return;
    if (lessons.length === 0) return;
    if (progress.completedModules.has(module.id)) return;
    const allComplete = lessons.every((l) => completedLessonIds.has(l.id));
    if (!allComplete) return;
    recordModuleComplete(module.id, {
      pathId: module.path_id,
      moduleXpReward: module.xp_reward,
      lessonIds: lessons.map((l) => l.id),
    });
    // completedLessonIds is a new Set every render; keyed off its content via
    // progress.lessons instead so this doesn't re-fire needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, lessons, progress.lessons, progress.loading, progress.hydrated, progress.isGuest, progress.completedModules, recordModuleComplete]);

  if (!module) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-14 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">Module not found</p>
            <Link href="/learn" className="text-sm text-violet-400 hover:text-violet-300 mt-2 inline-block">
              Back to learning hub
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const path = LEARNING_PATHS.find((p) => p.id === module.path_id);
  const firstIncomplete = lessons.find((l) => !completedLessonIds.has(l.id));

  // ── Poker Journey roadmap states ─────────────────────────────────────────
  // Every implemented module is open to every user — see lib/learn/journey.ts.
  // The only thing that can keep a module unreachable is not having any
  // playable content yet, handled by the Coming Soon branch below.
  const isComingSoon = !!module.contentStatus && module.contentStatus !== "complete";
  const stage = getStageForModule(module.id);

  if (isComingSoon) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-10 sm:py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
              <Link href="/learn" className="hover:text-foreground transition-colors">Learn</Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              <Link href="/learn/journey" className="hover:text-foreground transition-colors">Poker Journey</Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              <span className="text-foreground">{module.title}</span>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/80 via-card/60 to-card/40 px-6 py-8 sm:px-8">
              <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-500/8 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/40 border border-border/40">
                    <Clock className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-border/30 bg-secondary/30 text-muted-foreground/60">
                    Coming soon
                  </span>
                </div>

                {stage && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-1.5">
                    {stage.title} · Module {module.order}
                  </p>
                )}
                <h1 className="text-2xl font-bold text-foreground mb-1.5">{module.title}</h1>
                {module.subtitle && (
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">{module.subtitle}</p>
                )}
                <p className="text-sm text-foreground/70 leading-relaxed mb-6">{module.description}</p>

                {module.learningObjectives && module.learningObjectives.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-2.5">
                      What you&apos;ll learn
                    </p>
                    <ul className="space-y-1.5">
                      {module.learningObjectives.map((obj) => (
                        <li key={obj} className="flex items-start gap-2 text-sm text-foreground/80">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400/60 shrink-0 mt-0.5" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {module.plannedLessons && module.plannedLessons.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-2.5">
                      Planned lessons ({module.plannedLessons.length})
                    </p>
                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {module.plannedLessons.map((pl, i) => (
                        <li key={pl.title} className="text-xs text-muted-foreground/70 flex gap-2">
                          <span className="text-muted-foreground/40 tabular-nums">{i + 1}.</span>
                          {pl.title}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/learn/journey"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to the full journey
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link href="/learn" className="hover:text-foreground transition-colors">
              Learn
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            {path && (
              <>
                <Link
                  href={`/learn/path/${path.id}`}
                  className="hover:text-foreground transition-colors"
                >
                  {path.title}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              </>
            )}
            <span className="text-foreground">{module.title}</span>
          </div>

          {/* Module hero */}
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-950/40 via-card/80 to-blue-950/20 px-6 py-7 sm:px-8">
            <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-500/12 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/25 shrink-0">
                <Layers className="h-6 w-6 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400/60 mb-1.5">
                  Module
                </p>
                <h1 className="text-2xl font-bold text-foreground mb-1.5">{module.title}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {module.description}
                </p>

                {/* Concept tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {module.concept_ids.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/18 text-violet-400/70 font-semibold"
                    >
                      {c.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>

                {/* Stats + CTA row */}
                <div className="flex items-center gap-6 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <Zap className="h-3.5 w-3.5" />
                    {module.xp_reward} XP reward
                  </span>
                  {firstIncomplete && (
                    <Link
                      href={`/learn/lesson/${firstIncomplete.slug}`}
                      className="group relative overflow-hidden ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-md shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      {completedLessonIds.size === 0 ? "Start module" : "Continue"}
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lesson list */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-3">Lessons</p>
            {lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                idx={i}
                status={
                  completedLessonIds.has(lesson.id)
                    ? "completed"
                    : progress.lessons[lesson.id]?.status === "in_progress"
                    ? "in_progress"
                    : "not_started"
                }
              />
            ))}

            {lessons.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-card/40 p-8 text-center">
                <p className="text-sm text-muted-foreground">No lessons in this module yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
