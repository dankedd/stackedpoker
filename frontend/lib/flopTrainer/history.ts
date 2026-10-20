import { GOOD_WITHIN, type Category, type CategoryStats } from "./logic";

/**
 * This browser's recent answers (error per texture category) and, signed
 * out, the best session score. Used to steer the flop choice toward weak
 * categories; signed in, the server's numbers take over
 * (flop_trainer_state). Storage can be blocked: everything degrades to
 * "no history".
 */

const HISTORY_KEY = "sp_flop_trainer_history";
const BEST_KEY = "sp_flop_trainer_best";
const KEEP = 200;

interface Entry {
  c: Category;
  e: number;
}

function read(): Entry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.c === "string" && typeof x.e === "number") : [];
  } catch {
    return [];
  }
}

export function recordLocalAnswer(c: Category, error: number) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...read(), { c, e: error }].slice(-KEEP)));
  } catch {
    // Blocked storage: no history, the flop choice is just not adaptive.
  }
}

export function localCategoryStats(): CategoryStats {
  const acc: Partial<Record<Category, [number, number, number]>> = {};
  for (const { c, e } of read()) {
    const a = (acc[c] ??= [0, 0, 0]);
    a[0] += 1;
    a[1] += e;
    if (e <= GOOD_WITHIN) a[2] += 1;
  }
  const out: CategoryStats = {};
  for (const [c, [n, sum, hits]] of Object.entries(acc) as [Category, [number, number, number]][]) {
    out[c] = [n, sum / n, Math.round((1000 * hits) / n) / 10];
  }
  return out;
}

/** Average error of the last `n` answers in this browser, or null. */
export function localRecentError(n = 10): number | null {
  const h = read().slice(-n);
  return h.length >= 3 ? h.reduce((s, x) => s + x.e, 0) / h.length : null;
}

export function readLocalBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Returns true when `points` is a new best. */
export function recordLocalBest(points: number): boolean {
  if (points <= readLocalBest()) return false;
  try {
    localStorage.setItem(BEST_KEY, String(points));
  } catch {
    // Private window: the best lasts this visit.
  }
  return true;
}
