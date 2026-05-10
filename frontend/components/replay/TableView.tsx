"use client";

import { cn } from "@/lib/utils";
import { PlayingCard } from "@/components/poker/PlayingCard";
import type { HandSummaryData, ReplayAction } from "@/lib/types";
import type { VisibleBoard } from "@/hooks/useReplay";

interface TableViewProps {
  handSummary: HandSummaryData;
  visibleBoard: VisibleBoard;
  currentAction: ReplayAction | null;
  currentPot: number;
  step: number;
}

function CardBack() {
  return (
    <div className="h-10 w-7 rounded border-2 border-blue-600/60 bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center shadow-md">
      <div className="h-6 w-4 rounded border border-blue-500/30 bg-blue-800/30" />
    </div>
  );
}

function ratingRing(rating?: string) {
  if (rating === "good") return "ring-2 ring-poker-green/70 shadow-[0_0_12px_rgba(0,200,83,0.4)]";
  if (rating === "mistake") return "ring-2 ring-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.4)]";
  if (rating === "okay") return "ring-2 ring-yellow-400/70 shadow-[0_0_12px_rgba(250,204,21,0.3)]";
  return "";
}

function actionLabel(action: ReplayAction) {
  const verb = action.action.charAt(0).toUpperCase() + action.action.slice(1);
  return action.amount ? `${verb} ${action.amount}` : verb;
}

export function TableView({ handSummary, visibleBoard, currentAction, currentPot, step }: TableViewProps) {
  const isHeroActing = currentAction?.is_hero === true;
  const isVillainActing = currentAction !== null && !currentAction.is_hero;
  const heroCards = handSummary.hero_cards;
  const villainCards = handSummary.villain_cards;
  const allBoard = [...visibleBoard.flop, ...visibleBoard.turn, ...visibleBoard.river];
  const heroRating = isHeroActing ? currentAction?.feedback?.rating : undefined;

  return (
    <div className="relative w-full select-none" style={{ paddingBottom: "52%" }}>
      {/* Felt */}
      <div className="absolute inset-x-6 inset-y-3 rounded-[50%] bg-gradient-to-b from-[#1a5c35] via-[#154d2c] to-[#0f3d22] border-[10px] border-amber-900/50 shadow-2xl overflow-hidden">
        {/* Inner ring */}
        <div className="absolute inset-[8%] rounded-[50%] border border-white/5" />
        {/* Felt texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)"
        }} />
      </div>

      {/* Villain seat — top center */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        {/* Action bubble */}
        {isVillainActing && (
          <div className="px-2 py-0.5 rounded-full bg-yellow-400 text-black text-[10px] font-bold animate-fade-in">
            {actionLabel(currentAction!)}
          </div>
        )}
        {/* Cards */}
        <div className="flex gap-1">
          {villainCards
            ? villainCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
            : [0, 1].map((i) => <CardBack key={i} />)}
        </div>
        {/* Label */}
        <div className={cn(
          "px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
          isVillainActing ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30" : "bg-black/40 text-white/50"
        )}>
          {handSummary.villain_position ?? "Villain"}
        </div>
      </div>

      {/* Community cards — center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
        <div className="flex gap-1.5 min-h-[40px] items-center">
          {allBoard.map((card, i) => (
            <PlayingCard
              key={`${card}-${i}`}
              card={card}
              size="sm"
              animationDelay={i >= visibleBoard.flop.length ? 0 : undefined}
            />
          ))}
          {allBoard.length === 0 && step >= 0 && (
            <span className="text-white/20 text-xs">Waiting for board…</span>
          )}
        </div>

        {/* Pot */}
        {currentPot > 0 && (
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-poker-gold text-sm">🪙</span>
            <span className="text-xs font-bold text-yellow-300 tabular-nums">
              {currentPot.toFixed(1)}bb
            </span>
          </div>
        )}
      </div>

      {/* Hero seat — bottom center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        {/* Label */}
        <div className={cn(
          "px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
          isHeroActing ? "bg-poker-green/20 text-poker-green border border-poker-green/30" : "bg-black/40 text-white/50"
        )}>
          Hero · {handSummary.hero_position}
        </div>
        {/* Cards */}
        <div className={cn("flex gap-1 rounded-sm transition-all", ratingRing(heroRating))}>
          {heroCards.map((c, i) => (
            <PlayingCard key={i} card={c} size="sm" />
          ))}
        </div>
        {/* Action bubble */}
        {isHeroActing && (
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold animate-fade-in",
            heroRating === "mistake" ? "bg-red-500 text-white"
            : heroRating === "okay" ? "bg-yellow-400 text-black"
            : "bg-poker-green text-black"
          )}>
            {actionLabel(currentAction!)}
          </div>
        )}
      </div>
    </div>
  );
}
