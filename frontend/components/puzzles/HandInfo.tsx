'use client'

import { formatBb } from '@/components/poker/tableTokens'
import { cn } from '@/lib/utils'
import { STREET_LABEL, type InteractivePuzzle, type PuzzleDecision } from '@/lib/puzzles/interactive/types'

/**
 * The money panel.
 *
 * This is where every bb figure lives, and it exists because the action buttons
 * must not carry amounts. The distinction it is built to keep visible is the one
 * that silently breaks most poker UIs: a villain who raises TO 2.5bb has not
 * made the big blind's call 2.5bb — the blind is already in for 1 and owes 1.5.
 * So "Raise to" and "To call" are separate, separately-labelled rows, never
 * collapsed into one number.
 */
export function HandInfo({
  puzzle,
  decision,
  className,
}: {
  puzzle: InteractivePuzzle
  decision: PuzzleDecision
  className?: string
}) {
  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Street', value: STREET_LABEL[decision.street] },
    { label: 'Pot', value: `${formatBb(decision.potBb)} bb`, accent: true },
    { label: 'Effective stack', value: `${formatBb(decision.effectiveStackBb)} bb` },
  ]

  if (decision.facingBetBb !== undefined) {
    rows.push({
      label: decision.street === 'preflop' ? 'Villain raised to' : 'Villain bet',
      value: `${formatBb(decision.facingBetBb)} bb`,
    })
  }
  if (decision.heroInvestedBb !== undefined && decision.heroInvestedBb > 0) {
    rows.push({ label: 'You already in', value: `${formatBb(decision.heroInvestedBb)} bb` })
  }
  if (decision.toCallBb !== undefined) {
    rows.push({
      label: 'To call',
      value: decision.toCallBb === 0 ? 'Nothing — you may check' : `${formatBb(decision.toCallBb)} bb`,
      accent: true,
    })
  }

  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/[0.02] p-4', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">Hand info</p>

      <dl className="mt-3 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[12px] text-slate-400">Seats</dt>
          <dd className="font-mono text-[12px] font-bold text-white">
            {/* Per-decision villain wins over the setup's: a puzzle may vary the
                opener between decisions while holding everything else fixed. */}
            {puzzle.setup.heroSeat} vs {decision.villainSeat ?? puzzle.setup.villainSeat}
          </dd>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[12px] text-slate-400">{row.label}</dt>
            <dd
              className={cn(
                'shrink-0 font-mono text-[12px] font-bold tabular-nums',
                row.accent ? 'text-violet-300' : 'text-white'
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {puzzle.setup.gameNotes && (
        <p className="mt-3 border-t border-white/[0.07] pt-2.5 text-[11px] leading-relaxed text-slate-600">
          {puzzle.setup.gameNotes}
        </p>
      )}
    </div>
  )
}
