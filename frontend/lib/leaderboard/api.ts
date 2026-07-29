/**
 * Client for the global XP leaderboard API (backend/app/api/routes/leaderboard.py).
 *
 * This never calculates XP or level itself — it only displays what the
 * canonical XP system (backend/app/engines/learn/xp_calculator.py) already
 * computed server-side. Mirrors the fetch pattern in lib/learn/api.ts.
 */

export type LeaderboardPeriod = 'all' | '24h'

export interface LeaderboardRow {
  rank: number
  username: string
  level: number
  total_xp: number
  /** Only present for period="24h" — XP earned within the rolling window. */
  period_xp: number | null
  is_you: boolean
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod
  rows: LeaderboardRow[]
  has_more: boolean
}

export interface MyRankResponse {
  period: LeaderboardPeriod
  /** null = not currently ranked (no XP at all-time, or none in the 24h window). */
  rank: number | null
  username: string
  level: number
  total_xp: number
  period_xp: number | null
}

const API_BASE = ''

async function leaderboardFetch<T>(path: string, token: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const err = new Error('Request timed out. Please try again.')
      ;(err as Error & { status?: number }).status = 0
      throw err
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
    const detail = body.detail ?? `HTTP ${res.status}`
    const message = typeof detail === 'string' ? detail : (detail.message ?? JSON.stringify(detail))
    const err = new Error(message)
    ;(err as Error & { detail?: unknown; status?: number }).detail = detail
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  return res.json() as Promise<T>
}

export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  limit: number,
  offset: number,
  token: string,
): Promise<LeaderboardResponse> {
  return leaderboardFetch<LeaderboardResponse>(
    `/api/leaderboard?period=${period}&limit=${limit}&offset=${offset}`,
    token,
  )
}

export async function fetchMyLeaderboardRank(
  period: LeaderboardPeriod,
  token: string,
): Promise<MyRankResponse> {
  return leaderboardFetch<MyRankResponse>(`/api/leaderboard/me?period=${period}`, token)
}
