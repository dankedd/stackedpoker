"use client";

import type { PlayerLeak } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import Link from "next/link";

const SEVERITY_CONFIG = {
  critical: {
    color: "text-red-400",
    bg:    "bg-red-500/8 border-red-500/20",
    icon:  AlertCircle,
    label: "Critical",
  },
  major: {
    color: "text-amber-400",
    bg:    "bg-amber-500/8 border-amber-500/20",
    icon:  AlertTriangle,
    label: "Major",
  },
  minor: {
    color: "text-blue-400",
    bg:    "bg-blue-500/8 border-blue-500/20",
    icon:  Info,
    label: "Minor",
  },
};

const STREET_LABEL: Record<string, string> = {
  preflop: "Preflop",
  flop:    "Flop",
  turn:    "Turn",
  river:   "River",
  various: "Multiple streets",
};

interface LeakCardProps {
  leak: PlayerLeak;
  rank: number;
}

function LeakCard({ leak, rank }: LeakCardProps) {
  const cfg = SEVERITY_CONFIG[leak.severity] ?? SEVERITY_CONFIG.minor;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "rounded-xl border p-4 flex gap-3 transition-colors",
      cfg.bg,
    )}>
      {/* Rank + icon */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black",
          "bg-background/60 border border-border/40",
          cfg.color,
        )}>
          #{rank}
        </div>
        <Icon className={cn("h-3.5 w-3.5 mt-1", cfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-foreground">{leak.title}</h3>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", cfg.color)}>
            {cfg.label}
          </span>
          {leak.street !== "various" && (
            <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
              {STREET_LABEL[leak.street] ?? leak.street}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
          {leak.description}
        </p>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs mb-2">
          <span>
            <span className="text-muted-foreground">Occurrences: </span>
            <span className={cn("font-semibold", cfg.color)}>{leak.frequency}×</span>
          </span>
          <span>
            <span className="text-muted-foreground">Est. EV loss: </span>
            <span className="font-semibold text-red-400">−{leak.ev_loss_bb.toFixed(1)}bb</span>
          </span>
        </div>

        {/* EV bar */}
        <div className="h-1 rounded-full bg-background/60 overflow-hidden mb-2">
          <div
            className={cn("h-full rounded-full", cfg.color.replace("text-", "bg-").replace("-400", "-500"))}
            style={{ width: `${Math.min(100, (leak.ev_loss_bb / 30) * 100)}%` }}
          />
        </div>

        {/* Coaching note */}
        <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed border-l-2 border-border/50 pl-2">
          {leak.coaching_note}
        </p>

        {/* Hand refs */}
        {leak.example_hand_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {leak.example_hand_ids.slice(0, 3).map((id) => (
              <Link
                key={id}
                href={`/history/${id}`}
                className="inline-flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Review hand
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  leaks: PlayerLeak[];
}

export function LeakList({ leaks }: Props) {
  if (!leaks || leaks.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No significant leaks detected yet. Analyse more hands to unlock this section.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaks.map((leak, i) => (
        <LeakCard key={leak.id} leak={leak} rank={i + 1} />
      ))}
    </div>
  );
}
