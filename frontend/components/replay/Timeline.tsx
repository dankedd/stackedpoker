"use client";

import { cn } from "@/lib/utils";
import type { ReplayAction } from "@/lib/types";

interface TimelineProps {
  actions: ReplayAction[];
  currentStep: number;
  onGoTo: (n: number) => void;
}

function dotColor(action: ReplayAction, i: number, currentStep: number): string {
  if (i > currentStep) return "bg-white/10";
  if (!action.is_hero) return "bg-white/30";
  const r = action.feedback?.rating;
  if (r === "good") return "bg-poker-green";
  if (r === "okay") return "bg-yellow-400";
  if (r === "mistake") return "bg-red-500";
  return "bg-white/40";
}

function streetLabel(street: ReplayAction["street"]): string {
  return street.charAt(0).toUpperCase() + street.slice(1);
}

export function Timeline({ actions, currentStep, onGoTo }: TimelineProps) {
  // Group actions by street for the street label markers
  const streets: ReplayAction["street"][] = ["preflop", "flop", "turn", "river"];
  const firstIndexByStreet = new Map<string, number>();
  actions.forEach((a, i) => {
    if (!firstIndexByStreet.has(a.street)) firstIndexByStreet.set(a.street, i);
  });

  return (
    <div className="space-y-2">
      {/* Street labels */}
      <div className="flex gap-1 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider px-1">
        {streets.map((s) => {
          const idx = firstIndexByStreet.get(s);
          if (idx === undefined) return null;
          const active = actions[currentStep]?.street === s || (currentStep >= idx);
          return (
            <button
              key={s}
              onClick={() => onGoTo(idx)}
              className={cn(
                "transition-colors",
                active ? "text-muted-foreground" : "text-muted-foreground/30"
              )}
            >
              {streetLabel(s)}
            </button>
          );
        }).filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => {
          if (i > 0) acc.push(<span key={`sep-${i}`} className="opacity-30">·</span>);
          acc.push(el);
          return acc;
        }, [])}
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1 flex-wrap">
        {actions.map((action, i) => (
          <button
            key={i}
            title={`${action.player} ${action.action}${action.amount ? ` ${action.amount}` : ""}`}
            onClick={() => onGoTo(i)}
            className={cn(
              "rounded-full transition-all duration-200 cursor-pointer hover:scale-125",
              dotColor(action, i, currentStep),
              i === currentStep ? "w-5 h-2.5 scale-110" : "w-2 h-2",
            )}
          />
        ))}
      </div>

      {/* Step counter */}
      <p className="text-[10px] text-muted-foreground/50 tabular-nums">
        {currentStep >= 0 ? `${currentStep + 1} / ${actions.length}` : `0 / ${actions.length}`}
        {" · "}
        {actions.filter((a) => a.is_hero && a.feedback?.rating === "mistake").length} mistake
        {actions.filter((a) => a.is_hero && a.feedback?.rating === "mistake").length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
