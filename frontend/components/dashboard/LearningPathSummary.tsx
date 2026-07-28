"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { JOURNEY_STAGES, getCompletedModuleIds, getJourneyOverview, getStageStatus } from "@/lib/learn/journey";

// Compact module-progress summary reusing the same journey primitives as
// /learn (app/learn/page.tsx) and /progress — no separate progress model.
export function LearningPathSummary() {
  const { progress } = useLearnProgress();

  if (progress.loading) {
    return <div className="h-32 rounded-2xl border border-border/50 bg-card/40 animate-pulse" />;
  }

  const completedModuleIds = getCompletedModuleIds(progress.lessons);
  const overview = getJourneyOverview(progress.lessons);
  const currentStage =
    JOURNEY_STAGES.find((s) => getStageStatus(s, completedModuleIds) === "current") ?? JOURNEY_STAGES[0];

  const pct = overview.availableModules
    ? Math.round((overview.availableCompleted / overview.availableModules) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-1">
            Your learning path
          </p>
          <p className="text-sm text-muted-foreground">
            Currently in <span className="text-foreground font-medium">{currentStage.title}</span>
          </p>
        </div>
        <Link
          href="/learn"
          className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-300 transition-colors whitespace-nowrap"
        >
          Full roadmap
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground/60">
        {overview.availableCompleted} of {overview.availableModules} available modules complete ·{" "}
        {overview.totalRoadmapModules} planned in total
      </p>
    </div>
  );
}
