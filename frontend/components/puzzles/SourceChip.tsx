'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DERIVATION_LABEL, citation, derivationNote, source } from '@/lib/puzzles/interactive/sources'
import type { SourceId, UnsourcedNote } from '@/lib/puzzles/interactive/types'

/**
 * Attribution UI.
 *
 * `SourceChips` is deliberately expandable rather than a bare footnote marker:
 * the thing a learner most needs to see is not that a citation exists but what
 * it covers — a frequency measured in a BB vs UTG simulation is a different
 * claim from the same number measured against a button. So the expanded state
 * leads with `scope`, then the derivation, then the page.
 *
 * `UnsourcedPanel` is its counterpart and is styled to be at least as visible.
 * "The book does not answer this" is content here, not an apology.
 */

export function SourceChips({ ids, className }: { ids: SourceId[]; className?: string }) {
  const [open, setOpen] = useState(false)
  if (ids.length === 0) return null

  return (
    <div className={cn('mt-2', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-violet-300"
      >
        <BookOpen className="h-3 w-3 shrink-0" aria-hidden />
        {ids.length === 1 ? 'Source' : `${ids.length} sources`}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <ul className="mt-1.5 space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
          {ids.map((id) => {
            const ref = source(id)
            return (
              <li key={id} className="text-[11px] leading-relaxed">
                <p className="font-semibold text-slate-200">{citation(ref)}</p>
                <p className="mt-1 text-slate-400">
                  <span className="font-semibold text-slate-300">Covers: </span>
                  {ref.scope}
                </p>
                {ref.quote && (
                  <p className="mt-1 border-l-2 border-violet-500/30 pl-2 italic text-slate-400">“{ref.quote}”</p>
                )}
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                  {DERIVATION_LABEL[ref.derivation]} — {derivationNote(ref.derivation)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function UnsourcedPanel({ notes, className }: { notes: UnsourcedNote[]; className?: string }) {
  if (notes.length === 0) return null

  return (
    <div className={cn('space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4', className)}>
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        What the source does not say
      </p>
      {notes.map((note) => (
        <div key={note.question}>
          <p className="text-[13px] font-semibold text-amber-100/90">{note.question}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{note.answer}</p>
          {note.nearestSources && note.nearestSources.length > 0 && (
            <SourceChips ids={note.nearestSources} />
          )}
        </div>
      ))}
    </div>
  )
}
