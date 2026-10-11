/**
 * Client-safe half of the homepage demo: types, grading and the coach line.
 * Imports no chart data (the 400 KB range files stay on the server — see
 * demoSpots.ts, which resolves the numbers and passes them down).
 */

export type DemoAnswer = "fold" | "call" | "raise";

export interface DemoSpot {
  /** Hero and opener in the trainer's naming ("BN", "CO", …). */
  hero: string;
  opener: string;
  cards: [string, string];
  hand: string;
  /** Open size in BB. */
  openBb: number;
  stackBb: number;
  /** 0–1 per answer, read from the trainer's chart. */
  freqs: Record<DemoAnswer, number>;
  best: DemoAnswer;
}

export const ANSWER_LABEL: Record<DemoAnswer, string> = { fold: "Fold", call: "Call", raise: "3-Bet" };
export const SEATS_6 = ["LJ", "HJ", "CO", "BN", "SB", "BB"] as const;

export const displayPos = (p: string) => (p === "BN" ? "BTN" : p);

/**
 * The Preflop Trainer's own rule (lib/ranges/logic.ts gradeFrequencies):
 * correct when played ≥50% or the most frequent action (>5%); mixed ≥10%.
 */
export function gradeDemo(spot: DemoSpot, answer: DemoAnswer): "correct" | "mixed" | "wrong" {
  const p = spot.freqs[answer];
  const best = Math.max(...Object.values(spot.freqs));
  if (p >= 0.5 || (p > 0.05 && p >= best - 1e-9)) return "correct";
  if (p >= 0.1) return "mixed";
  return "wrong";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const verb = (a: DemoAnswer) => (a === "raise" ? "3-bet" : a);

const SUIT: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export function prettyCard(c: string): string {
  return `${c[0] === "T" ? "10" : c[0]}${SUIT[c[1]] ?? ""}`;
}

/** One plain sentence, built only from the chart's numbers. */
export function coachLine(spot: DemoSpot): string {
  const cards = spot.cards.map(prettyCard).join("");
  const parts = (Object.entries(spot.freqs) as [DemoAnswer, number][]).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  const where = `${displayPos(spot.hero)} vs a ${displayPos(spot.opener)} open`;
  if (parts.length === 1) return `With ${cards} ${where}, your range always ${verb(parts[0][0])}s.`;
  const never = (["raise", "call", "fold"] as DemoAnswer[]).filter((a) => spot.freqs[a] <= 0.005);
  const mix = parts.map(([a, v]) => `${ANSWER_LABEL[a].toLowerCase()} ${pct(v)}`).join(", ");
  return `With ${cards} ${where}, your range mixes: ${mix}.${never.length ? ` It never ${never.map(verb).join(" or ")}s.` : ""}`;
}
