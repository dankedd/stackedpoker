"use client";

/**
 * SkillHeatmap — radar-style visualization of 10 skill dimensions.
 *
 * Shows each dimension as a colored bar in a radial layout.
 * Weakest areas pulse gently to draw attention.
 * Tapping a dimension reveals drill recommendations.
 */

import { cn } from "@/lib/utils";
import {
  type SkillDimension,
  type SkillSnapshot,
  SKILL_LABELS,
  dimensionRatingColor,
  dimensionRatingBg,
} from "@/lib/coaching/types";

interface SkillHeatmapProps {
  snapshot: SkillSnapshot;
  onDimensionClick?: (dimension: SkillDimension) => void;
  compact?: boolean;
}

const DIMENSIONS: SkillDimension[] = [
  "cbet_accuracy",
  "defense_accuracy",
  "bet_sizing",
  "bluff_selection",
  "value_betting",
  "range_awareness",
  "position_awareness",
  "board_reading",
  "pot_control",
  "spr_awareness",
];

export function SkillHeatmap({
  snapshot,
  onDimensionClick,
  compact = false,
}: SkillHeatmapProps) {
  const isWeak = (dim: string) => snapshot.weakest_dimensions.includes(dim);
  const isStrong = (dim: string) => snapshot.strongest_dimensions.includes(dim);

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-5" : "grid-cols-2")}>
      {DIMENSIONS.map((dim) => {
        const rating = snapshot.dimensions[dim] ?? 50;
        const label = SKILL_LABELS[dim];
        const weak = isWeak(dim);
        const strong = isStrong(dim);

        return (
          <button
            key={dim}
            onClick={() => onDimensionClick?.(dim)}
            className={cn(
              "group relative rounded-xl border p-3 text-left transition-all",
              "hover:border-violet-500/40 hover:bg-violet-500/5",
              weak && "border-orange-500/30 bg-orange-500/5",
              strong && "border-emerald-500/20 bg-emerald-500/5",
              !weak && !strong && "border-border bg-card",
              compact && "p-2",
            )}
          >
            {/* Label */}
            <div className="flex items-center justify-between mb-2">
              <span
                className={cn(
                  "text-xs font-medium",
                  weak ? "text-orange-400" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  dimensionRatingColor(rating),
                )}
              >
                {Math.round(rating)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  dimensionRatingBg(rating),
                  weak && "animate-pulse",
                )}
                style={{ width: `${Math.min(100, Math.max(2, rating))}%` }}
              />
            </div>

            {/* Weak indicator */}
            {weak && (
              <div className="mt-1.5 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-[10px] text-orange-400/80">Needs work</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
