import { cn } from '@/lib/utils'

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
}

const SIZE_CONFIG = {
  xs: { outer: 'w-6 h-8 rounded-[3px] p-[2px]', rank: 'text-[8px]', suit: 'text-[7px]' },
  sm: { outer: 'w-8 h-11 rounded-[4px] p-[3px]', rank: 'text-[10px]', suit: 'text-[9px]' },
  md: { outer: 'w-10 h-14 rounded-[5px] p-[4px]', rank: 'text-xs', suit: 'text-[11px]' },
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
        className={cn(
          'flex items-center justify-center border border-white/10',
          cfg.outer,
          className
        )}
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <span className="text-white/20 font-bold text-[8px]">?</span>
      </div>
    )
  }

  const rank = card[0].toUpperCase() === 'T' ? '10' : card[0].toUpperCase()
  const suit = card[1].toLowerCase()
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit
  const isRed = suit === 'h' || suit === 'd'
  const color = isRed ? '#c8252d' : '#1a1a1a'

  return (
    <div
      className={cn(
        'relative select-none flex flex-col justify-between shrink-0',
        cfg.outer,
        className
      )}
      style={{
        background: 'linear-gradient(160deg, #fefefe 0%, #f8f7f5 65%, #f2efe8 100%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div className="flex flex-col items-start leading-none font-black" style={{ color }}>
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none', cfg.suit)}>{suitSymbol}</span>
      </div>
      <div className="flex flex-col items-end leading-none font-black rotate-180" style={{ color }}>
        <span className={cn('leading-none tracking-tight', cfg.rank)}>{rank}</span>
        <span className={cn('leading-none', cfg.suit)}>{suitSymbol}</span>
      </div>
    </div>
  )
}
