'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CONCEPT_DATA, type ConceptEntry } from './ConceptPopover'

// ── Mastery level display ─────────────────────────────────────────────────────

const MASTERY_LABELS = ['Unseen', 'Exposed', 'Learning', 'Familiar', 'Proficient', 'Mastered']

const MASTERY_COLORS: Record<number, { ring: string; bg: string; text: string; glow: string }> = {
  0: { ring: 'border-white/10',        bg: 'bg-white/[0.03]',     text: 'text-white/20',      glow: '' },
  1: { ring: 'border-slate-500/40',    bg: 'bg-slate-500/10',     text: 'text-slate-400',     glow: '' },
  2: { ring: 'border-amber-500/40',    bg: 'bg-amber-500/10',     text: 'text-amber-400',     glow: '' },
  3: { ring: 'border-blue-500/40',     bg: 'bg-blue-500/10',      text: 'text-blue-400',      glow: 'shadow-blue-900/30' },
  4: { ring: 'border-violet-500/50',   bg: 'bg-violet-500/15',    text: 'text-violet-300',    glow: 'shadow-violet-900/40' },
  5: { ring: 'border-emerald-400/60',  bg: 'bg-emerald-500/15',   text: 'text-emerald-300',   glow: 'shadow-emerald-900/40' },
}

const DOMAIN_ICON: Record<string, string> = {
  math: '∑',
  game_theory: 'G',
  fundamentals: '◉',
  strategy: '▲',
  ranges: '⊞',
  postflop: '◆',
  advanced: '★',
  tournament: 'T',
}

// ── Node component ────────────────────────────────────────────────────────────

interface ConceptNodeProps {
  entry: ConceptEntry
  masteryLevel: number
  isSelected: boolean
  onClick: () => void
}

function ConceptNode({ entry, masteryLevel, isSelected, onClick }: ConceptNodeProps) {
  const level = Math.max(0, Math.min(5, masteryLevel))
  const cls = MASTERY_COLORS[level]
  const icon = DOMAIN_ICON[entry.domain] ?? '●'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 rounded-2xl border p-3',
        'text-center transition-all duration-200 cursor-pointer select-none',
        'hover:scale-105 active:scale-95',
        isSelected ? 'scale-105 shadow-lg' : '',
        cls.ring, cls.bg,
        cls.glow ? `shadow-lg ${cls.glow}` : '',
      )}
      style={{ minWidth: 80, minHeight: 72 }}
    >
      {/* Domain icon */}
      <span className={cn('text-lg font-black leading-none', cls.text)}>
        {icon}
      </span>

      {/* Title */}
      <span className={cn('text-[9px] font-bold leading-tight line-clamp-2', cls.text)}>
        {entry.title}
      </span>

      {/* Mastery level dots */}
      <div className="flex gap-0.5 mt-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={cn(
              'h-1 w-1 rounded-full transition-all',
              i <= level ? cls.text.replace('text-', 'bg-') : 'bg-white/10'
            )}
          />
        ))}
      </div>

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/60 pointer-events-none" />
      )}
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  entry: ConceptEntry
  masteryLevel: number
  onClose: () => void
}

function DetailPanel({ entry, masteryLevel, onClose }: DetailPanelProps) {
  const level = Math.max(0, Math.min(5, masteryLevel))
  const cls = MASTERY_COLORS[level]

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-5 space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', cls.text)}>
            {entry.domain.replace(/_/g, ' ')} · {MASTERY_LABELS[level]}
          </p>
          <h3 className="text-base font-bold text-foreground">{entry.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground/40 hover:text-foreground text-sm transition-colors shrink-0 mt-0.5"
        >
          ✕
        </button>
      </div>

      {/* Mastery bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground/40">Mastery</span>
          <span className={cls.text}>{MASTERY_LABELS[level]}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-300',
                i <= level
                  ? cls.bg.replace('bg-', 'bg-').replace('/10', '/60').replace('/15', '/70')
                  : 'bg-white/[0.05]'
              )}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground leading-relaxed">{entry.summary}</p>

      {/* Formula */}
      {(CONCEPT_DATA[entry.id] as ConceptEntry & { formula?: string })?.formula && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400/60 mb-1">Formula</p>
          <code className="text-xs font-mono text-violet-200/90">
            {(CONCEPT_DATA[entry.id] as ConceptEntry & { formula?: string })?.formula}
          </code>
        </div>
      )}
    </div>
  )
}

// ── Domain section ────────────────────────────────────────────────────────────

const DOMAIN_ORDER = ['fundamentals', 'math', 'strategy', 'ranges', 'postflop', 'game_theory', 'advanced', 'tournament']
const DOMAIN_LABEL: Record<string, string> = {
  math: 'Math',
  game_theory: 'Game Theory',
  fundamentals: 'Fundamentals',
  strategy: 'Strategy',
  ranges: 'Range Play',
  postflop: 'Postflop',
  advanced: 'Advanced',
  tournament: 'Tournament',
}

// ── Main MasteryMap ───────────────────────────────────────────────────────────

interface MasteryMapProps {
  /** Map of concept_id → mastery level (0–5) */
  masteryData?: Record<string, number>
  className?: string
  compact?: boolean
}

export function MasteryMap({ masteryData = {}, className, compact = false }: MasteryMapProps) {
  const [selected, setSelected] = useState<string | null>(null)

  // Group concepts by domain
  const byDomain: Record<string, ConceptEntry[]> = {}
  for (const entry of Object.values(CONCEPT_DATA)) {
    if (!byDomain[entry.domain]) byDomain[entry.domain] = []
    byDomain[entry.domain].push(entry)
  }

  const totalConcepts = Object.values(CONCEPT_DATA).length
  const masteredCount = Object.values(masteryData).filter(v => v >= 5).length
  const learningCount = Object.values(masteryData).filter(v => v >= 2 && v < 5).length
  const avgMastery = totalConcepts > 0
    ? Object.values(CONCEPT_DATA).reduce((sum, e) => sum + (masteryData[e.id] ?? 0), 0) / totalConcepts
    : 0

  const selectedEntry = selected ? CONCEPT_DATA[selected] : null

  return (
    <div className={cn('space-y-5', className)}>
      {/* Stats row */}
      {!compact && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3 text-center">
            <p className="text-2xl font-black text-emerald-300">{masteredCount}</p>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Mastered</p>
          </div>
          <div className="flex-1 rounded-xl border border-blue-500/20 bg-blue-500/8 p-3 text-center">
            <p className="text-2xl font-black text-blue-300">{learningCount}</p>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Learning</p>
          </div>
          <div className="flex-1 rounded-xl border border-border/40 bg-card/60 p-3 text-center">
            <p className="text-2xl font-black text-foreground">{totalConcepts}</p>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Total</p>
          </div>
          <div className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 p-3 text-center">
            <p className="text-2xl font-black text-violet-300">{avgMastery.toFixed(1)}</p>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Avg Level</p>
          </div>
        </div>
      )}

      <div className={cn('grid gap-5', selectedEntry ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
        {/* Concept grid */}
        <div className="space-y-4">
          {DOMAIN_ORDER.filter(d => byDomain[d]?.length).map(domain => (
            <div key={domain}>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/30 mb-2">
                {DOMAIN_LABEL[domain] ?? domain}
              </p>
              <div className={cn('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5')}>
                {byDomain[domain].map(entry => (
                  <ConceptNode
                    key={entry.id}
                    entry={entry}
                    masteryLevel={masteryData[entry.id] ?? 0}
                    isSelected={selected === entry.id}
                    onClick={() => setSelected(s => s === entry.id ? null : entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedEntry && (
          <div className="lg:sticky lg:top-4 self-start">
            <DetailPanel
              entry={selectedEntry}
              masteryLevel={masteryData[selectedEntry.id] ?? 0}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-border/20">
          {[0, 1, 2, 3, 4, 5].map(level => {
            const cls = MASTERY_COLORS[level]
            return (
              <div key={level} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded-full border', cls.ring, cls.bg)} />
                <span className={cn('text-[10px] font-semibold', cls.text)}>
                  {MASTERY_LABELS[level]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
