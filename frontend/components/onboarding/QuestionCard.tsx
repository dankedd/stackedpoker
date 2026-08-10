'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssessmentQuestion } from '@/lib/learn/assessmentQuestions'

// Shared one-question-at-a-time renderer for the adaptive quiz, the Final
// Challenge, and the Foundation Final Challenge — all three just supply a
// different question source; the grading + reveal + "explanation withheld
// until answered" behavior is identical everywhere it's used.
export function QuestionCard({
  question,
  index,
  total,
  onAnswer,
  onNext,
}: {
  question: AssessmentQuestion
  /** 1-indexed, for "Question X of Y" — omit either to hide the counter. */
  index?: number
  total?: number
  /** Fired immediately on selection, for grading/engine state. */
  onAnswer: (correct: boolean) => void
  /** Fired when the learner is done reading the explanation and ready to advance. */
  onNext: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = question.options.find((o) => o.id === selectedId)
  const answered = selectedId !== null

  function choose(optionId: string) {
    if (answered) return
    setSelectedId(optionId)
    const option = question.options.find((o) => o.id === optionId)
    onAnswer(!!option?.correct)
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 p-6 sm:p-8">
      {index !== undefined && total !== undefined && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground/50 mb-1.5">
            <span>Question {index} of {total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-300"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-5 leading-snug">
        {question.prompt}
      </h2>

      <div className="space-y-2.5">
        {question.options.map((opt) => {
          const isSelected = opt.id === selectedId
          const showState = answered && (isSelected || opt.correct)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => choose(opt.id)}
              disabled={answered}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                !answered && 'border-border/40 bg-secondary/15 text-foreground hover:border-violet-500/30 hover:bg-violet-500/[0.05]',
                answered && !showState && 'border-border/20 bg-secondary/10 text-muted-foreground/40',
                showState && opt.correct && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
                showState && !opt.correct && 'border-red-500/40 bg-red-500/10 text-red-200',
              )}
            >
              {showState && (opt.correct ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-400" />
              ))}
              <span className="flex-1">{opt.label}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div
          className={cn(
            'mt-5 rounded-xl border px-4 py-3 text-xs leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200',
            selected?.correct
              ? 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-200/80'
              : 'border-amber-500/25 bg-amber-500/[0.05] text-amber-200/80',
          )}
        >
          {question.explanation}
        </div>
      )}

      {answered && (
        <button
          type="button"
          onClick={onNext}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
