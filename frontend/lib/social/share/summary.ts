/**
 * The few facts a shared hand is summed up by (page title, OG image, chat
 * cards): Hero's position and stack, the pot when the question is asked,
 * Hero's cards and the board. Reads the hand exactly as the viewer gets it,
 * so a guess-mode hand never reveals more than its cut-off point.
 */

import { buildTimeline, totalOnTable } from "@/lib/handHistory/timeline";
import type { ParsedHand } from "@/lib/handHistory/types";
import type { SharedHand } from "./anonymize";

export interface ShareSummary {
  position: string;
  stackBb: number;
  /** Pot in BB at Hero's decision (guess mode) or at the end of the hand. */
  potBb: number;
  heroCards: string[] | null;
  board: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeShare(hand: SharedHand): ShareSummary {
  const hero = hand.players.find((p) => p.isHero);
  const bb = hand.bigBlind || 1;
  const steps = buildTimeline(hand as ParsedHand);
  const last = steps[steps.length - 1];
  // Before payouts: the pot as it stood, not after it was pushed to a winner.
  const potChips = hand.truncated
    ? totalOnTable(last)
    : Math.max(hand.totalPot || 0, ...steps.filter((s) => s.kind !== "collect").map(totalOnTable));
  return {
    position: hero?.position ?? "Hero",
    stackBb: round1((hero?.stack ?? 0) / bb),
    potBb: round1(potChips / bb),
    heroCards: hand.heroCards ?? null,
    board: last?.board ?? [],
  };
}

/** "Ah" → { rank: "A", suit: "♥", color } in the site's four-colour deck. */
export function cardFace(card: string): { rank: string; suit: string; color: string } {
  const rank = card.slice(0, -1).replace("T", "10");
  const s = card.slice(-1).toLowerCase();
  const suits: Record<string, [string, string]> = {
    s: ["♠", "#0f172a"],
    h: ["♥", "#dc2626"],
    d: ["♦", "#2563eb"],
    c: ["♣", "#16a34a"],
  };
  const [suit, color] = suits[s] ?? ["?", "#0f172a"];
  return { rank, suit, color };
}
