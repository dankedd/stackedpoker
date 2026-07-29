"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface MarketingDecisionOption {
  id: string;
  label: string;
  correct?: boolean;
}

interface MarketingDecisionSpotProps {
  /** Ordered Fold → Check → Call → Raise → All-in subset, matching the
   *  real DecisionSpot's action ordering convention. Only the actions that
   *  are actually available in the scenario should be passed in. */
  options: MarketingDecisionOption[];
  question: string;
  correctExplanation: string;
  incorrectExplanation: string;
  onSelect?: (option: MarketingDecisionOption) => void;
  size?: "compact" | "full";
  className?: string;
}

/**
 * Marketing-only decision-buttons + reveal, visually matching the real
 * `components/learn/steps/DecisionSpot.tsx` button treatment. Deliberately
 * does NOT import the real DecisionSpot: that component takes a full
 * `LessonStep` from the lesson-content schema, and coupling the homepage to
 * that schema for a static demo would add coupling for no benefit. This is
 * local component state only — no XP, no persistence, no network calls.
 */
export function MarketingDecisionSpot({
  options,
  question,
  correctExplanation,
  incorrectExplanation,
  onSelect,
  size = "full",
  className,
}: MarketingDecisionSpotProps) {
  const [selected, setSelected] = useState<MarketingDecisionOption | null>(null);
  const isCompact = size === "compact";

  function handleSelect(option: MarketingDecisionOption) {
    if (selected) return;
    setSelected(option);
    onSelect?.(option);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p
        className={cn(
          "text-center font-semibold text-foreground",
          isCompact ? "text-xs" : "text-base"
        )}
      >
        {question}
      </p>

      <div
        className={cn(
          "grid gap-2",
          isCompact ? "grid-cols-3" : options.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        {options.map((opt) => {
          const isSelected = selected?.id === opt.id;
          const hasSelected = selected !== null;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={hasSelected && !isSelected}
              onClick={() => handleSelect(opt)}
              className={cn(
                "relative rounded-xl border font-semibold transition-all duration-150 active:scale-[0.97]",
                isCompact ? "px-2 py-2 text-[11px]" : "px-4 py-3.5 text-sm",
                isSelected
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20"
                  : hasSelected
                  ? "border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50"
                  : "border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className={cn(
            "rounded-xl border px-3.5 py-3 leading-relaxed animate-fade-in",
            isCompact ? "text-[11px]" : "text-sm",
            selected.correct
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/25 bg-amber-500/10 text-amber-300"
          )}
        >
          {selected.correct ? correctExplanation : incorrectExplanation}
        </div>
      )}
    </div>
  );
}
