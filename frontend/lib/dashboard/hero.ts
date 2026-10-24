import { HANDS_IMPORT_PATH, handsSummaryPath } from "@/lib/handHistory/feature";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { DASHBOARD_CONFIG } from "./config";
import type { LastTournament } from "./types";

/**
 * The dashboard's one primary action, by priority:
 *   a. train         no trainer spot played yet today
 *   b. mistakes      the last import has mistakes the user hasn't looked at
 *   c. limit         the daily spot limit is reached → review, new spots at midnight
 *   d. import        no hands imported, ever
 *   keepTraining     none of the above: more spots
 * "Today" is the day of the spot limit (Europe/Amsterdam, my_entitlements),
 * the same day the level card's daily XP counts.
 */
export type HeroKind = "train" | "mistakes" | "limit" | "import" | "keepTraining";

export interface HeroInput {
  /** Spots answered today; null when the entitlements are unknown. */
  spotsToday: number | null;
  /** null = no daily limit (Pro, trial). */
  dailyLimit: number | null;
  /** Next reset of the spot limit (ISO). */
  resetAt: string | null;
  handsImported: number;
  last: LastTournament | null;
  now: number;
}

export interface HeroState {
  kind: HeroKind;
  href: string;
  secondary: { kind: "train" | "import" | "example"; href: string } | null;
  /** Ring: spots today out of the goal (the limit, or the default goal). */
  done: number;
  goal: number;
  /** Unseen mistakes (kind "mistakes"). */
  mistakes: number;
  /** Countdown target (kind "limit"). */
  resetAt: string | null;
}

export const EXAMPLE_PATH = "/hands/example";

export function newMistakes(last: LastTournament | null, now: number): number {
  if (!last || last.reviewed || last.mistakes <= 0) return 0;
  const age = now - new Date(last.createdAt).getTime();
  return age <= DASHBOARD_CONFIG.newMistakesDays * 86_400_000 ? last.mistakes : 0;
}

export function pickHero(i: HeroInput): HeroState {
  const goal = i.dailyLimit ?? DASHBOARD_CONFIG.dailyGoalSpots;
  const done = i.spotsToday ?? 0;
  const atLimit = i.dailyLimit !== null && i.spotsToday !== null && i.spotsToday >= i.dailyLimit;
  const unseen = newMistakes(i.last, i.now);
  const noHands = i.handsImported === 0;
  const base = { done, goal, mistakes: unseen, resetAt: null as string | null };
  const train = { kind: "train" as const, href: PREFLOP_TRAINER_PATH };
  const importFirst = { kind: "import" as const, href: HANDS_IMPORT_PATH };

  if (i.spotsToday === 0 && !atLimit) {
    return { ...base, kind: "train", href: PREFLOP_TRAINER_PATH, secondary: noHands ? importFirst : null };
  }
  if (unseen > 0 && i.last) {
    return { ...base, kind: "mistakes", href: handsSummaryPath(i.last.id), secondary: atLimit ? null : train };
  }
  if (atLimit) {
    return {
      ...base,
      kind: "limit",
      href: i.last ? handsSummaryPath(i.last.id) : HANDS_IMPORT_PATH,
      secondary: null,
      resetAt: i.resetAt,
    };
  }
  if (noHands) {
    return { ...base, kind: "import", href: HANDS_IMPORT_PATH, secondary: { kind: "example", href: EXAMPLE_PATH } };
  }
  return { ...base, kind: "keepTraining", href: PREFLOP_TRAINER_PATH, secondary: null };
}

/** "04:12" — hours and minutes until `iso` (never negative). */
export function clockUntil(iso: string, now: number): string {
  const mins = Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
