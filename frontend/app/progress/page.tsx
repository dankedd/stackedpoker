'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Flame,
  AlertTriangle,
  CheckCircle,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { MasteryRing } from '@/components/learn/MasteryRing'
import { StreakBadge } from '@/components/learn/StreakBadge'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchUserProgress,
  fetchConceptMasteries,
  fetchUserLeaks,
  fetchLearningDashboard,
  resolveLeak,
} from '@/lib/learn/api'
import type {
  UserSkillProgress,
  UserConceptMastery,
  UserLeak,
  PersonalizedDashboard,
  MasteryLevel,
} from '@/lib/learn/types'
import { xpToNextLevel } from '@/lib/learn/types'
import { cn } from '@/lib/utils'

// ── Static data ───────────────────────────────────────────────────────────────

const CONCEPT_IDS = [
  'pot_odds',
  'mdf',
  'alpha',
  'position_value',
  'value_betting',
  'bluff_basics',
  'hand_ranges',
  'board_texture',
  'range_advantage',
  'nut_advantage',
  'cbet_theory',
  'equity_real',
  'spr_theory',
  'blockers',
  'polarized',
  'geometric_sizing',
]

const CONCEPT_DOMAIN: Record<string, string> = {
  pot_odds: 'game_theory',
  mdf: 'game_theory',
  alpha: 'game_theory',
  equity_real: 'game_theory',
  geometric_sizing: 'game_theory',
  position_value: 'strategy',
  value_betting: 'strategy',
  bluff_basics: 'strategy',
  hand_ranges: 'ranges',
  range_advantage: 'ranges',
  blockers: 'ranges',
  polarized: 'ranges',
  board_texture: 'postflop',
  nut_advantage: 'postflop',
  cbet_theory: 'postflop',
  spr_theory: 'postflop',
}

const DOMAIN_BADGE: Record<string, string> = {
  game_theory: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  strategy: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  ranges: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  postflop: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
}

const SEVERITY_STYLE: Record<string, string> = {
  mild: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  moderate: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  severe: 'border-red-500/30 bg-red-500/10 text-red-400',
}

const LEARNING_PATHS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'range-thinking', label: 'Range Thinking' },
  { id: 'gto-mastery', label: 'GTO Mastery' },
]

const ACHIEVEMENTS = [
  { id: 'first_lesson', title: 'First Steps', desc: 'Complete your first lesson', icon: '🎯' },
  { id: 'week_streak', title: '7-Day Streak', desc: 'Log in and learn 7 days in a row', icon: '🔥' },
  { id: 'range_builder', title: 'Range Architect', desc: 'Complete Range Trainer 10 times', icon: '🎯' },
  { id: 'leak_plugger', title: 'Leak Plugged', desc: 'Resolve 3 detected leaks', icon: '🔧' },
  { id: 'concept_master', title: 'Concept Master', desc: 'Reach mastery level 5 on 10 concepts', icon: '🧠' },
  { id: 'perfect_score', title: 'Perfect Score', desc: 'Score 100% on any lesson', icon: '⭐' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso?: string) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-white/[0.04]', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user, session } = useAuth()
  const token = session?.access_token ?? ''

  const [progress, setProgress] = useState<UserSkillProgress | null>(null)
  const [masteries, setMasteries] = useState<UserConceptMastery[]>([])
  const [leaks, setLeaks] = useState<UserLeak[]>([])
  const [dashboard, setDashboard] = useState<PersonalizedDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    Promise.all([
      fetchUserProgress(token),
      fetchConceptMasteries(token),
      fetchUserLeaks(token),
      fetchLearningDashboard(token),
    ])
      .then(([p, m, l, d]) => {
        setProgress(p)
        setMasteries(m)
        setLeaks(l.filter((lk) => !lk.resolved))
        setDashboard(d)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [token])

  const xpInfo = progress ? xpToNextLevel(progress.total_xp) : null

  const handleResolve = async (leakId: string) => {
    if (!token || resolvingId) return
    setResolvingId(leakId)
    try {
      await resolveLeak(leakId, token)
      setLeaks((prev) => prev.filter((l) => l.id !== leakId))
    } catch {
      // non-fatal
    } finally {
      setResolvingId(null)
    }
  }

  const masteryMap: Record<string, UserConceptMastery> = {}
  masteries.forEach((m) => {
    masteryMap[m.concept_id] = m
  })

  const earnedSet = new Set<string>(dashboard?.skill_progress.achievements ?? [])

  if (!user && !loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-14 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Trophy className="h-10 w-10 text-violet-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Track your progress</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Sign in to see your XP, level, concept mastery, and detected leaks.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
              >
                Sign in <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* ── Page header ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-0.5">
                  Your Journey
                </p>
                <h1 className="text-3xl font-bold text-foreground">Your Progress</h1>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-10">

              {/* ── Section 1: XP & Level Card ── */}
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-card/80 to-blue-600/5 p-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-8">

                  {/* Big level number */}
                  <div className="shrink-0 text-center sm:text-left">
                    <div className="text-6xl font-black text-violet-400 leading-none">
                      {progress?.level ?? 1}
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground mt-1.5">
                      Level {progress?.level ?? 1}
                    </div>
                  </div>

                  {/* XP bar + stats */}
                  <div className="flex-1 min-w-0 w-full space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>XP to next level</span>
                        <span>{xpInfo?.current ?? 0} / {xpInfo?.needed ?? 100}</span>
                      </div>
                      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-700"
                          style={{ width: `${xpInfo?.pct ?? 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {xpInfo ? xpInfo.needed - xpInfo.current : '—'} XP to Level {(progress?.level ?? 1) + 1}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div className="text-sm">
                        <span className="font-bold text-amber-400">
                          {(progress?.total_xp ?? 0).toLocaleString()}
                        </span>{' '}
                        <span className="text-muted-foreground">Total XP</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Flame className="h-4 w-4 text-orange-400" />
                        <span className="font-bold text-orange-400">
                          {progress?.streak_days ?? 0}
                        </span>{' '}
                        <span className="text-muted-foreground">day streak</span>
                      </div>
                      <StreakBadge days={progress?.streak_days ?? 0} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Learning Path Progress ── */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-5 sm:p-6">
                <h2 className="font-bold text-foreground mb-5">Learning Path Progress</h2>
                <div className="space-y-5">
                  {LEARNING_PATHS.map(({ id, label }) => (
                    <div key={id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold text-foreground">0%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500/50 w-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Section 3: Concept Mastery ── */}
              <div>
                <h2 className="font-bold text-foreground mb-4">Concept Mastery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {CONCEPT_IDS.map((cid) => {
                    const m = masteryMap[cid]
                    const lvl = (m?.mastery_level ?? 0) as MasteryLevel
                    const domain = CONCEPT_DOMAIN[cid] ?? 'strategy'

                    return (
                      <div
                        key={cid}
                        className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 hover:border-violet-500/20 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {toTitleCase(cid)}
                          </p>
                          <span
                            className={cn(
                              'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize',
                              DOMAIN_BADGE[domain]
                            )}
                          >
                            {domain.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <MasteryRing level={lvl} concept_id={cid} size="md" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {lvl === 0 ? 'Unseen' : lvl === 5 ? 'Mastered' : `Level ${lvl}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {m?.last_tested ? formatDate(m.last_tested) : 'Not tested'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Section 4: Active Leaks ── */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <h2 className="font-bold text-foreground">Active Leaks</h2>
                </div>

                {leaks.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                    <p className="font-semibold text-foreground">No active leaks!</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Keep analyzing hands to detect patterns.
                    </p>
                    <Link
                      href="/analyze"
                      className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Analyze a hand →
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {leaks.map((leak) => (
                      <div
                        key={leak.id}
                        className="flex items-center gap-3 py-3.5 flex-wrap sm:flex-nowrap"
                      >
                        <p className="text-sm font-medium text-foreground min-w-0 flex-1 truncate">
                          {toTitleCase(leak.concept_id)}
                        </p>

                        <span
                          className={cn(
                            'shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                            SEVERITY_STYLE[leak.severity]
                          )}
                        >
                          {leak.severity}
                        </span>

                        <span className="shrink-0 text-xs text-muted-foreground">
                          {leak.evidence_count} instance{leak.evidence_count !== 1 ? 's' : ''}
                        </span>

                        <button
                          type="button"
                          disabled={resolvingId === leak.id}
                          onClick={() => handleResolve(leak.id)}
                          className={cn(
                            'shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                            resolvingId === leak.id
                              ? 'opacity-50 cursor-default border-border/30 text-muted-foreground'
                              : 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10'
                          )}
                        >
                          {resolvingId === leak.id ? 'Resolving…' : 'Resolve'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section 5: Achievements ── */}
              <div>
                <h2 className="font-bold text-foreground mb-4">Achievements</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {ACHIEVEMENTS.map((a) => {
                    const earned = earnedSet.has(a.id)
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          'relative rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200',
                          earned
                            ? 'border-violet-500/30 bg-gradient-to-br from-violet-600/10 to-blue-600/5 shadow-lg shadow-violet-500/10'
                            : 'border-border/30 bg-card/40 opacity-50 grayscale'
                        )}
                      >
                        {earned && (
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl"
                          />
                        )}
                        <span className="text-3xl">{a.icon}</span>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-foreground">{a.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {a.desc}
                            </p>
                          </div>
                          {!earned && (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
