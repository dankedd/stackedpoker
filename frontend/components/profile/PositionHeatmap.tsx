"use client";

import type { PositionStat } from "@/lib/types";
import { cn } from "@/lib/utils";

const POSITION_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

function scoreBg(score: number): string {
  if (score === 0) return "bg-card/40 border-border/40";
  if (score >= 80) return "bg-green-500/12 border-green-500/25";
  if (score >= 70) return "bg-blue-500/12 border-blue-500/20";
  if (score >= 60) return "bg-violet-500/10 border-violet-500/20";
  if (score >= 50) return "bg-amber-500/8 border-amber-500/20";
  return "bg-red-500/8 border-red-500/20";
}

function scoreText(score: number): string {
  if (score === 0) return "text-muted-foreground/40";
  if (score >= 80) return "text-green-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 60) return "text-violet-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

interface Props {
  positionStats: PositionStat[];
}

export function PositionHeatmap({ positionStats }: Props) {
  // Build a lookup map
  const statMap: Record<string, PositionStat> = {};
  for (const s of positionStats) {
    statMap[s.position.toUpperCase()] = s;
  }

  // Filter to positions that have data
  const positions = POSITION_ORDER.filter(
    (p) => statMap[p] && statMap[p].hands > 0,
  );

  // Also include any unknown positions
  const unknownPositions = positionStats.filter(
    (s) => !POSITION_ORDER.includes(s.position.toUpperCase()) && s.hands > 0,
  );

  if (positions.length === 0 && unknownPositions.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Positional data available after 5+ hand analyses.
        </p>
      </div>
    );
  }

  const allPositions = [
    ...positions.map((p) => statMap[p]),
    ...unknownPositions,
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {allPositions.map((stat) => (
          <div
            key={stat.position}
            className={cn(
              "rounded-xl border p-3 text-center transition-colors",
              scoreBg(stat.avg_score),
            )}
          >
            <p className="text-xs font-bold text-muted-foreground mb-1">{stat.position}</p>
            <p className={cn("text-2xl font-black tabular-nums", scoreText(stat.avg_score))}>
              {stat.avg_score.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{stat.hands} hands</p>
            <p className="text-[10px] text-red-400/70">
              {stat.mistakes_per_hand.toFixed(1)} err/h
            </p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="font-medium">Score:</span>
        {[
          { label: "80+",  cls: "bg-green-500/30"  },
          { label: "70–79", cls: "bg-blue-500/30"  },
          { label: "60–69", cls: "bg-violet-500/25" },
          { label: "50–59", cls: "bg-amber-500/25"  },
          { label: "<50",   cls: "bg-red-500/25"    },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", cls)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
