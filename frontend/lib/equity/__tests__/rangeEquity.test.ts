import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_HANDS } from "@/lib/ranges/logic";
import { calculateEquity } from "@/lib/tools/equity";
import { buildPreflopTable, preflopMatchup, type PreflopTableData } from "../preflopTable";
import { equityVsRange, rangeCombos, type WeightedRange } from "../rangeEquity";
import { rankHandsVsRandom, topPercent } from "../ranking";

const ALL: WeightedRange = Object.fromEntries(ALL_HANDS.map((h) => [h, 1]));

describe("card removal", () => {
  it("drops villain combos holding Hero's or the board's cards", () => {
    expect(rangeCombos({ AA: 1 }, [])).toHaveLength(6);
    expect(rangeCombos({ AA: 1 }, ["As"])).toHaveLength(3);
    expect(rangeCombos({ AA: 1 }, ["As", "Ah"])).toHaveLength(1);
    expect(rangeCombos({ AKs: 1 }, ["Ks", "Kh", "Ad"])).toHaveLength(1);
  });

  it("returns null when the whole range is blocked", () => {
    expect(equityVsRange(["As", "Ah"], { AA: 1 }, ["Ad", "Ac", "2s"], null)).toBeNull();
  });
});

describe("postflop equity is exact enumeration", () => {
  const board = ["Kd", "7c", "2h"];

  it("matches hand-vs-hand for a one-combo range", () => {
    const r = equityVsRange(["As", "Ah"], { KK: 1 }, board, null)!;
    // Only KsKh and KsKc and KhKc remain (Kd on board) — check against the enumerator directly.
    const direct = ["KsKh", "KsKc", "KhKc"].map((c) => calculateEquity(["As", "Ah"], [c.slice(0, 2), c.slice(2)], board).heroEquity);
    expect(r.combos).toBe(3);
    expect(r.equity).toBeCloseTo(direct.reduce((a, b) => a + b) / 3, 10);
  });

  it("weights combos by the range's frequencies", () => {
    const a = equityVsRange(["As", "Ah"], { KK: 1 }, board, null)!;
    const b = equityVsRange(["As", "Ah"], { "72o": 1 }, board, null)!;
    const mixed = equityVsRange(["As", "Ah"], { KK: 1, "72o": 0.5 }, board, null)!;
    const expected = (a.equity * a.weight + b.equity * b.weight * 0.5) / (a.weight + b.weight * 0.5);
    expect(mixed.equity).toBeCloseTo(expected, 10);
    expect(mixed.weight).toBeCloseTo(a.weight + b.weight * 0.5, 10);
  });
});

// ── Preflop: needs data/equity/preflop-matchups.json ─────────────────────────

const TABLE_FILE = join(__dirname, "..", "..", "..", "data", "equity", "preflop-matchups.json");
const hasTable = existsSync(TABLE_FILE);

describe.skipIf(!hasTable)("preflop equity from the precomputed table", () => {
  const table = hasTable ? buildPreflopTable(JSON.parse(readFileSync(TABLE_FILE, "utf8")) as PreflopTableData) : null!;

  it("covers every suit-isomorphic matchup", () => {
    expect(table.index.size).toBe(47_008);
    expect(table.boards).toBe(1_712_304);
  });

  it("AA vs KK — 81.26% with no shared suit, 81.95% with one, 82.64% with both", () => {
    expect(equityVsRange(["As", "Ah"], { KK: 0 }, [], table)).toBeNull();
    const eq = (v: [string, string]) => preflopMatchup(table, ["As", "Ah"], v);
    const e = (v: [string, string]) => eq(v).win + eq(v).tie / 2;
    expect(e(["Kd", "Kc"])).toBeCloseTo(0.81255, 4);
    expect(e(["Ks", "Kd"])).toBeCloseTo(0.81946, 4); // the ~82% (±0.5%) from the spec
    expect(e(["Ks", "Kh"])).toBeCloseTo(0.82637, 4);
    // Mirrored lookup: KK's side of the same matchup.
    const kk = preflopMatchup(table, ["Kd", "Kc"], ["As", "Ah"]);
    expect(kk.win + kk.tie / 2).toBeCloseTo(1 - 0.81255, 4);
  });

  it("AA vs a random hand ≈ 85%", () => {
    const r = equityVsRange(["As", "Ah"], ALL, [], table)!;
    expect(r.equity).toBeGreaterThan(0.845);
    expect(r.equity).toBeLessThan(0.855);
  });

  it("JJ vs AQo ≈ 57%", () => {
    const r = equityVsRange(["Js", "Jd"], { AQo: 1 }, [], table)!;
    expect(Math.abs(r.equity - 0.57)).toBeLessThan(0.005);
  });

  it("agrees with direct enumeration on sampled matchups", () => {
    const cases: [[string, string], [string, string]][] = [
      [["Ah", "Qd"], ["Js", "Jd"]],
      [["7c", "6c"], ["As", "Kd"]],
      [["2s", "2h"], ["Tc", "9c"]],
    ];
    for (const [h, v] of cases) {
      const direct = calculateEquity(h, v, []);
      const m = preflopMatchup(table, h, v);
      expect(m.win).toBeCloseTo(direct.heroWinPct / 100, 6);
      expect(m.tie).toBeCloseTo(direct.tiePct / 100, 6);
    }
  }, 30_000);

  it("ranks hands for top-% picks: AA first, 72o near the bottom", () => {
    const order = rankHandsVsRandom(table).map((r) => r.hand);
    expect(order).toHaveLength(169);
    expect(order[0]).toBe("AA");
    expect(order.indexOf("72o")).toBeGreaterThan(160);
    expect(topPercent(order, 0.4)).toEqual(["AA"]); // 6 of 1,326 combos ≈ 0.45%
    expect(topPercent(order, 100)).toHaveLength(169);
  }, 60_000);
});
