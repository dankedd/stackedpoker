import { describe, expect, it } from "vitest";
import {
  getSubscription,
  isPaidTier,
  canUseUnlimitedAI,
  canAccessPremium,
  aiCoachDailyLimit,
  canAccessModule,
  canAccessLesson,
} from "../entitlements";

describe("getSubscription", () => {
  it("maps DB tier values to display labels", () => {
    expect(getSubscription("free")).toEqual({ tier: "free", label: "Free" });
    expect(getSubscription("pro")).toEqual({ tier: "pro", label: "Plus" });
    expect(getSubscription("premium")).toEqual({ tier: "premium", label: "Elite" });
    expect(getSubscription("admin")).toEqual({ tier: "admin", label: "Elite" });
  });

  it("treats null/undefined/unknown values as free", () => {
    expect(getSubscription(null).tier).toBe("free");
    expect(getSubscription(undefined).tier).toBe("free");
    expect(getSubscription("nonsense").tier).toBe("free");
  });
});

describe("isPaidTier / canUseUnlimitedAI / canAccessPremium", () => {
  it("is true for pro, premium, and admin; false for free and unknown", () => {
    for (const fn of [isPaidTier, canUseUnlimitedAI, canAccessPremium]) {
      expect(fn("pro")).toBe(true);
      expect(fn("premium")).toBe(true);
      expect(fn("admin")).toBe(true);
      expect(fn("free")).toBe(false);
      expect(fn(null)).toBe(false);
      expect(fn(undefined)).toBe(false);
    }
  });
});

describe("aiCoachDailyLimit", () => {
  it("is 3 for free, unlimited for any paid tier", () => {
    expect(aiCoachDailyLimit("free")).toBe(3);
    expect(aiCoachDailyLimit("pro")).toBe(Infinity);
    expect(aiCoachDailyLimit("premium")).toBe(Infinity);
    expect(aiCoachDailyLimit("admin")).toBe(Infinity);
  });
});

describe("canAccessModule", () => {
  const modules = [
    { sort_order: 0 },
    { sort_order: 1 },
    { sort_order: 2 },
    { sort_order: 3 },
  ];

  it("free tier gets only the first two modules by sort_order", () => {
    expect(canAccessModule("free", modules[0], modules)).toBe(true);
    expect(canAccessModule("free", modules[1], modules)).toBe(true);
    expect(canAccessModule("free", modules[2], modules)).toBe(false);
    expect(canAccessModule("free", modules[3], modules)).toBe(false);
  });

  it("is unaffected by array order — only sort_order matters", () => {
    const shuffled = [modules[3], modules[1], modules[2], modules[0]];
    expect(canAccessModule("free", modules[1], shuffled)).toBe(true);
    expect(canAccessModule("free", modules[2], shuffled)).toBe(false);
  });

  it("paid tiers get every module", () => {
    for (const m of modules) {
      expect(canAccessModule("pro", m, modules)).toBe(true);
      expect(canAccessModule("premium", m, modules)).toBe(true);
    }
  });

  it("a newly-added module (higher sort_order) is automatically locked for free — no code change needed", () => {
    const withNewModule = [...modules, { sort_order: 4 }];
    expect(canAccessModule("free", { sort_order: 4 }, withNewModule)).toBe(false);
  });
});

describe("canAccessLesson", () => {
  const module1 = { sort_order: 0 };
  const module3 = { sort_order: 2 };
  const allModules = [{ sort_order: 0 }, { sort_order: 1 }, module3, { sort_order: 3 }];
  const module3Lessons = [{ sort_order: 1 }, { sort_order: 2 }, { sort_order: 3 }, { sort_order: 4 }];

  it("every lesson in a fully-free module (module 1 or 2) is accessible", () => {
    const module1Lessons = [{ sort_order: 1 }, { sort_order: 2 }, { sort_order: 3 }];
    for (const lesson of module1Lessons) {
      expect(canAccessLesson("free", module1, lesson, allModules, module1Lessons)).toBe(true);
    }
  });

  it("in a premium module (module 3+), only the lowest sort_order lesson is free", () => {
    expect(canAccessLesson("free", module3, module3Lessons[0], allModules, module3Lessons)).toBe(true);
    expect(canAccessLesson("free", module3, module3Lessons[1], allModules, module3Lessons)).toBe(false);
    expect(canAccessLesson("free", module3, module3Lessons[2], allModules, module3Lessons)).toBe(false);
    expect(canAccessLesson("free", module3, module3Lessons[3], allModules, module3Lessons)).toBe(false);
  });

  it("the free lesson is found by lowest sort_order, not array position", () => {
    const shuffled = [module3Lessons[2], module3Lessons[0], module3Lessons[3], module3Lessons[1]];
    expect(canAccessLesson("free", module3, module3Lessons[0], allModules, shuffled)).toBe(true);
    expect(canAccessLesson("free", module3, module3Lessons[1], allModules, shuffled)).toBe(false);
  });

  it("paid tiers get every lesson in every module", () => {
    for (const lesson of module3Lessons) {
      expect(canAccessLesson("pro", module3, lesson, allModules, module3Lessons)).toBe(true);
      expect(canAccessLesson("premium", module3, lesson, allModules, module3Lessons)).toBe(true);
    }
  });
});
