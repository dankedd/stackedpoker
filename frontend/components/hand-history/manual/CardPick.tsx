"use client";

import { useState } from "react";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS: { key: string; symbol: string; className: string }[] = [
  { key: "s", symbol: "♠", className: "bg-slate-700 text-white" },
  { key: "h", symbol: "♥", className: "bg-red-600 text-white" },
  { key: "d", symbol: "♦", className: "bg-blue-600 text-white" },
  { key: "c", symbol: "♣", className: "bg-green-600 text-white" },
];

/**
 * Picks `count` cards: tap a rank, then a suit (four-colour deck, like the
 * replayer). Cards in `blocked` (already in use) can't be picked.
 */
export function CardPick({
  value,
  onChange,
  count,
  blocked,
  label,
}: {
  value: string[];
  onChange: (cards: string[]) => void;
  count: number;
  blocked: Set<string>;
  label: string;
}) {
  const [rank, setRank] = useState<string | null>(null);
  const full = value.length >= count;
  const taken = (card: string) => blocked.has(card) || value.includes(card);
  const rankFree = (r: string) => SUITS.some((s) => !taken(r + s.key));

  return (
    <div role="group" aria-label={label}>
      <div className="flex items-center gap-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(value.filter((_, k) => k !== i))}
            disabled={!value[i]}
            aria-label={value[i] ? `Remove ${value[i]}` : `Card ${i + 1} not picked`}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          >
            {value[i] ? (
              <FourColorCard card={value[i]} size="sm" />
            ) : (
              <span className="flex h-[70px] w-[50px] items-center justify-center rounded-[7px] border border-dashed border-white/20 text-xs text-white/40">?</span>
            )}
          </button>
        ))}
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="ml-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t.manual.clearCards}
          </button>
        )}
      </div>

      {!full && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]" aria-label={t.manual.rank}>
            {RANKS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={!rankFree(r)}
                aria-pressed={rank === r}
                onClick={() => setRank(r)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-bold transition-colors disabled:opacity-25",
                  rank === r ? "border-[#7C5CFF] bg-[#7C5CFF]/25 text-white" : "border-white/10 bg-white/[0.04] text-white/85 hover:border-white/30",
                )}
              >
                {r === "T" ? "10" : r}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5" aria-label={t.manual.suit}>
            {SUITS.map((s) => {
              const card = rank ? rank + s.key : "";
              const off = !rank || taken(card);
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    onChange([...value, card]);
                    setRank(null);
                  }}
                  aria-label={rank ? `${rank === "T" ? "10" : rank}${s.symbol}` : s.symbol}
                  className={cn("h-11 rounded-lg text-xl font-bold transition-opacity disabled:opacity-25", s.className)}
                >
                  {s.symbol}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
