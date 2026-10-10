import { describe, expect, it } from "vitest";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { ROUTES } from "../routes";
import { FOOTER_NAV, LANDING_FOOTER_NAV, PRIMARY_NAV, devNav, globalLinkTargets, primaryNav } from "../navigation";
import { isFeaturePublic } from "@/lib/features";

const labels = (items: { label: string }[]) => items.map((i) => i.label);
/** Learn and Puzzles as public header items, as they will be once lib/features.ts says so. */
const LIVE = { learn: true, puzzles: true };

describe("header navigation", () => {
  it("never lists the Wiki, whatever the flag", () => {
    for (const preflopTrainer of [true, false]) {
      const nav = primaryNav({ preflopTrainer });
      expect(labels(nav)).not.toContain("Wiki");
      expect(nav.map((i) => i.href)).not.toContain(ROUTES.wiki);
    }
    expect(PRIMARY_NAV.map((i) => i.href)).not.toContain(ROUTES.wiki);
  });

  it("puts Preflop Trainer where the Wiki was when the flag is on", () => {
    expect(labels(primaryNav({ preflopTrainer: true, ...LIVE }))).toEqual([
      "Learn",
      "Puzzles",
      "Preflop Trainer",
      "Bankroll",
      "Leaderboard",
    ]);
    expect(primaryNav({ preflopTrainer: true, ...LIVE })[2].href).toBe(PREFLOP_TRAINER_PATH);
  });

  it("has no Preflop Trainer item when the flag is off", () => {
    expect(labels(primaryNav({ preflopTrainer: false, ...LIVE }))).toEqual(["Learn", "Puzzles", "Bankroll", "Leaderboard"]);
  });

  it("adds Hands before Bankroll only when the hand history flag is on", () => {
    expect(labels(primaryNav({ preflopTrainer: false, handHistory: true, ...LIVE }))).toEqual([
      "Learn",
      "Puzzles",
      "Hands",
      "Bankroll",
      "Leaderboard",
    ]);
    expect(labels(primaryNav({ preflopTrainer: false }))).not.toContain("Hands");
  });

  it("leaves Learn and Puzzles out of the header while they are in development", () => {
    const nav = labels(primaryNav({ preflopTrainer: true, handHistory: true, learn: false, puzzles: false }));
    expect(nav).toEqual(["Preflop Trainer", "Hands", "Bankroll", "Leaderboard"]);
  });

  it("follows lib/features.ts: dev-only features sit in the In development menu, not the header or footers", () => {
    const header = PRIMARY_NAV.map((i) => i.href);
    const footers = [...FOOTER_NAV, ...LANDING_FOOTER_NAV].flatMap((g) => g.items.map((i) => i.href));
    const dev = devNav().map((i) => i.href);
    for (const [feature, href] of [["learn", "/learn"], ["puzzles", ROUTES.puzzles]] as const) {
      expect(header.includes(href)).toBe(isFeaturePublic(feature));
      expect(dev.includes(href)).toBe(!isFeaturePublic(feature));
      if (!isFeaturePublic(feature)) expect(footers).not.toContain(href);
    }
  });

  it("keeps the Wiki reachable from the footer and the global link graph", () => {
    const footerHrefs = FOOTER_NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(footerHrefs).toContain(ROUTES.wiki);
    expect(globalLinkTargets()).toContain(ROUTES.wiki);
  });

  it("no longer lists the trainer under Free tools", () => {
    const tools = FOOTER_NAV.find((g) => g.group === "Free tools")!;
    expect(tools.items.some((i) => i.href.includes("preflop"))).toBe(false);
  });
});
