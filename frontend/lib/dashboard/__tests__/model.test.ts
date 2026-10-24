import { describe, expect, it } from "vitest";
import type { Entitlements } from "@/lib/billing/entitlements";
import { boardCategory, leakView, planLine, skillView } from "../model";
import { parseDashboard, type Skill } from "../types";

const skill = (over: Partial<Skill> = {}): Skill => ({
  days: 30,
  preflop: {},
  preflopSpots: [],
  flop: { n: 0, good: 0, categories: {} },
  week: [
    [0, 0],
    [0, 0],
  ],
  ...over,
});

describe("boardCategory — the flop trainer's texture rules, from cards", () => {
  it.each([
    [["Kh", "Kd", "4c"], "paired"],
    [["7h", "7d", "7c"], "paired"],
    [["Ah", "9h", "4h"], "monotone"],
    [["Ah", "9d", "4c"], "ace_high"],
    [["Kh", "7c", "2d"], "king_high"],
    [["Jh", "8c", "3d"], "high"],
    [["9h", "8c", "6d"], "connected"],
    [["6h", "4c", "2d"], "connected"],
    [["Th", "5c", "2d"], "low_dry"],
  ])("%j → %s", (board, cat) => {
    expect(boardCategory(board as string[])).toBe(cat);
  });

  it("needs a full flop", () => {
    expect(boardCategory(["Ah", "Kd"])).toBeNull();
  });
});

describe("skillView", () => {
  it("below every minimum: not enough hands yet, and how many are still needed", () => {
    const v = skillView(skill({ preflop: { open: [8, 6] } }));
    expect(v.enough).toBe(false);
    expect(v.needed).toBe(10);
    expect(v.preflop.pct).toBeNull();
  });

  it("per-kind percentages only from their own minimum", () => {
    const v = skillView(skill({ preflop: { open: [30, 24], defense: [4, 1] } }));
    expect(v.enough).toBe(true);
    expect(v.preflop.pct).toBe(74); // 25 of 34
    expect(v.preflop.kinds.find((k) => k.key === "open")?.pct).toBe(80);
    expect(v.preflop.kinds.find((k) => k.key === "defense")?.pct).toBeNull();
  });

  it("weakest texture needs two textures with enough answers", () => {
    const one = skillView(skill({ flop: { n: 12, good: 6, categories: { paired: [12, 6] } } }));
    expect(one.weakestTexture).toBeNull();
    const two = skillView(skill({ flop: { n: 20, good: 13, categories: { paired: [10, 4], ace_high: [10, 9] } } }));
    expect(two.weakestTexture).toEqual({ label: "Paired boards", pct: 40 });
  });

  it("the train button goes to whichever weak spot misses more", () => {
    const flopWorse = skillView(
      skill({
        preflop: { open: [30, 24] },
        preflopSpots: [["open:open_mtt_bn_25", 10, 3]],
        flop: { n: 20, good: 11, categories: { paired: [10, 2], ace_high: [10, 9] } },
      }),
    );
    expect(flopWorse.weakest?.href).toBe("/flop-trainer?focus=paired");
    const preWorse = skillView(
      skill({
        preflop: { open: [30, 24] },
        preflopSpots: [["open:open_mtt_bn_25", 10, 9]],
        flop: { n: 20, good: 11, categories: { paired: [10, 2], ace_high: [10, 9] } },
      }),
    );
    expect(preWorse.weakest?.href.startsWith("/preflop-trainer")).toBe(true);
    expect(preWorse.weakest?.label).toMatch(/open at 25bb/);
  });

  it("weekly trend only with enough answers in both weeks", () => {
    expect(skillView(skill({ preflop: { open: [30, 24] }, week: [[30, 27], [5, 1]] })).trend).toBeNull();
    expect(skillView(skill({ preflop: { open: [30, 24] }, week: [[30, 27], [30, 21]] })).trend).toEqual({ dir: "up", points: 20 });
    expect(skillView(skill({ preflop: { open: [30, 24] }, week: [[30, 21], [30, 21]] })).trend).toEqual({ dir: "steady", points: 0 });
  });
});

describe("leakView", () => {
  it("preflop: names the chart's spot and trains that chart's group", () => {
    const v = leakView({
      handId: "h1",
      tournamentId: "t1",
      playedAt: "2026-10-20T20:00:00",
      hand: "A9o",
      position: "LJ",
      street: "preflop",
      verdict: "too_loose",
      chart: "open:open_mtt_lj_25",
      board: [],
      potBb: 10,
    });
    expect(v.title).toBe("A9o · LJ");
    expect(v.verdict).toBe("Too loose");
    expect(v.href).toBe("/hands/h1");
    expect(v.trainHref.startsWith("/preflop-trainer")).toBe(true);
  });

  it("flop: the board, and the c-bet trainer on that texture", () => {
    const v = leakView({
      handId: "h2",
      tournamentId: null,
      playedAt: "",
      hand: "KQs",
      position: "BTN",
      street: "flop",
      verdict: "questionable",
      chart: null,
      board: ["Kh", "7c", "2d", "Qs"],
      potBb: 14,
    });
    expect(v.spot).toBe("Flop K♥ 7♣ 2♦");
    expect(v.trainHref).toBe("/flop-trainer?cbet=1&focus=king_high");
  });
});

describe("planLine", () => {
  const base: Entitlements = {
    plan: "free",
    trialEndsAt: null,
    trialEnded: false,
    trialEndedSeen: false,
    subscription: { status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, hasCustomer: false },
    limits: { trainerHandsPerDay: 50, tournamentsPerWeek: 1, aiQuestionsPerDay: 3 },
    usage: { trainerHandsToday: 0, aiQuestionsToday: 0, tournamentsThisWeek: 1 },
    dailyResetAt: null,
    nextUploadAt: null,
    hiddenTournaments: 0,
  };
  it("Free: usage and upgrade", () => {
    expect(planLine(base)).toEqual({ label: "Free", detail: "1/1 tournament this week", action: "upgrade" });
  });
  it("Pro: renewal date, or the end date once cancelled", () => {
    const pro = { ...base, plan: "pro" as const, subscription: { ...base.subscription, currentPeriodEnd: "2026-11-24T10:00:00Z", hasCustomer: true } };
    expect(planLine(pro)).toEqual({ label: "Pro", detail: "renews 24 Nov", action: "manage" });
    expect(planLine({ ...pro, subscription: { ...pro.subscription, cancelAtPeriodEnd: true } })?.detail).toBe("ends 24 Nov");
  });
});

describe("parseDashboard", () => {
  it("reads the RPC shape, and survives missing parts", () => {
    const d = parseDashboard({
      hands: { imported: 225, tournaments: 12 },
      last_tournament: null,
      leaks: [],
      skill: { days: 30, preflop: { open: [10, 8] }, preflop_spots: [["open:x", 5, 2]], flop: { n: 0, good: 0, categories: {} }, week: [[1, 1], [0, 0]] },
      social: null,
    });
    expect(d?.hands).toEqual({ imported: 225, tournaments: 12 });
    expect(d?.skill.preflop.open).toEqual([10, 8]);
    expect(d?.skill.preflopSpots).toEqual([["open:x", 5, 2]]);
    expect(d?.social).toBeNull();
    expect(parseDashboard(null)).toBeNull();
    expect(parseDashboard({})?.skill.week).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
