"use client";

import type { PlayerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";

const STYLE_COLORS: Record<string, string> = {
  TAG:              "text-blue-400 bg-blue-500/10 border-blue-500/20",
  LAG:              "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Nit:              "text-slate-400 bg-slate-500/10 border-slate-500/20",
  "Calling Station":"text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Aggressive Fish":"text-red-400 bg-red-500/10 border-red-500/20",
  "Balanced Reg":   "text-green-400 bg-green-500/10 border-green-500/20",
  Recreational:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Unknown:          "text-muted-foreground bg-card border-border/60",
};

const SKILL_LABEL: Record<string, string> = {
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

const SKILL_COLOR: Record<string, string> = {
  beginner:     "text-amber-400",
  intermediate: "text-blue-400",
  advanced:     "text-green-400",
};

const QUALITY_COLOR: Record<string, string> = {
  insufficient: "text-muted-foreground",
  low:          "text-amber-400",
  moderate:     "text-blue-400",
  high:         "text-green-400",
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400" :
    score >= 65 ? "text-blue-400"  :
    score >= 50 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="flex flex-col items-center">
      <span className={cn("text-5xl font-black tabular-nums", color)}>
        {score > 0 ? score.toFixed(0) : "—"}
      </span>
      <span className="text-xs text-muted-foreground mt-1">/ 100</span>
    </div>
  );
}

interface Props {
  profile: PlayerProfile;
}

export function OverviewCard({ profile }: Props) {
  const styleColor = STYLE_COLORS[profile.style] ?? STYLE_COLORS.Unknown;
  const trend = profile.stats.score_trend;
  let trendDir: "up" | "down" | "flat" = "flat";
  if (trend.length >= 4) {
    const recent = trend.slice(-3).reduce((s, p) => s + p.score, 0) / 3;
    const older  = trend.slice(0, 3).reduce((s, p) => s + p.score, 0) / 3;
    if (recent - older > 5)  trendDir = "up";
    if (older - recent > 5)  trendDir = "down";
  }

  const TrendIcon =
    trendDir === "up"   ? TrendingUp   :
    trendDir === "down" ? TrendingDown :
    Minus;

  const trendColor =
    trendDir === "up"   ? "text-green-400" :
    trendDir === "down" ? "text-red-400"   :
    "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

        {/* Score ring */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-violet-500/25 bg-violet-500/5">
            <ScoreBadge score={Math.round(profile.overall_score)} />
            <div className="absolute -bottom-2 flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5">
              <TrendIcon className={cn("h-3 w-3", trendColor)} />
              <span className={cn("text-[10px] font-semibold", trendColor)}>
                {trendDir === "up" ? "Improving" : trendDir === "down" ? "Declining" : "Stable"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Avg Score</p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-semibold",
              styleColor,
            )}>
              <Shield className="h-3.5 w-3.5" />
              {profile.style}
            </span>
            <span className={cn("text-sm font-medium", SKILL_COLOR[profile.skill_level] ?? "text-muted-foreground")}>
              {SKILL_LABEL[profile.skill_level] ?? profile.skill_level}
            </span>
            <span className={cn("text-xs", QUALITY_COLOR[profile.data_quality])}>
              ({profile.sample_size} hands · {profile.data_quality} data)
            </span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            {profile.style_description}
          </p>

          {/* Quick stats row */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">VPIP </span>
              <span className="font-semibold text-foreground">{profile.stats.vpip_pct.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">PFR </span>
              <span className="font-semibold text-foreground">{profile.stats.pfr_pct.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">3bet </span>
              <span className="font-semibold text-foreground">{profile.stats.three_bet_pct.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Mistakes </span>
              <span className="font-semibold text-red-400">
                {profile.stats.avg_mistakes_per_hand.toFixed(1)}/hand
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Est. EV Loss </span>
              <span className="font-semibold text-red-400">−{profile.stats.total_ev_loss_bb.toFixed(0)}bb</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
