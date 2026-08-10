/**
 * Position trainer data.
 *
 * Seat names and act-order are the rules and vocabulary of the game, not a
 * strategy claim, so nothing here needs a theory citation. What each position
 * is WORTH is a strategy claim — so the "why it matters" lines quote the
 * StackedPoker concept registry's `position_value` entry rather than saying
 * anything new (see lib/seo/content/concepts.ts).
 */

export type PositionId = "UTG" | "MP" | "CO" | "BTN" | "SB" | "BB";

export interface PositionInfo {
  id: PositionId;
  name: string;
  /** Seat index clockwise from the button: 0 = BTN. */
  seatFromButton: number;
  /** Order of action preflop, 0 = first to act. */
  preflopOrder: number;
  /** Order of action postflop, 0 = first to act. */
  postflopOrder: number;
  short: string;
  inPositionPostflop: boolean;
}

/**
 * Six-handed, the table shape the StackedPoker curriculum teaches first.
 *
 * Preflop the blinds are already posted, so UTG acts first and the big blind
 * last. Postflop the order restarts from the small blind, which is the whole
 * reason the button is the strongest seat.
 */
export const POSITIONS: PositionInfo[] = [
  { id: "UTG", name: "Under the Gun", seatFromButton: 3, preflopOrder: 0, postflopOrder: 2, short: "First to act preflop", inPositionPostflop: false },
  { id: "MP", name: "Middle Position", seatFromButton: 2, preflopOrder: 1, postflopOrder: 3, short: "One seat before the cutoff", inPositionPostflop: false },
  { id: "CO", name: "Cutoff", seatFromButton: 1, preflopOrder: 2, postflopOrder: 4, short: "Directly right of the button", inPositionPostflop: false },
  { id: "BTN", name: "Button", seatFromButton: 0, preflopOrder: 3, postflopOrder: 5, short: "Last to act on every postflop street", inPositionPostflop: true },
  { id: "SB", name: "Small Blind", seatFromButton: 5, preflopOrder: 4, postflopOrder: 0, short: "Posts half a blind, acts first postflop", inPositionPostflop: false },
  { id: "BB", name: "Big Blind", seatFromButton: 4, preflopOrder: 5, postflopOrder: 1, short: "Posts a full blind, acts last preflop", inPositionPostflop: false },
];

export const POSITION_IDS: PositionId[] = POSITIONS.map((p) => p.id);

export function positionById(id: PositionId): PositionInfo {
  const found = POSITIONS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown position: ${id}`);
  return found;
}

/** Seats ordered as they sit at the table, starting from the button. */
export function seatOrder(): PositionInfo[] {
  return [...POSITIONS].sort((a, b) => a.seatFromButton - b.seatFromButton);
}

export type TrainerMode = "name-the-seat" | "who-acts-first";

export interface PositionQuestion {
  mode: TrainerMode;
  prompt: string;
  /** Highlighted seat for "name-the-seat". */
  highlight: PositionId | null;
  /** Two seats being compared for "who-acts-first". */
  contenders: PositionId[];
  answer: PositionId;
  explanation: string;
}

/**
 * Deterministic question generator.
 *
 * Takes the index and a seed instead of calling Math.random, so a session can
 * be replayed and a failing test names the exact question that broke.
 */
export function buildQuestion(index: number, seed: number, mode: TrainerMode): PositionQuestion {
  const rng = mulberry32(seed + index * 2654435761);

  if (mode === "name-the-seat") {
    const target = POSITIONS[Math.floor(rng() * POSITIONS.length)];
    return {
      mode,
      prompt: "Which position is highlighted?",
      highlight: target.id,
      contenders: [],
      answer: target.id,
      explanation: `${target.name} (${target.id}) — ${target.short.toLowerCase()}.`,
    };
  }

  // Two distinct seats, compared on preflop action order.
  const first = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  let second = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  if (second.id === first.id) {
    second = POSITIONS[(POSITIONS.indexOf(first) + 1) % POSITIONS.length];
  }
  const answer = first.preflopOrder < second.preflopOrder ? first : second;

  return {
    mode,
    prompt: "Preflop, which of these two acts first?",
    highlight: null,
    contenders: [first.id, second.id],
    answer: answer.id,
    explanation:
      `${answer.name} acts first: preflop the order runs UTG → MP → CO → BTN → SB → BB, ` +
      `so ${answer.id} is ahead of ${(answer.id === first.id ? second : first).id}.`,
  };
}

/** Small deterministic PRNG (mulberry32) — no dependency, fully reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POSITION_TRAINER_LENGTH = 12;
