"use client";

import type { CoachingAdvice, PlayerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const CATEGORY_COLOR: Record<string, string> = {
  cbet_oversizing:       "text-blue-400",
  missed_value:          "text-green-400",
  overfold:              "text-amber-400",
  overcall:              "text-red-400",
  river_bluff:           "text-violet-400",
  preflop_3bet:          "text-cyan-400",
  bb_defense:            "text-indigo-400",
  check_raise_response:  "text-orange-400",
  turn_barrel:           "text-teal-400",
  stack_depth_play:      "text-pink-400",
  icm_pressure:          "text-purple-400",
};

function CoachCard({ advice, defaultOpen }: { advice: CoachingAdvice; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const accentColor = CATEGORY_COLOR[advice.category] ?? "text-violet-400";

  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-card/50 overflow-hidden transition-all",
      open && "border-violet-500/20",
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-card/80 transition-colors"
      >
        <span className={cn(
          "shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black bg-background border border-border/60",
          accentColor,
        )}>
          {advice.priority}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{advice.headline}</p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{advice.detail}</p>
          {advice.example && (
            <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Example
              </p>
              <p className="text-xs text-foreground/80 font-mono leading-relaxed">{advice.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  profile: PlayerProfile;
}

export function CoachSummary({ profile }: Props) {
  return (
    <div className="space-y-4">
      {/* AI Summary paragraph */}
      {profile.ai_summary && (
        <div className="flex gap-3 rounded-xl border border-violet-500/15 bg-violet-500/5 p-4">
          <Brain className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">{profile.ai_summary}</p>
        </div>
      )}

      {/* Coaching cards */}
      {profile.coaching_advice.length > 0 ? (
        <div className="space-y-2">
          {profile.coaching_advice.map((advice, i) => (
            <CoachCard key={advice.priority} advice={advice} defaultOpen={i === 0} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Coaching advice will appear here once more hands are analysed.
          </p>
        </div>
      )}

      {/* Strengths & weaknesses */}
      {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {profile.strengths.length > 0 && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Strengths</p>
              <ul className="space-y-1.5">
                {profile.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile.weaknesses.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Weaknesses</p>
              <ul className="space-y-1.5">
                {profile.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tilt indicators */}
      {profile.tilt_indicators.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Mental Game Indicators</p>
          <ul className="space-y-1.5">
            {profile.tilt_indicators.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
