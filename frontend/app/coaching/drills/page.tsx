"use client";

/**
 * /coaching/drills — Rapid-fire drill trainer.
 *
 * Flow:
 *   1. Load drill set (5 drills by default)
 *   2. Show DrillCard one at a time
 *   3. User answers → instant feedback
 *   4. Track results in state
 *   5. After all drills → show DrillSessionSummary
 *   6. Option to retry or continue with new set
 *
 * URL params:
 *   ?type=cbet_or_check — drill type
 *   ?difficulty=beginner — difficulty filter
 *   ?count=10 — drills per session
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DrillCard } from "@/components/coaching/DrillCard";
import { DrillSessionSummary } from "@/components/coaching/DrillSessionSummary";
import type {
  DrillSpec,
  DrillResult,
  DrillType,
  DrillDifficulty,
} from "@/lib/coaching/types";
import { generateDrills } from "@/lib/coaching/api";

const DRILL_TITLES: Record<string, string> = {
  cbet_or_check: "C-Bet Trainer",
  defend_or_fold: "Defense Trainer",
  bet_size_select: "Sizing Trainer",
  bluff_or_give_up: "Bluff Trainer",
  value_bet_thin: "Value Bet Trainer",
  range_construction: "Range Builder",
};

type Phase = "loading" | "drilling" | "summary" | "error";

function DrillTrainerInner() {
  const searchParams = useSearchParams();
  const drillType = (searchParams.get("type") ?? "cbet_or_check") as DrillType;
  const difficulty = searchParams.get("difficulty") as DrillDifficulty | null;
  const count = parseInt(searchParams.get("count") ?? "5", 10);

  const [phase, setPhase] = useState<Phase>("loading");
  const [drills, setDrills] = useState<DrillSpec[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DrillResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDrills = useCallback(async () => {
    setPhase("loading");
    setCurrentIndex(0);
    setResults([]);
    try {
      const fetched = await generateDrills({
        drill_type: drillType,
        count,
        difficulty: difficulty ?? undefined,
      });
      if (fetched.length === 0) {
        setError("No drills available for this configuration.");
        setPhase("error");
        return;
      }
      setDrills(fetched);
      setPhase("drilling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drills");
      setPhase("error");
    }
  }, [drillType, count, difficulty]);

  useEffect(() => {
    loadDrills();
  }, [loadDrills]);

  const handleAnswer = useCallback(
    (action: string, timeMs: number) => {
      const drill = drills[currentIndex];
      if (!drill) return;

      const option = drill.options.find((o) => o.action === action);
      const result: DrillResult = {
        drill_id: drill.drill_id,
        drill_type: drill.drill_type,
        action_chosen: action,
        is_correct: option?.is_correct ?? false,
        is_acceptable: option?.is_acceptable ?? false,
        score: option?.is_correct ? 100 : option?.is_acceptable ? 60 : 0,
        time_ms: timeMs,
        concept_tags: drill.concept_tags,
      };

      setResults((prev) => [...prev, result]);
    },
    [drills, currentIndex],
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= drills.length) {
      setPhase("summary");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, drills.length]);

  const title = DRILL_TITLES[drillType] ?? "Drill Trainer";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link
          href="/coaching"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {difficulty && (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            difficulty === "beginner" ? "bg-green-500/10 text-green-400" :
            difficulty === "intermediate" ? "bg-blue-500/10 text-blue-400" :
            "bg-purple-500/10 text-purple-400",
          )}>
            {difficulty}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading drills...</p>
            </div>
          </div>
        )}

        {phase === "drilling" && drills[currentIndex] && (
          <DrillCard
            drill={drills[currentIndex]}
            onAnswer={handleAnswer}
            onNext={handleNext}
            showNumber={currentIndex + 1}
            totalDrills={drills.length}
          />
        )}

        {phase === "summary" && (
          <DrillSessionSummary
            results={results}
            onContinue={loadDrills}
            onRetry={loadDrills}
            xpEarned={results.reduce((sum, r) => sum + (r.is_correct ? 50 : r.is_acceptable ? 25 : 10), 0)}
          />
        )}

        {phase === "error" && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={loadDrills}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DrillTrainerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DrillTrainerInner />
    </Suspense>
  );
}
