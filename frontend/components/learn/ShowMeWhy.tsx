'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ShowMeWhyLayer {
  title: string
  body: string
}

interface ShowMeWhyProps {
  layers: ShowMeWhyLayer[]
  className?: string
  /** Custom trigger label — defaults to "Show me why". */
  triggerLabel?: string
}

/**
 * Reusable progressive-disclosure stepper — collapsed behind a "Show me why" trigger,
 * then reveals one layer at a time (Preflop Ranges -> Board Interaction -> Strong-Hand
 * Density -> Equity Distribution -> Strategic Consequence, per Module 8's design, though
 * any ordered set of layers works). Never dumps the full explanation as one paragraph —
 * the layer-by-layer reveal IS the pedagogy. Back/forward are plain <button>s (keyboard
 * accessible via Tab + Enter/Space with no extra wiring); motion is a simple opacity/
 * translate fade that respects `prefers-reduced-motion` via Tailwind's motion-safe variant.
 */
export function ShowMeWhy({ layers, className, triggerLabel = 'Show me why' }: ShowMeWhyProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  if (layers.length === 0) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/8 px-4 py-2.5 text-sm font-semibold text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/40 transition-colors',
          className,
        )}
      >
        <Sparkles className="h-4 w-4 group-hover:scale-110 transition-transform" />
        {triggerLabel}
      </button>
    )
  }

  const layer = layers[index]
  const isFirst = index === 0
  const isLast = index === layers.length - 1

  return (
    <div className={cn('rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400/60">
          Layer {index + 1} of {layers.length}
        </span>
        <div className="flex items-center gap-1">
          {layers.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-4 bg-violet-400' : 'w-1.5 bg-violet-500/20',
              )}
            />
          ))}
        </div>
      </div>

      <div key={index} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 space-y-1.5">
        <p className="text-sm font-bold text-foreground">{layer.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{layer.body}</p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-300/70 hover:text-violet-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(layers.length - 1, i + 1))}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30 transition-colors"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Collapse
          </button>
        )}
      </div>
    </div>
  )
}
