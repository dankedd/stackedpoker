import { cn } from '@/lib/utils'

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }

// Matches PlayingCard.tsx color palette exactly
const RED_COLOR   = '#B41C22'
const BLACK_COLOR = '#1C1917'

// `inset` (px) is the corner index's distance from BOTH the card's edges — used as an
// explicit top/left (and mirrored bottom/right) offset, never as container padding, so
// the two corner blocks are pinned independently of flex content-height distribution.
const SIZE_CONFIG = {
  xs: { outer: 'w-[27px] h-[38px] rounded-[4px]', inset: 2.5, rank: 'text-[8px]',  suit: 'text-[7px]'  },
  sm: { outer: 'w-[38px] h-[54px] rounded-[5px]', inset: 3.5, rank: 'text-[11px]', suit: 'text-[9px]'  },
  md: { outer: 'w-[51px] h-[72px] rounded-[6px]', inset: 4.5, rank: 'text-[15px]', suit: 'text-[12px]' },
  // Hero-card target for the preflop table's visual polish pass — noticeably larger
  // than 'md', the biggest tier used anywhere else.
  lg: { outer: 'w-[54px] h-[76px] rounded-[8px]', inset: 6, rank: 'text-[21px]', suit: 'text-[16px]' },
}

const RANK_NAME: Record<string, string> = {
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10',
  '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
}
const SUIT_NAME: Record<string, string> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' }

interface PlayingCardMiniProps {
  card: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function PlayingCardMini({ card, size = 'sm', className }: PlayingCardMiniProps) {
  const cfg = SIZE_CONFIG[size]

  if (!card || card.length < 2) {
    return (
      <div
        role="img"
        aria-label="Face-down card"
        className={cn('flex items-center justify-center shrink-0', cfg.outer, className)}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="text-white/20 font-bold text-[8px]">?</span>
      </div>
    )
  }

  const rawRank = card[0].toUpperCase()
  const rank    = rawRank === 'T' ? '10' : rawRank
  const suit    = card[1].toLowerCase()
  const sym     = SUIT_SYMBOL[suit] ?? suit
  const col     = suit === 'h' || suit === 'd' ? RED_COLOR : BLACK_COLOR
  const accessibleLabel = `${RANK_NAME[rawRank] ?? rawRank} of ${SUIT_NAME[suit] ?? suit}`

  return (
    <div
      role="img"
      aria-label={accessibleLabel}
      className={cn('relative select-none shrink-0 overflow-hidden', cfg.outer, className)}
      style={{
        background: 'linear-gradient(165deg, #FEFEFC 0%, #F9F6F0 40%, #F0EBE1 100%)',
        boxShadow: [
          '0 8px 20px rgba(0,0,0,0.58)',
          '0 2px 6px rgba(0,0,0,0.32)',
          'inset 0 1.5px 0 rgba(255,255,255,1)',
          'inset 0 -1px 0 rgba(0,0,0,0.07)',
        ].join(', '),
        border: '1px solid rgba(200,193,182,0.80)',
      }}
    >
      {/* Top gloss */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: '40%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 100%)',
          borderRadius: 'inherit',
        }}
      />

      {/* Top-left corner index — pinned via explicit top/left, not flex distribution. */}
      <div
        className="absolute z-10 flex flex-col items-start leading-none font-black"
        style={{ top: cfg.inset, left: cfg.inset, color: col }}
      >
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none', cfg.suit)}>{sym}</span>
      </div>

      {/* Bottom-right corner index — the EXACT mirror: same `inset` value, but anchored
          via bottom/right instead of top/left, then rotated 180deg around its own center.
          Rotation is a paint-time transform and never moves the pinned bounding box, so
          this corner's distance from the card's bottom/right edges is always identical to
          the top-left corner's distance from the top/left edges — regardless of glyph
          metrics (verified explicitly for Q, whose descender previously made this corner
          look uneven against a content-height-driven `justify-between` layout). */}
      <div
        className="absolute z-10 flex flex-col items-end leading-none font-black rotate-180"
        style={{ bottom: cfg.inset, right: cfg.inset, color: col }}
      >
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none', cfg.suit)}>{sym}</span>
      </div>
    </div>
  )
}
