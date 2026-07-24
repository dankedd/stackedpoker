'use client'

import { AlertCircle, RefreshCw, ChevronRight } from 'lucide-react'
import { PreviousButton } from './PreviousButton'

interface EvaluationFailedProps {
  /** Error type from the API (for optional debug display) */
  errorType?: string
  /** Re-submit the same step so the user can try again */
  onRetry: () => void
  /** Skip this step and advance */
  onContinue: () => void
  isLast: boolean
  /** Undefined/omitted on step 1, where there's nothing to go back to. */
  onPrevious?: () => void
}

export function EvaluationFailed({ errorType, onRetry, onContinue, isLast, onPrevious }: EvaluationFailedProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Main card — neutral, non-alarming */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-600/40 bg-slate-700/40">
            <AlertCircle className="h-6 w-6 text-slate-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-300 mb-1">
              Analysis unavailable
            </p>
            <p className="text-sm text-slate-400/80 leading-relaxed">
              We could not evaluate this decision right now. No score or XP has been
              awarded — your progress is still saved and you can retry without penalty.
            </p>
            {errorType && errorType !== 'network_error' && (
              <p className="mt-2 text-[11px] font-mono text-slate-500/60">
                {errorType}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onPrevious && <PreviousButton onClick={onPrevious} compact />}
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-600/40 bg-slate-700/30 px-4 py-3 text-sm font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="group relative flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-600/40 bg-slate-700/30 px-6 py-3.5 text-sm font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 transition-colors"
        >
          {isLast ? 'Finish Lesson' : (
            <>
              Continue
              <ChevronRight className="h-4 w-4 shrink-0" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
