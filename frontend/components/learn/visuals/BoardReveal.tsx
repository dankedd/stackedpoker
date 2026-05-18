'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Card parsing ──────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
}

const SUIT_COLORS: Record<string, string> = {
  h: 'text-red-400',
  d: 'text-red-400',
  c: 'text-slate-200',
  s: 'text-slate-200',
}

const SUIT_BG: Record<string, string> = {
  h: 'border-red-500/30 bg-gradient-to-br from-red-950/60 to-red-900/30',
  d: 'border-red-500/30 bg-gradient-to-br from-red-950/60 to-red-900/30',
  c: 'border-slate-500/30 bg-gradient-to-br from-slate-900/80 to-slate-800/40',
  s: 'border-slate-500/30 bg-gradient-to-br from-slate-900/80 to-slate-800/40',
}

function parseCard(card: string): { rank: string; suit: string } {
  const suit = card.slice(-1).toLowerCase()
  const rank = card.slice(0, -1).toUpperCase()
  return { rank, suit }
}

// ── Single animated card ──────────────────────────────────────────────────────

interface CardProps {
  card: string
  revealed: boolean
  size?: 'sm' | 'md' | 'lg'
  delay?: number
}

function AnimatedCard({ card, revealed, size = 'md', delay = 0 }: CardProps) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (!revealed) { setFlipped(false); return }
    const t = setTimeout(() => setFlipped(true), delay)
    return () => clearTimeout(t)
  }, [revealed, delay])

  const { rank, suit } = parseCard(card)
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit
  const suitColor = SUIT_COLORS[suit] ?? 'text-foreground'
  const bgCls = SUIT_BG[suit] ?? 'border-border/40 bg-card/80'

  const sizeMap = {
    sm: { outer: 'w-8 h-11', rank: 'text-sm', suit: 'text-[9px]' },
    md: { outer: 'w-11 h-15', rank: 'text-lg', suit: 'text-xs' },
    lg: { outer: 'w-14 h-20', rank: 'text-2xl', suit: 'text-sm' },
  }
  const { outer, rank: rankSz, suit: suitSz } = sizeMap[size]

  return (
    <div
      className={cn('relative shrink-0', outer)}
      style={{ perspective: '600px' }}
    >
      {/* Flip container */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(0deg)' : 'rotateY(90deg)',
          transitionDelay: `${delay}ms`,
        }}
      >
        {/* Face */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center rounded-lg border shadow-lg',
            bgCls,
            'shadow-black/40',
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className={cn('font-black leading-none', rankSz, suitColor)}>{rank}</span>
          <span className={cn('leading-none', suitSz, suitColor)}>{suitSymbol}</span>
        </div>
      </div>

      {/* Back face (shown while not revealed / mid-flip) */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg border border-violet-500/30',
          'bg-gradient-to-br from-violet-900/60 to-blue-900/40',
          'flex items-center justify-center',
          'transition-opacity duration-200',
          flipped ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
      >
        <div className="h-2/3 w-2/3 rounded border border-violet-500/20 bg-violet-500/10" />
      </div>
    </div>
  )
}

// ── Board reveal with street labels ──────────────────────────────────────────

interface BoardRevealProps {
  /** Array of card strings already dealt to this board (e.g. ['Ah','Kd','3s']) */
  board: string[]
  /** When false, all cards show backs; when true, cards animate in */
  revealed?: boolean
  /** Card size */
  size?: 'sm' | 'md' | 'lg'
  /** Show street labels above groups */
  showStreetLabels?: boolean
  className?: string
}

const STREET_LABEL: Record<number, string> = {
  3: 'Flop',
  4: 'Turn',
  5: 'River',
}

export function BoardReveal({
  board,
  revealed = true,
  size = 'md',
  showStreetLabels = false,
  className,
}: BoardRevealProps) {
  return (
    <div className={cn('flex items-end gap-1', className)}>
      {board.map((card, i) => {
        const streetLabel = showStreetLabels && (i === 0 || i === 3 || i === 4)
          ? STREET_LABEL[Math.min(board.length, i === 4 ? 5 : i === 3 ? 4 : 3)]
          : null

        return (
          <div key={i} className="flex flex-col items-center gap-1">
            {showStreetLabels && (i === 0 || i === 3 || i === 4) && (
              <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                {i === 0 ? 'Flop' : i === 3 ? 'Turn' : 'River'}
              </span>
            )}
            <AnimatedCard
              card={card}
              revealed={revealed}
              size={size}
              delay={i * 120}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Street-by-street animated board ──────────────────────────────────────────
// Reveals cards group by group with a "dealing" feel

interface StreetBoardProps {
  board: string[]           // final board (up to 5 cards)
  street: 'preflop' | 'flop' | 'turn' | 'river'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StreetBoard({ board, street, size = 'md', className }: StreetBoardProps) {
  const visibleCount =
    street === 'preflop' ? 0
    : street === 'flop' ? 3
    : street === 'turn' ? 4
    : 5

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {board.slice(0, 5).map((card, i) => (
        <AnimatedCard
          key={i}
          card={card}
          revealed={i < visibleCount}
          size={size}
          delay={i * 100}
        />
      ))}
    </div>
  )
}
