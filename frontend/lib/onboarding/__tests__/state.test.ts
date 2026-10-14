import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dashboardTipTour,
  emptyRow,
  isTrainerPromptSignup,
  needsChoiceScreen,
  otherTour,
  showTrainerTourNudge,
  tourHref,
  type OnboardingRow,
} from "../state";

const row = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({ ...emptyRow(), ...over });
const T = "2026-10-13T10:00:00Z";

describe("choice screen", () => {
  it("new users get it", () => {
    expect(needsChoiceScreen(null, undefined)).toBe(true);
    expect(needsChoiceScreen(row(), "trainer_banner")).toBe(true);
  });

  it("not once seen (also after skipping)", () => {
    expect(needsChoiceScreen(row({ onboarding_choice_seen_at: T, onboarding_choice: "skip" }), undefined)).toBe(false);
  });

  it("trainer-prompt signups never get it", () => {
    for (const src of ["trainer_prompt_5", "trainer_prompt_20"]) {
      expect(isTrainerPromptSignup(src)).toBe(true);
      expect(needsChoiceScreen(null, src)).toBe(false);
    }
    expect(isTrainerPromptSignup("trainer_banner")).toBe(false);
    expect(isTrainerPromptSignup(null)).toBe(false);
  });
});

describe("after a tour", () => {
  it("the other tour is offered until it is done", () => {
    expect(otherTour(row(), "preflop")).toBe("hands");
    expect(otherTour(row(), "hands")).toBe("preflop");
    expect(otherTour(row({ tour_hands_completed_at: T }), "preflop")).toBeNull();
  });

  it("tours start on their real screens", () => {
    expect(tourHref("preflop")).toBe("/preflop-trainer?tour=preflop");
    expect(tourHref("hands")).toBe("/hands/import?tour=hands");
  });
});

describe("dashboard tip", () => {
  it("suggests the tour that is still to do, trainer first", () => {
    expect(dashboardTipTour(row({ onboarding_choice_seen_at: T }), undefined)).toBe("preflop");
    expect(dashboardTipTour(row({ onboarding_choice_seen_at: T, tour_preflop_completed_at: T }), undefined)).toBe("hands");
  });

  it("goes away when both are done or it is dismissed", () => {
    expect(dashboardTipTour(row({ onboarding_choice_seen_at: T, tour_preflop_completed_at: T, tour_hands_completed_at: T }), undefined)).toBeNull();
    expect(dashboardTipTour(row({ onboarding_choice_seen_at: T, tour_tip_dismissed_at: T }), undefined)).toBeNull();
  });

  it("waits for onboarding, except for trainer-prompt signups", () => {
    expect(dashboardTipTour(null, undefined)).toBeNull();
    expect(dashboardTipTour(null, "trainer_prompt_5")).toBe("preflop");
  });
});

describe("trainer tour nudge", () => {
  it("only for trainer-prompt signups who have not done or declined it", () => {
    expect(showTrainerTourNudge(null, "trainer_prompt_5")).toBe(true);
    expect(showTrainerTourNudge(row({ tour_skipped_at: T }), "trainer_prompt_5")).toBe(false);
    expect(showTrainerTourNudge(row({ tour_preflop_completed_at: T }), "trainer_prompt_20")).toBe(false);
    expect(showTrainerTourNudge(null, undefined)).toBe(false);
  });
});

describe("example tournament stays in the browser", () => {
  const src = (p: string) => readFileSync(join(__dirname, "..", "..", "..", p), "utf8");
  it("never touches Supabase or the importer, so it cannot count toward the upload limit", () => {
    for (const p of ["lib/onboarding/exampleTournament.ts", "components/hand-history/ExampleTournament.tsx"]) {
      const s = src(p);
      expect(s, p).not.toMatch(/supabase|saveHands|hh_tournaments|hh_hands|\.from\(/);
    }
  });
});
