import { cn } from '@/lib/utils'
import { PlayingCardMini } from './PlayingCardMini'

const STREET_COLORS = {
  preflop: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
  flop: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  turn: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  river: 'text-red-400 border-red-400/30 bg-red-400/10',
}

interface PokerContextBarProps {
  board?: string[]
  heroPosition?: string
  villainPosition?: string
  potBb?: number
  effectiveStackBb?: number
  street?: string
  heroHand?: string[]
  className?: string
}

export function PokerContextBar({
  board,
  heroPosition,
  villainPosition,
  potBb,
  effectiveStackBb,
  street,
  heroHand,
  className,
}: PokerContextBarProps) {
  const hasContext =
    board?.length || heroPosition || villainPosition || potBb != null || effectiveStackBb != null

  if (!hasContext) return null

  const streetKey = (street ?? 'preflop') as keyof typeof STREET_COLORS
  const streetCls = STREET_COLORS[streetKey] ?? STREET_COLORS.preflop

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-border/40 bg-card/40',
        className
      )}
    >
      {/* Street badge */}
      {street && (
        <span
          className={cn(
            'text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg border',
            streetCls
          )}
        >
          {street}
        </span>
      )}

      {/* Divider helper */}
      {street && (board?.length || heroHand?.length || heroPosition) && (
        <div className="h-4 w-px bg-border/40" />
      )}

      {/* Hero hand */}
      {heroHand && heroHand.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/60">
            Hand
          </span>
          <div className="flex gap-1">
            {heroHand.map((card, i) => (
              <PlayingCardMini key={i} card={card} size="xs" />
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      {board && board.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Board
          </span>
          <div className="flex gap-1">
            {board.map((card, i) => (
              <PlayingCardMini key={i} card={card} size="xs" />
            ))}
          </div>
        </div>
      )}

      {/* Position matchup */}
      {(heroPosition || villainPosition) && (
        <div className="flex items-center gap-1.5">
          {heroPosition && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400">
              {heroPosition}
            </span>
          )}
          {heroPosition && villainPosition && (
            <span className="text-[10px] text-muted-foreground/30">vs</span>
          )}
          {villainPosition && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border/30 bg-secondary/40 text-muted-foreground/60">
              {villainPosition}
            </span>
          )}
        </div>
      )}

      {/* Pot */}
      {potBb != null && (
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400/50" />
          <span className="text-xs font-bold tabular-nums text-amber-200/70">
            Pot: {potBb % 1 === 0 ? potBb : potBb.toFixed(1)}bb
          </span>
        </div>
      )}

      {/* Effective stack */}
      {effectiveStackBb != null && (
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-sky-400/50" />
          <span className="text-xs font-bold tabular-nums text-sky-200/70">
            {effectiveStackBb % 1 === 0 ? effectiveStackBb : effectiveStackBb.toFixed(1)}bb eff
          </span>
        </div>
      )}
    </div>
  )
}
