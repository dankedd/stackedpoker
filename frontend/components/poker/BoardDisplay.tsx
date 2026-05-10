import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import type { BoardCards, BoardTexture } from "@/lib/types";

interface BoardDisplayProps {
  board: BoardCards;
  texture?: BoardTexture;
  className?: string;
}

const WETNESS_BADGE: Record<string, { label: string; color: string }> = {
  dry: { label: "Dry", color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  semi_wet: { label: "Semi-Wet", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  wet: { label: "Wet", color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
};

const RANGE_ADV_BADGE: Record<string, { label: string; color: string }> = {
  pfr: { label: "PFR Advantage", color: "text-poker-green bg-poker-green/10 border-poker-green/30" },
  caller: { label: "Caller Advantage", color: "text-red-400 bg-red-400/10 border-red-400/30" },
  neutral: { label: "Neutral", color: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
};

export function BoardDisplay({ board, texture, className }: BoardDisplayProps) {
  const allCards = [...board.flop, ...board.turn, ...board.river];
  const hasBoard = allCards.length > 0;

  if (!hasBoard) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Cards */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Flop */}
        {board.flop.length > 0 && (
          <div className="flex items-end gap-1">
            {board.flop.map((card, i) => (
              <PlayingCard key={`flop-${i}`} card={card} size="lg" animationDelay={i * 80} />
            ))}
          </div>
        )}

        {/* Turn divider */}
        {board.turn.length > 0 && (
          <>
            <div className="h-px w-4 bg-border self-center" />
            <PlayingCard card={board.turn[0]} size="lg" animationDelay={300} />
          </>
        )}

        {/* River divider */}
        {board.river.length > 0 && (
          <>
            <div className="h-px w-4 bg-border self-center" />
            <PlayingCard card={board.river[0]} size="lg" animationDelay={400} />
          </>
        )}
      </div>

      {/* Texture badges */}
      {texture && (
        <div className="flex flex-wrap gap-2">
          {texture.bucket && (
            <span className="rounded-full border border-poker-green/30 bg-poker-green/10 px-3 py-1 text-xs font-medium text-poker-green">
              {texture.bucket.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          )}

          {texture.wetness && WETNESS_BADGE[texture.wetness] && (
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                WETNESS_BADGE[texture.wetness].color
              )}
            >
              {WETNESS_BADGE[texture.wetness].label}
            </span>
          )}

          {texture.suitedness && (
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {texture.suitedness.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          )}

          {texture.range_advantage && RANGE_ADV_BADGE[texture.range_advantage] && (
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                RANGE_ADV_BADGE[texture.range_advantage].color
              )}
            >
              {RANGE_ADV_BADGE[texture.range_advantage].label}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {texture?.description && (
        <p className="text-sm text-muted-foreground">{texture.description}</p>
      )}
    </div>
  );
}
