'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Shared card identity ──────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const RED_COLOR   = '#B41C22'
const BLACK_COLOR = '#1C1917'

function parseCard(card: string): { rank: string; suit: string } {
  const suit = card.slice(-1).toLowerCase()
  const raw  = card.slice(0, -1).toUpperCase()
  return { rank: raw === 'T' ? '10' : raw, suit }
}

// ── Size system (mirrors PlayingCard.tsx) ─────────────────────────────────────

const SIZE_MAP = {
  sm: { h: 'h-[54px]',  w: 'w-[38px]',  r: 'rounded-[5px]',  p: 'p-[3.5px]',  corner: 'text-[11px]', suit: 'text-[9px]',   center: 'text-[22px]' },
  md: { h: 'h-[72px]',  w: 'w-[51px]',  r: 'rounded-[6px]',  p: 'p-[4.5px]',  corner: 'text-[15px]', suit: 'text-[12px]',  center: 'text-[29px]' },
  lg: { h: 'h-[100px]', w: 'w-[71px]',  r: 'rounded-[8px]',  p: 'p-[6px]',    corner: 'text-[20px]', suit: 'text-[15px]',  center: 'text-[40px]' },
}

// ── Premium face card ─────────────────────────────────────────────────────────

function PremiumCardFace({ rank, suit, size }: { rank: string; suit: string; size: 'sm' | 'md' | 'lg' }) {
  const cfg   = SIZE_MAP[size]
  const sym   = SUIT_SYMBOL[suit] ?? suit
  const isRed = suit === 'h' || suit === 'd'
  const col   = isRed ? RED_COLOR : BLACK_COLOR

  return (
    <div
      className={cn('relative select-none flex flex-col justify-between shrink-0 overflow-hidden', cfg.h, cfg.w, cfg.r, cfg.p)}
      style={{
        background: 'linear-gradient(165deg, #FEFEFC 0%, #F9F6F0 40%, #F0EBE1 100%)',
        boxShadow: [
          '0 14px 36px rgba(0,0,0,0.62)',
          '0 4px 10px rgba(0,0,0,0.38)',
          '0 1px 3px rgba(0,0,0,0.20)',
          'inset 0 1.5px 0 rgba(255,255,255,1)',
          'inset 0 -1px 0 rgba(0,0,0,0.07)',
        ].join(', '),
        border: '1px solid rgba(200,193,182,0.80)',
      }}
    >
      {/* Top gloss */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, transparent 100%)', borderRadius: 'inherit' }}
      />
      <div className="relative z-10 flex flex-col items-start leading-none font-black" style={{ color: col }}>
        <span className={cn('leading-none tracking-tight', cfg.corner)}>{rank}</span>
        <span className={cn('leading-none -mt-[1px]', cfg.suit)}>{sym}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={cn('leading-none select-none font-black', cfg.center)} style={{ color: col, opacity: isRed ? 0.11 : 0.08 }}>
          {sym}
        </span>
      </div>
      <div className="relative z-10 flex flex-col items-end leading-none font-black rotate-180" style={{ color: col }}>
        <span className={cn('leading-none tracking-tight', cfg.corner)}>{rank}</span>
        <span className={cn('leading-none -mt-[1px]', cfg.suit)}>{sym}</span>
      </div>
    </div>
  )
}

// ── Premium card back ─────────────────────────────────────────────────────────

function PremiumCardBack({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const cfg = SIZE_MAP[size]
  return (
    <div
      className={cn('select-none overflow-hidden shrink-0 relative', cfg.h, cfg.w, cfg.r)}
      style={{
        background: 'linear-gradient(148deg, #2C1B6E 0%, #18103E 38%, #0D0A28 62%, #1A1055 100%)',
        boxShadow: [
          '0 12px 30px rgba(0,0,0,0.55)',
          '0 3px 8px rgba(0,0,0,0.35)',
          'inset 0 1px 0 rgba(255,255,255,0.08)',
          'inset 0 0 0 1.5px rgba(139,92,246,0.12)',
        ].join(', '),
        border: '1px solid rgba(139,92,246,0.28)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)',
            'repeating-linear-gradient(-45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)',
          ].join(', '),
          backgroundSize: '8px 8px',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            width: '42%', height: '58%',
            border: '1px solid rgba(139,92,246,0.22)',
            boxShadow: '0 0 0 3px rgba(139,92,246,0.07)',
            borderRadius: '3px', transform: 'rotate(3deg)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '26%', height: '38%',
            border: '1px solid rgba(167,139,250,0.18)',
            borderRadius: '2px', transform: 'rotate(3deg)',
          }}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 65%)', borderRadius: 'inherit' }}
      />
    </div>
  )
}

// ── Single animated (flip) card ───────────────────────────────────────────────

interface AnimatedCardProps {
  card: string
  revealed: boolean
  size?: 'sm' | 'md' | 'lg'
  delay?: number
}

function AnimatedCard({ card, revealed, size = 'md', delay = 0 }: AnimatedCardProps) {
  const [flipped, setFlipped] = useState(false)
  const cfg = SIZE_MAP[size]

  useEffect(() => {
    if (!revealed) { setFlipped(false); return }
    const t = setTimeout(() => setFlipped(true), delay)
    return () => clearTimeout(t)
  }, [revealed, delay])

  const { rank, suit } = parseCard(card)

  return (
    <div className={cn('relative shrink-0', cfg.h, cfg.w)} style={{ perspective: '700px' }}>
      {/* Face — slides in from rotateY(90) */}
      <div
        className="absolute inset-0 transition-transform duration-[420ms] ease-out"
        style={{
          transform: flipped ? 'rotateY(0deg)' : 'rotateY(90deg)',
          transformOrigin: 'center center',
        }}
      >
        <PremiumCardFace rank={rank} suit={suit} size={size} />
      </div>

      {/* Back — fades out as card flips in */}
      <div
        className="absolute inset-0 transition-opacity duration-[180ms] ease-in"
        style={{ opacity: flipped ? 0 : 1, pointerEvents: flipped ? 'none' : 'auto' }}
      >
        <PremiumCardBack size={size} />
      </div>
    </div>
  )
}

// ── BoardReveal ───────────────────────────────────────────────────────────────

interface BoardRevealProps {
  board: string[]
  revealed?: boolean
  size?: 'sm' | 'md' | 'lg'
  showStreetLabels?: boolean
  className?: string
}

export function BoardReveal({ board, revealed = true, size = 'md', showStreetLabels = false, className }: BoardRevealProps) {
  return (
    <div className={cn('flex items-end gap-1.5', className)}>
      {board.map((card, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          {showStreetLabels && (i === 0 || i === 3 || i === 4) && (
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/35">
              {i === 0 ? 'Flop' : i === 3 ? 'Turn' : 'River'}
            </span>
          )}
          <AnimatedCard card={card} revealed={revealed} size={size} delay={i * 120} />
        </div>
      ))}
    </div>
  )
}

// ── StreetBoard ───────────────────────────────────────────────────────────────

interface StreetBoardProps {
  board: string[]
  street: 'preflop' | 'flop' | 'turn' | 'river'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StreetBoard({ board, street, size = 'md', className }: StreetBoardProps) {
  const visibleCount = street === 'preflop' ? 0 : street === 'flop' ? 3 : street === 'turn' ? 4 : 5

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {board.slice(0, 5).map((card, i) => (
        <AnimatedCard key={i} card={card} revealed={i < visibleCount} size={size} delay={i * 100} />
      ))}
    </div>
  )
}
