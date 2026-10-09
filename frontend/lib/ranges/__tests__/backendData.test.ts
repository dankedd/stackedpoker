import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { handRefFor } from "../api";
import { newDeal, type Rng } from "../logic";

/**
 * The server re-grades every trainer hand for XP against its own copy of the
 * charts (backend/app/engines/preflop_trainer/data). If the two copies drift,
 * the browser and the server disagree on what was correct.
 */

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
  it.each(["open", "pushfold", "defense"])("%s.json is byte-identical", (name) => {
    expect(readFileSync(resolve(BACKEND, `${name}.json`)).equals(readFileSync(resolve(FRONTEND, `${name}.json`)))).toBe(
      true,
    );
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
      expect(Number.isInteger(ref.chart_id)).toBe(true);
    }
    expect(seen).toEqual(new Set(["open", "pushfold", "defense"]));
  });
});
