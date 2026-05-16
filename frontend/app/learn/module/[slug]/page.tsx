"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Zap,
  BookOpen,
  Layers,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  MODULES_BY_SLUG,
  LEARNING_PATHS,
  LESSONS_BY_MODULE,
} from "@/lib/learn/curriculum";
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

function LessonCard({
  lesson,
  idx,
  complete,
}: {
  lesson: Lesson;
  idx: number;
  complete: boolean;
}) {
  return (
    <Link href={`/learn/lesson/${lesson.slug}`} className="group block">
      <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 px-5 py-4 hover:border-violet-500/30 hover:bg-violet-500/[0.03] transition-all duration-200">
        {/* Number / check */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
            complete
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : "border-violet-500/30 bg-violet-500/5 text-violet-400"
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
          </div>
          <p className="font-medium text-foreground text-sm truncate">{lesson.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lesson.estimated_min} min
            </span>
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Zap className="h-3 w-3" />
              {lesson.xp_reward} XP
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModulePage() {
  const { slug } = useParams<{ slug: string }>();

  const module = MODULES_BY_SLUG[slug];

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
  const lessons = (LESSONS_BY_MODULE[module.id] ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  // Simulated: no completions yet
  const completedLessonIds = new Set<string>();
  const firstIncomplete = lessons.find((l) => !completedLessonIds.has(l.id));

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

          {/* Module header */}
          <div className="mb-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-600/10 border border-violet-500/20 shrink-0">
                <Layers className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-1">
                  Module
                </p>
                <h1 className="text-2xl font-bold text-foreground">{module.title}</h1>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {module.description}
                </p>
              </div>
            </div>

            {/* Concept tags */}
            <div className="flex flex-wrap gap-1.5 mt-4 ml-16">
              {module.concept_ids.map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400/80 font-medium"
                >
                  {c.replace(/-/g, " ")}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="flex gap-5 mt-4 ml-16 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <Zap className="h-3.5 w-3.5" />
                {module.xp_reward} XP reward
              </span>
            </div>
          </div>

          {/* Start / Continue CTA */}
          {firstIncomplete && (
            <div className="mb-6">
              <Link
                href={`/learn/lesson/${firstIncomplete.slug}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                {completedLessonIds.size === 0 ? "Start module" : "Continue learning"}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Lesson list */}
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Lessons
            </h2>
            {lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                idx={i}
                complete={completedLessonIds.has(lesson.id)}
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
