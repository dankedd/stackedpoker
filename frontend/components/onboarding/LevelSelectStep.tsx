'use client'

import { GraduationCap, Coffee, TrendingUp, Trophy, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EXPERIENCE_LEVEL_OPTIONS, type ExperienceLevel } from '@/lib/learn/experienceLevel'

const ICONS: Record<ExperienceLevel, typeof GraduationCap> = {
  beginner: GraduationCap,
  recreational: Coffee,
  intermediate: TrendingUp,
  advanced: Trophy,
}

// One screen, one question, large touch targets — replaces the old
// self-rating + adaptive-quiz flow entirely. No scoring, no wrong answers.
export function LevelSelectStep({
  onSelect,
}: {
  onSelect: (level: ExperienceLevel) => void
}) {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-1.5">
        How would you describe your current poker level?
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-7">
        Pick the one that fits best — you can change this later.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXPERIENCE_LEVEL_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.id]
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={cn(
                'group relative text-left rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-6',
                'min-h-[132px] transition-all duration-200',
                'hover:border-violet-500/40 hover:bg-violet-500/[0.05] hover:-translate-y-0.5',
                'active:scale-[0.98]',
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0 group-hover:bg-violet-500/15 transition-colors">
                  <Icon className="h-5.5 w-5.5 text-violet-400" />
                </div>
                <h2 className="text-base font-bold text-foreground flex-1">{opt.title}</h2>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <ul className="space-y-1">
                {opt.bullets.map((b) => (
                  <li key={b} className="text-xs text-muted-foreground leading-relaxed">{b}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}
