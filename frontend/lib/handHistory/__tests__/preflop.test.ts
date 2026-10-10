import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MTT_OPEN_CHARTS } from "@/lib/ranges/data";
import { ALL_HANDS, frequencies, type Scenario } from "@/lib/ranges/logic";
import { parseTexts } from "../importer";
import { parseGGHand } from "../parsers/ggpoker";
import {
  PREFLOP_CHECK_VERSION,
  checkPreflop,
  describeCheck,
  findRfiSpot,
  handClass,
  lookupRfi,
  rangePosition,
  type PreflopVerdict,
} from "../preflop";
import type { ParsedHand } from "../types";
import { TOP_HAND } from "./reconstructed";

// ── Constructed hands ────────────────────────────────────────────────────────
// 8 players, button seat 8 → SB seat 1, BB seat 2, Hero UTG in seat 3 with
// seven players behind (the trainer's 9-max UTG+1 range). Level 500/1,000(125).

type HeroMove = "fold" | "raise" | "limp" | "allin";

function rfiHand(opts: {
  cards: [string, string];
  move: HeroMove;
  heroStack?: number;
  otherStack?: number;
  players?: number;
}): ParsedHand {
  const n = opts.players ?? 8;
  const heroStack = opts.heroStack ?? 25_000;
  const fmt = (x: number) => x.toLocaleString("en-US");
  const seats = Array.from({ length: n }, (_, i) => i + 1); // button = last seat
  const name = (s: number) => (s === 3 ? "Hero" : `p${s}aaaaaa`);
  const lines = [
    `Poker Hand #TM9000000001: Tournament #1, Test $1 Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/08 19:00:00`,
    `Table '1' ${n}-max Seat #${n} is the button`,
    ...seats.map((s) => `Seat ${s}: ${name(s)} (${fmt(s === 3 ? heroStack : (opts.otherStack ?? 30_000))} in chips)`),
    ...seats.map((s) => `${name(s)}: posts the ante 125`),
    `${name(1)}: posts small blind 500`,
    `${name(2)}: posts big blind 1,000`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [${opts.cards.join(" ")}]`,
  ];
  const stackAfterAnte = heroStack - 125;
  if (opts.move === "fold") lines.push("Hero: folds");
  if (opts.move === "raise") lines.push("Hero: raises 1,000 to 2,000");
  if (opts.move === "limp") lines.push("Hero: calls 1,000");
  if (opts.move === "allin") lines.push(`Hero: raises ${fmt(stackAfterAnte - 1000)} to ${fmt(stackAfterAnte)} and is all-in`);
  for (const s of [...seats.slice(3), 1, 2]) lines.push(`${name(s)}: folds`);
  lines.push("*** SHOWDOWN ***", `${name(3)} collected 1 from pot`, "*** SUMMARY ***", "Total pot 1 | Rake 0");
  const r = parseGGHand(lines.join("\n"));
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

/** UTG+1 25bb chart — what an 8-handed UTG with 25bb is graded against. */
const CHART = MTT_OPEN_CHARTS.find((c) => c.pos === "UTG+1" && c.stack === 25)!;
const SCENARIO: Scenario = { type: "open", kind: "freq", chart: CHART, stack: 25, fmt: "mtt", hero: "UTG+1" };
const f = (h: string) => frequencies(SCENARIO, h);

/** Two real cards for a hand class. */
function cardsOf(h: string): [string, string] {
  if (h.length === 2) return [`${h[0]}s`, `${h[1]}h`];
  return h[2] === "s" ? [`${h[0]}s`, `${h[1]}s`] : [`${h[0]}s`, `${h[1]}h`];
}
function pick(test: (fr: ReturnType<typeof f>) => boolean): string {
  const h = ALL_HANDS.find((x) => test(f(x)));
  if (!h) throw new Error("no hand in the chart fits this test");
  return h;
}

describe("preflop check — building blocks", () => {
  it("hand notation", () => {
    expect(handClass(["Qd", "Ah"])).toBe("AQo");
    expect(handClass(["Js", "Jd"])).toBe("JJ");
    expect(handClass(["9h", "Th"])).toBe("T9s");
    expect(handClass(["2c", "Ac"])).toBe("A2s");
  });

  it("maps seats by players still to act (MPT p.17–18: early positions go first)", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(rangePosition)).toEqual(["SB", "BN", "CO", "HJ", "LJ", "UTG+2", "UTG+1", "UTG"]);
    expect(rangePosition(9)).toBeNull();
    const spot = findRfiSpot(rfiHand({ cards: ["As", "Ah"], move: "raise" }))!;
    expect(spot).toMatchObject({ tablePosition: "UTG", playersBehind: 7, hand: "AA", action: "raise", sizeBb: 2 });
    const sixHanded = findRfiSpot(rfiHand({ cards: ["As", "Ah"], move: "raise", players: 6 }))!;
    expect(lookupRfi(sixHanded)).toMatchObject({ ok: true, ref: { position: "LJ" } });
  });

  it("rounds the effective stack to the nearest bucket the trainer has", () => {
    const at = (bb: number) => {
      const r = lookupRfi({ ...findRfiSpot(rfiHand({ cards: ["As", "Ah"], move: "raise" }))!, effStackBb: bb });
      return r.ok ? `${r.ref.kind}:${r.ref.bucket}` : "none";
    };
    expect([at(7.4), at(11.3), at(12.6), at(21), at(31), at(65), at(71)]).toEqual([
      "pushfold:7",
      "pushfold:10",
      "open:15",
      "open:25",
      "open:25",
      "open:60",
      "none",
    ]);
  });

  it("a raise of 90%+ of the stack counts as all-in", () => {
    const h = rfiHand({ cards: ["As", "Ah"], move: "raise", heroStack: 2_200 });
    expect(findRfiSpot(h)!.action).toBe("allin");
  });

  it("no check outside raise-first-in spots", () => {
    // Hero faces a raise in the top hand (and is in the BB).
    const r = parseGGHand(TOP_HAND);
    expect(r.ok && checkPreflop(r.hand)).toBeNull();
  });

  it("the version changes with the range data", () => {
    expect(PREFLOP_CHECK_VERSION).toMatch(/^\d+-[0-9a-f]{8}$/);
  });
});

describe("preflop check — every verdict (constructed hands, cards chosen from the trainer's chart)", () => {
  const verdictOf = (cards: [string, string], move: HeroMove, heroStack?: number): PreflopVerdict =>
    checkPreflop(rfiHand({ cards, move, heroStack }))!.verdict;

  it("correct: a pure raise, raised", () => {
    expect(verdictOf(cardsOf(pick((x) => (x.raise ?? 0) === 1)), "raise")).toBe("correct");
  });

  it("correct: a pure fold, folded", () => {
    expect(verdictOf(cardsOf(pick((x) => (x.fold ?? 0) === 1)), "fold")).toBe("correct");
  });

  it("too_loose: a pure fold, opened", () => {
    expect(verdictOf(cardsOf(pick((x) => (x.fold ?? 0) === 1)), "raise")).toBe("too_loose");
  });

  it("too_tight: a pure raise, folded", () => {
    expect(verdictOf(cardsOf(pick((x) => (x.raise ?? 0) === 1)), "fold")).toBe("too_tight");
  });

  it("wrong_action: a pure raise, limped (the chart has no limp)", () => {
    expect(CHART.actions.some((a) => a.key === "limp")).toBe(false);
    expect(verdictOf(cardsOf(pick((x) => (x.raise ?? 0) === 1)), "limp")).toBe("wrong_action");
  });

  it("mixed: the less frequent side of a mixed hand", () => {
    const h = pick((x) => (x.raise ?? 0) >= 0.1 && (x.raise ?? 0) < 0.5 && (x.fold ?? 0) > (x.raise ?? 0));
    expect(verdictOf(cardsOf(h), "raise")).toBe("mixed");
  });

  it("not_evaluated: effective stack deeper than the trainer's charts", () => {
    // 100bb against 30bb stacks is a 30bb effective stack — still graded.
    expect(checkPreflop(rfiHand({ cards: ["As", "Ah"], move: "raise", heroStack: 100_000 }))!.verdict).not.toBe("not_evaluated");
    const c = checkPreflop(rfiHand({ cards: ["As", "Ah"], move: "raise", heroStack: 100_000, otherStack: 120_000 }))!;
    expect(c.verdict).toBe("not_evaluated");
    expect(describeCheck(c).range).toMatch(/^Not evaluated: /);
  });

  it("describes the spot in plain English", () => {
    const h = pick((x) => (x.fold ?? 0) === 1);
    const c = checkPreflop(rfiHand({ cards: cardsOf(h), move: "raise" }))!;
    expect(describeCheck(c)).toMatchObject({
      range: `Your range: UTG+1, 25 BB, ${h} → fold.`,
      hero: "You: open-raise 2 BB.",
    });
  });
});

// ── The real export ──────────────────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "GG20261008-1802 - Daily Special 10.txt");
const hasFixture = existsSync(FIXTURE);

describe.skipIf(!hasFixture)("preflop check on the real export", () => {
  const out = parseTexts([{ fileName: "f", text: hasFixture ? readFileSync(FIXTURE, "utf8") : "" }]);
  const checks = out.entries.map((e) => ({ id: e.hand.handId, c: checkPreflop(e.hand) })).filter((x) => x.c);

  it("50 raise-first-in spots outside the BB: 42 folds, 6 open-raises, 2 all-ins", () => {
    expect(checks).toHaveLength(50);
    const actions = checks.map((x) => x.c!.detail.spot.action);
    expect(actions.filter((a) => a === "fold")).toHaveLength(42);
    // The UTG 7bb raise to 6.5bb (TM6510945652) is a raise in the history but
    // puts 94% of the stack in, so it is graded as an all-in.
    expect(actions.filter((a) => a === "raise")).toHaveLength(5);
    expect(actions.filter((a) => a === "allin")).toHaveLength(3);
    expect(checks.find((x) => x.id === "TM6510945652")!.c!.detail.spot.action).toBe("allin");
    expect(checks.every((x) => x.c!.verdict !== "not_evaluated")).toBe(true);
  });

  it("finds the spots that deviate from the ranges", () => {
    const by = (id: string) => checks.find((x) => x.id === id)!.c!;
    expect(by("TM6510603760").verdict).toBe("too_loose"); // Q8s shove, 12.5bb UTG+1 (8-handed)
    expect(by("TM6510944780").verdict).toBe("too_tight"); // 55 fold, 11.4bb LJ
    expect(by("TM6510605843").verdict).toBe("mixed"); // 55 fold, 21.7bb UTG+1 (8-handed)
  });
});
