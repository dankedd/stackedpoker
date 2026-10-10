/**
 * Step 3 — grade Hero's action with the Preflop Trainer's own rules
 * (lib/ranges/logic.ts `gradeFrequencies`: correct when the action is played
 * ≥50% or is the most frequent; mixed when played ≥10%; otherwise wrong).
 *
 *   correct → correct          mixed → mixed
 *   wrong   → too_tight        Hero folded a hand the range plays
 *           → too_loose        Hero played a hand the range mostly folds
 *           → wrong_action     Hero played, with an action the range does not pick
 */

import { gradeFrequencies } from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import type { HeroPreflopAction, PreflopVerdict } from "./types";

export function gradeAction(
  freqs: Partial<Record<RangeActionKey, number>>,
  action: HeroPreflopAction,
): { verdict: PreflopVerdict; expected: RangeActionKey } {
  const g = gradeFrequencies(freqs, action);
  // On a tie for the most frequent action, Hero's own pick is the one to show.
  const tied = g.chosen > 0 && g.chosen >= g.best - 1e-9;
  if (g.verdict === "correct") return { verdict: "correct", expected: tied ? action : g.bestKey };
  if (g.verdict === "mixed") return { verdict: "mixed", expected: g.bestKey };
  if (action === "fold") return { verdict: "too_tight", expected: g.bestKey };
  return { verdict: g.bestKey === "fold" ? "too_loose" : "wrong_action", expected: g.bestKey };
}
