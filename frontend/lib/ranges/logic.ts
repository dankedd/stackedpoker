import { CASH_OPEN_CHARTS, DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "./data";
import type {
  DefenseChart,
  DefenseSpot,
  HandClass,
  OpenChart,
  PushFoldChart,
  RangeActionKey,
} from "./types";

/**
 * Pure logic behind the preflop range tool and its trainer — a faithful port
 * of the trainer in the original standalone open-ranges.html. No React, no
 * randomness of its own: every function that needs chance takes an `rng`, so
 * the tests can pin it and the component can pass Math.random client-side.
 */

export type Rng = () => number;

// ── Hands ───────────────────────────────────────────────────────────────────

export const RANK_ORDER = "AKQJT98765432";

/** Grid cell (row, col) → hand class. Suited above the diagonal, offsuit below. */
export function handAt(row: number, col: number): HandClass {
  if (row === col) return RANK_ORDER[row] + RANK_ORDER[col];
  return col > row ? RANK_ORDER[row] + RANK_ORDER[col] + "s" : RANK_ORDER[col] + RANK_ORDER[row] + "o";
}

export const ALL_HANDS: HandClass[] = Array.from({ length: 169 }, (_, i) => handAt(Math.floor(i / 13), i % 13));

/** Pair 6, suited 4, offsuit 12. */
export function combos(hand: HandClass): number {
  if (hand.length === 2) return 6;
  return hand[2] === "s" ? 4 : 12;
}

/** Book/source naming uses "BN"; the site everywhere else says "BTN". Display only. */
export function displayPos(pos: string): string {
  return pos === "BN" ? "BTN" : pos;
}

// ── Push / fold ─────────────────────────────────────────────────────────────

/**
 * Max stack (bb) at which a hand is shoved. A printed number wins; an empty
 * cell means "always" (black background → 10, i.e. every stack ≤10bb) or
 * "never" (red background → 0).
 */
export function pushValue(cell: [string, string]): number {
  const [bg, n] = cell;
  if (n !== "") return Number(n);
  return bg === "black" ? 10 : 0;
}

export function shouldPush(cell: [string, string], stack: number): boolean {
  return pushValue(cell) >= stack;
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export type TrainerType = "open" | "def" | "mix";
export type TrainerMode = "all" | "mtt" | "pf" | "cash";

export type Scenario =
  | { type: "open"; kind: "freq"; chart: OpenChart; stack: number; fmt: "mtt" | "cash"; hero: string; w?: number }
  | { type: "open"; kind: "pf"; chart: PushFoldChart; stack: number; fmt: "mtt"; hero: string; w: number }
  | {
      type: "def";
      kind: "freq";
      chart: DefenseChart;
      stack: number;
      fmt: "mtt" | "cash";
      hero: string;
      vil: string;
      spot: DefenseSpot;
      w?: number;
    };

export type DefenseScenario = Extract<Scenario, { type: "def" }>;

export function openPool(mode: TrainerMode): Scenario[] {
  const pool: Scenario[] = [];
  if (mode === "all" || mode === "mtt")
    MTT_OPEN_CHARTS.forEach((c) => pool.push({ type: "open", kind: "freq", chart: c, stack: c.stack, fmt: "mtt", hero: c.pos }));
  if (mode === "all" || mode === "cash")
    CASH_OPEN_CHARTS.forEach((c) => pool.push({ type: "open", kind: "freq", chart: c, stack: c.stack, fmt: "cash", hero: c.pos }));
  if (mode === "all" || mode === "pf")
    PUSH_FOLD_CHARTS.forEach((c) => {
      for (let s = 2; s <= 10; s++) pool.push({ type: "open", kind: "pf", chart: c, stack: s, fmt: "mtt", hero: c.pos, w: 1 / 9 });
    });
  return pool;
}

export function defensePool(mode: TrainerMode): Scenario[] {
  return DEFENSE_CHARTS.filter(
    (c) => mode === "all" || (mode === "mtt" && c.group === "mtt") || (mode === "cash" && c.group === "cash"),
  ).map((c) => ({
    type: "def" as const,
    kind: "freq" as const,
    chart: c,
    stack: c.stack,
    fmt: c.group,
    hero: c.hero,
    vil: c.vil,
    spot: c.spot,
  }));
}

function pickWeighted(pool: Scenario[], rng: Rng): Scenario {
  const total = pool.reduce((s, p) => s + (p.w ?? 1), 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= p.w ?? 1;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

export function pickScenario(type: TrainerType, mode: TrainerMode, rng: Rng): Scenario {
  const t = type === "mix" ? (rng() < 0.5 ? "open" : "def") : type;
  let pool = t === "open" ? openPool(mode) : defensePool(mode);
  if (!pool.length) pool = openPool(mode).length ? openPool(mode) : defensePool(mode);
  return pickWeighted(pool, rng);
}

/** Frequencies of every button-relevant action for `hand` in this scenario. */
export function frequencies(sc: Scenario, hand: HandClass): Partial<Record<RangeActionKey, number>> {
  const f: Partial<Record<RangeActionKey, number>> =
    sc.type === "def" ? { fold: 0, call: 0, raise: 0, allin: 0 } : { fold: 0, limp: 0, raise: 0, allin: 0 };
  if (sc.kind === "pf") {
    if (shouldPush(sc.chart.grid[hand], sc.stack)) f.allin = 1;
    else f.fold = 1;
    return f;
  }
  const row = sc.chart.grid[hand];
  if (!row) return f;
  sc.chart.actions.forEach((a, i) => {
    f[a.key] = (f[a.key] ?? 0) + row[i];
  });
  return f;
}

// ── Dealing ─────────────────────────────────────────────────────────────────

export const SUITS = ["s", "h", "d", "c"] as const;

/** Real cards for a hand class, e.g. "AKs" → ["As","Ks"]. */
export function cardsFor(hand: HandClass, rng: Rng): [string, string] {
  const s1 = Math.floor(rng() * 4);
  let s2 = s1;
  if (hand.length === 2 || hand[2] === "o") {
    do s2 = Math.floor(rng() * 4);
    while (s2 === s1);
  }
  return [hand[0] + SUITS[s1], hand[1] + SUITS[s2]];
}

/** Hands that actually reach this spot (null cells never do). */
export function dealableHands(sc: Scenario): HandClass[] {
  const grid = sc.chart.grid as Record<string, unknown>;
  return Object.keys(grid).filter((h) => grid[h] !== null);
}

/** Combo-weighted hand class, skipping null cells. */
export function dealHand(sc: Scenario, rng: Rng): { hand: HandClass; cards: [string, string] } {
  const hands = dealableHands(sc);
  const total = hands.reduce((s, h) => s + combos(h), 0);
  let r = rng() * total;
  for (const h of hands) {
    r -= combos(h);
    if (r <= 0) return { hand: h, cards: cardsFor(h, rng) };
  }
  const h = hands[hands.length - 1];
  return { hand: h, cards: cardsFor(h, rng) };
}

export type Deal = Scenario & { hand: HandClass; cards: [string, string] };

/**
 * One trainer hand. With `fewerTrivialFolds`, a hand that is 100% fold is
 * re-dealt 80% of the time (up to 80 tries), so the trainer spends its time
 * on real decisions without hiding that most hands are folds.
 */
export function newDeal(type: TrainerType, mode: TrainerMode, fewerTrivialFolds: boolean, rng: Rng): Deal {
  let sc: Scenario;
  let d: { hand: HandClass; cards: [string, string] };
  let tries = 0;
  do {
    sc = pickScenario(type, mode, rng);
    d = dealHand(sc, rng);
    const f = frequencies(sc, d.hand);
    if (!fewerTrivialFolds || (f.fold ?? 0) < 0.999) break;
    if (rng() < 0.2) break;
  } while (++tries < 80);
  return { ...sc, ...d } as Deal;
}

// ── Buttons and labels ──────────────────────────────────────────────────────

/** Villain is all-in when the chart only offers call/fold. */
export function villainAllIn(sc: Scenario): boolean {
  return sc.type === "def" && !sc.chart.actions.some((a) => a.key === "raise" || a.key === "allin");
}

/**
 * The buttons that make sense in this spot:
 *  - villain all-in            → fold / call
 *  - re-raise would be all-in  → fold / call / all-in
 *  - push/fold (≤10bb)         → fold / all-in
 *  - open                      → fold / limp / raise / all-in
 *  - other defense             → fold / call / raise / all-in
 */
export function availableActions(sc: Scenario): RangeActionKey[] {
  if (sc.kind === "pf") return ["fold", "allin"];
  if (sc.type !== "def") return ["fold", "limp", "raise", "allin"];
  if (villainAllIn(sc)) return ["fold", "call"];
  const keys = sc.chart.actions.map((a) => a.key);
  if (keys.includes("allin") && !keys.includes("raise")) return ["fold", "call", "allin"];
  return ["fold", "call", "raise", "allin"];
}

/** Villain's open size, e.g. "2x". */
export function openSize(sc: DefenseScenario): string {
  if (sc.fmt === "cash") return sc.vil === "SB" ? "3x" : "2.5x";
  if (sc.chart.size) return sc.chart.size;
  if (sc.vil === "SB") return "3.5x";
  const oc = MTT_OPEN_CHARTS.find((c) => c.pos === sc.vil && c.stack === sc.stack);
  const raise = oc?.actions.find((a) => a.key === "raise");
  return raise ? raise.label.replace("Raise ", "") : "2x";
}

const RAISE_NAME: Record<DefenseSpot, string> = { open: "3-bet", push: "3-bet", limp: "Raise", "4bet": "5-bet", lr: "4-bet" };

export function actionName(k: RangeActionKey, sc: Scenario): string {
  if (sc.type !== "def") return { fold: "Fold", limp: "Limp", raise: "Raise", allin: "All-in", call: "Call" }[k];
  if (k === "call") return sc.spot === "limp" ? "Check" : villainAllIn(sc) ? "Call all-in" : "Call";
  if (k === "raise") return RAISE_NAME[sc.spot];
  return k === "fold" ? "Fold" : k === "allin" ? "All-in" : "Limp";
}

/** What happened before hero acts, e.g. "BTN opens 2x". */
export function spotLabel(sc: DefenseScenario): string {
  const v = displayPos(sc.vil);
  const allIn = villainAllIn(sc);
  switch (sc.spot) {
    case "open":
      return `${v} opens ${openSize(sc)}`;
    case "push":
      return `${v} goes all-in`;
    case "limp":
      return `${v} limps`;
    case "4bet":
      return allIn ? `You 3-bet, ${v} 4-bets all-in` : `You 3-bet, ${v} 4-bets`;
    case "lr":
      return allIn ? `${v} limped, you raised, ${v} jams` : `${v} limped, you raised, ${v} re-raises`;
  }
}

export function scenarioTitle(sc: Scenario): string {
  const hero = displayPos(sc.hero);
  if (sc.type === "def") return `${hero} vs ${displayPos(sc.vil)}${sc.fmt === "mtt" ? ` · ${sc.stack}bb` : " · cash"}`;
  return sc.kind === "pf" ? `${hero} · ${sc.stack}bb push/fold` : `${hero} · ${sc.stack}bb${sc.fmt === "cash" ? " cash" : ""}`;
}

// ── Table ───────────────────────────────────────────────────────────────────

export const SEATS_9 = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB", "BB"];
export const SEATS_6 = ["LJ", "HJ", "CO", "BN", "SB", "BB"];

export function seatsFor(sc: Scenario): string[] {
  return sc.fmt === "cash" ? SEATS_6 : SEATS_9;
}

export type SeatState = "hero" | "villain" | "folded" | "waiting";

export function seatStatus(sc: Scenario, pos: string): { state: SeatState; text: string } {
  const seats = seatsFor(sc);
  const hi = seats.indexOf(sc.hero);
  const i = seats.indexOf(pos);
  if (pos === sc.hero) return { state: "hero", text: "to act" };
  if (sc.type !== "def") return i < hi ? { state: "folded", text: "fold" } : { state: "waiting", text: "" };
  if (pos === sc.vil) {
    const allIn = villainAllIn(sc);
    const text = {
      open: `raise ${openSize(sc)}`,
      push: "all-in",
      limp: "limp",
      "4bet": allIn ? "4-bet all-in" : "4-bet",
      lr: allIn ? "all-in" : "re-raise",
    }[sc.spot];
    return { state: "villain", text };
  }
  const vi = seats.indexOf(sc.vil);
  if (sc.spot === "4bet" || sc.spot === "lr") return { state: "folded", text: "fold" };
  if (i < hi && i !== vi) return { state: "folded", text: "fold" };
  return { state: "waiting", text: "" };
}

/** Chips in front of a seat, or "" for none. */
export function betFor(sc: Scenario, pos: string): string {
  if (sc.type === "def") {
    const allIn = villainAllIn(sc);
    if (pos === sc.vil) {
      if (sc.spot === "open") return openSize(sc).replace("x", "") + "bb";
      if (sc.spot === "push") return sc.stack + "bb";
      if (sc.spot === "limp") return "1bb";
      if (sc.spot === "4bet") return allIn ? sc.stack + "bb" : "4-bet";
      if (sc.spot === "lr") return allIn ? sc.stack + "bb" : "re-raise";
    }
    if (pos === sc.hero && sc.spot === "4bet") return "3-bet";
    if (pos === sc.hero && sc.spot === "lr") return "raise";
  }
  return pos === "SB" ? "0.5bb" : pos === "BB" ? "1bb" : "";
}

// ── Grading and score ───────────────────────────────────────────────────────

export type Verdict = "correct" | "mixed" | "wrong";

export interface Grade {
  verdict: Verdict;
  /** Frequency of the chosen action. */
  chosen: number;
  bestKey: RangeActionKey;
  best: number;
}

/**
 * Correct when the action is played ≥50%, or it is (tied for) the most
 * frequent action and played more than 5%. Mixed when played ≥10%. Else wrong.
 */
export function gradeFrequencies(f: Partial<Record<RangeActionKey, number>>, k: RangeActionKey): Grade {
  const entries = Object.entries(f) as [RangeActionKey, number][];
  const best = Math.max(...entries.map(([, v]) => v));
  const bestKey = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const p = f[k] ?? 0;
  let verdict: Verdict;
  if (p >= 0.5 || (p > 0.05 && p >= best - 1e-9)) verdict = "correct";
  else if (p >= 0.1) verdict = "mixed";
  else verdict = "wrong";
  return { verdict, chosen: p, bestKey, best };
}

export function grade(sc: Scenario, hand: HandClass, k: RangeActionKey): Grade {
  return gradeFrequencies(frequencies(sc, hand), k);
}

export interface TrainerStats {
  hands: number;
  correct: number;
  mixed: number;
  streak: number;
}

export function applyVerdict(s: TrainerStats, v: Verdict): TrainerStats {
  return {
    hands: s.hands + 1,
    correct: s.correct + (v === "correct" ? 1 : 0),
    mixed: s.mixed + (v === "mixed" ? 1 : 0),
    streak: v === "wrong" ? 0 : s.streak + 1,
  };
}

/** (correct + ½·mixed) / hands, as a whole percentage. */
export function scorePct(s: TrainerStats): number {
  return s.hands ? Math.round(((s.correct + s.mixed * 0.5) / s.hands) * 100) : 0;
}
