'use client'

import { CheckCircle2, AlertTriangle, XCircle, ChevronRight, Trophy, BookOpen, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepResult } from '@/lib/learn/types'
import { QUALITY_LABELS, QUALITY_COLORS } from '@/lib/learn/types'
import { XPGain } from './XPGain'
import { EvaluationFailed } from './EvaluationFailed'
import { PreviousButton } from './PreviousButton'
import { AskCoachTrigger } from './coach/AskCoachTrigger'
import { RangeRevealCard } from './RangeRevealCard'
import { NutAdvantageMeter, RangeCoverageBar } from './visuals/NutAdvantageMeter'
import { TheoryPanel } from './visuals/TheoryPanel'

interface StepFeedbackProps {
  result: StepResult
  onContinue: () => void
  onRetry: () => void
  isLast: boolean
  /** Undefined/omitted on step 1, where there's nothing to go back to. */
  onPrevious?: () => void
  /** Opens the AI Coach drawer, already scoped to this step's post-answer
   *  context — omitted (e.g. no signed-in session) simply hides the trigger. */
  onAskCoach?: () => void
}

/** 'perfect'/'good' read as "correct enough to ask a deeper question";
 *  'acceptable'/'mistake'/'punt' read as "wrong enough to ask why". */
const CORRECT_ENOUGH_QUALITIES = new Set(['perfect', 'good'])

// ── Quality-based colour tokens ───────────────────────────────────────────────

const QUALITY_BG: Record<string, string> = {
  perfect:    'border-emerald-500/30 bg-emerald-500/8',
  good:       'border-blue-500/30 bg-blue-500/8',
  acceptable: 'border-amber-500/30 bg-amber-500/8',
  mistake:    'border-orange-500/30 bg-orange-500/8',
  punt:       'border-red-500/30 bg-red-500/8',
}

const QUALITY_BADGE: Record<string, string> = {
  perfect:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  good:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  acceptable: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  mistake:    'bg-orange-500/15 text-orange-400 border-orange-500/30',
  punt:       'bg-red-500/15 text-red-400 border-red-500/30',
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function QualityIcon({ quality }: { quality: string }) {
  if (quality === 'perfect' || quality === 'good') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
      </div>
    )
  }
  if (quality === 'acceptable') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
      </div>
    )
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
      <XCircle className="h-6 w-6 text-red-400" />
    </div>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  if (source === 'solver') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300/80 border border-blue-400/30 bg-blue-500/10 rounded px-1.5 py-0.5">
        <Cpu className="h-3 w-3" />
        Solver
      </span>
    )
  }
  if (source === 'theory_engine') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400/60 border border-violet-500/20 bg-violet-500/5 rounded px-1.5 py-0.5">
        <BookOpen className="h-3 w-3" />
        Theory Engine
      </span>
    )
  }
  return null
}

// ── Structured feedback list ──────────────────────────────────────────────────
// Same convention as ConceptReveal's StructuredTheoryList — for feedback that
// enumerates a genuinely categorical/sequential rule set instead of prose.

function StructuredFeedbackList({ items }: { items: { term: string; description: string }[] }) {
  return (
    <div className="rounded-xl border border-violet-500/15 bg-secondary/20 divide-y divide-border/20 overflow-hidden mt-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <span className="shrink-0 rounded-md border border-violet-500/30 bg-violet-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300 leading-4">
            {item.term}
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item.description}</p>
        </div>
      ))}
    </div>
  )
}

// ── Correct-answer reveal ─────────────────────────────────────────────────────
// Sits between the score and the WHY explanation: RESULT -> SCORE -> CORRECT
// ANSWER -> EXPLANATION. `result.answer_reveal` is only ever populated by
// evaluator.ts (the same source of truth as scoring) and, for most step
// types, only when the response wasn't fully correct, so a perfect answer
// never gets an unnecessary "you were wrong" comparison here. A few step
// types (e.g. range_equity_predict) opt into always showing it — see
// evalNumeric's `alwaysReveal` option — because the reference value itself
// is the pedagogical point, not a right/wrong check. `answer_reveal.source`
// (an internal book/chapter/page citation) is deliberately never rendered
// here or anywhere else in the learner UI — the coach presents theory as
// its own knowledge, never naming a source.

function AnswerRevealBlock({ term, correct, yours, alsoAccepted, delta }: NonNullable<StepResult['answer_reveal']>) {
  return (
    <div className="my-3 rounded-xl border border-border/40 bg-secondary/30 px-4 py-3">
      {yours && (
        <p className="text-xs text-muted-foreground/70 mb-1">
          Your answer: <span className="font-medium text-foreground/70">{yours}</span>
        </p>
      )}
      <p className="text-sm font-semibold text-foreground">
        {term}: <span className="text-violet-300">{correct}</span>
      </p>
      {delta && (
        <p className="text-xs text-muted-foreground/70 mt-1">
          Difference: <span className="font-medium text-foreground/70">{delta}</span>
        </p>
      )}
      {alsoAccepted && alsoAccepted.length > 0 && (
        <p className="text-xs text-muted-foreground/60 mt-1">
          Also accepted: {alsoAccepted.join(' · ')}
        </p>
      )}
    </div>
  )
}

// ── Continue button ───────────────────────────────────────────────────────────

function ContinueButton({ onClick, isLast }: { onClick: () => void; isLast: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
      {isLast ? (
        <>
          <Trophy className="h-4 w-4 shrink-0" />
          Finish Lesson
        </>
      ) : (
        <>
          Continue
          <ChevronRight className="h-4 w-4 shrink-0" />
        </>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function StepFeedback({ result, onContinue, onRetry, isLast, onPrevious, onAskCoach }: StepFeedbackProps) {
  // ── Failed state: no score, no XP, honest message ─────────────────────────
  if (!result.evaluation_valid) {
    return (
      <EvaluationFailed
        errorType={result.error_type}
        onRetry={onRetry}
        onContinue={onContinue}
        isLast={isLast}
        onPrevious={onPrevious}
      />
    )
  }

  // ── Theory engine / solver: full quality-based styling ────────────────────
  // solver gets slightly enhanced visuals; theory_engine is standard
  const isSolver = result.evaluation_source === 'solver'

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header card */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          isSolver ? 'border-blue-500/40 bg-blue-500/6' : QUALITY_BG[result.quality]
        )}
      >
        {/* Two columns (icon | everything else) from 480px up, where the 64px
            icon gutter costs nothing. Below 480px the same grid re-flows: the
            icon and badges keep row 1, and the score/explanation block drops to
            row 2 spanning BOTH columns — so the prose starts at the card's left
            padding and runs the full content width instead of being squeezed
            into the ~60% column left over beside the icon. One DOM, two
            layouts: nothing is duplicated or conditionally rendered.

            480px, not the usual `sm:` (640px), because that is where the trade
            actually turns: stacking costs a dedicated ~64px icon row, and it
            only pays for itself while the freed width removes more than about
            three wrapped lines. Measured on a 397-character explanation, the
            stacked layout is 78px shorter at 375px wide and 10px shorter at
            430px, but 58px TALLER at 639px for zero lines saved. Every phone in
            portrait (320-430px) sits well inside the winning side. */}
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-4 min-[480px]:gap-y-2">
          {/* Icon — row 1 only on mobile (the text passes underneath it);
              spans both rows on desktop, reproducing the old flex layout. */}
          <div className="col-start-1 row-start-1 min-[480px]:row-span-2">
            <QualityIcon quality={result.quality} />
          </div>

          {/* Badges — beside the icon at every width. They wrap to a second
              line on narrow phones, which is what stacks "Perfect Play" over
              "Theory Engine" next to the icon. */}
          <div className="col-start-2 row-start-1 min-w-0 flex items-center gap-2 flex-wrap self-center min-[480px]:self-start">
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                QUALITY_BADGE[result.quality]
              )}
            >
              {QUALITY_LABELS[result.quality]}
            </span>
            {result.ev_loss_bb > 0 && (
              <span className="text-xs text-orange-400/80 font-semibold">
                −{result.ev_loss_bb.toFixed(1)} BB EV
              </span>
            )}
            <SourceBadge source={result.evaluation_source} />
          </div>

          {/* Score + explanation — full card width on mobile, the right-hand
              column on desktop. */}
          <div className="row-start-2 col-start-1 col-span-2 min-w-0 min-[480px]:col-start-2 min-[480px]:col-span-1">
            <p className={cn('text-sm font-semibold mb-1', QUALITY_COLORS[result.quality])}>
              Score: {result.score}/100
            </p>
            {result.answer_reveal && <AnswerRevealBlock {...result.answer_reveal} />}
            <p className="text-sm text-muted-foreground leading-relaxed">{result.feedback}</p>
            {result.structured_points && result.structured_points.length > 0 && (
              <StructuredFeedbackList items={result.structured_points} />
            )}
            {onAskCoach && (
              // Generous separation from the explanation on mobile, and a real
              // 44px touch target — the inline trigger is otherwise a bare
              // ~16px line of text. Desktop keeps both the old 12px gap and the
              // button's original inline-block box.
              <div className="mt-5 min-[480px]:mt-3">
                <AskCoachTrigger
                  variant="inline"
                  onClick={onAskCoach}
                  className="inline-flex min-h-[44px] items-center min-[480px]:inline-block min-[480px]:min-h-0"
                  label={
                    CORRECT_ENOUGH_QUALITIES.has(result.quality)
                      ? 'Ask Coach why'
                      : 'Not sure why? Ask Coach'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Concept explanation if provided */}
      {result.concept_explanation && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
              {result.concept_triggered ?? 'Concept'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.concept_explanation}
          </p>
        </div>
      )}

      {/* XP gain — the confirmed level-up celebration (if any) is handled
          separately by LevelUpModal, driven by the server-confirmed total
          in LearnProgressContext, not by this step's local/optimistic
          result.leveled_up (see evaluator.ts's module docstring). */}
      <div className="flex justify-center">
        <XPGain xp={result.xp_earned} />
      </div>

      {/* Full defending-strategy reveal for DEFEND decision_spot steps — only present
          when defendRangeReveal.ts could resolve real canonical data for this exact
          matchup/stack tier; never shown before this point (the answer + score above),
          so it can never leak the answer ahead of time. */}
      {result.range_reveal && <RangeRevealCard reveal={result.range_reveal} />}

      {/* Hand-authored theory panel — the honest substitute for a range chart in spots
          the canonical data doesn't cover (see TheoryPanelData in types.ts). Sits in the
          same post-score slot as range_reveal, and for the same reason: it explains the
          answer, so it must never appear before the answer. */}
      {result.theory_panel && <TheoryPanel panel={result.theory_panel} />}

      {/* Nut-advantage reveal — "who owns more of the strongest hands," purely
          presentational (see LessonStep.nut_advantage_reveal), never before this point. */}
      {result.nut_advantage_reveal && (
        <div className="rounded-2xl border border-border/30 bg-secondary/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
            Nut Advantage
          </p>
          <NutAdvantageMeter
            advantage={result.nut_advantage_reveal.advantage}
            ipLabel={result.nut_advantage_reveal.ipLabel}
            oopLabel={result.nut_advantage_reveal.oopLabel}
          />
          {result.nut_advantage_reveal.caption && (
            <p className="text-[10px] text-muted-foreground/50 mt-2">{result.nut_advantage_reveal.caption}</p>
          )}
        </div>
      )}

      {/* Compact post-prediction "Solver Strategy" reveal (see LessonStep.solver_reveal) —
          the learner predicted first; this confirms or challenges that prediction. */}
      {result.solver_reveal && (
        <div className="rounded-2xl border border-border/30 bg-secondary/10 p-4">
          <RangeCoverageBar
            buckets={result.solver_reveal.buckets}
            title={result.solver_reveal.title ?? 'Solver Strategy'}
          />
          {result.solver_reveal.caption && (
            <p className="text-[10px] text-muted-foreground/50 mt-2">{result.solver_reveal.caption}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {onPrevious && <PreviousButton onClick={onPrevious} />}
        <ContinueButton onClick={onContinue} isLast={isLast} />
      </div>
    </div>
  )
}
