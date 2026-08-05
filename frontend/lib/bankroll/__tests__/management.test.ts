import { describe, expect, it } from "vitest";
import { categorizeSession, evaluateBankrollStatus } from "../management";

describe("categorizeSession", () => {
  it("maps plain cash sessions to 'cash'", () => {
    expect(categorizeSession("cash", "NLHE")).toBe("cash");
    expect(categorizeSession("cash", null)).toBe("cash");
  });

  it("maps PLO/Omaha cash sessions to 'plo', case-insensitively", () => {
    expect(categorizeSession("cash", "PLO")).toBe("plo");
    expect(categorizeSession("cash", "plo5")).toBe("plo");
    expect(categorizeSession("cash", "Omaha Hi/Lo")).toBe("plo");
  });

  it("folds tournament and sit_and_go into 'tournament'", () => {
    expect(categorizeSession("tournament", "NLHE")).toBe("tournament");
    expect(categorizeSession("sit_and_go", "NLHE")).toBe("tournament");
  });

  it("maps spin_and_go to its own category", () => {
    expect(categorizeSession("spin_and_go", null)).toBe("spin_and_go");
  });

  it("leaves 'other' uncategorized", () => {
    expect(categorizeSession("other", "NLHE")).toBeNull();
  });
});

describe("evaluateBankrollStatus", () => {
  it("returns 'unknown' when no rule is configured", () => {
    expect(evaluateBankrollStatus(5000, undefined).status).toBe("unknown");
  });

  it("returns 'unknown' when currentBuyIn is not set", () => {
    expect(evaluateBankrollStatus(5000, { buyInCount: 40, currentBuyIn: null }).status).toBe("unknown");
  });

  it("returns 'move_down' when below the chosen buy-in-count threshold", () => {
    const result = evaluateBankrollStatus(3000, { buyInCount: 40, currentBuyIn: 200 }); // 15 buy-ins
    expect(result.status).toBe("move_down");
    expect(result.buyInsAvailable).toBe(15);
    expect(result.warning).toContain("15.0 buy-ins");
  });

  it("returns 'safe' exactly at the threshold", () => {
    const result = evaluateBankrollStatus(8000, { buyInCount: 40, currentBuyIn: 200 }); // exactly 40
    expect(result.status).toBe("safe");
  });

  it("returns 'safe' between the threshold and 1.5x the threshold", () => {
    const result = evaluateBankrollStatus(10000, { buyInCount: 40, currentBuyIn: 200 }); // 50 buy-ins
    expect(result.status).toBe("safe");
  });

  it("returns 'move_up' at or above 1.5x the threshold", () => {
    const result = evaluateBankrollStatus(12000, { buyInCount: 40, currentBuyIn: 200 }); // 60 buy-ins
    expect(result.status).toBe("move_up");
    expect(result.warning).toBeNull();
  });
});
