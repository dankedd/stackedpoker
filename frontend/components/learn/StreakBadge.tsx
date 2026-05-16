import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakBadgeProps {
  days: number
  className?: string
}

export function StreakBadge({ days, className }: StreakBadgeProps) {
  if (days === 0) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-secondary/30',
          className
        )}
      >
        <Flame className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="text-xs font-semibold text-muted-foreground/50">No streak</span>
      </div>
    )
  }

  const isHot = days >= 7
  const isOnFire = days >= 30

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold',
        isOnFire
          ? 'border-red-500/40 bg-red-500/10 text-red-300'
          : isHot
          ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        className
      )}
    >
      <Flame
        className={cn(
          'h-3.5 w-3.5',
          isOnFire ? 'text-red-400' : isHot ? 'text-orange-400' : 'text-amber-400'
        )}
      />
      <span className="text-xs">
        <span className="text-sm font-black">{days}</span>
        {' '}day{days !== 1 ? 's' : ''} streak
      </span>
    </div>
  )
}
