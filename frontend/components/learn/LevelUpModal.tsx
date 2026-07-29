'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelProgress } from '@/lib/learn/levelCurve'
import type { LevelUpEvent } from '@/lib/learn/levelUpDetection'
import { fetchMyLeaderboardRank, type LeaderboardPeriod } from '@/lib/leaderboard/api'

/**
 * No shared analytics abstraction exists in this codebase yet (audited —
 * grep for "analytics"/"posthog"/"gtag" turns up nothing). Per the task's
 * own instruction not to introduce one solely for this feature, these are
 * dev-only console.debug calls — the same convention already used for
 * diagnostics elsewhere in LearnProgressContext.tsx. Swap the body for a
 * real analytics call the moment such an abstraction exists; the call
 * sites/event names/properties below are already exactly what that call
 * would need.
 */
function emitLevelUpAnalyticsEvent(name: string, properties: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[analytics] ${name}`, properties)
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// ── Rank preview ──────────────────────────────────────────────────────────────
// Only ever renders a number after a real, successful fetch from the
// canonical leaderboard backend — never estimated from XP. Any failure
// (network, 5xx, timeout) degrades silently to the generic CTA; it must
// never block or break the level-up modal itself.

interface RankPreviewState {
  allTimeRank: number | null
  last24hRank: number | null
  loaded: boolean
}

function useRankPreview(token: string): RankPreviewState {
  const [state, setState] = useState<RankPreviewState>({
    allTimeRank: null, last24hRank: null, loaded: false,
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const load = async (period: LeaderboardPeriod) => {
      try {
        const res = await fetchMyLeaderboardRank(period, token)
        return res.rank
      } catch {
        return null
      }
    }

    Promise.all([load('all'), load('24h')]).then(([allTimeRank, last24hRank]) => {
      if (cancelled) return
      setState({ allTimeRank, last24hRank, loaded: true })
    })

    return () => {
      cancelled = true
    }
  }, [token])

  return state
}

/** Pure presentation, split out from useRankPreview's data-fetching so it's
 *  directly testable via renderToStaticMarkup (this codebase's convention —
 *  no jsdom/testing-library — see components/learn/__tests__/). Never shows
 *  a number unless `loaded` is true AND the backend actually returned one;
 *  loaded=false or both-null-after-loading both fall back to the generic
 *  CTA, never an estimate. */
export function RankPreviewSection({ allTimeRank, last24hRank, loaded }: RankPreviewState) {
  const hasRealRank = loaded && (allTimeRank !== null || last24hRank !== null)

  if (!hasRealRank) {
    return (
      <div className="mb-6 rounded-xl border border-border/40 bg-white/[0.02] p-3.5">
        <p className="text-xs text-muted-foreground/60">
          See how you rank on the leaderboard.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-border/40 bg-white/[0.02] p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2.5">
        Your Rank
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground/50 mb-0.5">All time</p>
          <p className="text-lg font-black text-foreground tabular-nums">
            {allTimeRank !== null ? `#${allTimeRank}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/50 mb-0.5">Last 24 hours</p>
          <p className="text-lg font-black text-foreground tabular-nums">
            {last24hRank !== null ? `#${last24hRank}` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Focus trap ──────────────────────────────────────────────────────────────

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled'),
      )

    const first = focusables()[0]
    first?.focus()

    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) return
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      previouslyFocused?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}

// ── Main modal ────────────────────────────────────────────────────────────────

export interface LevelUpModalProps {
  event: LevelUpEvent
  /** Primary action — "Continue Learning". Just dismisses; the underlying
   *  page (lesson/module/step flow) is already wherever "continuing" means. */
  onContinue: () => void
  /** Escape / backdrop click / close button. */
  onDismiss: () => void
  /** Auth token for the optional rank-preview fetch — omit to skip it
   *  entirely (falls back to the generic CTA immediately). */
  token?: string
}

export function LevelUpModal({ event, onContinue, onDismiss, token }: LevelUpModalProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const rank = useRankPreview(token ?? '')

  const levelProgress = useMemo(() => getLevelProgress(event.totalXp), [event.totalXp])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), reducedMotion ? 0 : 30)
    return () => clearTimeout(t)
  }, [reducedMotion])

  useEffect(() => {
    emitLevelUpAnalyticsEvent('level_up_shown', {
      previous_level: event.previousLevel,
      new_level: event.newLevel,
      xp_total: event.totalXp,
    })
    // Fires once per distinct level-up event, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.previousLevel, event.newLevel, event.totalXp])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useFocusTrap(dialogRef, true)

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, reducedMotion ? 0 : 200)
  }

  function handleContinue() {
    emitLevelUpAnalyticsEvent('level_up_continue', {
      previous_level: event.previousLevel,
      new_level: event.newLevel,
      xp_total: event.totalXp,
    })
    setVisible(false)
    setTimeout(onContinue, reducedMotion ? 0 : 200)
  }

  function handleLeaderboardClick() {
    emitLevelUpAnalyticsEvent('level_up_leaderboard_clicked', {
      previous_level: event.previousLevel,
      new_level: event.newLevel,
      xp_total: event.totalXp,
    })
    setVisible(false)
    setTimeout(onDismiss, reducedMotion ? 0 : 200)
  }

  const hasRealRank = rank.loaded && (rank.allTimeRank !== null || rank.last24hRank !== null)

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4',
        'transition-opacity',
        reducedMotion ? '' : 'duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
        onClick={handleDismiss}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-heading"
        aria-describedby="level-up-description"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-sm rounded-2xl border border-violet-500/30',
          'bg-gradient-to-b from-violet-950/90 via-card/95 to-card/95',
          'shadow-2xl shadow-violet-900/40 p-6 sm:p-7',
          reducedMotion ? '' : 'transition-all duration-300 ease-out',
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2',
        )}
      >
        {/* Subtle ambient glow — no particles, no confetti */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-28 w-28 rounded-full bg-violet-500/25 blur-3xl',
            !reducedMotion && 'animate-pulse',
          )}
        />

        {/* Screen-reader announcement — the level increase is stated in
            plain text below too, this just ensures it's announced promptly. */}
        <p role="status" aria-live="assertive" className="sr-only">
          Level up! You reached Level {event.newLevel}.
        </p>

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-lg shadow-violet-900/20">
            <Trophy className="h-7 w-7 text-violet-300" />
          </div>

          <p
            id="level-up-heading"
            className="text-[11px] font-black uppercase tracking-[0.3em] text-violet-400/70 mb-2"
          >
            Level Up
          </p>

          {/* Previous -> new level transition */}
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <span className="text-xl font-bold text-muted-foreground/40 tabular-nums">
              {event.previousLevel}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40" aria-hidden />
            <span className="text-4xl font-black text-foreground tabular-nums">
              {event.newLevel}
            </span>
          </div>

          <p id="level-up-description" className="text-sm text-muted-foreground mb-4">
            You reached <span className="font-semibold text-violet-300">Level {event.newLevel}</span>
          </p>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 mb-5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            <span className="text-sm font-bold tabular-nums text-amber-300">
              +{event.xpAwarded.toLocaleString()} XP
            </span>
          </div>

          {/* Progress toward next level — canonical getLevelProgress, never
              recomputed locally. */}
          <div className="mb-6 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Level {levelProgress.level} · {levelProgress.totalXp.toLocaleString()} XP total
              </span>
              <span className="text-[11px] text-muted-foreground/50">
                {levelProgress.xpRemaining.toLocaleString()} to Level {levelProgress.level + 1}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400 transition-all duration-700"
                style={{ width: `${levelProgress.progressPercent}%` }}
                role="progressbar"
                aria-valuenow={levelProgress.progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress toward Level ${levelProgress.level + 1}`}
              />
            </div>
          </div>

          {/* Rank preview — real data only, never estimated */}
          <div className="mb-6 rounded-xl border border-border/40 bg-white/[0.02] p-3.5">
            {hasRealRank ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2.5">
                  Your Rank
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground/50 mb-0.5">All time</p>
                    <p className="text-lg font-black text-foreground tabular-nums">
                      {rank.allTimeRank !== null ? `#${rank.allTimeRank}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/50 mb-0.5">Last 24 hours</p>
                    <p className="text-lg font-black text-foreground tabular-nums">
                      {rank.last24hRank !== null ? `#${rank.last24hRank}` : '—'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                See how you rank on the leaderboard.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Continue Learning
            </button>
            <Link
              href="/leaderboard"
              onClick={handleLeaderboardClick}
              className="w-full rounded-xl border border-border/50 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
