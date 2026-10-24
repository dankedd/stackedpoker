'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { LEVELS } from '@/lib/levels/strings'
import { cn } from '@/lib/utils'

interface XPGainProps {
  xp: number
  /** Day-streak bonus that came with this answer (trainers). */
  bonus?: number
  className?: string
}

/** Small "+XP" badge shown inline after a step's or answer's feedback: pops
 *  in and floats up a little. The confirmed level-up celebration (if this XP
 *  happened to cross a level) is a separate concern — see LevelUpModal,
 *  driven by LearnProgressContext's server-confirmed pendingLevelUp, never by
 *  this result. */
export function XPGain({ xp, bonus = 0, className }: XPGainProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t1)
  }, [])

  return (
    <span className="inline-flex items-center gap-1.5" aria-live="polite">
      <span
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 transition-all duration-500 ease-out motion-reduce:transition-none',
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2',
          className,
        )}
      >
        <Star className="h-4 w-4 text-amber-400 fill-amber-400/30" />
        <span className="text-lg font-black text-amber-300">+{xp} XP</span>
      </span>
      {bonus > 0 && (
        <span
          className={cn(
            'rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-300 transition-all delay-200 duration-500 motion-reduce:transition-none',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          {LEVELS.bonusChip(bonus)}
        </span>
      )}
    </span>
  )
}
