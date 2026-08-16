import type { Card } from "../cards";

/**
 * The Poker Hand Analyzer's data model.
 *
 * The whole design turns on one separation, kept in the types so it cannot be
 * blurred later: what HAPPENED (facts), what the maths SAYS (calculations),
 * and what the reviewed theory EXPLAINS (concepts). A strategic verdict is
 * only ever emitted where the maths decides it — never where it would be an
 * opinion dressed as output.
 */

export type Street = "preflop" | "flop" | "turn" | "river";

/** Six-handed positions, matching lib/tools/positions.ts. */
export type Position = "UTG" | "MP" | "CO" | "BTN" | "SB" | "BB";

export type ActionType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "3bet"
  | "4bet"
  | "allin";

export type Actor = "hero" | "villain";

export interface HandAction {
  street: Street;
  actor: Actor;
  type: ActionType;
  /** Chips put in by this action, in big blinds. Absent for fold/check. */
  amountBb?: number;
}

/**
 * One analysed hand.
 *
 * Everything except `heroCards` and `heroPosition` is optional: the analyser
 * has to be useful to someone who pastes half a hand, and says what it cannot
 * determine rather than refusing to start.
 */
export interface HandInput {
  heroPosition: Position;
  heroCards: Card[];
  villainPosition?: Position;
  villainCards?: Card[];
  board: Card[];
  actions: HandAction[];
  /** Effective stack in big blinds at the start of the hand. */
  effectiveStackBb?: number;
  /** Pot before the street being analysed, in big blinds. */
  potBb?: number;
  /**
   * A reviewed range the user chose to stand villain's unknown hand in for.
   *
   * Only ever consulted when `villainCards` is absent — a known hand is always
   * better than a model of one — and only honoured when the preset genuinely
   * fits the spot. See rangePresets.ts.
   */
  villainRangePresetId?: string;
}

// ── Output ───────────────────────────────────────────────────────────────────

/**
 * How much the analyser is entitled to claim.
 *
 * `insufficient` is a first-class outcome, not a failure: an analysis that
 * says "villain's hand is unknown, so equity cannot be computed" is more
 * useful than a confident number nobody can stand behind.
 */
export type Confidence = "high" | "medium" | "insufficient";

export type Verdict =
  /** The maths settles it: the price was beaten. */
  | "profitable-by-the-maths"
  /** The maths settles it: the price was not beaten. */
  | "unprofitable-by-the-maths"
  /**
   * The maths settles it AGAINST A CHOSEN RANGE — a conditional result.
   *
   * Kept as separate verdict values rather than a flag on the two above, so a
   * conditional conclusion can never be rendered, stored, copied or sent to
   * the coach with the wording of an unconditional one. The condition is not
   * decoration; it is part of what was concluded.
   */
  | "profitable-against-the-range"
  | "unprofitable-against-the-range"
  /** Computable facts exist, but the decision depends on villain's range. */
  | "needs-review"
  /** Not enough input to say anything beyond the facts. */
  | "insufficient-information";

/**
 * What a conditional analysis was conditioned ON (§6, §13).
 *
 * Present exactly when the verdict is one of the two `-against-the-range`
 * values, so nothing downstream can show a range-based conclusion without the
 * range and its attribution travelling alongside it.
 */
export interface ConditionalRange {
  presetId: string;
  presetLabel: string;
  /** "Hand Range 82: BB vs BN Open — Modern Poker Theory (Acevedo, 2019), p.243." */
  citation: string;
  /** How the chart's numbers were obtained, in a sentence. */
  derivationNote: string;
  /** Everything the reader is taking on by selecting it. */
  assumptions: string[];
  /** Combos left after hero's cards and the board were removed. */
  combosConsidered: number;
  /** Combos the range holds before removal. */
  combosInRange: number;
}

/** A single computed number, with the arithmetic that produced it. */
export interface Calculation {
  id: string;
  label: string;
  value: string;
  /** The formula or source, so a reader can check it. */
  basis: string;
  confidence: Confidence;
}

/** A concept the hand exercises, resolved against the reviewed registry. */
export interface DetectedConcept {
  /** Key in lib/theory/concepts.json. */
  conceptId: string;
  name: string;
  /** Why this hand raised it — a fact about the hand, not a claim about play. */
  trigger: string;
  /** The registry's own beginner explanation. Never paraphrased. */
  explanation: string;
}

// ── Input state (§4) ─────────────────────────────────────────────────────────

/**
 * Three genuinely different situations, kept apart because conflating them is
 * what makes a tool feel broken:
 *
 *   invalid     — the input describes a hand that cannot exist. Nothing can be
 *                 done with it until the user fixes it.
 *   incomplete  — the input is a real hand, but too little of it is entered to
 *                 analyse anything. Not an error; a prompt.
 *   analyzable  — enough is known to produce facts, maths and concepts. Says
 *                 nothing about whether the VERDICT will be decisive.
 */
export type InputState = "invalid" | "incomplete" | "analyzable";

/** A field the user could fill in to get more out of the analysis. */
export type MissingField =
  | "villainCards"
  | "villainPosition"
  | "potBb"
  | "effectiveStackBb"
  | "actions"
  | "board"
  | "heroCards"
  | "heroPosition"
  | "villainRange";

/**
 * A missing input, phrased as an offer rather than a complaint (§5).
 *
 * `unlocks` is the whole point: the user should never have to work out why the
 * analyser wants something, or guess what filling it in would buy them.
 */
export interface MissingInformation {
  field: MissingField;
  /** Button copy — "Add villain's cards". */
  label: string;
  /** What filling it in makes possible — "exact equity, and a definite verdict". */
  unlocks: string;
  /** Whether the analysis is meaningfully limited without it. */
  severity: "blocking" | "improves";
}

/**
 * Something the analyser deliberately cannot determine, and why (§1).
 *
 * These are not failures. Each one is a statement about the limits of what
 * arithmetic and reviewed theory can settle, and most name the input that
 * would move the question into reach.
 */
export interface Unknown {
  id: string;
  /** What cannot be determined. */
  question: string;
  /** Why not, in terms of what is missing or unmodelled. */
  because: string;
  /** The field that would resolve it, where one exists. */
  resolvedBy?: MissingField;
}

// ── The "why" (§3) ───────────────────────────────────────────────────────────

/** One input to the decision: a fact, and the reason it bears on the choice. */
export interface DecisionFactor {
  label: string;
  /** The fact itself — a card, a price, a ratio. Never a judgement. */
  value: string;
  /** Why it matters, from reviewed theory. */
  bearing: string;
}

/**
 * The decision the hand actually turns on, and what feeds into it.
 *
 * StackedPoker's claim is "help me understand why", so the analyser states the
 * question before the answer, lists what bears on it, and then says how those
 * pieces relate — but only relationships the arithmetic supports. Where the
 * maths runs out, `relationship` says so instead of asserting a strategy.
 */
export interface KeyDecision {
  /** "Whether to call villain's 6bb bet on the turn." */
  question: string;
  factors: DecisionFactor[];
  /** How the factors combine into the verdict above. */
  relationship: string;
}

export interface HandSummary {
  heroCards: string;
  heroPosition: Position;
  villain?: string;
  board: string;
  street: Street;
  lastHeroAction?: string;
  potBb?: number;
}

export interface HandAnalysis {
  summary: HandSummary;
  /** How complete the input was. `analyzable` for anything this type describes. */
  state: InputState;
  verdict: Verdict;
  confidence: Confidence;
  /** One line stating what the verdict rests on. */
  verdictBasis: string;
  /** The question the hand turns on, and what bears on it. */
  keyDecision: KeyDecision;
  /**
   * Set when, and only when, the verdict was reached against a chosen range.
   * Its presence is what every surface keys off to say "conditional".
   */
  conditional?: ConditionalRange;
  /** What happened — plain facts, no interpretation. */
  facts: string[];
  calculations: Calculation[];
  concepts: DetectedConcept[];
  /** What could not be determined, structured — each with the reason. */
  unknowns: Unknown[];
  /** Inputs that would extend the analysis, each with what it unlocks. */
  missing: MissingInformation[];
  /**
   * The same ground as `unknowns`, flattened to prose.
   *
   * Kept because the AI Coach payload and the copy-to-clipboard summary both
   * want sentences rather than a structure, and because a reader of the raw
   * analysis object should not have to reassemble them.
   */
  limitations: string[];
  /** Concept ids, for the AI Coach's own theory grounding. */
  conceptIds: string[];
}

/**
 * What comes back when the input is NOT analysable.
 *
 * A distinct type, so nothing downstream can read a verdict off a hand that
 * never had one. The UI renders these two states differently: `invalid` is an
 * error to fix, `incomplete` is an invitation to keep going.
 */
export interface HandNotAnalysable {
  state: "invalid" | "incomplete";
  /** What is wrong, or what is still needed. One line each. */
  reasons: string[];
  /** What to do next, as fields the user can fill. */
  missing: MissingInformation[];
}

export type AnalysisOutcome = HandAnalysis | HandNotAnalysable;

export function isAnalysed(outcome: AnalysisOutcome): outcome is HandAnalysis {
  return outcome.state === "analyzable";
}
