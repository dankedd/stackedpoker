import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { handRefFor } from "../api";
import { DEFENSE_CHARTS, OPEN_CHARTS, PUSH_FOLD_CHARTS } from "../data";
import { newDeal, type Rng } from "../logic";

/**
 * The server re-grades every trainer hand for XP against its own copy of the
 * charts (backend/app/engines/preflop_trainer/data). If the two copies drift,
 * the browser and the server disagree on what was correct. The browser's copy
 * is the server's minus the source fields (scripts/build-range-data.mjs).
 */

const SOURCE_FIELDS = ["page", "hr", "n", "title"];

const FRONTEND = resolve(__dirname, "../../../data/ranges");
const BACKEND = resolve(__dirname, "../../../../backend/app/engines/preflop_trainer/data");

function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("backend chart copy", () => {
  it.each(["open", "pushfold", "defense"])("%s.json is the server's copy without source fields", (name) => {
    const server = JSON.parse(readFileSync(resolve(BACKEND, `${name}.json`), "utf8")) as Record<string, unknown>[];
    const client = JSON.parse(readFileSync(resolve(FRONTEND, `${name}.json`), "utf8"));
    expect(client).toEqual(server.map((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !SOURCE_FIELDS.includes(k)))));
  });

  it("ships no source field to the browser", () => {
    for (const c of [...OPEN_CHARTS, ...PUSH_FOLD_CHARTS, ...DEFENSE_CHARTS]) {
      for (const k of SOURCE_FIELDS) expect(c, `${c.id}.${k}`).not.toHaveProperty(k);
      expect(c.id).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe("handRefFor", () => {
  it("identifies every kind of deal the way the server expects", () => {
    const rng = seeded(7);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const deal = newDeal("mix", "all", false, rng);
      const ref = handRefFor(deal);
      seen.add(ref.kind);
      if (ref.kind === "pushfold") {
        expect(ref.stack).toBeGreaterThanOrEqual(2);
        expect(ref.stack).toBeLessThanOrEqual(10);
      } else {
        expect(ref.stack).toBeNull();
      }
      expect(ref.chart_id).toMatch(/^(open|push|def)_[a-z0-9_]+$/);
    }
    expect(seen).toEqual(new Set(["open", "pushfold", "defense"]));
  });
});
