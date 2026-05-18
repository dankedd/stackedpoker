import { cn } from '@/lib/utils'

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }

// Matches PlayingCard.tsx color palette exactly
const RED_COLOR   = '#B41C22'
const BLACK_COLOR = '#1C1917'

const SIZE_CONFIG = {
  xs: { outer: 'w-[27px] h-[38px] rounded-[4px] p-[2.5px]', rank: 'text-[8px]',  suit: 'text-[7px]'  },
  sm: { outer: 'w-[38px] h-[54px] rounded-[5px] p-[3.5px]', rank: 'text-[11px]', suit: 'text-[9px]'  },
  md: { outer: 'w-[51px] h-[72px] rounded-[6px] p-[4.5px]', rank: 'text-[15px]', suit: 'text-[12px]' },
}

interface PlayingCardMiniProps {
  card: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export function PlayingCardMini({ card, size = 'sm', className }: PlayingCardMiniProps) {
  const cfg = SIZE_CONFIG[size]

  if (!card || card.length < 2) {
    return (
      <div
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

  return (
    <div
      className={cn(
        'relative select-none flex flex-col justify-between shrink-0 overflow-hidden',
        cfg.outer,
        className,
      )}
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
      <div className="relative z-10 flex flex-col items-start leading-none font-black" style={{ color: col }}>
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none -mt-[1px]', cfg.suit)}>{sym}</span>
      </div>
      <div className="relative z-10 flex flex-col items-end leading-none font-black rotate-180" style={{ color: col }}>
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none -mt-[1px]', cfg.suit)}>{sym}</span>
      </div>
    </div>
  )
}
