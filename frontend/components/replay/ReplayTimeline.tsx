"use client";

import { cn } from "@/lib/utils";
import type { ReplayAction } from "@/lib/types";

interface ReplayTimelineProps {
  actions: ReplayAction[];
  currentStep: number;
  onGoTo: (n: number) => void;
}

const STREET_ORDER: ReplayAction["street"][] = ["preflop", "flop", "turn", "river"];

const STREET_ACCENT: Record<string, string> = {
  preflop: "text-blue-400",
  flop:    "text-emerald-400",
  turn:    "text-orange-400",
  river:   "text-red-400",
};

const STREET_LINE: Record<string, string> = {
  preflop: "bg-blue-500/30",
  flop:    "bg-emerald-500/30",
  turn:    "bg-orange-500/30",
  river:   "bg-red-500/30",
};

function nodeDot(action: ReplayAction, i: number, current: number) {
  const past = i <= current;
  if (!action.is_hero || !past) return past ? "bg-white/25" : "bg-white/8";
  const r = action.feedback?.rating;
  if (r === "good")    return "bg-poker-green shadow-[0_0_6px_rgba(0,200,83,0.6)]";
  if (r === "okay")    return "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]";
  if (r === "mistake") return "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]";
  return "bg-white/30";
}

type Group = { street: ReplayAction["street"]; actions: { action: ReplayAction; index: number }[] };

function groupByStreet(actions: ReplayAction[]): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  actions.forEach((a, i) => {
    if (!current || current.street !== a.street) {
      current = { street: a.street, actions: [] };
      groups.push(current);
    }
    current.actions.push({ action: a, index: i });
  });
  return groups;
}

export function ReplayTimeline({ actions, currentStep, onGoTo }: ReplayTimelineProps) {
  const groups = groupByStreet(actions);

  return (
    <div className="space-y-2">
      {/* Street groups */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1">
        {groups.map((group) => (
          <div key={group.street} className="flex items-center gap-1.5 flex-shrink-0">
            {/* Street label */}
            <span className={cn("text-[9px] uppercase tracking-widest font-bold flex-shrink-0", STREET_ACCENT[group.street])}>
              {group.street.slice(0, 2)}
            </span>
            {/* Connector line */}
            <div className={cn("h-px w-3 flex-shrink-0", STREET_LINE[group.street])} />
            {/* Action nodes */}
            <div className="flex items-center gap-1">
              {group.actions.map(({ action, index }) => {
                const isCurrent = index === currentStep;
                return (
                  <button
                    key={index}
                    title={`${action.player}: ${action.action}${action.amount ? ` ${action.amount}` : ""}`}
                    onClick={() => onGoTo(index)}
                    className={cn(
                      "rounded-full transition-all duration-200 hover:scale-125 cursor-pointer flex-shrink-0",
                      nodeDot(action, index, currentStep),
                      isCurrent ? "w-4 h-3 scale-110" : "w-2.5 h-2.5",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-px w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-poker-green/40 rounded-full transition-all duration-500"
          style={{
            width: `${((currentStep + 1) / Math.max(actions.length, 1)) * 100}%`,
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-white/20 uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-poker-green inline-block" />good
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />okay
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />mistake
        </span>
        <span className="ml-auto tabular-nums">
          {currentStep >= 0 ? currentStep + 1 : 0} / {actions.length}
        </span>
      </div>
    </div>
  );
}
