import { describe, expect, it } from "vitest";
import { DEFENSE_CHARTS } from "@/lib/ranges/data";
import { ALL_HANDS, frequencies, type Scenario } from "@/lib/ranges/logic";
import type { DefenseChart, DefenseSpot, RangeActionKey } from "@/lib/ranges/types";
import { parseGGHand } from "../parsers/ggpoker";
import { parsePSHand } from "../parsers/pokerstars";
import { checkPreflop, describeCheck, findSpots, reasonText, spotGroup, type PreflopCheck } from "../preflop";
import { exampleHands } from "@/lib/onboarding/exampleTournament";
import type { ParsedHand } from "../types";

// ── Hand builders ────────────────────────────────────────────────────────────
// Level 500/1,000 with a 125 ante. The button is the last seat, so seat 1 is
// the SB and seat 2 the BB. Pot totals at the end are placeholders: the check
// only reads the preflop actions.

const fmt = (x: number) => x.toLocaleString("en-US");

interface Build {
  players?: number;
  heroSeat: number;
  cards: string;
  stacks?: Record<number, number>;
  /** Preflop lines; "S3" in a line is replaced by seat 3's name. */
  actions: string[];
}

const ggName = (s: number, hero: number) => (s === hero ? "Hero" : `p${s}aaaaaa`);

function gg(b: Build): ParsedHand {
  const n = b.players ?? 8;
  const seats = Array.from({ length: n }, (_, i) => i + 1);
  const name = (s: number) => ggName(s, b.heroSeat);
  const sub = (l: string) => l.replace(/S(\d)/g, (_, s) => name(Number(s)));
  const lines = [
    `Poker Hand #TM9000000777: Tournament #1, Test $1 Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/08 19:00:00`,
    `Table '1' ${n}-max Seat #${n} is the button`,
    ...seats.map((s) => `Seat ${s}: ${name(s)} (${fmt(b.stacks?.[s] ?? 25_000)} in chips)`),
    ...seats.map((s) => `${name(s)}: posts the ante 125`),
    `${name(1)}: posts small blind 500`,
    `${name(2)}: posts big blind 1,000`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [${b.cards}]`,
    ...b.actions.map(sub),
    "*** SHOWDOWN ***",
    `${name(2)} collected 1 from pot`,
    "*** SUMMARY ***",
    "Total pot 1 | Rake 0",
  ];
  const r = parseGGHand(lines.join("\n"));
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

/** PokerStars format, 9-max with a big-blind ante (one player posts the ante for the table). */
function ps(b: Build): ParsedHand {
  const n = b.players ?? 9;
  const seats = Array.from({ length: n }, (_, i) => i + 1);
  const name = (s: number) => (s === b.heroSeat ? "Hero" : `Player${s}`);
  const sub = (l: string) => l.replace(/S(\d)/g, (_, s) => name(Number(s)));
  const lines = [
    `PokerStars Hand #250000009999: Tournament #3800000099, $10+$1 USD Hold'em No Limit - Level X (500/1000) - 2026/07/04 20:15:00 ET`,
    `Table '3800000099 1' 9-max Seat #${n} is the button`,
    ...seats.map((s) => `Seat ${s}: ${name(s)} (${b.stacks?.[s] ?? 25000} in chips)`),
    `${name(2)}: posts the ante 1000`,
    `${name(1)}: posts small blind 500`,
    `${name(2)}: posts big blind 1000`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [${b.cards}]`,
    ...b.actions.map(sub),
    `${name(2)} collected 1 from pot`,
    "*** SUMMARY ***",
    "Total pot 1 | Rake 0",
  ];
  const r = parsePSHand(lines.join("\n"));
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

const folds = (seats: number[]) => seats.map((s) => `S${s}: folds`);

// ── Chart helpers: pick cards from the trainer's own data ───────────────────

function chartOf(spot: DefenseSpot, hero: string, vil: string, stack: number): DefenseChart {
  const c = DEFENSE_CHARTS.find((x) => x.group === "mtt" && x.spot === spot && x.hero === hero && x.vil === vil && x.stack === stack);
  if (!c) throw new Error(`no chart ${hero} vs ${vil} ${spot} ${stack}`);
  return c;
}
function freqsOf(c: DefenseChart, h: string) {
  const sc: Scenario = { type: "def", kind: "freq", chart: c, stack: c.stack, fmt: "mtt", hero: c.hero, vil: c.vil, spot: c.spot };
  return frequencies(sc, h);
}
function pick(c: DefenseChart, test: (f: Partial<Record<RangeActionKey, number>>) => boolean, exclude: string[] = []): string {
  const h = ALL_HANDS.find((x) => c.grid[x] && !exclude.includes(x) && test(freqsOf(c, x)));
  if (!h) throw new Error(`no hand in HR ${c.n} fits`);
  return h;
}
/** Two real cards for a hand class. */
function cards(h: string): string {
  if (h.length === 2) return `${h[0]}s ${h[1]}h`;
  return h[2] === "s" ? `${h[0]}s ${h[1]}s` : `${h[0]}s ${h[1]}h`;
}
const verdict = (h: ParsedHand) => checkPreflop(h)?.verdict;
const detail = (h: ParsedHand) => (checkPreflop(h) as PreflopCheck).detail;

// 8-handed: seat 3 UTG(→UTG+1), 4 UTG+1(→UTG+2), 5 LJ, 6 HJ, 7 CO, 8 BTN, 1 SB, 2 BB.
const BB_VS_BN = chartOf("open", "BB", "BN", 25);
const BB_VS_CO = chartOf("open", "BB", "CO", 25);
const BB_VS_SB_PUSH25 = chartOf("push", "BB", "SB", 25);
const BB_VS_SB_PUSH15 = chartOf("push", "BB", "SB", 15);
const BB_VS_SB_LIMP = chartOf("limp", "BB", "SB", 25);
const BB_VS_SB_LR = chartOf("lr", "BB", "SB", 25);
const BB_VS_BN_4BET = chartOf("4bet", "BB", "BN", 25);

/** BTN opens to `to`, SB folds, Hero (BB) does `hero`. */
function vsBtnOpen(hand: string, hero: string, to = 2000) {
  return gg({ heroSeat: 2, cards: cards(hand), actions: [...folds([3, 4, 5, 6, 7]), `S8: raises ${fmt(to - 1000)} to ${fmt(to)}`, "S1: folds", hero] });
}

// ── vs_open ──────────────────────────────────────────────────────────────────

describe("defense check — vs open (GGPoker)", () => {
  const pureCall = pick(BB_VS_BN, (f) => (f.call ?? 0) >= 0.99);
  const pureFold = pick(BB_VS_CO, (f) => (f.fold ?? 0) >= 0.99);

  it("recognises the spot: positions, effective stack, villain's size, Hero's action", () => {
    const s = findSpots(vsBtnOpen(pureCall, "Hero: calls 1,000"))[0];
    expect(s).toMatchObject({ kind: "vs_open", tablePosition: "BB", position: "BB", action: "call", effStackBb: 25 });
    expect(s.villain).toMatchObject({ tablePosition: "BTN", position: "BN", sizeBb: 2, allIn: false });
  });

  it("grades against the matching chart (BB vs BN, 25bb)", () => {
    const d = detail(vsBtnOpen(pureCall, "Hero: calls 1,000"));
    expect(d.range).toMatchObject({ kind: "defense", n: BB_VS_BN.n, page: BB_VS_BN.page, bucket: 25, vil: "BN", spot: "open" });
  });

  it("correct / too_tight / wrong_action for a pure call", () => {
    expect(verdict(vsBtnOpen(pureCall, "Hero: calls 1,000"))).toBe("correct");
    expect(verdict(vsBtnOpen(pureCall, "Hero: folds"))).toBe("too_tight");
    expect(verdict(vsBtnOpen(pureCall, "Hero: raises 5,000 to 6,000"))).toBe("wrong_action");
  });

  it("too_loose: continuing with a pure fold (BB vs CO)", () => {
    const h = gg({ heroSeat: 2, cards: cards(pureFold), actions: [...folds([3, 4, 5, 6]), "S7: raises 1,000 to 2,000", "S8: folds", "S1: folds", "Hero: calls 1,000"] });
    expect(verdict(h)).toBe("too_loose");
  });

  it("mixed: the minor action of a mixed hand", () => {
    const h = pick(BB_VS_BN, (f) => (f.call ?? 0) >= 0.5 && (f.raise ?? 0) >= 0.1 && (f.raise ?? 0) < 0.5);
    expect(verdict(vsBtnOpen(h, "Hero: raises 5,000 to 6,000"))).toBe("mixed");
  });

  it("min-raise vs a bigger open: the size is recorded, the (size-less) chart is the same", () => {
    const small = findSpots(vsBtnOpen(pureCall, "Hero: calls 1,000"))[0];
    const big = findSpots(vsBtnOpen(pureCall, "Hero: calls 2,000", 3000))[0];
    expect(small.villain!.sizeBb).toBe(2);
    expect(big.villain!.sizeBb).toBe(3);
    expect(detail(vsBtnOpen(pureCall, "Hero: calls 2,000", 3000)).range!.n).toBe(BB_VS_BN.n);
    expect(describeCheck(checkPreflop(vsBtnOpen(pureCall, "Hero: calls 2,000", 3000))!).title).toBe("Facing a BTN open (3bb) · 25bb · BB");
  });

  it("a 3-bet of 90%+ of the effective stack is graded as all-in", () => {
    const s = findSpots(vsBtnOpen(pureCall, "Hero: raises 21,500 to 22,500"))[0];
    expect(s.action).toBe("allin");
  });

  it("the BB vs SB open uses the chart with the closest printed size", () => {
    const sb = DEFENSE_CHARTS.find((c) => c.group === "mtt" && c.spot === "open" && c.hero === "BB" && c.vil === "SB" && c.stack === 25)!;
    const h = pick(sb, (f) => (f.call ?? 0) >= 0.99);
    const hand = gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7, 8]), "S1: raises 2,300 to 3,300", "Hero: calls 2,300"] });
    expect(detail(hand).range).toMatchObject({ n: sb.n, size: sb.size });
    expect(verdict(hand)).toBe("correct");
  });

  it("no chart for this position pair → not_evaluated, never a nearby chart", () => {
    // HJ (seat 6) opens: the trainer has no BB-vs-HJ chart.
    const h = gg({ heroSeat: 2, cards: cards(pureCall), actions: [...folds([3, 4, 5]), "S6: raises 1,000 to 2,000", ...folds([7, 8, 1]), "Hero: folds"] });
    const c = checkPreflop(h)!;
    expect(c.verdict).toBe("not_evaluated");
    expect(c.detail.reason).toEqual({ code: "no_defense_chart", kind: "vs_open", hero: "BB", vil: "HJ" });
    expect(reasonText(c.detail.reason)).toMatch(/^no matching chart/);
  });

  it("effective stack below the shallowest defense chart → not_evaluated (too short)", () => {
    const h = gg({ heroSeat: 2, cards: cards(pureCall), stacks: { 2: 8000 }, actions: [...folds([3, 4, 5, 6, 7]), "S8: raises 1,000 to 2,000", "S1: folds", "Hero: folds"] });
    expect(detail(h).reason).toMatchObject({ code: "too_short" });
  });
});

describe("defense check — vs open (PokerStars, big-blind ante)", () => {
  it("BTN opens, Hero defends the BB: graded against BB vs BN", () => {
    // 9-handed: seat 9 is the button.
    const h = pick(BB_VS_BN, (f) => (f.call ?? 0) >= 0.99);
    const hand = ps({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7, 8]), "S9: raises 1000 to 2000", "S1: folds", "Hero: folds"] });
    const c = checkPreflop(hand)!;
    expect(c.detail.spot.kind).toBe("vs_open");
    expect(c.detail.range!.n).toBe(BB_VS_BN.n);
    expect(c.verdict).toBe("too_tight");
  });
});

// ── vs_push ──────────────────────────────────────────────────────────────────

describe("defense check — vs push", () => {
  const call = pick(BB_VS_SB_PUSH25, (f) => (f.call ?? 0) >= 0.99);
  const fold = pick(BB_VS_SB_PUSH25, (f) => (f.fold ?? 0) >= 0.99);
  const sbShove = (h: string, hero: string) => gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7, 8]), "S1: raises 23,875 to 24,875 and is all-in", hero] });

  it("the SB's all-in is a vs_push spot, graded against BB vs SB push (25bb)", () => {
    const d = detail(sbShove(call, "Hero: calls 23,875 and is all-in"));
    expect(d.spot.kind).toBe("vs_push");
    expect(d.spot.villain!.allIn).toBe(true);
    expect(d.range).toMatchObject({ n: BB_VS_SB_PUSH25.n, spot: "push" });
  });

  it("correct call, too_tight fold, too_loose call", () => {
    expect(verdict(sbShove(call, "Hero: calls 23,875 and is all-in"))).toBe("correct");
    expect(verdict(sbShove(call, "Hero: folds"))).toBe("too_tight");
    expect(verdict(sbShove(fold, "Hero: calls 23,875 and is all-in"))).toBe("too_loose");
    expect(verdict(sbShove(fold, "Hero: folds"))).toBe("correct");
  });

  it("short-stack shove-as-open from the SB at 15bb → the 15bb push chart", () => {
    const h = pick(BB_VS_SB_PUSH15, (f) => (f.call ?? 0) >= 0.99);
    const hand = gg({ heroSeat: 2, cards: cards(h), stacks: { 1: 15_000 }, actions: [...folds([3, 4, 5, 6, 7, 8]), "S1: raises 13,875 to 14,875 and is all-in", "Hero: calls 13,875"] });
    expect(detail(hand).range).toMatchObject({ n: BB_VS_SB_PUSH15.n, bucket: 15 });
    expect(verdict(hand)).toBe("correct");
  });

  it("an open of 90%+ of the stack counts as a shove", () => {
    const hand = gg({ heroSeat: 2, cards: cards(call), actions: [...folds([3, 4, 5, 6, 7, 8]), "S1: raises 22,000 to 23,000", "Hero: folds"] });
    expect(findSpots(hand)[0].kind).toBe("vs_push");
  });

  it("a CO shove has no push chart → not_evaluated", () => {
    const hand = gg({ heroSeat: 2, cards: cards(call), stacks: { 7: 12_000 }, actions: [...folds([3, 4, 5, 6]), "S7: raises 10,875 to 11,875 and is all-in", "S8: folds", "S1: folds", "Hero: folds"] });
    expect(detail(hand).reason).toEqual({ code: "no_defense_chart", kind: "vs_push", hero: "BB", vil: "CO" });
  });

  it("PokerStars: the SB shoves into the BB", () => {
    const hand = ps({ heroSeat: 2, cards: cards(call), actions: [...folds([3, 4, 5, 6, 7, 8, 9]), "S1: raises 23500 to 24500 and is all-in", "Hero: calls 23500"] });
    expect(findSpots(hand)[0]).toMatchObject({ kind: "vs_push", action: "call" });
    expect(verdict(hand)).toBe("correct");
  });
});

// ── vs_limp and vs_limp_raise ────────────────────────────────────────────────

describe("defense check — vs limp / limp-raise (BB vs SB)", () => {
  const limp = (h: string, ...rest: string[]) => gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7, 8]), "S1: calls 500", ...rest] });

  it("a check behind the SB's limp is the chart's call (\"Check\")", () => {
    const h = pick(BB_VS_SB_LIMP, (f) => (f.call ?? 0) >= 0.99);
    const c = checkPreflop(limp(h, "Hero: checks"))!;
    expect(c.detail.spot).toMatchObject({ kind: "vs_limp", action: "call" });
    expect(c.detail.spot.villain!.sizeBb).toBe(1);
    expect(c.detail.range!.n).toBe(BB_VS_SB_LIMP.n);
    expect(c.verdict).toBe("correct");
    expect(describeCheck(c).hero).toBe("You checked → Correct.");
  });

  it("a raise over the limp with a pure check is wrong_action", () => {
    const h = pick(BB_VS_SB_LIMP, (f) => (f.call ?? 0) >= 0.99);
    expect(verdict(limp(h, "Hero: raises 3,000 to 4,000"))).toBe("wrong_action");
  });

  it("raise, the limper re-raises: the second decision is graded against the limp-raise chart", () => {
    // A hand the BB raises over the limp and that the limp-raise chart then has an entry for.
    const h = ALL_HANDS.find((x) => (freqsOf(BB_VS_SB_LIMP, x).raise ?? 0) >= 0.5 && BB_VS_SB_LR.grid[x] && (freqsOf(BB_VS_SB_LR, x).fold ?? 0) >= 0.99);
    expect(h).toBeDefined();
    const hand = limp(h!, "Hero: raises 3,000 to 4,000", "S1: raises 20,875 to 24,875 and is all-in", "Hero: calls 20,875");
    const spots = findSpots(hand);
    expect(spots.map((s) => s.kind)).toEqual(["vs_limp", "vs_limp_raise"]);
    expect(spots[1].villain).toMatchObject({ tablePosition: "SB", allIn: true });
    // Calling the jam with a hand the limp-raise chart folds: that decision is the hand's verdict.
    const c = checkPreflop(hand)!;
    expect(c.detail.spot.kind).toBe("vs_limp_raise");
    expect(c.detail.range!.n).toBe(BB_VS_SB_LR.n);
    expect(c.verdict).toBe("too_loose");
    expect(c.detail.also).toMatchObject({ kind: "vs_limp" });
  });

  it("two limpers → not_evaluated (no chart)", () => {
    const h = pick(BB_VS_SB_LIMP, (f) => (f.call ?? 0) >= 0.99);
    const hand = gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7]), "S8: calls 1,000", "S1: calls 500", "Hero: checks"] });
    expect(detail(hand).reason).toEqual({ code: "unmatched", why: "multi_limp" });
  });
});

// ── vs_4bet ──────────────────────────────────────────────────────────────────

describe("defense check — vs 4-bet", () => {
  const fourBet = (h: string, last: string) =>
    gg({
      heroSeat: 2,
      cards: cards(h),
      actions: [...folds([3, 4, 5, 6, 7]), "S8: raises 1,000 to 2,000", "S1: folds", "Hero: raises 4,500 to 5,500", "S8: raises 19,375 to 24,875 and is all-in", last],
    });

  it("Hero 3-bets, the opener 4-bets: two decisions, the second against BB vs BN 4-bet", () => {
    const h = pick(BB_VS_BN_4BET, (f) => (f.call ?? 0) >= 0.99);
    const hand = fourBet(h, "Hero: calls 19,375 and is all-in");
    expect(findSpots(hand).map((s) => s.kind)).toEqual(["vs_open", "vs_4bet"]);
    expect(findSpots(hand)[1].villain).toMatchObject({ tablePosition: "BTN", position: "BN", allIn: true });
  });

  it("too_tight: folding a pure call to the 4-bet (the 4-bet decision is the hand's verdict)", () => {
    const h = pick(BB_VS_BN_4BET, (f) => (f.call ?? 0) >= 0.99, []);
    const c = checkPreflop(fourBet(h, "Hero: folds"))!;
    expect(c.verdict).toBe("too_tight");
    expect(c.detail.spot.kind).toBe("vs_4bet");
    expect(c.detail.range!.n).toBe(BB_VS_BN_4BET.n);
    expect(c.detail.also!.kind).toBe("vs_open");
  });

  it("a hand outside the 3-bet range: the 4-bet chart has no entry (not_in_range), the 3-bet is what gets graded", () => {
    const h = ALL_HANDS.find((x) => BB_VS_BN_4BET.grid[x] === null && (freqsOf(BB_VS_BN, x).fold ?? 0) >= 0.99)!;
    const c = checkPreflop(fourBet(h, "Hero: folds"))!;
    expect(c.detail.spot.kind).toBe("vs_open");
    expect(c.verdict).toBe("too_loose");
    expect(c.detail.also).toMatchObject({ kind: "vs_4bet", verdict: "not_evaluated" });
  });
});

// ── Unmatched spots and edge cases ───────────────────────────────────────────

describe("defense check — spots without a chart", () => {
  const h = "AKo";
  it("squeeze: an open plus a caller before Hero", () => {
    const hand = gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6]), "S7: raises 1,000 to 2,000", "S8: calls 2,000", "S1: folds", "Hero: raises 7,000 to 8,000"] });
    expect(findSpots(hand)[0].kind).toBe("other");
    expect(detail(hand).reason).toEqual({ code: "unmatched", why: "squeeze" });
  });

  it("cold 4-bet: an open and a 3-bet before Hero", () => {
    const hand = gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6]), "S7: raises 1,000 to 2,000", "S8: raises 4,000 to 6,000", "S1: folds", "Hero: folds"] });
    expect(detail(hand).reason).toEqual({ code: "unmatched", why: "cold_4bet" });
  });

  it("two all-ins before Hero", () => {
    const hand = gg({ heroSeat: 2, cards: cards(h), stacks: { 7: 10_000, 8: 9_000 }, actions: [...folds([3, 4, 5, 6]), "S7: raises 8,875 to 9,875 and is all-in", "S8: calls 8,875 and is all-in", "S1: folds", "Hero: folds"] });
    expect(detail(hand).reason).toEqual({ code: "unmatched", why: "multi_allin" });
  });

  it("ante-only pot: everyone folds to the big blind → no decision, no check", () => {
    const hand = gg({ heroSeat: 2, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7, 8, 1]), "Uncalled bet (500) returned to Hero"] });
    expect(checkPreflop(hand)).toBeNull();
  });

  it("villain is the BB: Hero opens, the BB 3-bets — only the open is graded (no chart vs a 3-bet)", () => {
    const hand = gg({ heroSeat: 8, cards: cards(h), actions: [...folds([3, 4, 5, 6, 7]), "Hero: raises 1,000 to 2,000", "S1: folds", "S2: raises 4,000 to 6,000", "Hero: folds"] });
    expect(findSpots(hand).map((s) => s.kind)).toEqual(["rfi"]);
    expect(checkPreflop(hand)!.detail.spot.kind).toBe("rfi");
  });

  it("every spot kind maps to a filter group (\"other\" to none)", () => {
    expect(spotGroup("rfi")).toBe("open");
    expect(spotGroup("vs_limp_raise")).toBe("vs_limp");
    expect(spotGroup("other")).toBeNull();
  });
});

// ── Wording ──────────────────────────────────────────────────────────────────

describe("defense check — panel text", () => {
  it("title, frequencies and the verdict line", () => {
    const h = pick(BB_VS_BN, (f) => (f.call ?? 0) >= 0.99);
    const t = describeCheck(checkPreflop(vsBtnOpen(h, "Hero: folds"))!);
    expect(t.title).toBe("Facing a BTN open (2bb) · 25bb · BB");
    expect(t.withHand).toBe(`With ${h} here: Call 100%.`);
    expect(t.hero).toBe("You folded → Too tight.");
    expect(t.range).toBe(`Chart: BB vs BTN open, 25 BB, ${h} → Call.`);
    expect(t.explain).toMatch(/almost\) never folds/);
  });
});

// ── The example tournament (/hands/example) ──────────────────────────────────

describe("example tournament", () => {
  it("6 opens, 1 vs open (too tight), 1 vs shove (correct), nothing left unevaluated", () => {
    const kinds = exampleHands().map((h) => `${h.check?.detail.spot.kind}:${h.check?.verdict}`).sort();
    expect(kinds).toEqual(
      ["rfi:correct", "rfi:correct", "rfi:correct", "rfi:correct", "rfi:too_loose", "rfi:too_tight", "vs_open:too_tight", "vs_push:correct"].sort(),
    );
  });
});

// ── Rows for the backend's coach-context test ────────────────────────────────
// The two example defense hands as the app stores them (made-up hands, safe
// to commit) → backend/tests/data/example_defense_rows.json.

describe("example defense rows for the backend", () => {
  it("writes the K9o fold and the A8o call as stored rows", async () => {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { preflopColumns } = await import("../rows");
    const { EXAMPLE_HAND_TEXTS } = await import("@/lib/onboarding/exampleTournament");
    const rows: Record<string, unknown> = {};
    for (const text of EXAMPLE_HAND_TEXTS.slice(6)) {
      const r = parseGGHand(text);
      if (!r.ok) throw new Error(r.failure.error);
      const pf = preflopColumns(r.hand);
      rows[r.hand.handId] = { data: r.hand, raw_text: text, preflop_check: pf.preflop_check, preflop_detail: pf.preflop_detail, analysis: null, favorited_at: null };
    }
    const dir = join(__dirname, "..", "..", "..", "..", "backend", "tests", "data");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "example_defense_rows.json"), JSON.stringify(rows, null, 2) + "\n");
    expect(Object.keys(rows)).toEqual(["TM9900000007", "TM9900000008"]);
  });
});
