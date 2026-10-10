import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPreflopTable, type PreflopTableData } from "@/lib/equity/preflopTable";
import { equityVsRange } from "@/lib/equity/rangeEquity";
import { parseGGHand } from "../parsers/ggpoker";
import { potOddsDecisions } from "../potOdds";
import { splitHands } from "../split";
import type { ParsedHand } from "../types";
import { findVillain, position9, rangePresets, villainRange } from "../villain";
import { NO_FLOP_HAND, TOP_HAND } from "./reconstructed";

function parse(text: string): ParsedHand {
  const r = parseGGHand(text);
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

describe("villain", () => {
  it("is the only other player left at the end", () => {
    expect(findVillain(parse(TOP_HAND))).toBe("922e16a4");
  });

  it("has no villain when everyone folded to Hero", () => {
    const h = parse(NO_FLOP_HAND);
    expect(findVillain(h)).toBeNull();
  });

  it("maps seats to 9-max chart positions by players acting after", () => {
    const h = parse(TOP_HAND); // button seat 2, 8 players
    expect(position9(h, "Hero")).toBe("BB");
    expect(position9(h, "4070ed9d")).toBe("SB");
    expect(position9(h, "7b1c90fe")).toBe("BN");
    expect(position9(h, "922e16a4")).toBe("CO");
    expect(position9(h, "a596eadd")).toBe("UTG+1"); // 8-handed UTG
  });

  it("quick picks list the trainer's ranges for a position", () => {
    const p = rangePresets("HJ");
    expect(p.some((x) => x.group === "Open")).toBe(true);
    expect(p.some((x) => x.group === "Push/fold")).toBe(true);
    expect(p.some((x) => x.label.startsWith("HJ") && x.id.startsWith("def-"))).toBe(true);
    expect(p.every((x) => Object.values(x.range).every((w) => w > 0 && w <= 1))).toBe(true);
  });
});

describe("villain's range", () => {
  // SB shoves, a shorter BB calls all-in: still the BB's call range vs an SB shove.
  const SB_SHOVE = (bbStack: string, bbCall: string) => `Poker Hand #TM1: Tournament #1, Test $1 Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/08 19:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: aaaaaaaa (30,000 in chips)
Seat 2: Hero (14,600 in chips)
Seat 3: 515c421f (${bbStack} in chips)
Seat 4: bbbbbbbb (30,000 in chips)
aaaaaaaa: posts the ante 125
Hero: posts the ante 125
515c421f: posts the ante 125
bbbbbbbb: posts the ante 125
Hero: posts small blind 500
515c421f: posts big blind 1,000
*** HOLE CARDS ***
Dealt to Hero [Ah Jc]
bbbbbbbb: folds
aaaaaaaa: folds
Hero: raises 13,475 to 14,475 and is all-in
515c421f: ${bbCall}
*** SHOWDOWN ***
Hero collected 1 from pot
*** SUMMARY ***
Total pot 1 | Rake 0`;

  it("BB calling an SB shove uses the trainer's BB-vs-SB-shove call range", () => {
    const vr = villainRange(parse(SB_SHOVE("30,000", "calls 13,475")), "515c421f")!;
    expect(vr.label).toBe("BB call vs SB-shove · 15 BB");
    expect(vr.approximation).toBeNull();
  });

  it("also when the BB is shorter and calls all-in", () => {
    const vr = villainRange(parse(SB_SHOVE("9,000", "calls 7,875 and is all-in")), "515c421f")!;
    expect(vr.label).toMatch(/^BB call vs SB-shove · \d+ BB$/);
    expect(vr.approximation).toBeNull();
  });
});

describe("pot odds", () => {
  it("top hand: 24,188 to call into 40,488 → 37.4% needed (villain's extra 20,704 is not in play)", () => {
    const d = potOddsDecisions(parse(TOP_HAND));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ street: "preflop", toCall: 24188, pot: 40488, action: "call" });
    expect(d[0].required).toBeCloseTo(24188 / 64676, 6);
    expect(d[0].stillToAct).toBe(1); // the opener had yet to act behind Hero
  });

  it("no decision when Hero is never facing a bet", () => {
    expect(potOddsDecisions(parse(NO_FLOP_HAND))).toEqual([]);
  });
});

// ── The real export ──────────────────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "GG20261008-1802 - Daily Special 10.txt");
const TABLE_FILE = join(__dirname, "..", "..", "..", "data", "equity", "preflop-matchups.json");

describe.skipIf(!existsSync(FIXTURE))("top hand of the real export", () => {
  const hand = existsSync(FIXTURE) ? parse(splitHands(readFileSync(FIXTURE, "utf8")).hands[0]) : null!;

  it("villain shoves HJ over a UTG+2 open: the trainer's nearest chart is HJ vs LJ at 15bb", () => {
    expect(findVillain(hand)).toBe("922e16a4");
    expect(position9(hand, "922e16a4")).toBe("HJ");
    expect(position9(hand, "6888443a")).toBe("UTG+2");
    const vr = villainRange(hand, "922e16a4")!;
    expect(vr.label).toBe("HJ shove vs LJ-open · 15 BB");
    expect(vr.approximation).toBe("Approximation: opener UTG+2 as LJ.");
    expect(vr.source?.page).toBeGreaterThan(0);
    expect(vr.range.JJ).toBeGreaterThan(0);
  });

  it("pot odds: 37.4% needed", () => {
    const [d] = potOddsDecisions(hand);
    expect(d.toCall).toBe(24188);
    expect(d.pot).toBe(40488);
    expect(Math.round(d.required * 1000) / 10).toBe(37.4);
  });

  it.skipIf(!existsSync(TABLE_FILE))("AhQd's equity against that range, compared with the pot odds", () => {
    const table = buildPreflopTable(JSON.parse(readFileSync(TABLE_FILE, "utf8")) as PreflopTableData);
    const vr = villainRange(hand, "922e16a4")!;
    const r = equityVsRange(["Ah", "Qd"], vr.range, [], table)!;
    const [d] = potOddsDecisions(hand);
    // Logged so the number is visible in the test output.
    console.log(`AhQd vs ${vr.label}: ${(r.equity * 100).toFixed(1)}% (tie ${(r.tie * 100).toFixed(1)}%), needed ${(d.required * 100).toFixed(1)}%`);
    expect(r.equity).toBeGreaterThan(0.3);
    expect(r.equity).toBeLessThan(0.7);
  });
});
