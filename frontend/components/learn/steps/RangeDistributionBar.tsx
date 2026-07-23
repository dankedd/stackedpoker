'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface RangeDistributionBarProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

type Bucket = 'strong' | 'good' | 'weak' | 'trash'
const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: 'strong', label: 'Strong', color: 'bg-emerald-500/70' },
  { key: 'good', label: 'Good', color: 'bg-sky-500/70' },
  { key: 'weak', label: 'Weak', color: 'bg-amber-500/70' },
  { key: 'trash', label: 'Trash', color: 'bg-rose-500/70' },
]

function DistributionBar({ label, dist }: { label: string; dist: { strong: number; good: number; weak: number; trash: number } }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">{label}</p>
      </div>
      <div className="h-6 w-full rounded-lg overflow-hidden flex border border-border/30">
        {BUCKETS.map((b) => {
          const pct = dist[b.key]
          if (pct <= 0) return null
          return (
            <div
              key={b.key}
              className={cn('h-full flex items-center justify-center', b.color)}
              style={{ width: `${pct}%` }}
              title={`${b.label}: ${pct}%`}
            >
              {pct >= 12 && <span className="text-[9px] font-bold text-white/90">{pct}%</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Two-range (Hero vs Villain) Strong/Good/Weak/Trash stacked-bar comparison.
 *  'predict' mode collects a quick per-bucket "which side has more?" self-check
 *  before revealing the real bars; 'reveal' mode shows them immediately.
 *  Grading (if any) is the `options`-based follow-up question, not the predictions. */
export function RangeDistributionBar({ step, onAnswer, disabled = false }: RangeDistributionBarProps) {
  const mountTime = useRef(Date.now())
  const mode = step.range_distribution_mode ?? 'reveal'
  const hero = step.range_distribution_hero
  const villain = step.range_distribution_villain

  const [predictions, setPredictions] = useState<Partial<Record<Bucket, 'hero' | 'villain' | 'equal'>>>({})
  const [revealed, setRevealed] = useState(mode === 'reveal')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setPredictions({})
    setRevealed(mode === 'reveal')
    setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  function predict(bucket: Bucket, side: 'hero' | 'villain' | 'equal') {
    if (revealed) return
    setPredictions((prev) => ({ ...prev, [bucket]: side }))
  }

  const allPredicted = BUCKETS.every((b) => predictions[b.key])

  if (!hero || !villain) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Range distribution data missing.</p>
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {!revealed && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
          <p className="text-center text-xs font-semibold text-foreground">
            Predict: for each bucket, which side has more of it?
          </p>
          {BUCKETS.map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold w-16 shrink-0">{b.label}</span>
              <div className="flex gap-1.5 flex-1">
                {(['hero', 'equal', 'villain'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => predict(b.key, side)}
                    className={cn(
                      'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition-all',
                      predictions[b.key] === side
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                        : 'border-border/40 bg-secondary/30 text-muted-foreground/60 hover:text-muted-foreground',
                    )}
                  >
                    {side === 'hero' ? hero.label : side === 'villain' ? villain.label : 'About Equal'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={!allPredicted}
            onClick={() => setRevealed(true)}
            className={cn(
              'w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all',
              allPredicted
                ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5'
                : 'opacity-40 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground',
            )}
          >
            Reveal the actual distributions
          </button>
        </div>
      )}

      {revealed && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
          <DistributionBar label={hero.label} dist={hero} />
          <DistributionBar label={villain.label} dist={villain} />

          {mode === 'predict' && (
            <div className="pt-2 border-t border-border/20 space-y-1">
              {BUCKETS.map((b) => {
                const heroMore = hero[b.key] > villain[b.key]
                const villainMore = villain[b.key] > hero[b.key]
                const actual = heroMore ? 'hero' : villainMore ? 'villain' : 'equal'
                const correct = predictions[b.key] === actual
                return (
                  <p key={b.key} className={cn('text-[10px]', correct ? 'text-emerald-400/80' : 'text-amber-400/80')}>
                    {b.label}: you said {predictions[b.key] === 'hero' ? hero.label : predictions[b.key] === 'villain' ? villain.label : 'about equal'}
                    {' — '}{correct ? 'correct' : `actually ${actual === 'hero' ? hero.label : actual === 'villain' ? villain.label : 'about equal'}`}
                  </p>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-4 text-[9px] text-muted-foreground/40 pt-2 border-t border-border/20">
            {BUCKETS.map((b) => (
              <div key={b.key} className="flex items-center gap-1">
                <div className={cn('h-2 w-2 rounded-[2px]', b.color)} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[9px] text-muted-foreground/30">
            Illustrative reference distributions, not solver-exact outputs.
          </p>
        </div>
      )}

      {revealed && step.range_distribution_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.range_distribution_prompt}</p>
      )}

      {revealed && options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                    : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {revealed && options.length === 0 && (
        <button
          type="button"
          disabled={disabled || selected !== null}
          onClick={() => handleSelect('__continue__')}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            selected !== null || disabled
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          Continue
        </button>
      )}
    </div>
  )
}
