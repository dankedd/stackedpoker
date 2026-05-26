"use client";

/**
 * ActionGradeCard — shows a single graded action with coaching.
 *
 * Used in hand review to display per-action solver feedback.
 * Expandable: collapsed shows grade + one-liner, expanded shows
 * full coaching with key factors and transferable concept.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  type ActionScore,
  type ActionQuality,
  qualityColor,
  qualityBg,
  severityGlow,
} from "@/lib/coaching/types";

interface ActionGradeCardProps {
  score: ActionScore;
  index: number;
}

const QUALITY_EMOJI: Record<ActionQuality, string> = {
  optimal: "✓",
  good: "✓",
  acceptable: "~",
  inaccuracy: "△",
  mistake: "✗",
  blunder: "✗✗",
};

const STREET_LABELS: Record<string, string> = {
  preflop: "Pre",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

export function ActionGradeCard({ score, index }: ActionGradeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const severity = score.mistake?.severity ?? "none";
  const advice = score.advice;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "w-full text-left rounded-xl border transition-all duration-200",
        "hover:border-violet-500/30",
        qualityBg(score.quality),
        severityGlow(severity),
      )}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        {/* Street badge */}
        <div className="flex-shrink-0 w-10 text-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {STREET_LABELS[score.street] ?? score.street}
          </span>
        </div>

        {/* Quality indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
            "text-sm font-bold",
            qualityColor(score.quality),
            qualityBg(score.quality),
          )}
        >
          {QUALITY_EMOJI[score.quality]}
        </div>

        {/* Action + headline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground capitalize">
              {score.action}
            </span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                qualityColor(score.quality),
              )}
            >
              {score.score}
            </span>
          </div>
          {advice && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {advice.headline}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded coaching */}
      {expanded && advice && (
        <div className="px-3 pb-4 pt-1 border-t border-white/5 space-y-3">
          {/* Verdict */}
          <p className="text-sm text-foreground/90">{advice.verdict}</p>

          {/* What happened + what to do */}
          {advice.why_its_wrong && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5">
              <p className="text-xs text-red-300">{advice.why_its_wrong}</p>
            </div>
          )}
          {advice.what_to_do_instead && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5">
              <p className="text-xs text-emerald-300">{advice.what_to_do_instead}</p>
            </div>
          )}
          {advice.why_its_right && !advice.why_its_wrong && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5">
              <p className="text-xs text-emerald-300">{advice.why_its_right}</p>
            </div>
          )}

          {/* Key factors */}
          {advice.key_factors.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Key Factors
              </span>
              {advice.key_factors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-violet-400 text-xs mt-0.5">•</span>
                  <span className="text-xs text-foreground/80">{factor}</span>
                </div>
              ))}
            </div>
          )}

          {/* Transferable concept */}
          {advice.transferable_concept && (
            <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-2.5">
              <span className="text-[10px] uppercase tracking-wider text-violet-400/70 block mb-1">
                Remember
              </span>
              <p className="text-xs text-violet-200/90">{advice.transferable_concept}</p>
            </div>
          )}

          {/* Solver distribution */}
          {score.mistake?.action_distribution && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Solver Strategy
              </span>
              <div className="flex gap-1.5">
                {Object.entries(score.mistake.action_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, freq]) => (
                    <div
                      key={action}
                      className="flex-1 rounded-md bg-white/5 p-1.5 text-center"
                    >
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {action}
                      </div>
                      <div className="text-xs font-bold text-foreground tabular-nums">
                        {Math.round(freq * 100)}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
