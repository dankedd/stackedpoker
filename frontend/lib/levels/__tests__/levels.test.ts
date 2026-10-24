/**
 * The level table (lib/levels) against shared/levels.json — the same file the
 * backend (tests/test_xp_calculator.py) and SQL (xp_rebalance.test.sql) check.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import config from "../levels.json";
import {
  MAX_LEVEL,
  THRESHOLDS,
  TIERS,
  TIER_STYLES,
  getLevelProgress,
  levelForXP,
  tierForLevel,
  xpRequiredForLevel,
} from "..";

const SHARED = path.resolve(__dirname, "../../../../shared/levels.json");
const COPY = path.resolve(__dirname, "../levels.json");

describe("levels.json", () => {
  it.runIf(existsSync(SHARED))("is byte-identical to shared/levels.json", () => {
    expect(readFileSync(COPY, "utf8")).toBe(readFileSync(SHARED, "utf8"));
  });

  it("thresholds follow round_half_up(base × level ^ exponent)", () => {
    const { base, exponent } = config.curve;
    const expected = [0];
    for (let level = 1; level < MAX_LEVEL; level++) {
      expected.push(expected[level - 1] + Math.floor(base * level ** exponent + 0.5));
    }
    expect(THRESHOLDS).toEqual(expected);
    expect(MAX_LEVEL).toBe(50);
  });

  it("every level costs more than the one before, and stays polynomial", () => {
    const costs = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => xpRequiredForLevel(i + 1));
    costs.slice(1).forEach((c, i) => expect(c).toBeGreaterThan(costs[i]));
    expect(costs[costs.length - 1]).toBeLessThan(2000);
  });

  it("hits the calibration milestones for the reference player", () => {
    const at = (level: number) => config.reference_days[level - 1];
    expect(at(2)).toBeLessThanOrEqual(0.3);
    expect(at(5)).toBeLessThanOrEqual(2);
    expect(at(10)).toBeGreaterThanOrEqual(6);
    expect(at(10)).toBeLessThanOrEqual(9);
    expect(at(20)).toBeGreaterThanOrEqual(45);
    expect(at(20)).toBeLessThanOrEqual(61);
    expect(at(30)).toBeGreaterThanOrEqual(150);
    expect(at(30)).toBeLessThanOrEqual(185);
    expect(at(50)).toBeGreaterThanOrEqual(640);
    expect(at(50)).toBeLessThanOrEqual(800);
  });
});

describe("levelForXP / getLevelProgress", () => {
  it("level boundaries", () => {
    expect(levelForXP(-5)).toBe(1);
    expect(levelForXP(0)).toBe(1);
    expect(levelForXP(1)).toBe(1);
    expect(levelForXP(2)).toBe(2);
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(levelForXP(THRESHOLDS[level - 1])).toBe(level);
      expect(levelForXP(THRESHOLDS[level - 1] - 1)).toBe(level - 1);
    }
  });

  it("mid-level progress (300 XP: level 10, 34 / 84)", () => {
    const p = getLevelProgress(300);
    expect(p.level).toBe(10);
    expect([p.currentLevelThreshold, p.nextLevelThreshold]).toEqual([266, 350]);
    expect([p.currentLevelXp, p.xpRequiredForNextLevel, p.xpRemaining]).toEqual([34, 84, 50]);
    expect(p.progressPercent).toBe(40);
    expect(p.tier.title).toBe("Grinder");
  });

  it("caps at level 50, Legend", () => {
    const p = getLevelProgress(10 ** 9);
    expect(p.level).toBe(50);
    expect(p.isMaxLevel).toBe(true);
    expect(p.tier.title).toBe("Legend");
    expect(p.nextLevelThreshold).toBeNull();
    expect(p.progressPercent).toBe(100);
  });
});

describe("tiers", () => {
  it.each([
    [1, "Fish"], [4, "Fish"], [5, "Calling Station"], [9, "Calling Station"], [10, "Grinder"], [14, "Grinder"],
    [15, "Reg"], [19, "Reg"], [20, "Shark"], [29, "Shark"], [30, "Crusher"], [39, "Crusher"],
    [40, "High Roller"], [49, "High Roller"], [50, "Legend"],
  ])("level %i is %s", (level, title) => {
    expect(tierForLevel(level).title).toBe(title);
  });

  it("cover 1-50 once, each with a style", () => {
    const levels = TIERS.flatMap((t) => Array.from({ length: t.max - t.min + 1 }, (_, i) => t.min + i));
    expect(levels).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    TIERS.forEach((t) => expect(TIER_STYLES[t.color]).toBeDefined());
  });
});
