/**
 * Hand DNA — a qualitative, rule-based decomposition of a starting hand's
 * preflop properties. Every bucket is derived directly from the two ranks
 * and suitedness — no invented scores, no external chart data.
 */

export type DNALevel = 'low' | 'medium' | 'high'

export interface HandDNA {
  hand: string
  isPair: boolean
  isSuited: boolean
  highCardValue: DNALevel
  connectedness: DNALevel
  nutPotential: string
  blockerValue: string
  playability: DNALevel
}

const RANK_VALUE: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
}

function highCardValue(hi: number, lo: number, isPair: boolean): DNALevel {
  if (isPair) return hi >= 10 ? 'high' : hi >= 7 ? 'medium' : 'low'
  if (hi === 14) return lo >= 10 ? 'high' : lo >= 5 ? 'medium' : 'low'
  if (hi >= 12) return lo >= 10 ? 'high' : lo >= 7 ? 'medium' : 'low'
  if (hi >= 10) return lo >= 9 ? 'medium' : 'low'
  return 'low'
}

function connectedness(hi: number, lo: number, isPair: boolean): DNALevel {
  if (isPair) return 'low'
  const gap = hi - lo - 1
  if (gap <= 0) return 'high'
  if (gap === 1) return 'medium'
  return 'low'
}

function nutPotential(isPair: boolean, isSuited: boolean, conn: DNALevel): string {
  const parts: string[] = []
  if (isPair) parts.push('set potential')
  if (isSuited) parts.push('flush potential')
  if (conn !== 'low') parts.push('straight potential')
  return parts.length > 0 ? parts.join(' + ') : 'limited — mostly one-dimensional showdown value'
}

function blockerValue(hi: number): string {
  if (hi === 14) return 'Ace blocker'
  if (hi === 13) return 'King blocker'
  return 'none'
}

function playability(isPair: boolean, isSuited: boolean, conn: DNALevel, hc: DNALevel): DNALevel {
  let score = 0
  if (isSuited) score += 1
  if (conn === 'high') score += 1
  else if (conn === 'medium') score += 0.5
  if (isPair) score += 1
  if (hc === 'high') score += 1
  else if (hc === 'medium') score += 0.5
  if (score >= 2.5) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

/** Classify a 2-character (pair, e.g. 'AA') or 3-character ('AKs'/'AKo') hand notation. */
export function classifyHandDNA(hand: string): HandDNA {
  const r1 = hand[0]
  const r2 = hand[1]
  const suffix = hand[2]
  const isPair = hand.length === 2
  const isSuited = suffix === 's'
  const v1 = RANK_VALUE[r1] ?? 0
  const v2 = RANK_VALUE[r2] ?? 0
  const hi = Math.max(v1, v2)
  const lo = Math.min(v1, v2)

  const hc = highCardValue(hi, lo, isPair)
  const conn = connectedness(hi, lo, isPair)

  return {
    hand,
    isPair,
    isSuited,
    highCardValue: hc,
    connectedness: conn,
    nutPotential: nutPotential(isPair, isSuited, conn),
    blockerValue: blockerValue(hi),
    playability: playability(isPair, isSuited, conn, hc),
  }
}
