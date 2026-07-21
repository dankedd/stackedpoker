'use client'

import { cn } from '@/lib/utils'

interface ChipStackProps {
  label: string
  value: number
  color: 'slate' | 'amber' | 'violet'
  delayMs?: number
}

const COLOR_CLASSES: Record<ChipStackProps['color'], string> = {
  slate:  'border-border/40 bg-secondary/40 text-foreground',
  amber:  'border-amber-500/30 bg-amber-500/10 text-amber-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
}

function ChipStack({ label, value, color, delayMs = 0 }: ChipStackProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border px-4 py-3 min-w-[84px]',
        'animate-in fade-in zoom-in-95 duration-500 fill-mode-both',
        COLOR_CLASSES[color],
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-60">{label}</span>
      <span className="text-lg font-black tabular-nums">{value}</span>
    </div>
  )
}

interface PotDisplayProps {
  /** Pot before any of the amounts below are added (the starting pot). */
  potBefore: number
  /** Villain's bet — rendered as a chip sliding in next to the pot. */
  bet?: number
  /** Hero's call/risk amount — rendered last, highlighted. */
  call?: number
  /** Overrides the computed total (potBefore + bet + call) if provided. */
  finalPotOverride?: number
  className?: string
}

/** Shared chip/pot visualization — pot, villain's bet, hero's call, and the resulting final pot. */
export function PotDisplay({ potBefore, bet, call, finalPotOverride, className }: PotDisplayProps) {
  const finalPot = finalPotOverride ?? potBefore + (bet ?? 0) + (call ?? 0)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <ChipStack label="Pot" value={potBefore} color="slate" delayMs={0} />
        {bet != null && <ChipStack label="Villain bets" value={bet} color="amber" delayMs={120} />}
        {call != null && <ChipStack label="Hero calls" value={call} color="violet" delayMs={240} />}
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
          Final pot
        </p>
        <p className="text-2xl font-black tabular-nums text-foreground">{Math.round(finalPot)}</p>
      </div>
    </div>
  )
}
