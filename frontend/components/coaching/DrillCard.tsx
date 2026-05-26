"use client";

/**
 * DrillCard — rapid-fire drill interaction component.
 *
 * Flow:
 *   1. Show prompt + board + options
 *   2. User taps an option
 *   3. Instant color feedback (green/yellow/red)
 *   4. Show explanation + solver distribution
 *   5. Auto-advance after 2s (or tap to continue)
 *
 * Designed for mobile-first: large tap targets, one-handed use,
 * thumb-friendly option positioning at bottom of screen.
 */

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { DrillSpec, DrillOption } from "@/lib/coaching/types";

interface DrillCardProps {
  drill: DrillSpec;
  onAnswer: (action: string, timeMs: number) => void;
  onNext: () => void;
  showNumber?: number;
  totalDrills?: number;
}

type Phase = "question" | "feedback";

const SUIT_SYMBOLS: Record<string, string> = {
  s: "♠", h: "♥", d: "♦", c: "♣",
};

function cardDisplay(card: string): string {
  if (card.length < 2) return card;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return `${rank}${SUIT_SYMBOLS[suit] ?? suit}`;
}

function suitColor(card: string): string {
  const suit = card.slice(-1);
  if (suit === "h" || suit === "d") return "text-red-400";
  return "text-foreground";
}

export function DrillCard({
  drill,
  onAnswer,
  onNext,
  showNumber,
  totalDrills,
}: DrillCardProps) {
  const [phase, setPhase] = useState<Phase>("question");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  // Reset on new drill
  useEffect(() => {
    setPhase("question");
    setSelectedAction(null);
  }, [drill.drill_id]);

  const handleSelect = useCallback(
    (action: string) => {
      if (phase !== "question") return;
      const elapsed = Date.now() - startTime;
      setSelectedAction(action);
      setPhase("feedback");
      onAnswer(action, elapsed);
    },
    [phase, startTime, onAnswer],
  );

  const selectedOption = drill.options.find((o) => o.action === selectedAction);
  const isCorrect = selectedOption?.is_correct ?? false;
  const isAcceptable = selectedOption?.is_acceptable ?? false;

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Progress indicator */}
      {showNumber != null && totalDrills != null && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${((showNumber) / totalDrills) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {showNumber}/{totalDrills}
          </span>
        </div>
      )}

      {/* Board display */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-center gap-2">
          {drill.board.map((card, i) => (
            <div
              key={i}
              className={cn(
                "w-12 h-16 rounded-lg bg-white/95 border border-white/20",
                "flex items-center justify-center",
                "text-lg font-bold shadow-lg",
                suitColor(card),
              )}
            >
              {cardDisplay(card)}
            </div>
          ))}
        </div>
      </div>

      {/* Spot info */}
      <div className="text-center px-4 pb-1">
        <span className="text-xs text-muted-foreground">
          {drill.spot_type} • {drill.positions.replace("_vs_", " vs ")} • {drill.stack_depth}bb
        </span>
      </div>

      {/* Question prompt */}
      <div className="px-4 py-3 flex-shrink-0">
        <p className="text-sm text-foreground/90 text-center leading-relaxed">
          {drill.prompt}
        </p>
      </div>

      {/* Options (bottom-aligned for thumb reach) */}
      <div className="flex-1" />
      <div className="px-4 pb-4 space-y-2">
        {phase === "question" ? (
          // Question phase: show options
          drill.options.map((option) => (
            <button
              key={option.action}
              onClick={() => handleSelect(option.action)}
              className={cn(
                "w-full py-4 px-5 rounded-xl border text-left transition-all",
                "active:scale-[0.98]",
                "border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/5",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {option.label}
              </span>
            </button>
          ))
        ) : (
          // Feedback phase: show results
          <>
            {drill.options.map((option) => {
              const isSelected = option.action === selectedAction;
              const optionCorrect = option.is_correct;
              const optionAcceptable = option.is_acceptable;

              return (
                <div
                  key={option.action}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl border transition-all",
                    optionCorrect && "border-emerald-500/40 bg-emerald-500/10",
                    !optionCorrect && isSelected && "border-red-500/40 bg-red-500/10",
                    !optionCorrect && !isSelected && optionAcceptable && "border-yellow-500/20 bg-yellow-500/5",
                    !optionCorrect && !isSelected && !optionAcceptable && "border-border/30 bg-card/50 opacity-50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-sm font-medium",
                      optionCorrect ? "text-emerald-300" : isSelected ? "text-red-300" : "text-muted-foreground",
                    )}>
                      {isSelected ? (optionCorrect ? "✓ " : "✗ ") : ""}
                      {option.label}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(option.solver_frequency * 100)}%
                    </span>
                  </div>
                  {isSelected && (
                    <p className="text-xs text-foreground/70 mt-1.5">
                      {option.feedback}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Explanation */}
            <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3 mt-2">
              <p className="text-xs text-violet-200/90 leading-relaxed">
                {drill.explanation}
              </p>
            </div>

            {/* Continue button */}
            <button
              onClick={onNext}
              className={cn(
                "w-full py-3.5 rounded-xl font-medium text-sm transition-all",
                "bg-violet-600 hover:bg-violet-500 text-white",
                "active:scale-[0.98]",
              )}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
