/**
 * Splits an export file into the raw text of each hand.
 *
 * Hands start with "Poker Hand #" (GGPoker; PokerStars-style formats use the
 * same opening). Splitting on that header — rather than on blank lines —
 * keeps a hand intact even when it contains a blank line itself. Anything
 * before the first header is returned as `leftover` so it can be reported.
 */
export function splitHands(fileText: string): { hands: string[]; leftover: string } {
  const text = fileText.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const parts = text.split(/^(?=Poker Hand #)/m);
  const leftover = parts.length && !parts[0].startsWith("Poker Hand #") ? parts.shift()!.trim() : "";
  return { hands: parts.map((p) => p.trim()).filter(Boolean), leftover };
}
