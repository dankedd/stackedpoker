import { describe, expect, it } from "vitest";
import CBET from "../cbetProfiles.json";
import type { Buckets, FlopIndexRow } from "../logic";
import { canonicalFlop, cbetAdvice, type CbetAdvice, gradeCbet, gridHand, pickPair, versusCorrect, versusGap, weakestCategory } from "../phase3";

// Same cases as backend/tests/test_flop_trainer.py — the server re-grades signed-in answers.
const K = CBET.bucket_order as (keyof Buckets)[];
const toBuckets = (xs: number[]) => Object.fromEntries(K.map((k, i) => [k, xs[i]])) as Buckets;

describe("cbetAdvice", () => {
  it("uses the book's printed strategy on its example flops", () => {
    // 8h6d2s BN (p.693-695): bet 2/3 48.6%, check 42.8% -> low band, big size.
    const a = cbetAdvice("srp_bb_vs_bn_40", "8c6d2h", toBuckets([0, 0, 0, 0]), toBuckets([0, 0, 0, 0]), []);
    expect([a.source, a.band, a.size, a.bands]).toEqual(["book", "low", "big", ["low"]]);
    const q = cbetAdvice("srp_bb_vs_utg_40", "QcJcTc", toBuckets([0, 0, 0, 0]), toBuckets([0, 0, 0, 0]), []);
    expect([q.band, q.size]).toEqual(["high", "small"]);
  });

  it.each(CBET.profiles.map((p, i) => [i, p] as const))("maps book profile %i to itself", (_, p) => {
    const a = cbetAdvice("srp_bb_vs_bn_40", "AcKdQh", toBuckets(p.ip), toBuckets(p.oop), ["unpaired", "rainbow"]);
    expect([a.source, a.band, a.size, a.distance]).toEqual(["profile", p.band, p.size, 0]);
  });

  it("gives paired and monotone boards a small size", () => {
    const big = CBET.profiles[0];
    expect(cbetAdvice("srp_bb_vs_bn_40", "KcKd2h", toBuckets(big.ip), toBuckets(big.oop), ["paired"]).size).toBe("small");
    const mono = cbetAdvice("srp_bb_vs_bn_40", "KcTc2c", toBuckets(big.ip), toBuckets(big.oop), ["unpaired", "monotone"]);
    expect(mono.size).toBe("small");
    expect(mono.bands).toContain("high");
    expect(mono.rule).toBe("monotone");
  });

  it("grades band and size separately", () => {
    const advice: CbetAdvice = { band: "mid", bands: ["mid", "low"], size: "big", source: "profile" };
    expect(gradeCbet("low", "big", advice)).toEqual({ bandOk: true, sizeOk: true, points: 2 });
    expect(gradeCbet("high", "big", advice).points).toBe(1);
  });
});

describe("canonicalFlop", () => {
  // Expected values from backend cards.canonical().
  it.each([
    [["Ah", "Qd", "3s"], "AcQd3h"],
    [["9h", "8h", "4d"], "9c8c4d"],
    [["5h", "5d", "4h"], "5c5d4c"],
    [["2s", "Kd", "Kh"], "KcKd2h"],
    [["7c", "7d", "7h"], "7c7d7h"],
    [["Ts", "Js", "Qs"], "QcJcTc"],
    [["3d", "Ac", "8d"], "Ac8d3d"],
  ])("%j → %s", (cards, key) => {
    expect(canonicalFlop(cards)).toBe(key);
  });
});

describe("quick fire", () => {
  const row = (flop: string, equity_ip: number): FlopIndexRow => ({
    flop,
    flop_weight: 12,
    equity_ip,
    nut_adv: { ip: 10, oop: 5, diff: 5, leader: "IP" },
    texture: [],
  });
  const index = [row("A", 50), row("B", 53), row("C", 58), row("D", 66), row("E", 70)];

  it("picks two flops inside the gap range", () => {
    for (let i = 0; i < 30; i++) {
      const [a, b] = pickPair(index, 4, 8, () => ((i * 7919) % 100) / 100);
      const gap = Math.abs(a.equity_ip - b.equity_ip);
      expect(a.flop).not.toBe(b.flop);
      expect(gap).toBeGreaterThanOrEqual(4);
      expect(gap).toBeLessThanOrEqual(8);
    }
  });

  it("narrows the gap as the streak grows", () => {
    expect(versusGap(0)).toEqual([8, 20]);
    expect(versusGap(5)).toEqual([4, 8]);
    expect(versusGap(12)).toEqual([2, 4]);
  });

  it("grades the higher-equity flop, near-ties either way", () => {
    expect(versusCorrect("a", 60, 55)).toBe(true);
    expect(versusCorrect("b", 60, 55)).toBe(false);
    expect(versusCorrect("b", 60, 59.6)).toBe(true);
  });
});

describe("texture tracking", () => {
  it("names the category with the lowest hit rate", () => {
    const w = weakestCategory({ paired: [10, 4, 80], connected: [8, 9, 40], ace_high: [12, 3, 90], monotone: [2, 20, 0] });
    expect(w?.category).toBe("connected");
  });

  it("needs two categories with enough answers", () => {
    expect(weakestCategory({ paired: [10, 4, 80], monotone: [2, 20, 0] })).toBeNull();
  });
});

describe("grid", () => {
  it("lays out pairs on the diagonal, suited above", () => {
    expect([gridHand(0, 0), gridHand(0, 1), gridHand(1, 0), gridHand(12, 12)]).toEqual(["AA", "AKs", "AKo", "22"]);
  });
});
