import { cn } from '@/lib/utils'
import type { MasteryLevel } from '@/lib/learn/types'
import { MASTERY_LABELS } from '@/lib/learn/types'

const RING_COLORS: Record<MasteryLevel, { stroke: string; glow: string; text: string }> = {
  0: { stroke: '#475569', glow: 'none', text: 'text-slate-500' },
  1: { stroke: '#ef4444', glow: '0 0 8px rgba(239,68,68,0.4)', text: 'text-red-400' },
  2: { stroke: '#f97316', glow: '0 0 8px rgba(249,115,22,0.4)', text: 'text-orange-400' },
  3: { stroke: '#f59e0b', glow: '0 0 8px rgba(245,158,11,0.4)', text: 'text-amber-400' },
  4: { stroke: '#3b82f6', glow: '0 0 8px rgba(59,130,246,0.4)', text: 'text-blue-400' },
  5: { stroke: '#10b981', glow: '0 0 10px rgba(16,185,129,0.5)', text: 'text-emerald-400' },
}

const SIZE_CONFIG = {
  sm: { size: 32, r: 12, sw: 3, fontSize: 'text-[10px]' },
  md: { size: 48, r: 18, sw: 4, fontSize: 'text-sm' },
}

interface MasteryRingProps {
  level: MasteryLevel
  concept_id: string
  size?: 'sm' | 'md'
  className?: string
}

export function MasteryRing({ level, concept_id, size = 'md', className }: MasteryRingProps) {
  const cfg = SIZE_CONFIG[size]
  const colors = RING_COLORS[level]
  const circumference = 2 * Math.PI * cfg.r
  const progress = level / 5
  const dashOffset = circumference * (1 - progress)
  const center = cfg.size / 2

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      title={`${concept_id}: ${MASTERY_LABELS[level]}`}
    >
      <svg
        width={cfg.size}
        height={cfg.size}
        className="-rotate-90"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={cfg.r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={cfg.sw}
        />
        {/* Progress arc */}
        {level > 0 && (
          <circle
            cx={center}
            cy={center}
            r={cfg.r}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={cfg.sw}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: colors.glow !== 'none' ? `drop-shadow(${colors.glow})` : undefined }}
          />
        )}
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center font-black',
          cfg.fontSize,
          colors.text
        )}
      >
        {level}
      </span>
    </div>
  )
}
