/**
 * Flop Equity Trainer — grading, flop choice and explanations.
 *
 * Data: precomputed per spot and canonical flop from Modern Poker Theory's
 * ranges (supabase_flop_equity.sql, backend/app/flop_equity). Nothing is
 * computed live. The server re-grades every signed-in answer
 * (backend/app/flop_equity/grading.py — keep the two in step); the browser's
 * verdict is only the instant feedback.
 */

export type NutSide = "IP" | "OOP" | "EQUAL";
export type Verdict = "perfect" | "good" | "miss";
export type BucketKey = "strong" | "good" | "weak" | "trash";
export type Buckets = Record<BucketKey, number>;

export interface FlopSpot {
  spot_id: string;
  spot_type: string;
  ip: string;
  oop: string;
  stack_bb: number;
  action: string;
  ip_range_pct: number | null;
  oop_range_pct: number | null;
  source_pages: number[];
}

export interface NutAdv {
  ip: number;
  oop: number;
  diff: number;
  leader: NutSide;
  equal_within_pp?: number;
}

/** What the browser keeps for every flop of a spot (to choose the next flop). */
export interface FlopIndexRow {
  flop: string;
  flop_weight: number;
  equity_ip: number;
  nut_adv: NutAdv;
  texture: string[];
}

/** The rest of a flop's row, loaded for the flop on screen. */
export interface FlopDetail {
  equity_oop: number;
  buckets_ip: Buckets;
  buckets_oop: Buckets;
}

export const BUCKETS: { key: BucketKey; label: string; rule: string; color: string }[] = [
  // Bucket names and edges: Modern Poker Theory, Equity Buckets (p.597). Colours are our own.
  { key: "strong", label: "Strong", rule: "75%+ equity", color: "#8b5cf6" },
  { key: "good", label: "Good", rule: "50–75%", color: "#38bdf8" },
  { key: "weak", label: "Weak", rule: "33–50%", color: "#f59e0b" },
  { key: "trash", label: "Trash", rule: "under 33%", color: "#475569" },
];

export const SESSION_LENGTH = 10;
export const PERFECT_WITHIN = 3;
export const GOOD_WITHIN = 7;
const POINTS: Record<Verdict, number> = { perfect: 2, good: 1, miss: 0 };
export const NUT_BONUS = 1;
export const MAX_SESSION_POINTS = SESSION_LENGTH * (POINTS.perfect + NUT_BONUS);

export interface Graded {
  verdict: Verdict;
  error: number;
  nutCorrect: boolean;
  points: number;
}

export function gradeAnswer(guess: number, exact: number, nutGuess: NutSide, nutActual: NutSide): Graded {
  const error = Math.round(Math.abs(guess - exact) * 100) / 100;
  const verdict: Verdict = error <= PERFECT_WITHIN ? "perfect" : error <= GOOD_WITHIN ? "good" : "miss";
  const nutCorrect = nutGuess === nutActual;
  return { verdict, error, nutCorrect, points: POINTS[verdict] + (nutCorrect ? NUT_BONUS : 0) };
}

// ── Texture categories (same rules as grading.py texture_category) ─────────

export type Category = "paired" | "monotone" | "ace_high" | "king_high" | "high" | "connected" | "low_dry";

export const CATEGORY_LABEL: Record<Category, string> = {
  paired: "Paired boards",
  monotone: "Monotone boards",
  ace_high: "Ace-high boards",
  king_high: "King-high boards",
  high: "Queen- and jack-high boards",
  connected: "Low connected boards",
  low_dry: "Low dry boards",
};

const label = (texture: string[], prefix: string) =>
  texture.find((t) => t.startsWith(prefix))?.slice(prefix.length) ?? "";

export function textureCategory(texture: string[]): Category {
  if (texture.includes("trips") || texture.includes("paired")) return "paired";
  if (texture.includes("monotone")) return "monotone";
  const rank = label(texture, "rank:").slice(0, 1);
  if (rank === "A") return "ace_high";
  if (rank === "K") return "king_high";
  if (rank === "Q" || rank === "J") return "high";
  return Number(label(texture, "straights:") || 0) >= 1 ? "connected" : "low_dry";
}

// ── Difficulty and flop choice ──────────────────────────────────────────────

export type Tier = 1 | 2 | 3;

/** Weighted terciles of the equity gap |equity − 50| over a spot's flops. */
export function tierCuts(index: FlopIndexRow[]): [number, number] {
  const rows = [...index].sort((a, b) => Math.abs(a.equity_ip - 50) - Math.abs(b.equity_ip - 50));
  const total = rows.reduce((s, r) => s + r.flop_weight, 0);
  const cuts: number[] = [];
  let acc = 0;
  for (const r of rows) {
    acc += r.flop_weight;
    if (cuts.length < 2 && acc >= (total * (cuts.length + 1)) / 3) cuts.push(Math.abs(r.equity_ip - 50));
  }
  return [cuts[0] ?? 0, cuts[1] ?? 0];
}

/**
 * 1 = clear (a big equity gap, or a trips board), 3 = close (the third of
 * flops nearest to 50/50), 2 = in between.
 */
export function tierOf(row: FlopIndexRow, cuts: [number, number]): Tier {
  const gap = Math.abs(row.equity_ip - 50);
  if (row.texture.includes("trips") || gap > cuts[1]) return 1;
  return gap <= cuts[0] ? 3 : 2;
}

/** A session runs from clear flops to close ones. */
const SESSION_TIERS: Tier[] = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];

/**
 * The tier for question `n` (0-based) of a session, shifted one step by how
 * accurate the player has been lately (average error over recent answers).
 */
export function tierFor(n: number, recentError: number | null): Tier {
  const base = SESSION_TIERS[Math.min(n, SESSION_TIERS.length - 1)];
  const shift = recentError === null ? 0 : recentError <= PERFECT_WITHIN ? 1 : recentError > GOOD_WITHIN ? -1 : 0;
  return Math.max(1, Math.min(3, base + shift)) as Tier;
}

/** Per category: answers, average error, and (when known) % of answers within 7 points. */
export type CategoryStats = Partial<Record<Category, [answers: number, avgError: number, hitPct?: number]>>;

/**
 * How much more often each category is dealt: up to 3x for categories where
 * the player's average error is well above their overall average (at least
 * 3 answers in that category).
 */
export function categoryWeights(stats: CategoryStats): Record<Category, number> {
  const entries = Object.entries(stats) as [Category, [number, number, number?]][];
  const n = entries.reduce((s, [, [k]]) => s + k, 0);
  const overall = n > 0 ? entries.reduce((s, [, [k, e]]) => s + k * e, 0) / n : 0;
  const w = {} as Record<Category, number>;
  for (const c of Object.keys(CATEGORY_LABEL) as Category[]) {
    const s = stats[c];
    w[c] = s && s[0] >= 3 ? 1 + Math.max(0, Math.min(2, (s[1] - overall) / 3)) : 1;
  }
  return w;
}

/**
 * The next flop: from the wanted tier (or the nearest tier that has flops
 * left), weighted by how often the flop occurs (its suit-isomorphism weight)
 * and by the category weights. `exclude` keeps a session free of repeats.
 */
export function pickFlop(
  index: FlopIndexRow[],
  cuts: [number, number],
  tier: Tier,
  weights: Record<Category, number>,
  exclude: Set<string>,
  rand: () => number,
): FlopIndexRow {
  const pool = index.filter((r) => !exclude.has(r.flop));
  const source = pool.length ? pool : index;
  const order: Tier[] = tier === 1 ? [1, 2, 3] : tier === 2 ? [2, 1, 3] : [3, 2, 1];
  let candidates: FlopIndexRow[] = [];
  for (const t of order) {
    candidates = source.filter((r) => tierOf(r, cuts) === t);
    if (candidates.length) break;
  }
  const wt = (r: FlopIndexRow) => r.flop_weight * weights[textureCategory(r.texture)];
  const total = candidates.reduce((s, r) => s + wt(r), 0);
  let x = rand() * total;
  for (const r of candidates) {
    x -= wt(r);
    if (x <= 0) return r;
  }
  return candidates[candidates.length - 1];
}

// ── Cards ───────────────────────────────────────────────────────────────────

const SUITS = ["c", "d", "h", "s"] as const;

/**
 * The canonical flop with its suits relabelled at random (equity does not
 * depend on which suits they are), so the same flop doesn't always show
 * clubs first. Highest card first.
 */
export function displayCards(flop: string, rand: () => number): string[] {
  const perm = [...SUITS];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const map = Object.fromEntries(SUITS.map((s, i) => [s, perm[i]]));
  return [0, 2, 4].map((i) => flop[i] + map[flop[i + 1]]);
}

export function displayPos(pos: string): string {
  return pos === "BN" ? "BTN" : pos;
}

/** "BTN opens 2.3x, BB calls" from the stored action text. */
export function spotTitle(spot: FlopSpot): string {
  return spot.action.replace(/\bBN\b/g, "BTN").replace(", folds to BB", "");
}

// ── Explanation (our own words, from the numbers) ──────────────────────────
// Each note was checked against the precomputed averages per category for
// both MVP spots (BTN and UTG vs BB, 40bb): ace-high gives the raiser the
// biggest lead, connected boards the smallest, monotone below average; on
// paired boards the BB has its highest Strong share and a lot of Trash; on
// low dry boards overpairs are 5–15% of the raiser's range and ~1% of the BB's.

const CATEGORY_NOTE: Record<Category, string> = {
  paired: "Paired boards connect with few hands, so the caller's range splits into a handful of trips and a lot of misses.",
  monotone: "On monotone boards any hand with one card of the suit has a flush or a draw, so the raiser's lead is smaller than on most boards.",
  ace_high: "High, dry cards like an ace suit the raiser, whose range holds more big aces and broadways.",
  king_high: "High, dry cards like a king suit the raiser, whose range holds more big broadways.",
  high: "Queen- and jack-high boards still lean toward the raiser's broadways, but the caller pairs up more often than on ace- or king-high boards.",
  connected: "Low, connected boards hit the caller's wider range of suited and connected hands; this is where the raiser's edge shrinks most.",
  low_dry: "Low, dry boards miss most hands, so overpairs — far more common in the raiser's range — carry a lot of weight.",
};

export function explain(spot: FlopSpot, row: FlopIndexRow, detail: FlopDetail | null): string {
  const ip = displayPos(spot.ip);
  const oop = displayPos(spot.oop);
  const eq = Math.round(row.equity_ip);
  const lead =
    eq >= 60 ? `${ip} is well ahead at ${eq}%.` : eq >= 54 ? `${ip} has the edge at ${eq}%.` : eq > 46 ? `Close to even: ${ip} has ${eq}%.` : `${oop} is ahead: ${ip} has only ${eq}%.`;
  const nut = row.nut_adv;
  const strong =
    nut.leader === "EQUAL"
      ? `Both ranges hold about as many Strong hands (${fmt(nut.ip)}% vs ${fmt(nut.oop)}%).`
      : `${nut.leader === "IP" ? ip : oop} has more Strong hands: ${fmt(nut.leader === "IP" ? nut.ip : nut.oop)}% vs ${fmt(nut.leader === "IP" ? nut.oop : nut.ip)}%.`;
  const trash = detail && detail.buckets_oop.trash - detail.buckets_ip.trash >= 8 ? ` ${oop} misses more often: ${fmt(detail.buckets_oop.trash)}% Trash.` : "";
  return `${lead} ${strong}${trash} ${CATEGORY_NOTE[textureCategory(row.texture)]}`;
}

export const fmt = (x: number) => (Math.round(x * 10) / 10).toString();
