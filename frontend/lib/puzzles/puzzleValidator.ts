/**
 * puzzleValidator.ts
 *
 * Validates puzzle context strings for correct postflop actor order.
 * Catches impossible states where the IP player acts before OOP player
 * has had the opportunity to act.
 */

import { heroActsFirstPostflop } from "./positionEngine";

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Validation result types ───────────────────────────────────────────────────

export interface ValidationIssue {
  puzzleId: string;
  stepIdx: number;
  street: string;
  severity: "error" | "warning";
  message: string;
  context: string;
}

export interface ContextValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Per-context validation ────────────────────────────────────────────────────

/**
 * Validates a single context string for actor-order correctness.
 *
 * Rules enforced (postflop only):
 *  1. If villain is IP (acts last), villain should not be shown checking/betting
 *     UNLESS hero already acted in the same context snippet.
 *  2. Compound sentences: "BTN calls flop and checks" — checks embedded after calls
 *     are also caught.
 *
 * Safe patterns (excluded from flagging):
 *  - "checks back" / "checks the [street]" → IP checking AFTER OOP checked (fine)
 *  - "checked back" (past tense reference)
 *  - Preflop streets (position order is different preflop)
 */
export function validateContextActorOrder(
  context: string,
  street: string,
  heroPos: string,
  villainPos: string,
): ContextValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only enforce postflop actor order
  if (street === "preflop") return { valid: true, errors, warnings };

  // Determine who is OOP (acts first postflop)
  const heroIsOop = heroActsFirstPostflop(heroPos, villainPos);
  const villainIsIp = !heroIsOop; // villain is IP → should act AFTER hero

  if (!villainIsIp) {
    // Villain is OOP — it is fine for villain to act first; nothing to flag.
    return { valid: true, errors, warnings };
  }

  // ── Villain is IP. Check for impossible "villain acts before hero" patterns. ──

  const vp = escapeRegex(villainPos);

  // Pattern 1: villain checks directly ("BTN checks." / "BTN checks.")
  // Excluded: "checks back", "checks the [street]", "checked back/the"
  const directCheckRe = new RegExp(
    `\\b${vp}\\s+checks?(?!\\s+(?:back|the\\b))`,
    "i",
  );

  // Pattern 2: compound sentence ("BTN calls flop and checks")
  const compoundCheckRe = new RegExp(
    `\\b${vp}\\s+(?:calls?|raises?)\\s+\\S+\\s+and\\s+checks?`,
    "i",
  );

  // Pattern 3: villain bets/leads without hero acting first
  // ("BTN bets", "BTN fires", "BTN leads", "BTN double-barrels")
  const villainBetRe = new RegExp(
    `\\b${vp}\\s+(?:bets?|fires?|leads?|double.?barrels?)`,
    "i",
  );

  // Pattern 4: hero has already acted in this snippet
  // "you check/bet/raise/call/fold" or "hero checks/bets/raises/calls/folds"
  const heroActRe =
    /\b(you\s+(?:check|bet|raise|call|fold|c-?bet)|hero\s+(?:checks?|bets?|raises?|calls?|folds?))\b/i;

  const hasHeroAction = heroActRe.test(context);

  if (!hasHeroAction) {
    if (directCheckRe.test(context)) {
      errors.push(
        `${villainPos} is IP but context shows villain checking before hero acts: "${context}"`,
      );
    } else if (compoundCheckRe.test(context)) {
      errors.push(
        `${villainPos} is IP but context shows villain checking (compound sentence) before hero acts: "${context}"`,
      );
    } else if (villainBetRe.test(context)) {
      // Villain IP betting is fine (they can bet after OOP checks or on any street);
      // only warn if there's no OOP reference at all (might be a missing context)
      const oopCheckRe = /\b(?:checks?|checked)\b/i;
      if (!oopCheckRe.test(context)) {
        warnings.push(
          `${villainPos} is IP and bets/leads without any OOP check mentioned: "${context}" — verify OOP player acted first`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Puzzle-level validation ───────────────────────────────────────────────────

export interface PuzzleValidationResult {
  puzzleId: string;
  issues: ValidationIssue[];
  valid: boolean;
}

export interface PuzzleForValidation {
  id: string;
  heroPosition: string;
  villainPosition: string;
  steps: Array<{
    street?: string;
    context: string;
  }>;
}

export function validatePuzzle(puzzle: PuzzleForValidation): PuzzleValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < puzzle.steps.length; i++) {
    const step = puzzle.steps[i];
    const street = step.street ?? "flop";
    const result = validateContextActorOrder(
      step.context,
      street,
      puzzle.heroPosition,
      puzzle.villainPosition,
    );

    for (const msg of result.errors) {
      issues.push({
        puzzleId: puzzle.id,
        stepIdx: i,
        street,
        severity: "error",
        message: msg,
        context: step.context,
      });
    }
    for (const msg of result.warnings) {
      issues.push({
        puzzleId: puzzle.id,
        stepIdx: i,
        street,
        severity: "warning",
        message: msg,
        context: step.context,
      });
    }
  }

  return {
    puzzleId: puzzle.id,
    issues,
    valid: issues.filter((i) => i.severity === "error").length === 0,
  };
}

export function validateAllPuzzles(
  puzzles: PuzzleForValidation[],
): PuzzleValidationResult[] {
  const results = puzzles.map(validatePuzzle);

  if (process.env.NODE_ENV === "development") {
    const allIssues = results.flatMap((r) => r.issues);
    if (allIssues.length > 0) {
      console.group("[PuzzleValidator] Actor-order issues found:");
      for (const issue of allIssues) {
        const fn = issue.severity === "error" ? console.error : console.warn;
        fn(
          `[${issue.severity.toUpperCase()}] ${issue.puzzleId} step ${issue.stepIdx} (${issue.street}): ${issue.message}`,
        );
      }
      console.groupEnd();
    } else {
      console.log("[PuzzleValidator] All puzzles passed actor-order validation.");
    }
  }

  return results;
}

// ── Golden tests ──────────────────────────────────────────────────────────────

interface GoldenTest {
  label: string;
  heroPos: string;
  villainPos: string;
  street: string;
  context: string;
  expectValid: boolean;
}

const GOLDEN_TESTS: GoldenTest[] = [
  // ── BTN vs BB (BTN is IP, BB is OOP) ───────────────────────────────────────
  {
    label: "BTN vs BB: IP (BTN) checks — SHOULD FAIL (no hero action first)",
    heroPos: "BB",
    villainPos: "BTN",
    street: "flop",
    context: "Pot 10bb. Flop: Ah7d2c. BTN checks.",
    expectValid: false,
  },
  {
    label: "BTN vs BB: IP checks BACK after hero — valid",
    heroPos: "BB",
    villainPos: "BTN",
    street: "flop",
    context: "You check. BTN checks back.",
    expectValid: true,
  },
  {
    label: "BTN vs BB: OOP (BB/hero) checks, BTN bets — valid",
    heroPos: "BB",
    villainPos: "BTN",
    street: "flop",
    context: "You check. BTN bets 5bb.",
    expectValid: true,
  },
  {
    label: "BTN vs BB: BTN bets river after no check mentioned — warning (not error)",
    heroPos: "BB",
    villainPos: "BTN",
    street: "river",
    context: "Pot 30bb. River: Kc. BTN bets 20bb.",
    expectValid: true, // warning only, not error
  },
  // ── CO vs BTN (CO is OOP, BTN is IP) ───────────────────────────────────────
  {
    label: "CO vs BTN: BTN checks before hero acts — SHOULD FAIL",
    heroPos: "CO",
    villainPos: "BTN",
    street: "flop",
    context: "Pot 15bb. Flop: 9s5d2h. BTN checks.",
    expectValid: false,
  },
  {
    label: "CO vs BTN: compound BTN calls and checks — SHOULD FAIL",
    heroPos: "CO",
    villainPos: "BTN",
    street: "turn",
    context: "BTN calls flop and checks turn.",
    expectValid: false,
  },
  {
    label: "CO vs BTN: hero bets, BTN calls, you bet again — valid sequence",
    heroPos: "CO",
    villainPos: "BTN",
    street: "flop",
    context: "You bet 6bb. BTN calls.",
    expectValid: true,
  },
  // ── SB vs BB (SB is OOP, BB is IP) — preflop reversed, postflop same ───────
  {
    label: "SB vs BB: BB checks before SB (hero) acts — SHOULD FAIL",
    heroPos: "SB",
    villainPos: "BB",
    street: "flop",
    context: "Pot 8bb. Flop: Kd7h3c. BB checks.",
    expectValid: false,
  },
  {
    label: "SB vs BB: hero checks, BB checks back — valid",
    heroPos: "SB",
    villainPos: "BB",
    street: "flop",
    context: "You check. BB checks back.",
    expectValid: true,
  },
  // ── 3-bet pot CO vs BTN ─────────────────────────────────────────────────────
  {
    label: "3bet CO vs BTN: BTN checks the flop (past reference) — valid",
    heroPos: "CO",
    villainPos: "BTN",
    street: "turn",
    context: "BTN checked the flop. Turn: Tc. Pot 45bb.",
    expectValid: true,
  },
  {
    label: "3bet CO vs BTN: BTN checks again (no hero action) — SHOULD FAIL",
    heroPos: "CO",
    villainPos: "BTN",
    street: "turn",
    context: "BTN checks again.",
    expectValid: false,
  },
  // ── SB vs BTN (SB is OOP, BTN is IP) ───────────────────────────────────────
  {
    label: "SB vs BTN: BTN calls turn and checks river (compound) — SHOULD FAIL",
    heroPos: "SB",
    villainPos: "BTN",
    street: "river",
    context: "BTN calls turn and checks river.",
    expectValid: false,
  },
  // ── BB vs CO (BB is OOP, CO is IP) ─────────────────────────────────────────
  {
    label: "BB vs CO: CO checks without hero action — SHOULD FAIL",
    heroPos: "BB",
    villainPos: "CO",
    street: "flop",
    context: "Pot 12bb. CO checks.",
    expectValid: false,
  },
  // ── Preflop exempt ──────────────────────────────────────────────────────────
  {
    label: "Preflop: BTN raises, CO calls — preflop exempt from postflop rule",
    heroPos: "CO",
    villainPos: "BTN",
    street: "preflop",
    context: "BTN raises to 3bb. CO calls.",
    expectValid: true,
  },
];

export interface GoldenTestResult {
  label: string;
  passed: boolean;
  expected: boolean;
  got: boolean;
  errors: string[];
  warnings: string[];
}

export function runGoldenTests(): GoldenTestResult[] {
  const results: GoldenTestResult[] = [];

  for (const test of GOLDEN_TESTS) {
    const result = validateContextActorOrder(
      test.context,
      test.street,
      test.heroPos,
      test.villainPos,
    );
    const gotValid = result.valid;
    const passed = gotValid === test.expectValid;

    results.push({
      label: test.label,
      passed,
      expected: test.expectValid,
      got: gotValid,
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  if (process.env.NODE_ENV === "development") {
    const failed = results.filter((r) => !r.passed);
    if (failed.length === 0) {
      console.log(
        `[PuzzleValidator] Golden tests: ${results.length}/${results.length} passed ✓`,
      );
    } else {
      console.group(`[PuzzleValidator] Golden tests: ${failed.length} FAILED`);
      for (const f of failed) {
        console.error(
          `FAIL: "${f.label}" — expected valid=${f.expected}, got valid=${f.got}`,
          f.errors,
        );
      }
      console.groupEnd();
    }
  }

  return results;
}
