import type { ManualSetup, ManualStep } from "./engine";

/** Everything the user entered for a manual hand: enough to rebuild or edit it. */
export interface ManualEntry {
  setup: ManualSetup;
  steps: ManualStep[];
  /** Opponents' shown cards (missing = unknown). */
  shown: Record<string, string[]>;
  /** The user's winner per pot index, when the cards don't decide it. */
  potWinners: Record<number, string[]>;
}
