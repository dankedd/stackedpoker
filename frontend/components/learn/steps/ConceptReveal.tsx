'use client'

import { BookOpen, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface ConceptRevealProps {
  step: LessonStep
  onComplete: () => void
}

export function ConceptReveal({ step, onComplete }: ConceptRevealProps) {
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
          <div className="space-y-3">
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
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">No content provided for this concept.</p>
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
