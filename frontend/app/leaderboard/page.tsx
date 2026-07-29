'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchLeaderboard,
  fetchMyLeaderboardRank,
  type LeaderboardPeriod,
  type LeaderboardRow,
  type MyRankResponse,
} from '@/lib/leaderboard/api'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

// ── Row ─────────────────────────────────────────────────────────────────────

const TOP_RANK_STYLES: Record<number, string> = {
  1: 'border-amber-500/30 bg-amber-500/[0.06]',
  2: 'border-slate-400/25 bg-slate-400/[0.05]',
  3: 'border-orange-700/30 bg-orange-700/[0.05]',
}

const TOP_RANK_TEXT: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-slate-300',
  3: 'text-orange-400/90',
}

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[13px] font-bold',
        isTop3
          ? cn(TOP_RANK_STYLES[rank], TOP_RANK_TEXT[rank])
          : 'border-border/50 bg-white/[0.03] text-muted-foreground',
      )}
    >
      {rank}
    </div>
  )
}

function LeaderboardRowItem({ row, period }: { row: LeaderboardRow; period: LeaderboardPeriod }) {
  const isTop3 = row.rank <= 3
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors',
        row.is_you
          ? 'border-violet-500/35 bg-violet-500/[0.07]'
          : 'border-border/40 bg-card/40 hover:bg-card/60',
      )}
    >
      <RankBadge rank={row.rank} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate text-[14px]',
              isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
            )}
          >
            {row.username}
          </span>
          {row.is_you && (
            <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-violet-300">
              You
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
          <span className="rounded-full border border-border/50 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            LVL {row.level}
          </span>
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              isTop3 ? TOP_RANK_TEXT[row.rank] : 'text-foreground/90',
            )}
          >
            {period === '24h'
              ? `+${(row.period_xp ?? 0).toLocaleString()} XP`
              : `${row.total_xp.toLocaleString()} XP`}
          </span>
        </div>
      </div>
    </div>
  )
}

function MyRankRow({ myRank, period }: { myRank: MyRankResponse; period: LeaderboardPeriod }) {
  if (myRank.rank === null) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-500/25 bg-violet-500/[0.04] px-4 py-3.5 text-center text-[13px] text-muted-foreground">
        {period === '24h'
          ? "You haven't earned XP in the last 24 hours yet."
          : 'Complete a lesson to join the leaderboard.'}
      </div>
    )
  }
  return (
    <LeaderboardRowItem
      row={{
        rank: myRank.rank,
        username: myRank.username,
        level: myRank.level,
        total_xp: myRank.total_xp,
        period_xp: myRank.period_xp,
        is_you: true,
      }}
      period={period}
    />
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function PeriodTabs({ period, onChange }: { period: LeaderboardPeriod; onChange: (p: LeaderboardPeriod) => void }) {
  const tabs: { id: LeaderboardPeriod; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: '24h', label: 'Last 24 Hours' },
  ]
  return (
    <div className="inline-flex rounded-xl border border-border/50 bg-white/[0.03] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-150',
            period === tab.id
              ? 'bg-violet-500/15 text-violet-300 shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── Main content ─────────────────────────────────────────────────────────────

function LeaderboardContent() {
  const { user, session, loading: authLoading } = useAuth()
  const token = session?.access_token ?? ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const period: LeaderboardPeriod = searchParams.get('period') === '24h' ? '24h' : 'all'

  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myRank, setMyRank] = useState<MyRankResponse | null>(null)

  const setPeriod = useCallback(
    (next: LeaderboardPeriod) => {
      router.replace(`/leaderboard?period=${next}`, { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    if (authLoading || !user || !token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchLeaderboard(period, PAGE_SIZE, 0, token),
      fetchMyLeaderboardRank(period, token),
    ])
      .then(([board, mine]) => {
        if (cancelled) return
        setRows(board.rows)
        setHasMore(board.has_more)
        setOffset(board.rows.length)
        setMyRank(mine)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leaderboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period, token, user, authLoading])

  const loadMore = useCallback(() => {
    if (!token || loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchLeaderboard(period, PAGE_SIZE, offset, token)
      .then((board) => {
        setRows((prev) => [...prev, ...board.rows])
        setHasMore(board.has_more)
        setOffset((prev) => prev + board.rows.length)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load more'))
      .finally(() => setLoadingMore(false))
  }, [period, offset, token, loadingMore, hasMore])

  const iAmVisible = rows.some((r) => r.is_you)

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ── Header ── */}
        <div className="mb-8">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-400/60">
            Progression
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Leaderboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            See how your XP progression compares across every Stacked learner.
          </p>
        </div>

        <div className="mb-6">
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>

        {!authLoading && !user && (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center">
            <p className="mb-4 text-sm text-muted-foreground">Sign in to see where you rank.</p>
            <Link
              href="/login"
              className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-violet-900/30 transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}

        {user && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400/60" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-6 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && rows.length === 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
                {period === '24h'
                  ? 'No XP has been earned in the last 24 hours yet.'
                  : 'Be the first to earn XP.'}
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <>
                <div className="flex flex-col gap-2">
                  {rows.map((row) => (
                    <LeaderboardRowItem key={row.rank} row={row} period={period} />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-xl border border-border/50 bg-white/[0.03] px-5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Your rank, always visible — sticky-feeling separate row when
                you're not already in the loaded page. ── */}
            {!loading && !error && myRank && !iAmVisible && (
              <div className="mt-6">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Your rank
                </p>
                <MyRankRow myRank={myRank} period={period} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400/60" />
          </div>
        }
      >
        <LeaderboardContent />
      </Suspense>
      <Footer />
    </div>
  )
}
