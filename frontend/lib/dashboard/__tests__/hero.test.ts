import { describe, expect, it } from "vitest";
import { clockUntil, newMistakes, pickHero, type HeroInput } from "../hero";
import type { LastTournament } from "../types";

const NOW = Date.parse("2026-10-24T18:00:00Z");
const tour = (over: Partial<LastTournament> = {}): LastTournament => ({
  id: "t1",
  name: "Bounty Hunter",
  site: "ggpoker",
  createdAt: "2026-10-24T12:00:00Z",
  handCount: 120,
  reviewed: false,
  mistakes: 3,
  score: 88,
  ...over,
});
const input = (over: Partial<HeroInput> = {}): HeroInput => ({
  spotsToday: 12,
  dailyLimit: 50,
  resetAt: "2026-10-24T22:00:00Z",
  handsImported: 200,
  last: tour({ reviewed: true }),
  now: NOW,
  ...over,
});

describe("pickHero — one primary action, by priority", () => {
  it("a. not trained yet today → train (before anything else)", () => {
    const h = pickHero(input({ spotsToday: 0, last: tour() }));
    expect(h.kind).toBe("train");
    expect(h.href).toBe("/preflop-trainer");
    expect([h.done, h.goal]).toEqual([0, 50]);
  });

  it("a. a new user without hands also gets the import as the secondary action", () => {
    const h = pickHero(input({ spotsToday: 0, handsImported: 0, last: null }));
    expect(h.kind).toBe("train");
    expect(h.secondary).toEqual({ kind: "import", href: "/hands/import" });
  });

  it("b. unseen mistakes in the last import → straight to its summary", () => {
    const h = pickHero(input({ last: tour() }));
    expect(h.kind).toBe("mistakes");
    expect(h.mistakes).toBe(3);
    expect(h.href).toBe("/hands/summary/t1");
    expect(h.secondary?.kind).toBe("train");
  });

  it("c. daily limit reached → review the last tournament, with the reset time", () => {
    const h = pickHero(input({ spotsToday: 50 }));
    expect(h.kind).toBe("limit");
    expect(h.href).toBe("/hands/summary/t1");
    expect(h.resetAt).toBe("2026-10-24T22:00:00Z");
    expect([h.done, h.goal]).toEqual([50, 50]);
  });

  it("c. at the limit without any tournament → import", () => {
    const h = pickHero(input({ spotsToday: 50, handsImported: 0, last: null }));
    expect(h.kind).toBe("limit");
    expect(h.href).toBe("/hands/import");
  });

  it("d. trained today, no hands ever → import your first tournament, with the example", () => {
    const h = pickHero(input({ handsImported: 0, last: null }));
    expect(h.kind).toBe("import");
    expect(h.secondary).toEqual({ kind: "example", href: "/hands/example" });
  });

  it("otherwise → keep training", () => {
    expect(pickHero(input()).kind).toBe("keepTraining");
  });

  it("Pro (no limit) never hits the limit and gets the default goal ring", () => {
    const h = pickHero(input({ spotsToday: 400, dailyLimit: null }));
    expect(h.kind).toBe("keepTraining");
    expect(h.goal).toBe(50);
  });

  it("unknown entitlements (before the billing migration) never claim 'not trained today'", () => {
    expect(pickHero(input({ spotsToday: null })).kind).toBe("keepTraining");
  });
});

describe("newMistakes", () => {
  it("counts only unreviewed, recent imports with mistakes", () => {
    expect(newMistakes(tour(), NOW)).toBe(3);
    expect(newMistakes(tour({ reviewed: true }), NOW)).toBe(0);
    expect(newMistakes(tour({ mistakes: 0 }), NOW)).toBe(0);
    expect(newMistakes(tour({ createdAt: "2026-09-01T00:00:00Z" }), NOW)).toBe(0);
    expect(newMistakes(null, NOW)).toBe(0);
  });
});

describe("clockUntil", () => {
  it("formats HH:MM and never goes negative", () => {
    expect(clockUntil("2026-10-24T22:00:00Z", NOW)).toBe("04:00");
    expect(clockUntil("2026-10-24T18:05:30Z", NOW)).toBe("00:06");
    expect(clockUntil("2026-10-24T17:00:00Z", NOW)).toBe("00:00");
  });
});
