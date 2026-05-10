"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReplayFeedback } from "@/lib/types";

interface CoachCardProps {
  feedback: ReplayFeedback;
  triggerKey: number;
}

const RATING_CONFIG = {
  good: {
    label: "GTO ✓",
    badge: "bg-poker-green/15 text-poker-green border-poker-green/35",
    bar: "bg-poker-green",
    glow: "shadow-[0_0_24px_rgba(0,200,83,0.10)]",
  },
  okay: {
    label: "Okay",
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/35",
    bar: "bg-yellow-400",
    glow: "",
  },
  mistake: {
    label: "Mistake",
    badge: "bg-red-500/15 text-red-400 border-red-500/35",
    bar: "bg-red-400",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.10)]",
  },
};

export function CoachCard({ feedback, triggerKey }: CoachCardProps) {
  const [gtoOpen, setGtoOpen] = useState(false);
  const cfg = RATING_CONFIG[feedback.rating];

  return (
    <div
      key={triggerKey}
      className={cn(
        "w-full rounded-2xl border border-white/8 animate-slide-up-in overflow-hidden",
        cfg.glow
      )}
      style={{ background: "rgba(14,16,20,0.96)", backdropFilter: "blur(16px)" }}
    >
      {/* Color accent bar */}
      <div className={cn("h-[2px] w-full", cfg.bar)} />

      <div className="p-4 space-y-2.5">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mt-0.5",
              cfg.badge
            )}
          >
            {cfg.label}
          </span>
          <p className="text-sm font-semibold text-white/88 leading-snug">{feedback.title}</p>
        </div>

        {/* Explanation */}
        <p className="text-[13px] text-white/55 leading-relaxed">{feedback.explanation}</p>

        {/* GTO note — collapsible */}
        {feedback.gto_note && (
          <>
            <button
              type="button"
              onClick={() => setGtoOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors"
            >
              <ChevronDown
                className={cn("h-3 w-3 transition-transform duration-200", gtoOpen && "rotate-180")}
              />
              GTO insight
            </button>
            {gtoOpen && (
              <p className="text-[12px] text-white/38 leading-relaxed pl-4 border-l border-white/10 animate-slide-up-in">
                {feedback.gto_note}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
