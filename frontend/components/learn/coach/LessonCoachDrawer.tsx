'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronLeft, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CoachChat, type CoachChatHandle } from '@/components/learn/CoachChat'
import type { CoachAction } from '@/lib/learn/api'
import { toCoachApiContext, type LessonCoachContext } from '@/lib/learn/lessonCoachContext'

interface LessonCoachDrawerProps {
  open: boolean
  onClose: () => void
  context: LessonCoachContext | null
  /** step.range_hint, when authored — shown verbatim on the first hint
   *  request with no LLM call (spec §37: authored hints used first). */
  authoredHint?: string
  token: string
  moduleTitle?: string
}

const QUICK_ACTION_LABELS: Record<CoachAction, string> = {
  hint: 'Give me a hint',
  explain_concept: 'Explain the concept',
  walkthrough: 'Walk me through it',
  why_wrong: 'Why was my answer wrong?',
  why_correct: 'Why is this correct?',
  key_takeaway: 'What should I remember?',
}

function quickActionsFor(context: LessonCoachContext | null): { id: CoachAction; label: string }[] {
  if (!context) return []
  const action = (id: CoachAction) => ({ id, label: QUICK_ACTION_LABELS[id] })
  if (!context.hasAnswered) {
    return [action('hint'), action('explain_concept'), action('walkthrough')]
  }
  if (context.isCorrect) {
    return [action('why_correct'), action('explain_concept'), action('key_takeaway')]
  }
  return [action('why_wrong'), action('hint'), action('walkthrough')]
}

export function LessonCoachDrawer({
  open,
  onClose,
  context,
  authoredHint,
  token,
  moduleTitle,
}: LessonCoachDrawerProps) {
  const threadKey = context ? `${context.lessonId}:${context.stepId}` : 'none'
  const [hintLevel, setHintLevel] = useState(0)
  const [showAuthoredHint, setShowAuthoredHint] = useState(false)
  const chatRef = useRef<CoachChatHandle>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // A new step/lesson is a fresh contextual thread (spec §21/22) — reset the
  // hint ladder and any shown authored-hint note. The embedded CoachChat is
  // additionally remounted via `key={threadKey}` below, which resets its own
  // message history and session id.
  useEffect(() => {
    setHintLevel(0)
    setShowAuthoredHint(false)
  }, [threadKey])

  // Focus management: move focus into the drawer on open, return it to
  // whatever triggered the open on close. Escape closes.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      panelRef.current?.focus()
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }
    previousFocusRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const quickActions = useMemo(() => quickActionsFor(context), [context])

  const apiContext = useMemo(() => {
    if (!context) return {}
    return { ...toCoachApiContext(context), hint_level: hintLevel || undefined }
  }, [context, hintLevel])

  function handleQuickAction(id: CoachAction, label: string) {
    if (id === 'hint') {
      const nextLevel = hintLevel + 1
      if (nextLevel === 1 && authoredHint) {
        setHintLevel(1)
        setShowAuthoredHint(true)
        return
      }
      setHintLevel(nextLevel)
      chatRef.current?.sendMessage(label, 'hint')
      return
    }
    chatRef.current?.sendMessage(label, id)
  }

  const conceptLabel = context?.conceptIds[0]?.replace(/-/g, ' ')
  const contextLine = [moduleTitle, context?.lessonTitle].filter(Boolean).join(' · ')

  return (
    <div className={cn('fixed inset-0 z-50', !open && 'pointer-events-none')}>
      {/* Backdrop — only below the xl breakpoint, where the panel overlays
          instead of the lesson content shifting to make room for it. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 xl:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Coach"
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col bg-card border-border/50 shadow-2xl shadow-black/40 outline-none',
          'transition-transform duration-300 ease-out',
          // Mobile: near-fullscreen bottom sheet
          'inset-x-0 bottom-0 top-[8%] rounded-t-2xl border-t',
          // Tablet and up: fixed right-side panel
          'md:inset-y-0 md:right-0 md:left-auto md:top-0 md:bottom-0 md:w-[420px] md:max-w-[92vw] md:rounded-t-none md:rounded-l-2xl md:border-l md:border-t-0',
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-2 border-b border-border/40 px-4 py-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to question"
            className="md:hidden -ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/70">
              AI Coach
            </p>
            {contextLine && (
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{contextLine}</p>
            )}
            {conceptLabel && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-violet-300/70">
                <BookOpen className="h-3 w-3 shrink-0" />
                <span className="truncate capitalize">{conceptLabel}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Coach"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Authored hint (level 1, when the step has one) — deterministic,
            no LLM call, shown above the chat rather than inside it. */}
        {showAuthoredHint && authoredHint && (
          <div className="mx-4 mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/70 mb-1">
              Hint
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{authoredHint}</p>
          </div>
        )}

        {/* Conversation — mounted whenever there's a step context, regardless
            of `open`: the drawer's own transform/opacity is what hides it
            when closed. Only remounting on a genuine step/lesson change
            (`key={threadKey}`) is what makes conversation survive toggling
            the drawer shut and back open (spec: closing must not lose the
            thread), while still starting fresh on a new question. */}
        {context && (
          <CoachChat
            key={threadKey}
            ref={chatRef}
            token={token}
            context={apiContext}
            quickActions={quickActions}
            onQuickAction={handleQuickAction}
            className="flex-1 min-h-0"
          />
        )}
      </div>
    </div>
  )
}
