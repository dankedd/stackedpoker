"use client";

import { useEffect, useState } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CoachPreviewCardProps {
  question: string;
  hint: string;
  size?: "compact" | "full";
  className?: string;
}

const TYPING_DELAY_MS = 700;

/**
 * Static, presentational stand-in for the real AI Coach conversation —
 * mirrors `components/learn/CoachChat.tsx`'s exact avatar/bubble styling
 * (gradient avatar, rounded-tl-sm coach bubble, rounded-tr-sm learner
 * bubble, `animate-bounce` typing dots) without importing it: the real
 * component requires a live Supabase access token and calls the backend
 * coach API keyed to a real lesson/step, neither of which exist on a
 * marketing page. Once scrolled into view, shows a brief typing indicator
 * before the (always-static, never-generated) hint text fades in — no API
 * call, no tokens, no Coach usage consumed. Skips straight to the final
 * text under prefers-reduced-motion.
 */
export function CoachPreviewCard({ question, hint, size = "full", className }: CoachPreviewCardProps) {
  const { ref, visible } = useInView(0.3);
  const reducedMotion = useReducedMotion();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      setShowHint(true);
      return;
    }
    const t = setTimeout(() => setShowHint(true), TYPING_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible, reducedMotion]);

  const isCompact = size === "compact";
  const bubbleText = isCompact ? "text-[11px] px-3 py-2" : "text-sm px-4 py-3";
  const avatarSize = isCompact ? "h-6 w-6" : "h-7 w-7";
  const iconSize = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div ref={ref} className={cn("space-y-2.5", className)}>
      {/* Learner message */}
      <div className="flex items-start gap-2.5 flex-row-reverse">
        <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary border border-border/60 mt-0.5", avatarSize)}>
          <User className={cn(iconSize, "text-muted-foreground")} />
        </div>
        <div
          className={cn(
            "rounded-2xl rounded-tr-sm bg-violet-600/15 border border-violet-500/25 text-foreground leading-relaxed",
            bubbleText
          )}
        >
          {question}
        </div>
      </div>

      {/* Coach reply — typing indicator, then the hint fades in */}
      <div className="flex items-start gap-2.5">
        <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500 mt-0.5", avatarSize)}>
          <Bot className={cn(iconSize, "text-white")} />
        </div>
        {showHint ? (
          <div
            className={cn(
              "rounded-2xl rounded-tl-sm bg-card border border-border/50 text-foreground leading-relaxed animate-fade-in",
              bubbleText
            )}
          >
            {hint}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/50 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-violet-400/70 inline-block animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
