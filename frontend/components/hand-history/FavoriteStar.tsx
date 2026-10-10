"use client";

import { Star } from "lucide-react";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

/** Empty star = not a favourite, filled yellow star = favourite. */
export function FavoriteStar({
  on,
  pending,
  onToggle,
  shortcut,
  className,
}: {
  on: boolean;
  pending?: boolean;
  onToggle: () => void;
  /** Shown in the tooltip, e.g. "S". */
  shortcut?: string;
  className?: string;
}) {
  const label = (on ? t.favorite.remove : t.favorite.add) + (shortcut ? ` (${shortcut})` : "");
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={(e) => {
        // The overview rows are links; the star must not open the hand.
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-400/10 disabled:cursor-wait",
        className,
      )}
    >
      <Star className={cn("h-[18px] w-[18px] transition", on ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-300")} />
    </button>
  );
}
