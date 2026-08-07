"use client";

import Link from "next/link";
import { Brain, Sparkles, CheckCircle, ChevronRight } from "lucide-react";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
// Metadata only — never '@/lib/learn/curriculum'. See scripts/generateCurriculumPublic.ts.
import { LESSONS_BY_ID } from "@/lib/learn/curriculumPublic.generated";
import { getNextLessonTarget, getNextPlannedModule } from "@/lib/learn/journey";

// Mirrors the "Continue learning" card on /learn (app/learn/page.tsx) so the
// dashboard's primary CTA resolves to the same lesson via the same lookup —
// continueTarget.lesson_id is a lesson id, must go through LESSONS_BY_ID.
export function ContinueLearningCard() {
  const { progress } = useLearnProgress();

  if (progress.loading) {
    return <div className="h-24 rounded-2xl border border-border/50 bg-card/40 animate-pulse" />;
  }

  const continueLesson = progress.continueTarget
    ? LESSONS_BY_ID[progress.continueTarget.lesson_id]
    : undefined;
  const nextLessonTarget = getNextLessonTarget(progress.lessons);
  const nextPlannedModule = getNextPlannedModule();

  if (continueLesson && progress.continueTarget) {
    return (
      <Link href={`/learn/lesson/${continueLesson.slug}`} className="group block">
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-card/80 to-blue-900/20 p-6 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/20 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30">
                <Brain className="h-5.5 w-5.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/60 mb-0.5">
                  Continue learning
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
    );
  }

  if (nextLessonTarget) {
    return (
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
    );
  }

  return (
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
  );
}
