import { describe, expect, it } from "vitest";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { ROUTES } from "../routes";
import { FOOTER_NAV, PRIMARY_NAV, globalLinkTargets, primaryNav } from "../navigation";

const labels = (items: { label: string }[]) => items.map((i) => i.label);

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
    expect(labels(primaryNav({ preflopTrainer: true }))).toEqual([
      "Learn",
      "Puzzles",
      "Preflop Trainer",
      "Bankroll",
      "Leaderboard",
    ]);
    expect(primaryNav({ preflopTrainer: true })[2].href).toBe(PREFLOP_TRAINER_PATH);
  });

  it("has no Preflop Trainer item when the flag is off", () => {
    expect(labels(primaryNav({ preflopTrainer: false }))).toEqual(["Learn", "Puzzles", "Bankroll", "Leaderboard"]);
  });

  it("adds Hands before Bankroll only when the hand history flag is on", () => {
    expect(labels(primaryNav({ preflopTrainer: false, handHistory: true }))).toEqual([
      "Learn",
      "Puzzles",
      "Hands",
      "Bankroll",
      "Leaderboard",
    ]);
    expect(labels(primaryNav({ preflopTrainer: false }))).not.toContain("Hands");
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
