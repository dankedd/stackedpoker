'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep, ScenarioNode, ActionQuality } from '@/lib/learn/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function qualityColor(q: ActionQuality): string {
  switch (q) {
    case 'perfect':    return 'text-emerald-400'
    case 'good':       return 'text-blue-400'
    case 'acceptable': return 'text-amber-400'
    case 'mistake':    return 'text-orange-400'
    case 'punt':       return 'text-rose-400'
  }
}

function qualityBorder(q: ActionQuality): string {
  switch (q) {
    case 'perfect':    return 'border-emerald-500/40 bg-emerald-500/8'
    case 'good':       return 'border-blue-500/40 bg-blue-500/8'
    case 'acceptable': return 'border-amber-500/40 bg-amber-500/8'
    case 'mistake':    return 'border-orange-500/40 bg-orange-500/8'
    case 'punt':       return 'border-rose-500/40 bg-rose-500/8'
  }
}

function qualityLabel(q: ActionQuality): string {
  switch (q) {
    case 'perfect':    return 'Optimal Line'
    case 'good':       return 'Good Play'
    case 'acceptable': return 'Acceptable'
    case 'mistake':    return 'Mistake'
    case 'punt':       return 'Major Leak'
  }
}

function EvBadge({ ev }: { ev: number }) {
  if (ev > 0) return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
      <TrendingUp className="h-3.5 w-3.5" />
      +{ev.toFixed(1)} bb
    </span>
  )
  if (ev < 0) return (
    <span className="flex items-center gap-1 text-rose-400 text-xs font-bold">
      <TrendingDown className="h-3.5 w-3.5" />
      {ev.toFixed(1)} bb
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-muted-foreground/50 text-xs font-bold">
      <Minus className="h-3.5 w-3.5" />
      0 bb
    </span>
  )
}

// ── Breadcrumb trail ──────────────────────────────────────────────────────────

interface BreadcrumbProps {
  trail: string[]
  onReset: () => void
}

function BreadcrumbTrail({ trail, onReset }: BreadcrumbProps) {
  if (trail.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-violet-400 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>
      <span className="text-muted-foreground/20">·</span>
      {trail.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border',
            i === trail.length - 1
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-400/80 font-semibold'
              : 'border-border/20 text-muted-foreground/30',
          )}>
            {label}
          </span>
          {i < trail.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/20 shrink-0" />
          )}
        </span>
      ))}
    </div>
  )
}

// ── Option button ─────────────────────────────────────────────────────────────

interface OptionButtonProps {
  label: string
  onClick: () => void
}

function OptionButton({ label, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full flex items-center justify-between gap-3',
        'rounded-xl border border-border/40 bg-secondary/30 px-4 py-3.5',
        'text-sm font-medium text-foreground',
        'hover:border-violet-500/40 hover:bg-violet-500/8 hover:text-violet-200',
        'active:scale-[0.98] transition-all duration-150 overflow-hidden text-left',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
      />
      <span className="relative">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-violet-400 transition-colors" />
    </button>
  )
}

// ── Outcome card ──────────────────────────────────────────────────────────────

interface OutcomeCardProps {
  node: ScenarioNode
  trail: string[]
  onContinue: (quality: ActionQuality, ev: number) => void
}

function OutcomeCard({ node, trail, onContinue }: OutcomeCardProps) {
  const outcome = node.outcome!
  return (
    <div className={cn(
      'rounded-2xl border p-5 space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-200',
      qualityBorder(outcome.quality),
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-xs font-semibold uppercase tracking-wider mb-0.5', qualityColor(outcome.quality))}>
            {qualityLabel(outcome.quality)}
          </p>
          <p className="font-bold text-foreground">{outcome.label}</p>
        </div>
        <EvBadge ev={outcome.ev_bb} />
      </div>

      <p className="text-sm text-muted-foreground/80 leading-relaxed">
        {outcome.explanation}
      </p>

      {/* Path taken */}
      <div className="pt-2 border-t border-border/20">
        <p className="text-[10px] text-muted-foreground/40 mb-2">Your line:</p>
        <div className="flex items-center gap-1 flex-wrap">
          {trail.map((step, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/20" />}
              {step}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onContinue(outcome.quality, outcome.ev_bb)}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2',
          'rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 overflow-hidden',
          'bg-gradient-to-r from-violet-600 to-blue-500 text-white',
          'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        Continue
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  )
}

// ── Main ScenarioTree component ───────────────────────────────────────────────

interface ScenarioTreeProps {
  step: LessonStep
  onAnswer: (quality: ActionQuality, timeMs: number) => void
  disabled?: boolean
}

export function ScenarioTree({ step, onAnswer, disabled = false }: ScenarioTreeProps) {
  const mountTime = useRef(Date.now())
  const [currentNodeId, setCurrentNodeId] = useState<string>(step.scenario_root ?? '')
  const [trail, setTrail] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setCurrentNodeId(step.scenario_root ?? '')
    setTrail([])
    setDone(false)
  }, [step.id, step.scenario_root])

  const nodeMap = Object.fromEntries(
    (step.scenario_nodes ?? []).map((n) => [n.id, n]),
  ) as Record<string, ScenarioNode>

  const currentNode = nodeMap[currentNodeId]

  function handleOptionClick(childNodeId: string, optionLabel: string) {
    if (disabled || done) return
    setTrail((prev) => [...prev, optionLabel])
    setCurrentNodeId(childNodeId)
  }

  function handleReset() {
    if (done) return
    setCurrentNodeId(step.scenario_root ?? '')
    setTrail([])
  }

  function handleContinue(quality: ActionQuality, _ev: number) {
    setDone(true)
    // Map quality to a score to feed through the standard evaluator
    const elapsed = Date.now() - mountTime.current
    // We pass quality string directly; the backend step evaluator already handles ActionQuality
    onAnswer(quality, elapsed)
  }

  if (!currentNode) {
    return (
      <div className="text-center text-sm text-muted-foreground/40 py-8">
        Scenario data missing — check curriculum definition.
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Trail */}
      <BreadcrumbTrail trail={trail} onReset={handleReset} />

      {/* Current node card */}
      {currentNode.outcome ? (
        <OutcomeCard node={currentNode} trail={trail} onContinue={handleContinue} />
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4 animate-in fade-in duration-200">
          {/* Node label + description */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60 mb-1">
              {trail.length === 0 ? 'Starting Position' : 'Situation'}
            </p>
            <p className="font-semibold text-foreground">{currentNode.label}</p>
            {currentNode.description && (
              <p className="text-sm text-muted-foreground/70 mt-1.5 leading-relaxed">
                {currentNode.description}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

          {/* Options */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">
              Choose your action
            </p>
            <div className="space-y-2">
              {(currentNode.children ?? []).map((child) => (
                <OptionButton
                  key={child.node_id}
                  label={child.option_label}
                  onClick={() => handleOptionClick(child.node_id, child.option_label)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
