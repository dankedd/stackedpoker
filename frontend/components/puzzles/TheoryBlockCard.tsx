'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SourceChips, UnsourcedPanel } from './SourceChip'
import { StatExhibitCard } from './StatExhibitCard'
import type { TheoryBlock } from '@/lib/puzzles/interactive/types'

/**
 * One theory card, collapsible, open by default.
 *
 * Reading order inside is fixed and matches the order the argument is actually
 * built in the source: prose that frames the question, then the figures, then
 * the individual claims, then the gaps. Each bullet carries its own citation
 * rather than the card carrying one for all of them, because these cards pull
 * from several different tables and a single card-level footnote would let a
 * claim borrow authority from a neighbouring claim's source.
 */
export function TheoryBlockCard({ block }: { block: TheoryBlock }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="text-[14px] font-bold text-white">{block.title}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', !open && '-rotate-90')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/[0.07] px-4 py-4">
          <p className="text-[13px] leading-relaxed text-slate-300">{block.body}</p>

          {block.exhibit && <StatExhibitCard exhibit={block.exhibit} />}

          {block.bullets && block.bullets.length > 0 && (
            <ul className="space-y-3">
              {block.bullets.map((bullet, i) => (
                <li key={i} className="border-l-2 border-violet-500/25 pl-3">
                  <p className="text-[13px] leading-relaxed text-slate-300">{bullet.text}</p>
                  <SourceChips ids={bullet.sources} />
                </li>
              ))}
            </ul>
          )}

          {block.unsourced && <UnsourcedPanel notes={block.unsourced} />}
        </div>
      )}
    </div>
  )
}
