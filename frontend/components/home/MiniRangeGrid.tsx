"use client";

import type { HomeChart } from "@/lib/home/charts";
import { cn } from "@/lib/utils";

/** Same action colours as every range grid on the site (lib/learn/actionStyles.ts). */
export const ACTION_COLOR: Record<string, string> = {
  raise: "#8b5cf6",
  allin: "rgba(239,68,68,0.85)",
  limp: "rgba(14,165,233,0.75)",
  call: "#10b981",
  fold: "rgba(148,163,184,0.18)",
};

const RANKS = "AKQJT98765432";
export function handAt(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[col];
  return col > row ? RANKS[row] + RANKS[col] + "s" : RANKS[col] + RANKS[row] + "o";
}

function cellBackground(mix: [string, number][] | null): string {
  if (!mix) return "transparent";
  if (mix.length === 1) return ACTION_COLOR[mix[0][0]] ?? ACTION_COLOR.fold;
  // Stacked left → right in action order, like the trainer's mixed cells.
  let at = 0;
  const stops = mix.map(([k, f]) => {
    const from = at * 100;
    at += f;
    const c = ACTION_COLOR[k] ?? ACTION_COLOR.fold;
    return `${c} ${from}% ${at * 100}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * Compact 13×13 range grid for the homepage. `wave` makes the cells fill in
 * as a diagonal wave (needs an `.hp-in` ancestor, see InView).
 */
export function MiniRangeGrid({
  chart,
  wave = false,
  highlight,
  onHover,
  showLabels = false,
  className,
}: {
  chart: HomeChart;
  wave?: boolean;
  highlight?: string | null;
  onHover?: (hand: string | null) => void;
  showLabels?: boolean;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${chart.title} range chart`}
      className={cn("grid gap-[2px]", className)}
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      onMouseLeave={() => onHover?.(null)}
    >
      {chart.cells.map((mix, i) => {
        const r = Math.floor(i / 13);
        const c = i % 13;
        const hand = handAt(r, c);
        const on = highlight === hand;
        return (
          <span
            key={hand}
            onMouseEnter={onHover ? () => onHover(hand) : undefined}
            onClick={onHover ? () => onHover(hand) : undefined}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-[2px] text-[7px] font-semibold leading-none text-white/85 sm:text-[9px]",
              wave && "hp-pop",
              !mix && "border border-dashed border-white/10",
              on && "z-10 ring-2 ring-white",
              onHover && "cursor-pointer",
            )}
            style={{ background: cellBackground(mix), ...(wave ? { ["--hp-i" as string]: (r + c) * 0.5 } : null) }}
          >
            {showLabels ? hand : null}
          </span>
        );
      })}
    </div>
  );
}

export function Legend({ chart, className }: { chart: HomeChart; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70", className)}>
      {chart.legend.map((l) => (
        <li key={l.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ACTION_COLOR[l.key] ?? ACTION_COLOR.fold }} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
