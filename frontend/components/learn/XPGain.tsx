'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface XPGainProps {
  xp: number
  className?: string
}

/** Small "+XP" badge shown inline after a step's feedback. The confirmed
 *  level-up celebration (if this XP happened to cross a level) is a
 *  separate concern — see LevelUpModal, driven by LearnProgressContext's
 *  server-confirmed pendingLevelUp, never by this step's local result. */
export function XPGain({ xp, className }: XPGainProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t1)
  }, [])

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 transition-all duration-500',
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        className,
      )}
    >
      <Star className="h-4 w-4 text-amber-400 fill-amber-400/30" />
      <span className="text-lg font-black text-amber-300">+{xp} XP</span>
    </div>
  )
}
