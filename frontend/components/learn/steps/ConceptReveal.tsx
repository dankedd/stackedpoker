'use client'

import { useState } from 'react'
import { BookOpen, ChevronRight, FlaskConical, Lightbulb, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { CONCEPT_DATA } from '@/components/learn/ConceptPopover'
import { EquityBar } from '@/components/learn/visuals/EquityBar'
import { FoldFreqBar } from '@/components/learn/visuals/PressureGauge'
import { NutAdvantageMeter } from '@/components/learn/visuals/NutAdvantageMeter'

// ── Visual type renderers ─────────────────────────────────────────────────────

function EquityBarVisual({ conceptId }: { conceptId?: string }) {
  // Show a contextual equity bar for pot_odds / equity_real concepts
  const examples = [
    { hero: 36, label: '36% — Flush draw (open-ender)' },
    { hero: 50, label: '50% — Pair vs. pair' },
    { hero: 78, label: '78% — Overpair vs. two overcards' },
  ]
  const [idx, setIdx] = useState(0)
  const ex = examples[idx]

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
        Interactive: equity split
      </p>
      <EquityBar heroEquity={ex.hero} animate size="md" />
      <p className="text-xs text-muted-foreground/60 text-center">{ex.label}</p>
      <div className="flex justify-center gap-2">
        {examples.map((e, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={cn(
              'rounded-full px-3 py-1 text-[10px] font-semibold border transition-all',
              idx === i
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                : 'border-border/30 bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
            )}
          >
            {e.hero}%
          </button>
        ))}
      </div>
    </div>
  )
}

function MdfVisual() {
  const [foldFreq, setFoldFreq] = useState(40)
  const mdf = 67

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
        Interactive: adjust fold frequency
      </p>
      <FoldFreqBar foldFreq={foldFreq} mdf={mdf} />
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={foldFreq}
          onChange={e => setFoldFreq(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
        <p className={cn(
          'text-xs text-center font-semibold',
          foldFreq > (100 - mdf) ? 'text-red-400' : foldFreq < (100 - mdf - 10) ? 'text-amber-400' : 'text-emerald-400'
        )}>
          {foldFreq > (100 - mdf)
            ? 'You are over-folding! Villain can bluff any two cards profitably.'
            : foldFreq < (100 - mdf - 10)
            ? 'You are under-folding — villain should stop bluffing.'
            : 'Defense frequency is close to optimal.'}
        </p>
      </div>
    </div>
  )
}

function NutAdvantageVisual() {
  const scenarios = [
    { board: 'A♠7♦2♣ (rainbow)', adv: 55 },
    { board: 'T♥9♥8♠ (connected)', adv: -15 },
    { board: 'K♠Q♦J♣ (broadway)', adv: 10 },
  ]
  const [idx, setIdx] = useState(0)

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
        Interactive: board nut advantage
      </p>
      <NutAdvantageMeter advantage={scenarios[idx].adv} animate showInterpretation />
      <div className="flex flex-wrap justify-center gap-2">
        {scenarios.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all',
              idx === i
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                : 'border-border/30 bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
            )}
          >
            {s.board}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Visual type dispatch ──────────────────────────────────────────────────────

function VisualSection({
  visualType,
  conceptId,
}: {
  visualType?: string
  conceptId?: string
}) {
  if (visualType === 'equity_bar') return <EquityBarVisual conceptId={conceptId} />
  if (visualType === 'mdf_bar' || conceptId === 'mdf' || conceptId === 'alpha') return <MdfVisual />
  if (visualType === 'nut_advantage' || conceptId === 'nut_advantage') return <NutAdvantageVisual />
  return null
}

// ── Concept data lookup ───────────────────────────────────────────────────────

function ConceptEnrichment({ conceptId }: { conceptId: string }) {
  const entry = CONCEPT_DATA[conceptId]
  if (!entry) return null

  const hasFormula = !!(entry as typeof entry & { formula?: string }).formula
  const formula = (entry as typeof entry & { formula?: string }).formula
  const example = (entry as typeof entry & { example?: string }).example

  return (
    <div className="space-y-3">
      {/* Formula */}
      {hasFormula && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-3.5 w-3.5 text-violet-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400/70">Formula</p>
          </div>
          <code className="text-sm font-mono text-violet-100/90 leading-relaxed block">{formula}</code>
        </div>
      )}

      {/* Example */}
      {example && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/6 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">Example</p>
          </div>
          <p className="text-sm text-amber-200/80 leading-relaxed">{example}</p>
        </div>
      )}

      {/* Related */}
      {entry.related && entry.related.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
            Related:
          </span>
          {entry.related.slice(0, 4).map(rel => {
            const relEntry = CONCEPT_DATA[rel]
            return (
              <span
                key={rel}
                className="inline-flex items-center gap-0.5 rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 text-[10px] font-semibold text-violet-400/70"
              >
                {relEntry?.title ?? rel.replace(/_/g, ' ')}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ConceptReveal ─────────────────────────────────────────────────────────────

interface ConceptRevealProps {
  step: LessonStep
  onComplete: () => void
}

export function ConceptReveal({ step, onComplete }: ConceptRevealProps) {
  const [enriched, setEnriched] = useState(false)
  const primaryConceptId = step.concept_ids?.[0]

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Glow card */}
      <div
        className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-card/60 to-blue-600/5 p-6 relative overflow-hidden"
        style={{
          boxShadow: '0 0 40px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Ambient glow orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full bg-violet-500/12 blur-2xl"
        />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 shrink-0">
            <BookOpen className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60 mb-0.5">
              Concept
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              {step.concept_title ?? 'Key Concept'}
            </h2>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent mb-5" />

        {/* Content */}
        {step.concept_content ? (
          <div className="space-y-3 mb-5">
            {step.concept_content
              .split(/\n+/)
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {para}
                </p>
              ))}
          </div>
        ) : step.narrative ? (
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{step.narrative}</p>
        ) : null}

        {/* Interactive visual for this concept's visual type */}
        {step.visual && (
          <div className="mb-5 rounded-xl border border-border/30 bg-secondary/20 p-4">
            <VisualSection visualType={step.visual} conceptId={primaryConceptId} />
          </div>
        )}

        {/* Formula / enrichment toggle */}
        {primaryConceptId && CONCEPT_DATA[primaryConceptId] && (
          <>
            {!enriched ? (
              <button
                type="button"
                onClick={() => setEnriched(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400/70 hover:text-violet-300 transition-colors"
              >
                <FlaskConical className="h-3 w-3" />
                Show formula & example
              </button>
            ) : (
              <ConceptEnrichment conceptId={primaryConceptId} />
            )}
          </>
        )}

        {/* Concept tags */}
        {step.concept_ids && step.concept_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-border/20">
            {step.concept_ids.map(id => (
              <span
                key={id}
                className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/8 text-violet-400/70 font-medium"
              >
                {id.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Got it button */}
      <button
        type="button"
        onClick={onComplete}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2.5',
          'rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5',
          'text-sm font-semibold text-white',
          'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
          'hover:-translate-y-0.5 transition-all duration-200 overflow-hidden'
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        Got it
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  )
}
