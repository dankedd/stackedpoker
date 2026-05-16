/**
 * replayState.test.ts — Deterministic replay state machine tests.
 *
 * Tests the canonical step=N semantics:
 *   step=0             → clean state, no actions applied
 *   step=1             → actions[0] applied (first voluntary action)
 *   step=N             → actions[0..N-1] applied
 *   step=totalSteps    → all actions applied, verdict shown
 *
 * Rendering rules:
 *   currentAction   = step > 0 ? actions[step-1] : null
 *   isFoldedPast    = foldedAtStep < step - 1
 *   isFoldingNow    = foldedAtStep === step - 1
 *   visibleBoard    = streets in actions[0..step-1]
 */

import { describe, it, expect } from "vitest";
import type { ReplayAnalysis, ReplayAction } from "@/lib/types";

// ── Pure helpers extracted from useReplay ────────────────────────────────────

function getVisibleBoard(analysis: ReplayAnalysis, step: number) {
  const seen = new Set(
    (analysis?.actions ?? []).slice(0, step).map((a) => a.street)
  );
  const b = analysis?.hand_summary?.board ?? { flop: [], turn: [], river: [] };
  return {
    flop:  seen.has("flop")  || seen.has("turn") || seen.has("river") ? b.flop  : [],
    turn:  seen.has("turn")  || seen.has("river") ? b.turn  : [],
    river: seen.has("river") ? b.river : [],
  };
}

function currentAction(actions: ReplayAction[], step: number): ReplayAction | null {
  return step > 0 && step <= actions.length ? actions[step - 1] : null;
}

function isFoldedPast(foldedAtStep: number | null, step: number): boolean {
  return foldedAtStep !== null && foldedAtStep < step - 1;
}

function isFoldingNow(foldedAtStep: number | null, step: number): boolean {
  return foldedAtStep !== null && foldedAtStep === step - 1;
}

// ── Fixture factory ──────────────────────────────────────────────────────────

function makeAction(
  player: string,
  action: string,
  street: ReplayAction["street"] = "preflop",
  is_hero = false,
): ReplayAction {
  return {
    id: 0,
    street,
    player,
    action,
    amount: null,
    pot_after: 2.0,
    is_hero,
    feedback: null,
  } as unknown as ReplayAction;
}

function makeAnalysis(
  actions: ReplayAction[],
  flop = ["Ah", "Kd", "2c"],
  turn = ["Js"],
  river = ["5h"],
): ReplayAnalysis {
  return {
    hand_summary: {
      hero_position: "BTN",
      hero_cards: ["As", "Kh"],
      villain_position: "BB",
      villain_cards: null,
      effective_stack_bb: 100,
      board: { flop, turn, river },
      big_blind: 1,
      currency: "",
      stakes: "NL100",
      players: [],
      player_count: 6,
    },
    actions,
    overall_verdict: { score: 70, title: "", summary: "", key_mistakes: [], key_strengths: [] },
  } as unknown as ReplayAnalysis;
}

// ── Step 0: clean state ───────────────────────────────────────────────────────

describe("step=0: clean state", () => {
  const actions = [
    makeAction("UTG", "fold"),
    makeAction("HJ",  "fold"),
    makeAction("CO",  "raise"),
    makeAction("BTN", "call", "preflop", true),
    makeAction("BB",  "fold"),
  ];
  const analysis = makeAnalysis(actions);

  it("currentAction is null", () =>
    expect(currentAction(actions, 0)).toBeNull());

  it("board is empty", () => {
    const board = getVisibleBoard(analysis, 0);
    expect(board.flop).toHaveLength(0);
    expect(board.turn).toHaveLength(0);
    expect(board.river).toHaveLength(0);
  });

  it("no player is isFoldedPast", () => {
    for (let foldedAt = 0; foldedAt < 5; foldedAt++) {
      expect(isFoldedPast(foldedAt, 0)).toBe(false);
    }
  });

  it("no player is isFoldingNow", () => {
    for (let foldedAt = 0; foldedAt < 5; foldedAt++) {
      expect(isFoldingNow(foldedAt, 0)).toBe(false);
    }
  });
});

// ── Step 1: first action applied ─────────────────────────────────────────────

describe("step=1: first action applied (UTG fold)", () => {
  const actions = [
    makeAction("UTG", "fold"),   // foldedAtStep=0
    makeAction("HJ",  "fold"),   // foldedAtStep=1
    makeAction("CO",  "raise"),
  ];
  const analysis = makeAnalysis(actions);

  it("currentAction is actions[0] (UTG fold)", () =>
    expect(currentAction(actions, 1)?.player).toBe("UTG"));

  it("UTG is isFoldingNow (not past)", () => {
    expect(isFoldingNow(0, 1)).toBe(true);
    expect(isFoldedPast(0, 1)).toBe(false);
  });

  it("HJ is not yet folded (future action)", () => {
    expect(isFoldingNow(1, 1)).toBe(false);
    expect(isFoldedPast(1, 1)).toBe(false);
  });

  it("board is still empty (preflop)", () => {
    const board = getVisibleBoard(analysis, 1);
    expect(board.flop).toHaveLength(0);
  });
});

// ── Off-by-one proof ─────────────────────────────────────────────────────────

describe("off-by-one: fold transitions are exactly correct", () => {
  // CO folds at index 2 (step 3 applies it)
  const CO_FOLDED_AT = 2;

  it("step=2: CO has NOT yet folded", () => {
    expect(isFoldedPast(CO_FOLDED_AT, 2)).toBe(false);
    expect(isFoldingNow(CO_FOLDED_AT, 2)).toBe(false);
  });

  it("step=3: CO is folding NOW (this is the action being shown)", () => {
    expect(isFoldingNow(CO_FOLDED_AT, 3)).toBe(true);
    expect(isFoldedPast(CO_FOLDED_AT, 3)).toBe(false);
  });

  it("step=4: CO is folded PAST (already happened)", () => {
    expect(isFoldedPast(CO_FOLDED_AT, 4)).toBe(true);
    expect(isFoldingNow(CO_FOLDED_AT, 4)).toBe(false);
  });
});

// ── Preflop action ordering ───────────────────────────────────────────────────

describe("preflop action ordering (6-max: UTG→HJ→CO→BTN→SB→BB)", () => {
  const actions = [
    makeAction("UTG", "fold"),   // index 0 → step 1
    makeAction("HJ",  "fold"),   // index 1 → step 2
    makeAction("CO",  "raise"),  // index 2 → step 3
    makeAction("BTN", "call", "preflop", true), // index 3 → step 4
    makeAction("SB",  "fold"),   // index 4 → step 5
    makeAction("BB",  "fold"),   // index 5 → step 6
  ];

  it("step 1 → UTG fold", () =>
    expect(currentAction(actions, 1)?.player).toBe("UTG"));
  it("step 2 → HJ fold", () =>
    expect(currentAction(actions, 2)?.player).toBe("HJ"));
  it("step 3 → CO raise", () =>
    expect(currentAction(actions, 3)?.player).toBe("CO"));
  it("step 4 → BTN call", () =>
    expect(currentAction(actions, 4)?.player).toBe("BTN"));
  it("step 5 → SB fold", () =>
    expect(currentAction(actions, 5)?.player).toBe("SB"));
  it("step 6 → BB fold", () =>
    expect(currentAction(actions, 6)?.player).toBe("BB"));
  it("step 7 → null (past end)", () =>
    expect(currentAction(actions, 7)).toBeNull());
});

// ── Board visibility ─────────────────────────────────────────────────────────

describe("board visibility: streets appear at correct step", () => {
  const actions = [
    makeAction("BTN", "bet",  "preflop", true),
    makeAction("BB",  "call", "preflop"),
    makeAction("BB",  "check","flop"),
    makeAction("BTN", "bet",  "flop",   true),
    makeAction("BB",  "call", "flop"),
    makeAction("BB",  "check","turn"),
    makeAction("BTN", "bet",  "turn",   true),
    makeAction("BB",  "fold", "river"),
  ];
  const analysis = makeAnalysis(actions, ["Ah","Kd","2c"], ["Js"], ["5h"]);

  it("step=0: all streets hidden", () => {
    const b = getVisibleBoard(analysis, 0);
    expect(b.flop).toHaveLength(0);
    expect(b.turn).toHaveLength(0);
    expect(b.river).toHaveLength(0);
  });

  it("step=2: still preflop — board hidden", () => {
    const b = getVisibleBoard(analysis, 2);
    expect(b.flop).toHaveLength(0);
  });

  it("step=3: first flop action applied — flop visible", () => {
    const b = getVisibleBoard(analysis, 3);
    expect(b.flop).toHaveLength(3);
    expect(b.turn).toHaveLength(0);
  });

  it("step=6: first turn action applied — turn visible", () => {
    const b = getVisibleBoard(analysis, 6);
    expect(b.flop).toHaveLength(3);
    expect(b.turn).toHaveLength(1);
    expect(b.river).toHaveLength(0);
  });

  it("step=8: river action applied — all streets visible", () => {
    const b = getVisibleBoard(analysis, 8);
    expect(b.flop).toHaveLength(3);
    expect(b.turn).toHaveLength(1);
    expect(b.river).toHaveLength(1);
  });
});

// ── No skipped / no duplicated actions ───────────────────────────────────────

describe("no skipped or duplicated actions", () => {
  const actions = [
    makeAction("A", "fold"),
    makeAction("B", "raise"),
    makeAction("C", "call", "preflop", true),
  ];

  it("sequential steps each show a different action", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= actions.length; s++) {
      const a = currentAction(actions, s);
      expect(a).not.toBeNull();
      const key = `${a!.player}-${s}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("each step's action matches the expected player in order", () => {
    expect(currentAction(actions, 1)?.player).toBe("A");
    expect(currentAction(actions, 2)?.player).toBe("B");
    expect(currentAction(actions, 3)?.player).toBe("C");
  });
});

// ── Reset correctness ─────────────────────────────────────────────────────────

describe("reset: step=0 is fully clean after any step", () => {
  const actions = [
    makeAction("UTG", "fold"),
    makeAction("CO",  "raise"),
    makeAction("BTN", "call", "preflop", true),
  ];
  const analysis = makeAnalysis(actions);

  // Simulate being at step=3 (all actions applied) then resetting to step=0
  const postResetStep = 0;

  it("currentAction is null after reset", () =>
    expect(currentAction(actions, postResetStep)).toBeNull());

  it("no player is folded after reset", () => {
    expect(isFoldedPast(0, postResetStep)).toBe(false);
    expect(isFoldingNow(0, postResetStep)).toBe(false);
  });

  it("board is empty after reset", () => {
    const b = getVisibleBoard(analysis, postResetStep);
    expect(b.flop).toHaveLength(0);
  });
});

// ── isFirst / isLast boundary conditions ─────────────────────────────────────

describe("isFirst / isLast boundary conditions", () => {
  const totalSteps = 5;

  function isFirst(step: number) { return step === 0; }
  function isLast(step: number, total: number) { return total > 0 ? step >= total : false; }

  it("isFirst=true only at step=0", () => {
    expect(isFirst(0)).toBe(true);
    expect(isFirst(1)).toBe(false);
  });

  it("isLast=true at step=totalSteps", () => {
    expect(isLast(totalSteps, totalSteps)).toBe(true);
    expect(isLast(totalSteps - 1, totalSteps)).toBe(false);
  });

  it("isLast=false when totalSteps=0", () => {
    expect(isLast(0, 0)).toBe(false);
  });
});
