'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface XPGainProps {
  xp: number
  leveled_up: boolean
  new_level?: number
  className?: string
}

export function XPGain({ xp, leveled_up, new_level, className }: XPGainProps) {
  const [visible, setVisible] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)

  useEffect(() => {
    // Trigger mount animation
    const t1 = setTimeout(() => setVisible(true), 50)
    if (leveled_up) {
      const t2 = setTimeout(() => setShowLevelUp(true), 600)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    return () => clearTimeout(t1)
  }, [leveled_up])

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* XP badge */}
      <div
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 transition-all duration-500',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        )}
      >
        <Star className="h-4 w-4 text-amber-400 fill-amber-400/30" />
        <span className="text-lg font-black text-amber-300">+{xp} XP</span>
      </div>

      {/* Level-up overlay card */}
      {leveled_up && (
        <div
          className={cn(
            'flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-600/20 to-blue-600/10 transition-all duration-500',
            showLevelUp ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30">
            <Star className="h-5 w-5 text-violet-300 fill-violet-400/30" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-0.5">
              Level Up!
            </p>
            {new_level != null && (
              <p className="text-2xl font-black text-foreground">
                Level{' '}
                <span className="text-violet-300">{new_level}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
