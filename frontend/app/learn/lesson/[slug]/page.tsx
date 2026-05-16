"use client";

import { useState } from "react";
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
import {
  LESSONS_BY_SLUG,
  MODULES_BY_SLUG,
  LESSONS_BY_MODULE,
} from "@/lib/learn/curriculum";
import { completeLesson } from "@/lib/learn/api";
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

  const lesson = LESSONS_BY_SLUG[slug];
  const [completionData, setCompletionData] = useState<{
    score: number;
    xpEarned: number;
    leveledUp: boolean;
    newLevel?: number;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

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

  const module = MODULES_BY_SLUG[lesson.module_id];
  const allLessons = (LESSONS_BY_MODULE[lesson.module_id] ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const lessonIdx = allLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = allLessons[lessonIdx + 1] ?? null;

  const handleComplete = async (score: number, xpEarned: number) => {
    let leveledUp = false;
    let newLevel: number | undefined;

    if (session?.access_token) {
      try {
        const result = await completeLesson(lesson.id, score, session.access_token);
        leveledUp = result.leveled_up;
      } catch {
        // Non-blocking — show completion UI regardless
      }
    }

    setCompletionData({ score, xpEarned, leveledUp, newLevel });
  };

  // ── Completion screen ──────────────────────────────────────────────────────
  if (completionData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Minimal header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
          <Link
            href={module ? `/learn/module/${module.slug}` : "/learn"}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {module?.title ?? "Modules"}
          </Link>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Complete
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 text-center">
            {/* Success icon */}
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Lesson complete!</h1>
              <p className="text-muted-foreground text-sm">{lesson.title}</p>
            </div>

            {/* Score + XP */}
            <div className="flex items-center justify-center gap-8">
              <ScoreRing score={completionData.score} />
              <XPGain
                xp={completionData.xpEarned}
                leveled_up={completionData.leveledUp}
                new_level={completionData.newLevel}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {nextLesson && (
                <Link
                  href={`/learn/lesson/${nextLesson.slug}`}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  Next lesson: {nextLesson.title}
                  <ChevronRight className="h-4 w-4" />
                </Link>
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
      {/* Minimal header */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <Link
          href={module ? `/learn/module/${module.slug}` : "/learn"}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{module?.title ?? "Back"}</span>
          <span className="sm:hidden">Back</span>
        </Link>

        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate max-w-xs">{lesson.title}</p>
          <HeaderDots total={lesson.steps.length} current={currentStep} />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-400 shrink-0">
          <Star className="h-3.5 w-3.5 fill-amber-400/30" />
          {lesson.xp_reward} XP
        </div>
      </div>

      {/* Player */}
      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-2xl">
          {session?.access_token ? (
            <LessonPlayer
              lesson={lesson}
              token={session.access_token}
              onComplete={handleComplete}
            />
          ) : (
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-8 text-center">
              <p className="font-semibold text-foreground mb-2">Sign in to track your progress</p>
              <p className="text-sm text-muted-foreground mb-5">
                You can still preview the lesson, but XP and progress won&apos;t be saved.
              </p>
              <LessonPlayer
                lesson={lesson}
                token=""
                onComplete={(score, xp) => setCompletionData({ score, xpEarned: xp, leveledUp: false })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
