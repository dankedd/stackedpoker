import { describe, expect, it } from "vitest";
import { DEFENSE_CHARTS, OPEN_CHARTS, PUSH_FOLD_CHARTS } from "../data";
import { ALL_HANDS } from "../logic";

/**
 * Shape checks for data/ranges/*.json. These guard a future data swap, not
 * the values themselves — the numbers are whatever the source says.
 */

const name = (c: { title?: string; pos?: string; stack?: number; group?: string }) =>
  c.title ?? `${c.pos} ${c.stack}bb ${c.group}`;

describe("range data", () => {
  it("has the expected number of charts", () => {
    expect(OPEN_CHARTS).toHaveLength(40);
    expect(PUSH_FOLD_CHARTS).toHaveLength(8);
    expect(DEFENSE_CHARTS).toHaveLength(159);
  });

  it("gives every grid exactly the 169 hand classes", () => {
    const expected = [...ALL_HANDS].sort();
    for (const c of [...OPEN_CHARTS, ...PUSH_FOLD_CHARTS, ...DEFENSE_CHARTS]) {
      expect(Object.keys(c.grid).sort(), name(c)).toEqual(expected);
    }
  });

  it("has one frequency per action and every non-null row sums to ~1", () => {
    for (const c of [...OPEN_CHARTS, ...DEFENSE_CHARTS]) {
      for (const [hand, row] of Object.entries(c.grid)) {
        if (row === null) continue;
        expect(row, `${name(c)} ${hand}`).toHaveLength(c.actions.length);
        const sum = row.reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1), `${name(c)} ${hand} sums to ${sum}`).toBeLessThan(0.005);
      }
    }
  });

  it("states action percentages that add up to ~100", () => {
    // ±3 rather than ±0.5: a handful of the book's captions are themselves
    // off (CO vs UTG 15bb prints 8.3% + 88.7% = 97.0%). Shown as printed.
    for (const c of [...OPEN_CHARTS, ...DEFENSE_CHARTS]) {
      const total = c.actions.reduce((s, a) => s + a.pct, 0);
      expect(Math.abs(total - 100), `${name(c)} totals ${total}`).toBeLessThanOrEqual(3);
    }
  });

  it("only uses null cells in defense charts", () => {
    for (const c of OPEN_CHARTS) expect(Object.values(c.grid).includes(null as never)).toBe(false);
  });

  it("uses only known push/fold cell values", () => {
    for (const c of PUSH_FOLD_CHARTS) {
      for (const [bg, n] of Object.values(c.grid)) {
        expect(["black", "red"]).toContain(bg);
        expect(n === "" || /^[1-9]$/.test(n)).toBe(true);
      }
    }
  });
});
