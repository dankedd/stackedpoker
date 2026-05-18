'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

// ── Grid setup (same layout as RangeBuild) ────────────────────────────────────

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

function buildHandGrid(): string[][] {
  return RANKS.map((r1, row) =>
    RANKS.map((r2, col) => {
      if (row === col) return r1 + r1
      if (row < col) return r1 + r2 + 's'
      return r2 + r1 + 'o'
    }),
  )
}

const HAND_GRID = buildHandGrid()

function comboCount(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6
}

const TOTAL_COMBOS = 1326

// ── Colour scale: equity → hue (0 = red, 120 = green) ────────────────────────

function equityToColor(equity: number): string {
  // equity: 0–100 → interpolate red → amber → green
  const clamped = Math.max(0, Math.min(100, equity))
  if (clamped < 33) {
    const t = clamped / 33
    return `rgba(239,68,68,${0.15 + t * 0.25})`  // red zone
  }
  if (clamped < 60) {
    const t = (clamped - 33) / 27
    return `rgba(245,158,11,${0.15 + t * 0.3})`  // amber zone
  }
  const t = (clamped - 60) / 40
  return `rgba(16,185,129,${0.2 + t * 0.45})`    // green zone
}

function equityTextColor(equity: number): string {
  if (equity >= 60) return 'text-emerald-300'
  if (equity >= 40) return 'text-amber-300'
  if (equity >= 20) return 'text-orange-300'
  return 'text-rose-300'
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipInfo {
  hand: string
  equity: number | null
  inTarget: boolean
  x: number
  y: number
}

// ── Main component ────────────────────────────────────────────────────────────

interface RangeHeatmapProps {
  step: LessonStep
  /** For identify mode: user clicks cells to mark them, then submits */
  onAnswer: (hands: string[], timeMs: number) => void
  disabled?: boolean
}

export function RangeHeatmap({ step, onAnswer, disabled = false }: RangeHeatmapProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add')
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(new Set())
    setSubmitted(false)
  }, [step.id])

  const heatmapData = step.range_heatmap_data ?? {}
  const targetHands = new Set(step.range_heatmap_target ?? [])
  const isIdentifyMode = targetHands.size > 0

  const toggleHand = useCallback(
    (hand: string, mode?: 'add' | 'remove') => {
      if (disabled || submitted || !isIdentifyMode) return
      setSelected((prev) => {
        const next = new Set(prev)
        const effectiveMode = mode ?? (next.has(hand) ? 'remove' : 'add')
        if (effectiveMode === 'add') next.add(hand)
        else next.delete(hand)
        return next
      })
    },
    [disabled, submitted, isIdentifyMode],
  )

  function handleMouseDown(hand: string) {
    if (disabled || submitted || !isIdentifyMode) return
    const mode = selected.has(hand) ? 'remove' : 'add'
    setDragMode(mode)
    setIsDragging(true)
    toggleHand(hand, mode)
  }

  function handleMouseEnter(hand: string, e: React.MouseEvent) {
    if (isDragging && isIdentifyMode) toggleHand(hand, dragMode)
    // Show tooltip
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({
        hand,
        equity: heatmapData[hand] ?? null,
        inTarget: targetHands.has(hand),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  function handleMouseLeave() {
    setTooltip(null)
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current
    onAnswer(Array.from(selected), elapsed)
  }

  const selectedCombos = Array.from(selected).reduce((s, h) => s + comboCount(h), 0)
  const pctSelected = ((selectedCombos / TOTAL_COMBOS) * 100).toFixed(1)

  // Legend: what equity values mean
  const equityValues = Object.values(heatmapData)
  const hasHeatmap = equityValues.length > 0
  const avgEquity =
    equityValues.length > 0
      ? equityValues.reduce((a, b) => a + b, 0) / equityValues.length
      : 0

  return (
    <div
      ref={containerRef}
      className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative"
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { handleMouseUp(); setTooltip(null) }}
    >
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Hint */}
      {step.range_hint && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <p className="text-xs text-violet-400/80">{step.range_hint}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isIdentifyMode && (
            <>
              <span className="text-sm font-bold text-violet-400">
                {selectedCombos}{' '}
                <span className="text-muted-foreground/50 font-normal text-xs">combos</span>
              </span>
              <span className="text-sm font-bold text-amber-400">
                {pctSelected}
                <span className="text-muted-foreground/50 font-normal text-xs">%</span>
              </span>
            </>
          )}
          {hasHeatmap && (
            <span className="text-sm font-bold text-emerald-400">
              avg {avgEquity.toFixed(0)}%{' '}
              <span className="text-muted-foreground/50 font-normal text-xs">equity</span>
            </span>
          )}
        </div>
        {isIdentifyMode && !submitted && !disabled && selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex ml-7 mb-0.5">
            {RANKS.map((r) => (
              <div
                key={r}
                className="flex-1 min-w-0 text-center text-[9px] font-bold text-muted-foreground/40 leading-none"
              >
                {r}
              </div>
            ))}
          </div>

          {/* Rows */}
          {HAND_GRID.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center">
              <div className="w-7 text-[9px] font-bold text-muted-foreground/40 text-center shrink-0">
                {RANKS[rowIdx]}
              </div>
              {row.map((hand, colIdx) => {
                const isSelected = selected.has(hand)
                const equity = heatmapData[hand] ?? null
                const inTarget = targetHands.has(hand)
                const isPair = rowIdx === colIdx
                const isSuited = rowIdx < colIdx

                // Background: equity heatmap or selection
                let bgStyle: React.CSSProperties = {}
                if (equity !== null && !isSelected) {
                  bgStyle = { backgroundColor: equityToColor(equity) }
                }

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'm-px rounded-[3px] select-none transition-all duration-100',
                      'text-[8px] font-bold leading-none',
                      // Selection state (identify mode)
                      isIdentifyMode && isSelected
                        ? inTarget
                          ? 'bg-emerald-500/70 text-white ring-1 ring-emerald-400/60'
                          : 'bg-violet-500/60 text-white'
                        : '',
                      // Non-selected in identify mode — show subtle background
                      isIdentifyMode && !isSelected && equity === null
                        ? isPair
                          ? 'bg-secondary/70 text-muted-foreground/60'
                          : isSuited
                          ? 'bg-secondary/50 text-muted-foreground/40'
                          : 'bg-secondary/30 text-muted-foreground/30'
                        : '',
                      // Heatmap text color
                      !isSelected && equity !== null
                        ? equityTextColor(equity)
                        : '',
                      // Hover / interactive
                      isIdentifyMode && !disabled && !submitted
                        ? 'cursor-pointer hover:ring-1 hover:ring-violet-500/40'
                        : equity !== null
                        ? 'cursor-default'
                        : 'cursor-default',
                      (disabled || submitted) && 'pointer-events-none',
                    )}
                    style={bgStyle}
                    onMouseDown={() => handleMouseDown(hand)}
                    onMouseEnter={(e) => handleMouseEnter(hand, e)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <span className="truncate px-0.5">{hand}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border/60 bg-card/90 backdrop-blur-sm px-2.5 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 10, (containerRef.current?.clientWidth ?? 400) - 120),
            top: tooltip.y - 50,
          }}
        >
          <p className="font-bold text-foreground">{tooltip.hand}</p>
          {tooltip.equity !== null && (
            <p className={equityTextColor(tooltip.equity)}>Equity: {tooltip.equity}%</p>
          )}
          {isIdentifyMode && (
            <p className={tooltip.inTarget ? 'text-emerald-400' : 'text-rose-400/70'}>
              {tooltip.inTarget ? 'In target range' : 'Not in target'}
            </p>
          )}
        </div>
      )}

      {/* Colour legend (heatmap mode) */}
      {hasHeatmap && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
          <span>Equity density:</span>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-8 rounded-sm bg-gradient-to-r from-rose-500/60 via-amber-500/60 to-emerald-500/60" />
            <span>Low → High</span>
          </div>
        </div>
      )}

      {/* Identify mode legend */}
      {isIdentifyMode && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/40">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500/60" />
            <span>Selected (incorrect)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500/70" />
            <span>Selected (correct)</span>
          </div>
        </div>
      )}

      {/* Submit */}
      {isIdentifyMode && (
        <button
          type="button"
          disabled={disabled || submitted || selected.size === 0}
          onClick={handleSubmit}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2',
            'rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            submitted || disabled || selected.size === 0
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          {!(submitted || disabled || selected.size === 0) && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
          )}
          {submitted
            ? 'Submitted'
            : selected.size === 0
            ? 'Click hands to identify the range'
            : `Submit selection (${selectedCombos} combos)`}
        </button>
      )}
    </div>
  )
}
