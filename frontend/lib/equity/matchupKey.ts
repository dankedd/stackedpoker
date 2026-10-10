/**
 * Canonical key for a preflop matchup of two known hands.
 *
 * Preflop, only the pattern of suits matters, not which suits they are:
 * AsKs vs QhQd has exactly the same equity as AhKh vs QsQc. Taking the
 * smallest spelling over all 24 suit relabellings, and over both orders of
 * the two hands, folds the ~1.6 million combo-vs-combo matchups into ~47,000
 * classes — few enough to compute every one exactly, once, offline
 * (scripts/generate-preflop-equity.ts), and look them up instantly.
 *
 * `flipped` says the key lists villain's hand first, so the stored equity
 * belongs to villain and must be mirrored.
 */

const SUITS = ["s", "h", "d", "c"] as const;

const PERMS: string[][] = (() => {
  const out: string[][] = [];
  const permute = (a: string[], k: number) => {
    if (k === a.length) {
      out.push([...a]);
      return;
    }
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      permute(a, k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  permute([...SUITS], 0);
  return out;
})();

function spell(a: string, b: string, p: string[]): string {
  const x = a[0] + p[SUITS.indexOf(a[1] as (typeof SUITS)[number])];
  const y = b[0] + p[SUITS.indexOf(b[1] as (typeof SUITS)[number])];
  return x < y ? x + y : y + x;
}

function smallest(h: readonly string[], v: readonly string[]): string {
  let best = "";
  for (const p of PERMS) {
    const k = `${spell(h[0], h[1], p)}|${spell(v[0], v[1], p)}`;
    if (!best || k < best) best = k;
  }
  return best;
}

export function matchupKey(hero: readonly string[], villain: readonly string[]): { key: string; flipped: boolean } {
  const a = smallest(hero, villain);
  const b = smallest(villain, hero);
  return a <= b ? { key: a, flipped: false } : { key: b, flipped: true };
}

/** "AcKd|QhQs" → [["Ac","Kd"],["Qh","Qs"]]. */
export function keyHands(key: string): [[string, string], [string, string]] {
  const [l, r] = key.split("|");
  return [
    [l.slice(0, 2), l.slice(2, 4)],
    [r.slice(0, 2), r.slice(2, 4)],
  ];
}
