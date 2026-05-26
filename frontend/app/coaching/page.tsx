"use client";

/**
 * /coaching — Main coaching dashboard.
 *
 * Personalized hub showing:
 *   1. Skill heatmap (10 dimensions)
 *   2. Active leaks with drill recommendations
 *   3. Training priority list
 *   4. Quick-start drill buttons
 *   5. Recent progress and streak
 *
 * Mobile-first: single column, thumb-friendly, fast comprehension.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SkillHeatmap } from "@/components/coaching/SkillHeatmap";
import { StreakBanner } from "@/components/coaching/StreakBanner";
import {
  type SkillSnapshot,
  type LeakProfile,
  type TrainingPlanItem,
  type SkillDimension,
  SKILL_LABELS,
  dimensionRatingColor,
} from "@/lib/coaching/types";
import {
  getSkillProfile,
  getLeaks,
  getTrainingPlan,
} from "@/lib/coaching/api";

// Placeholder user ID — in production, from auth context
const USER_ID = "demo-user";

// Drill type display names
const DRILL_LABELS: Record<string, string> = {
  cbet_or_check: "C-Bet Trainer",
  defend_or_fold: "Defense Trainer",
  bet_size_select: "Sizing Trainer",
  bluff_or_give_up: "Bluff Trainer",
  value_bet_thin: "Value Bet Trainer",
  range_construction: "Range Builder",
};

export default function CoachingDashboard() {
  const [skill, setSkill] = useState<SkillSnapshot | null>(null);
  const [leaks, setLeaks] = useState<LeakProfile[]>([]);
  const [plan, setPlan] = useState<TrainingPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, l, p] = await Promise.all([
          getSkillProfile(USER_ID).catch(() => null),
          getLeaks(USER_ID).catch(() => []),
          getTrainingPlan(USER_ID).catch(() => []),
        ]);
        if (s) setSkill(s);
        setLeaks(l);
        setPlan(p);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback skill snapshot for new users
  const snap: SkillSnapshot = skill ?? {
    user_id: USER_ID,
    timestamp: new Date().toISOString(),
    dimensions: Object.fromEntries(
      Object.keys(SKILL_LABELS).map((k) => [k, 50]),
    ),
    overall_rating: 50,
    level: 1,
    total_xp: 0,
    hands_analyzed: 0,
    drills_completed: 0,
    weakest_dimensions: [],
    strongest_dimensions: [],
    rating_trend: "stable",
    recent_accuracy_pct: 0,
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaching</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your personalized training dashboard
          </p>
        </div>

        {/* Overall rating + streak */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card flex-1">
            <div className="text-3xl font-black text-violet-400 tabular-nums">
              {Math.round(snap.overall_rating)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Overall Rating</div>
              <div className={cn(
                "text-xs font-medium",
                snap.rating_trend === "improving" ? "text-emerald-400" :
                snap.rating_trend === "declining" ? "text-red-400" :
                "text-muted-foreground",
              )}>
                {snap.rating_trend === "improving" ? "↑ Improving" :
                 snap.rating_trend === "declining" ? "↓ Declining" :
                 "→ Stable"}
              </div>
            </div>
          </div>
          <StreakBanner streakDays={0} className="flex-1" />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/coaching/drills?type=cbet_or_check"
            className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 hover:bg-violet-500/10 transition-all active:scale-[0.98]"
          >
            <div className="text-lg mb-1">⚔️</div>
            <div className="text-sm font-medium text-foreground">C-Bet Trainer</div>
            <div className="text-xs text-muted-foreground mt-0.5">Quick 5-min session</div>
          </Link>
          <Link
            href="/coaching/drills?type=defend_or_fold"
            className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 hover:bg-blue-500/10 transition-all active:scale-[0.98]"
          >
            <div className="text-lg mb-1">🛡️</div>
            <div className="text-sm font-medium text-foreground">Defense Trainer</div>
            <div className="text-xs text-muted-foreground mt-0.5">Defend your blinds</div>
          </Link>
        </div>

        {/* Skill heatmap */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            Skill Profile
            <span className="text-xs font-normal text-muted-foreground">
              (tap to see drills)
            </span>
          </h2>
          <SkillHeatmap
            snapshot={snap}
            onDimensionClick={(dim) => {
              const drill = plan.find((p) => p.dimension === dim)?.recommended_drill;
              if (drill) {
                window.location.href = `/coaching/drills?type=${drill}`;
              }
            }}
          />
        </div>

        {/* Active leaks */}
        {leaks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active Leaks
            </h2>
            <div className="space-y-2">
              {leaks.slice(0, 3).map((leak) => (
                <div
                  key={leak.concept_id}
                  className={cn(
                    "rounded-xl border p-3 flex items-center gap-3",
                    leak.severity === "severe"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-orange-500/20 bg-orange-500/5",
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    leak.severity === "severe" ? "bg-red-400" : "bg-orange-400",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {SKILL_LABELS[leak.dimension] ?? leak.concept_id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {leak.description}
                    </div>
                  </div>
                  {leak.recommended_drill_type && (
                    <Link
                      href={`/coaching/drills?type=${leak.recommended_drill_type}`}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium flex-shrink-0"
                    >
                      Train →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Training priority */}
        {plan.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Training Priority
            </h2>
            <div className="space-y-1.5">
              {plan.slice(0, 5).map((item, i) => (
                <div
                  key={item.dimension}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <div className="flex-1">
                    <span className="text-sm text-foreground">
                      {SKILL_LABELS[item.dimension as SkillDimension] ?? item.dimension}
                    </span>
                  </div>
                  <span className={cn(
                    "text-xs font-bold tabular-nums",
                    dimensionRatingColor(item.rating),
                  )}>
                    {Math.round(item.rating)}
                  </span>
                  {item.recommended_drill && (
                    <Link
                      href={`/coaching/drills?type=${item.recommended_drill}`}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      Drill
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats footer */}
        <div className="flex gap-4 py-4 border-t border-border">
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-foreground tabular-nums">{snap.hands_analyzed}</div>
            <div className="text-xs text-muted-foreground">Hands Reviewed</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-foreground tabular-nums">{snap.drills_completed}</div>
            <div className="text-xs text-muted-foreground">Drills Done</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-violet-400 tabular-nums">Lv.{snap.level}</div>
            <div className="text-xs text-muted-foreground">{snap.total_xp} XP</div>
          </div>
        </div>
      </div>
    </div>
  );
}
