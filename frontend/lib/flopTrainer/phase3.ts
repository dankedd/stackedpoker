/**
 * Flop Equity Trainer, Phase 3: the c-bet question, quick fire (A vs B),
 * texture tracking and the explorer's flop handling.
 *
 * The c-bet advice mirrors backend/app/flop_equity/grading.py cbet_advice —
 * same data file (cbetProfiles.json, a byte-for-byte copy checked by the
 * backend tests), same rules. Signed in, the server's verdict is the one
 * that counts.
 */

import CBET from "./cbetProfiles.json";
import {
  CATEGORY_LABEL,
  textureCategory,
  type BucketKey,
  type Buckets,
  type Category,
  type CategoryStats,
  type FlopIndexRow,
} from "./logic";

// ── C-bet ───────────────────────────────────────────────────────────────────

export type Band = "high" | "mid" | "low";
export type Size = "small" | "big";

export const BAND_LABEL: Record<Band, string> = { high: "High (80%+)", mid: "Mid (60–80%)", low: "Low (under 60%)" };
export const SIZE_LABEL: Record<Size, string> = { small: "Small (min-bet or 1/3)", big: "Big (1/2 or 2/3)" };
const BANDS: Band[] = ["high", "mid", "low"];
const BAND_TIE = 1.1;

export type BookStrategy = Partial<Record<"bet_2_3" | "bet_1_2" | "bet_1_3" | "bet_min" | "check", number>>;

export interface CbetAdvice {
  size: Size;
  band: Band;
  /** Every band that counts as right (near-ties between the book's groups). */
  bands: Band[];
  source: "book" | "profile";
  /** The book's printed strategy for this flop (source "book" only). */
  strategy?: BookStrategy;
  pages: number[];
  distance?: number;
  /** The texture rule that forced a small size, if any. */
  rule?: string;
}

interface Profile {
  band: Band;
  size: Size;
  page: number;
  ip: number[];
  oop: number[];
}

interface SizeRule {
  texture: string;
  size: Size;
  pages: number[];
  also_band?: Band;
}

const PROFILES = CBET.profiles as Profile[];
const RULES = CBET.size_rules as SizeRule[];
const ORDER = CBET.bucket_order as BucketKey[];

export const bandOf = (betPct: number): Band => (betPct >= 80 ? "high" : betPct >= 60 ? "mid" : "low");

export function cbetAdvice(spotId: string, flop: string, ip: Buckets, oop: Buckets, texture: string[]): CbetAdvice {
  const book = CBET.book_flops.find((b) => b.spot_id === spotId && b.flop === flop);
  if (book) {
    const s = book.strategy as BookStrategy;
    const big = (s.bet_2_3 ?? 0) + (s.bet_1_2 ?? 0);
    const small = (s.bet_1_3 ?? 0) + (s.bet_min ?? 0);
    const band = bandOf(100 - (s.check ?? 0));
    return { size: big > small ? "big" : "small", band, bands: [band], source: "book", strategy: s, pages: book.pages };
  }
  const rule = RULES.find((r) => texture.includes(r.texture));
  const v = [...ORDER.map((k) => ip[k]), ...ORDER.map((k) => oop[k])];
  const scored = PROFILES.filter((p) => !rule || p.size === rule.size)
    .map((p) => ({ d: Math.sqrt([...p.ip, ...p.oop].reduce((sum, x, i) => sum + (v[i] - x) ** 2, 0)), p }))
    .sort((a, b) => a.d - b.d);
  const best = scored[0];
  const bands = new Set(scored.filter((x) => x.p.size === best.p.size && x.d <= best.d * BAND_TIE).map((x) => x.p.band));
  if (rule?.also_band) bands.add(rule.also_band);
  return {
    size: best.p.size,
    band: best.p.band,
    bands: BANDS.filter((b) => bands.has(b)),
    source: "profile",
    pages: [...new Set([675, best.p.page, ...(rule?.pages ?? [])])].sort((a, b) => a - b),
    distance: Math.round(best.d * 10) / 10,
    ...(rule ? { rule: rule.texture } : {}),
  };
}

export function gradeCbet(band: Band, size: Size, advice: CbetAdvice) {
  const bandOk = advice.bands.includes(band);
  const sizeOk = size === advice.size;
  return { bandOk, sizeOk, points: Number(bandOk) + Number(sizeOk) };
}

/** One line on why, in our own words, from the advice and the flop's buckets. */
export function explainCbet(a: CbetAdvice, ipName: string, oopName: string, oop: Buckets): string {
  if (a.source === "book") {
    const s = a.strategy ?? {};
    const parts = (
      [
        ["2/3 pot", s.bet_2_3],
        ["1/2 pot", s.bet_1_2],
        ["1/3 pot", s.bet_1_3],
        ["min-bet", s.bet_min],
        ["check", s.check],
      ] as const
    )
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k} ${v}%`);
    return `Reference strategy for this exact flop: ${parts.join(" · ")}.`;
  }
  const size =
    a.rule === "paired" || a.rule === "trips"
      ? "On paired boards small bets are the norm: few hands connect, and the BB's range splits into strong hands and misses."
      : a.rule === "monotone"
        ? "On monotone boards small bets are preferred: a big bet folds the BB's weak flush draws and leaves you against its flushes."
        : a.size === "big"
          ? `${oopName} has few Strong hands (${Math.round(oop.strong)}%) and plenty that would call, so ${ipName} sizes up.`
          : `${oopName} has enough Strong hands (${Math.round(oop.strong)}%) to raise, so ${ipName} keeps the bet small.`;
  const freq =
    a.band === "high"
      ? `${oopName}'s range is full of Trash (${Math.round(oop.trash)}%), so ${ipName} can bet almost everything.`
      : a.band === "mid"
        ? `The ranges are closer here, so ${ipName} checks back part of its good-but-not-great hands.`
        : `This board suits ${oopName}: ${ipName} checks a lot and bets a more polarized range.`;
  return `${size} ${freq}`;
}

// ── Texture tracking ────────────────────────────────────────────────────────

/** [answers, average error, % within 7 points]; older state rows have no hit rate. */
export type CategoryRow = [number, number, number?];

/** The category the player judges worst: lowest hit rate, then highest error (at least `min` answers). */
export function weakestCategory(stats: CategoryStats, min = 5): { category: Category; row: CategoryRow } | null {
  const rows = (Object.entries(stats) as [Category, CategoryRow][]).filter(([c, r]) => c in CATEGORY_LABEL && r[0] >= min);
  if (rows.length < 2) return null;
  rows.sort((a, b) => (a[1][2] ?? 100) - (b[1][2] ?? 100) || b[1][1] - a[1][1]);
  return { category: rows[0][0], row: rows[0][1] };
}

export function isCategory(x: string | null): x is Category {
  return Boolean(x && x in CATEGORY_LABEL);
}

/** Restrict a spot's flops to one category (when training a weak spot). */
export function inCategory(index: FlopIndexRow[], c: Category | null): FlopIndexRow[] {
  if (!c) return index;
  const rows = index.filter((r) => textureCategory(r.texture) === c);
  return rows.length ? rows : index;
}

// ── Quick fire ──────────────────────────────────────────────────────────────

export const VERSUS_TIE = 0.5;

/**
 * Two flops of one spot whose equities differ by `minGap`–`maxGap` points,
 * each drawn by how often it occurs. Smaller gaps are harder.
 */
export function pickPair(index: FlopIndexRow[], minGap: number, maxGap: number, rand: () => number): [FlopIndexRow, FlopIndexRow] {
  const draw = (rows: FlopIndexRow[]) => {
    const total = rows.reduce((s, r) => s + r.flop_weight, 0);
    let x = rand() * total;
    for (const r of rows) {
      x -= r.flop_weight;
      if (x <= 0) return r;
    }
    return rows[rows.length - 1];
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    const a = draw(index);
    const partners = index.filter((r) => {
      const gap = Math.abs(r.equity_ip - a.equity_ip);
      return r.flop !== a.flop && gap >= minGap && gap <= maxGap;
    });
    if (partners.length) {
      const b = draw(partners);
      return rand() < 0.5 ? [a, b] : [b, a];
    }
  }
  const sorted = [...index].sort((x, y) => x.equity_ip - y.equity_ip);
  return [sorted[0], sorted[sorted.length - 1]];
}

/** Gap range for the n-th pick of a run: wide at first, narrowing to 2–4 points. */
export function versusGap(streak: number): [number, number] {
  if (streak < 3) return [8, 20];
  if (streak < 8) return [4, 8];
  return [2, 4];
}

export function versusCorrect(pick: "a" | "b", a: number, b: number): boolean {
  const [picked, other] = pick === "a" ? [a, b] : [b, a];
  return picked >= other - VERSUS_TIE;
}

// ── Explorer ────────────────────────────────────────────────────────────────

const RANKS = "23456789TJQKA";
const SUITS = ["c", "d", "h", "s"];
const rankOf = (c: string) => RANKS.indexOf(c[0]) + 2;

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}
const SUIT_PERMS = permutations(SUITS);

/** Same as cards.py canonical(): the smallest relabelling, cards high to low. */
export function canonicalFlop(cards: string[]): string {
  let best: string | null = null;
  for (const perm of SUIT_PERMS) {
    const map = Object.fromEntries(SUITS.map((s, i) => [s, perm[i]]));
    const key = cards
      .map((c) => c[0] + map[c[1]])
      .sort((x, y) => rankOf(y) - rankOf(x) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0))
      .join("");
    if (best === null || key < best) best = key;
  }
  return best ?? "";
}

/** The 13x13 grid's hand at row i, column j (AA top left; suited above the diagonal). */
export function gridHand(i: number, j: number): string {
  const r = "AKQJT98765432";
  if (i === j) return r[i] + r[j];
  return i < j ? `${r[i]}${r[j]}s` : `${r[j]}${r[i]}o`;
}
