'use client'

import { cn } from '@/lib/utils'
import type { Achievement } from '@/lib/learn/types'

// ── Tier styles ───────────────────────────────────────────────────────────────

const TIER_RING: Record<Achievement['tier'], string> = {
  bronze:   'ring-amber-700/50 bg-amber-900/20',
  silver:   'ring-slate-400/50 bg-slate-700/20',
  gold:     'ring-yellow-500/60 bg-yellow-900/20',
  platinum: 'ring-violet-400/60 bg-violet-900/20',
}

const TIER_GLOW: Record<Achievement['tier'], string> = {
  bronze:   '',
  silver:   '',
  gold:     'shadow-yellow-500/20',
  platinum: 'shadow-violet-500/30',
}

const TIER_LABEL: Record<Achievement['tier'], string> = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
}

// ── Category accent ───────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<Achievement['category'], string> = {
  learning:    'text-blue-400/70',
  consistency: 'text-orange-400/70',
  mastery:     'text-violet-400/70',
  exploration: 'text-emerald-400/70',
  performance: 'text-amber-400/70',
}

// ── Single badge (compact) ────────────────────────────────────────────────────

interface AchievementBadgeProps {
  achievement: Achievement
  unlocked?: boolean
  size?: 'sm' | 'md'
  showTitle?: boolean
  className?: string
}

export function AchievementBadge({
  achievement,
  unlocked = false,
  size = 'md',
  showTitle = true,
  className,
}: AchievementBadgeProps) {
  const ringClass = TIER_RING[achievement.tier]
  const glowClass = TIER_GLOW[achievement.tier]

  const iconSize = size === 'sm' ? 'h-10 w-10 text-xl' : 'h-14 w-14 text-2xl'
  const titleClass = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 select-none',
        !unlocked && 'opacity-40 grayscale',
        className,
      )}
      title={unlocked ? achievement.condition : `Locked: ${achievement.condition}`}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl ring-2',
          iconSize,
          ringClass,
          unlocked && glowClass && `shadow-lg ${glowClass}`,
          unlocked && 'ring-offset-1 ring-offset-background',
        )}
      >
        <span role="img" aria-label={achievement.title}>
          {achievement.icon}
        </span>
      </div>

      {showTitle && (
        <p className={cn('font-semibold text-center text-foreground leading-tight', titleClass)}>
          {achievement.title}
        </p>
      )}
    </div>
  )
}

// ── Achievements panel (grid of badges) ──────────────────────────────────────

interface AchievementsPanelProps {
  achievements: Achievement[]
  unlockedIds: Set<string>
  /** Show all or only unlocked */
  showLocked?: boolean
  className?: string
}

export function AchievementsPanel({
  achievements,
  unlockedIds,
  showLocked = true,
  className,
}: AchievementsPanelProps) {
  const visible = showLocked ? achievements : achievements.filter((a) => unlockedIds.has(a.id))

  if (visible.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground/40 py-4">
        No achievements unlocked yet — start learning to earn badges!
      </p>
    )
  }

  // Group by category
  const grouped = visible.reduce<Record<string, Achievement[]>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className={cn('space-y-5', className)}>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest mb-3',
              CATEGORY_COLOR[cat as Achievement['category']],
            )}
          >
            {cat}
          </p>
          <div className="flex flex-wrap gap-4">
            {items.map((a) => (
              <AchievementBadge
                key={a.id}
                achievement={a}
                unlocked={unlockedIds.has(a.id)}
                size="md"
                showTitle
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Achievement unlock toast (used in lesson summary) ────────────────────────

interface AchievementToastProps {
  achievement: Achievement
  className?: string
}

export function AchievementToast({ achievement, className }: AchievementToastProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-900/20 to-amber-900/10 px-4 py-3',
        'shadow-lg shadow-yellow-900/20 animate-in slide-in-from-bottom-3 duration-400',
        className,
      )}
    >
      <span className="text-2xl shrink-0">{achievement.icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500/70 mb-0.5">
          Achievement Unlocked · {TIER_LABEL[achievement.tier]}
        </p>
        <p className="font-bold text-foreground text-sm">{achievement.title}</p>
        <p className="text-xs text-muted-foreground/60 truncate">{achievement.description}</p>
      </div>
      <span className="shrink-0 text-xs font-black text-amber-400">
        +{achievement.xp_bonus} XP
      </span>
    </div>
  )
}
