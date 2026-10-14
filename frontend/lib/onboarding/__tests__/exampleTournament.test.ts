import { describe, expect, it } from "vitest";
import { buildTimeline, totalOnTable } from "@/lib/handHistory/timeline";
import { EXAMPLE_TOURNAMENT_NAME, exampleHands } from "../exampleTournament";

describe("Example tournament", () => {
  const hands = exampleHands();

  it("every hand parses as one tournament", () => {
    expect(hands).toHaveLength(6);
    for (const h of hands) {
      expect(h.hand.tournamentName).toBe(EXAMPLE_TOURNAMENT_NAME);
      expect(h.hand.heroName).toBe("Hero");
    }
  });

  it("chips add up at every step of every hand", () => {
    for (const { hand } of hands) {
      const start = hand.players.reduce((a, p) => a + p.stack, 0);
      const steps = buildTimeline(hand);
      for (const step of steps) {
        const onTable = Object.values(step.stacks).reduce((a, b) => a + b, 0) + totalOnTable(step);
        expect(onTable, hand.handId).toBeCloseTo(start, 6);
      }
      expect(totalOnTable(steps.at(-1)!), hand.handId).toBeCloseTo(0, 6);
    }
  });

  it("the default filters show the three hands that matter", () => {
    const shown = hands.filter((h) => h.matters).map((h) => h.hand.heroCards?.join(" "));
    expect(shown).toEqual(["Td Th", "9s 4d", "Ac Kd"]);
  });

  it("the real preflop check flags one too-loose and one too-tight hand", () => {
    const verdict = (cards: string) => hands.find((h) => h.hand.heroCards?.join(" ") === cards)?.check?.verdict;
    expect(verdict("9s 4d")).toBe("too_loose");
    expect(verdict("Ah Qh")).toBe("too_tight");
    expect(verdict("Ac Kd")).toBe("correct");
    expect(verdict("7c 2d")).toBe("correct");
  });
});
