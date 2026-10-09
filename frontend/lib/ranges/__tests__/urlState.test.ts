import { describe, expect, it } from "vitest";
import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "../data";
import type { Deal } from "../logic";
import {
  RANGES_DEFAULTS,
  TRAINER_DEFAULTS,
  chartHrefForDeal,
  parseRangesQuery,
  parseTrainerQuery,
  rangesQuery,
  trainerQuery,
} from "../urlState";

const qs = (s: string) => new URLSearchParams(s.replace(/^\?/, ""));

describe("trainer query", () => {
  it("defaults to an empty query", () => {
    expect(trainerQuery(TRAINER_DEFAULTS)).toBe("");
    expect(parseTrainerQuery(qs(""))).toEqual(TRAINER_DEFAULTS);
  });

  it("round-trips every setting", () => {
    for (const type of ["open", "def", "mix"] as const)
      for (const game of ["all", "mtt", "pf", "cash"] as const)
        for (const fewerFolds of [true, false]) {
          if (game === "pf" && type !== "open") continue;
          const s = { type, game, fewerFolds };
          expect(parseTrainerQuery(qs(trainerQuery(s)))).toEqual(s);
        }
  });

  it("drops push/fold outside opening hands and ignores junk", () => {
    expect(parseTrainerQuery(qs("type=def&game=pf")).game).toBe("all");
    expect(parseTrainerQuery(qs("type=nope&game=zzz"))).toEqual(TRAINER_DEFAULTS);
  });
});

describe("ranges query", () => {
  it("round-trips each view", () => {
    const cases = [
      { ...RANGES_DEFAULTS, view: "mtt" as const, mtt: { pos: "CO", stack: 40 } },
      { ...RANGES_DEFAULTS, view: "cash" as const, cash: { pos: "SB" } },
      { ...RANGES_DEFAULTS, view: "pf" as const, pf: { pos: "SB", stack: 7 } },
      {
        ...RANGES_DEFAULTS,
        view: "def" as const,
        def: { game: "mtt" as const, hero: "SB", vil: "LJ", stack: 25, spot: "4bet" as const },
      },
    ];
    for (const s of cases) expect(parseRangesQuery(qs(rangesQuery(s)))).toEqual(s);
  });

  it("falls back to defaults for missing or bad values", () => {
    expect(parseRangesQuery(qs(""))).toEqual(RANGES_DEFAULTS);
    expect(parseRangesQuery(qs("view=pf&stack=99")).pf.stack).toBe(10);
    expect(parseRangesQuery(qs("view=def&spot=nope")).def.spot).toBe("open");
  });

  it("accepts a plain searchParams record (server components)", () => {
    expect(parseRangesQuery({ view: "mtt", pos: "HJ", stack: "25" }).mtt).toEqual({ pos: "HJ", stack: 25 });
  });
});

describe("View full chart link", () => {
  const hand = { hand: "AKs", cards: ["As", "Ks"] as [string, string] };

  it("points a defense hand at its exact chart", () => {
    const c = DEFENSE_CHARTS.find((x) => x.group === "mtt" && x.spot === "4bet")!;
    const deal = { type: "def", kind: "freq", chart: c, stack: c.stack, fmt: c.group, hero: c.hero, vil: c.vil, spot: c.spot, ...hand } as Deal;
    const href = chartHrefForDeal(deal);
    expect(href.startsWith("/preflop-trainer/ranges?")).toBe(true);
    const s = parseRangesQuery(qs(href.split("?")[1]));
    expect(s.view).toBe("def");
    expect(s.def).toEqual({ game: "mtt", hero: c.hero, vil: c.vil, stack: c.stack, spot: "4bet" });
  });

  it("points opens and push/fold at their chart", () => {
    const o = MTT_OPEN_CHARTS.find((x) => x.pos === "CO" && x.stack === 40)!;
    const open = { type: "open", kind: "freq", chart: o, stack: 40, fmt: "mtt", hero: "CO", ...hand } as Deal;
    expect(parseRangesQuery(qs(chartHrefForDeal(open).split("?")[1])).mtt).toEqual({ pos: "CO", stack: 40 });

    const p = PUSH_FOLD_CHARTS.find((x) => x.pos === "SB")!;
    const pf = { type: "open", kind: "pf", chart: p, stack: 6, fmt: "mtt", hero: "SB", w: 1 / 9, ...hand } as Deal;
    const s = parseRangesQuery(qs(chartHrefForDeal(pf).split("?")[1]));
    expect(s.view).toBe("pf");
    expect(s.pf).toEqual({ pos: "SB", stack: 6 });
  });
});
