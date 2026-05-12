"use client";

import { cn } from "@/lib/utils";

export type GameType =
  | "Hold'em"
  | "PLO"
  | "Short Deck"
  | "Spin & Gold"
  | "All-In or Fold"
  | "Rush & Cash"
  | "Mystery Battle Royale";

export interface AnalysisSetupValue {
  gameType: GameType;
  playerCount: number;
}

export const ANALYSIS_SETUP_DEFAULT: AnalysisSetupValue = {
  gameType: "Hold'em",
  playerCount: 6,
};

const GAME_TYPES: GameType[] = [
  "Hold'em",
  "PLO",
  "Short Deck",
  "Spin & Gold",
  "All-In or Fold",
  "Rush & Cash",
  "Mystery Battle Royale",
];

interface Props {
  value: AnalysisSetupValue;
  onChange: (v: AnalysisSetupValue) => void;
  className?: string;
}

export function AnalysisSetup({ value, onChange, className }: Props) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Game type row */}
      <div className="flex items-start gap-3">
        <span className="text-xs text-muted-foreground shrink-0 min-w-[58px] pt-1.5">
          Game type
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GAME_TYPES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange({ ...value, gameType: g })}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-all leading-none",
                value.gameType === g
                  ? "border-poker-green/60 bg-poker-green/10 text-poker-green"
                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Player count row */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground shrink-0 min-w-[58px]">
          Players
        </span>
        <div className="flex gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...value, playerCount: n })}
              className={cn(
                "h-7 w-7 rounded-md text-xs font-medium border transition-all",
                value.playerCount === n
                  ? "border-poker-green/60 bg-poker-green/10 text-poker-green"
                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
