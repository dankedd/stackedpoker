import {
  BB_DEFENSE_COMPLETE_100BB,
  BB_DEFENSE_COMPLETE_100BB_PROVENANCE,
  type BBOpenDefenseMatchup,
  type ChartProvenance,
} from "@/lib/learn/bbDefenseComplete";
import { CASH_100BB_OPEN_RESPONSE_CHARTS } from "@/lib/learn/cash100bbOpenResponseBaselines";
import { isExecutable, sourceStatusOf, type RangeSourceStatus } from "./rangeSource";
import type { HandAction, HandInput, Position } from "./types";

/**
 * Villain range presets.
 *
 * Every preset here is a SLICE of an existing reviewed chart. Nothing in this
 * file authors a range: the hand lists and their frequencies come out of
 * lib/learn/bbDefenseComplete.ts and lib/learn/cash100bbOpenResponseBaselines.ts
 * untouched, and the only computation performed is picking one action's column
 * out of a complete strategy — which is arithmetic on the source, not a new
 * claim about poker.
 *
 * WHY THESE TWO DATASETS AND NOT THE OTHERS
 *
 * The repo holds a lot of range data. Most of it cannot drive a calculation:
 *
 *  - `THREEBET_RESPONSE_CHARTS`, `DEFEND_RESPONSE_CHARTS` — built by spreading
 *    a book AGGREGATE percentage across hands the book never names. Their own
 *    file headers call this an illustrative construction / source
 *    reconstruction. Excellent teaching material; not a measurement.
 *  - `RFI_DEEP`, `THREEBET_*`, `DEFEND_*`, `ranges.ts` — ported from backend
 *    files whose docstrings say "simplified practical ranges, not solver-exact".
 *  - `MTT_RFI_CHARTS` — genuinely reviewed, and excluded anyway: it is 9-max
 *    MTT with a 12.5% ante at 15/25/40/60bb, and this analyser is a 6-max
 *    100bb-ish tool. The right reason to reject a range is sometimes context,
 *    not provenance, and `applicablePresets` enforces that separately.
 *
 * What is left is the two datasets that were read out of the book's own chart
 * images and cross-validated against the aggregates printed beneath them. That
 * is six charts, which is a small number, and a small number of trustworthy
 * ranges is the point (§17).
 */

export type VillainPreflopAction = "called" | "3bet";

export interface RangePreset {
  id: string;
  /** What the user picks from a list. Plain language, no chart keys. */
  label: string;
  /** One line on what the range represents. */
  description: string;
  /** The seat this range belongs to — villain's. */
  villainPosition: Position;
  /** The seat it is defined AGAINST — hero's. */
  heroPosition: Position;
  /** What villain did preflop to arrive in this range. */
  villainAction: VillainPreflopAction;
  format: "6-max cash";
  tableSize: 6;
  /** The depth the source solved at. Not a suggestion — see `applicablePresets`. */
  effectiveStackBb: 100;
  /**
   * hand class → weight in 0–1: villain's frequency of taking this action with
   * that hand, straight from the source chart. A hand absent from the map is
   * not in the range.
   */
  hands: Record<string, number>;
  /** The existing provenance record for the chart this was sliced from. */
  provenance: ChartProvenance;
  sourceStatus: RangeSourceStatus;
  /** The source's own stated aggregate for THIS action, as a percentage. */
  bookAggregatePct: number;
  /** Everything the reader is agreeing to by selecting it. */
  assumptions: string[];
}

/** The book's 6-max seat names against this app's. A naming bridge, not theory. */
const MATCHUP_BY_HERO_SEAT: Record<string, BBOpenDefenseMatchup> = {
  UTG: "BB_vs_UTG", // the book's LJ — the first-in seat at a 6-max table
  MP: "BB_vs_HJ", // the book's HJ — this app calls the seat MP
  CO: "BB_vs_CO",
  BTN: "BB_vs_BTN",
  SB: "BB_vs_SB",
};

const ACTION_KEY: Record<VillainPreflopAction, "call" | "3bet"> = {
  called: "call",
  "3bet": "3bet",
};

const ACTION_WORD: Record<VillainPreflopAction, string> = {
  called: "called",
  "3bet": "3-bet",
};

/**
 * Pulls one action's column out of a complete strategy.
 *
 * The result is villain's range CONDITIONAL on having taken that action: each
 * hand carries the frequency the chart gives it, so a hand villain calls with
 * 30% of the time contributes 30% of its combos. No renormalisation is applied
 * — the weights stay as the source recorded them, and the equity engine
 * normalises when it averages.
 */
function slice(strategy: Record<string, Record<string, number | undefined>>, action: string): Record<string, number> {
  const hands: Record<string, number> = {};
  for (const [hand, mix] of Object.entries(strategy)) {
    const frequency = mix[action];
    if (frequency !== undefined && frequency > 0) hands[hand] = frequency;
  }
  return hands;
}

function bbDefensePreset(heroPosition: Position, action: VillainPreflopAction): RangePreset {
  const matchup = MATCHUP_BY_HERO_SEAT[heroPosition];
  const provenance = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup];
  const hands = slice(BB_DEFENSE_COMPLETE_100BB[matchup], ACTION_KEY[action]);
  const aggregate = action === "called" ? provenance.bookAggregate.call : provenance.bookAggregate.threeBet;

  return {
    id: `bb-${action}-vs-${heroPosition.toLowerCase()}`,
    label: `BB ${ACTION_WORD[action]} your ${heroPosition} open`,
    description: `The hands the big blind ${ACTION_WORD[action]} with against a ${heroPosition} open, at 100bb.`,
    villainPosition: "BB",
    heroPosition,
    villainAction: action,
    format: "6-max cash",
    tableSize: 6,
    effectiveStackBb: 100,
    hands,
    provenance,
    sourceStatus: sourceStatusOf(provenance),
    bookAggregatePct: aggregate,
    assumptions: assumptionsFor(provenance, aggregate, ACTION_WORD[action]),
  };
}

/**
 * BTN facing a CO open — the one chart transcribed so far from the book's
 * "Playing Versus Open Raises" section.
 *
 * That file carries a `sourceRef` rather than a `ChartProvenance`, and its
 * header documents the same extraction method and the same cross-validation
 * (measured 12.16/4.99/82.85 against the book's printed 11.7/5.4/82.3). The
 * provenance record below is assembled FROM those existing fields — it adds no
 * new claim, it puts the claim the file already makes into the shape the rest
 * of this system reads.
 */
function btnVsCoPreset(action: VillainPreflopAction): RangePreset {
  const chart = CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb;
  const provenance: ChartProvenance = {
    source: "Modern Poker Theory (Acevedo, 2019)",
    page: chart.sourceRef.page,
    figure: `Hand Range ${chart.sourceRef.handRangeNo}: BN vs CO Open`,
    gameAssumptions: "6-max cash, 100bb effective, CO opens 2.5bb, no ante",
    derivation: "reconstructed",
    bookAggregate: {
      threeBet: chart.aggregate["3bet"],
      call: chart.aggregate.call,
      fold: chart.aggregate.fold,
    },
  };

  const hands: Record<string, number> = {};
  for (const cell of chart.cells) {
    const frequency = cell.actions[ACTION_KEY[action]];
    if (frequency !== undefined && frequency > 0) hands[cell.hand] = frequency;
  }

  const aggregate = action === "called" ? chart.aggregate.call : chart.aggregate["3bet"];

  return {
    id: `btn-${action}-vs-co`,
    label: `BTN ${ACTION_WORD[action]} your CO open`,
    description: `The hands the button ${ACTION_WORD[action]} with against a cutoff open, at 100bb.`,
    villainPosition: "BTN",
    heroPosition: "CO",
    villainAction: action,
    format: "6-max cash",
    tableSize: 6,
    effectiveStackBb: 100,
    hands,
    provenance,
    sourceStatus: sourceStatusOf(provenance),
    bookAggregatePct: aggregate,
    assumptions: assumptionsFor(provenance, aggregate, ACTION_WORD[action]),
  };
}

function assumptionsFor(provenance: ChartProvenance, aggregate: number, word: string): string[] {
  return [
    provenance.gameAssumptions,
    `The source puts this ${word} range at ${aggregate}% of all hands.`,
    "A different open size or stack depth changes the true frequencies — this range is not size-invariant.",
    "It is a model of what a solver does at equilibrium, not a record of what your opponent actually does.",
  ];
}

/**
 * Every preset, built once at module load.
 *
 * Twelve: five hero seats × called/3-bet against the big blind, plus the two
 * BTN-vs-CO slices. Every one traces to a numbered Hand Range in the book.
 */
export const RANGE_PRESETS: RangePreset[] = [
  ...(Object.keys(MATCHUP_BY_HERO_SEAT) as Position[]).flatMap((heroPosition) => [
    bbDefensePreset(heroPosition, "called"),
    bbDefensePreset(heroPosition, "3bet"),
  ]),
  btnVsCoPreset("called"),
  btnVsCoPreset("3bet"),
];

export function presetById(id: string): RangePreset | undefined {
  return RANGE_PRESETS.find((preset) => preset.id === id);
}

/**
 * The presets that may actually be executed.
 *
 * A separate list from `RANGE_PRESETS` so that "is this range allowed to drive
 * a calculation" is answered in one place, by the source status, rather than
 * by whoever is writing the next call site.
 */
export function executablePresets(): RangePreset[] {
  return RANGE_PRESETS.filter((preset) => isExecutable(preset.sourceStatus));
}

// ── Context filtering (§5) ───────────────────────────────────────────────────

export type PresetRejection =
  | "villain-position"
  | "hero-position"
  | "villain-action"
  | "hero-not-opener"
  | "street"
  | "stack-depth"
  | "not-executable";

/**
 * The stack band a 100bb chart is offered within.
 *
 * `bbDefenseComplete.ts` states plainly that its data must not be reused at a
 * different depth, because defending and 3-betting frequencies are
 * depth-sensitive. Some tolerance is still necessary — nobody sits at exactly
 * 100bb — so the band is ±40%, wide enough to cover a normal cash table and
 * narrow enough to exclude a short stack or a deep one.
 *
 * This band is an implementation decision, not a claim from the source. It is
 * stated here rather than buried so it can be argued with.
 */
const STACK_BAND: [number, number] = [60, 140];

/** Villain's aggressive preflop actions, for reading what they did. */
const VILLAIN_3BET_TYPES = ["3bet", "raise", "4bet", "allin"];

function villainPreflopAction(actions: HandAction[]): VillainPreflopAction | undefined {
  const preflop = actions.filter((action) => action.street === "preflop");
  const villain = preflop.filter((action) => action.actor === "villain");
  if (!villain.length) return undefined;
  // The last thing villain did preflop is what put them in a range.
  const last = villain[villain.length - 1];
  if (last.type === "call") return "called";
  if (VILLAIN_3BET_TYPES.includes(last.type)) return "3bet";
  return undefined;
}

/** Whether hero opened the pot — every preset is defined against an open. */
function heroOpened(actions: HandAction[]): boolean {
  const preflop = actions.filter((action) => action.street === "preflop");
  const firstAggression = preflop.find((action) =>
    ["bet", "raise", "3bet", "4bet", "allin"].includes(action.type),
  );
  return firstAggression?.actor === "hero";
}

export interface PresetMatch {
  preset: RangePreset;
  /** Empty when the preset applies. */
  rejections: PresetRejection[];
}

/**
 * Tests one preset against a spot.
 *
 * Deliberately returns the REASONS rather than a boolean, so the UI can explain
 * why nothing is on offer instead of silently showing an empty list, and so the
 * tests can assert on the specific mismatch rather than on "false".
 */
export function matchPreset(preset: RangePreset, input: HandInput): PresetMatch {
  const rejections: PresetRejection[] = [];

  if (!isExecutable(preset.sourceStatus)) rejections.push("not-executable");
  if (input.villainPosition !== preset.villainPosition) rejections.push("villain-position");
  if (input.heroPosition !== preset.heroPosition) rejections.push("hero-position");
  if (!heroOpened(input.actions)) rejections.push("hero-not-opener");
  if (villainPreflopAction(input.actions) !== preset.villainAction) rejections.push("villain-action");

  // Preflop is excluded for a measured reason, not a theoretical one — see
  // rangeEquity.ts. There is no board to enumerate from, and the enumeration
  // that would be required is minutes long.
  if (input.board.length < 3) rejections.push("street");

  if (
    input.effectiveStackBb !== undefined &&
    (input.effectiveStackBb < STACK_BAND[0] || input.effectiveStackBb > STACK_BAND[1])
  ) {
    rejections.push("stack-depth");
  }

  return { preset, rejections };
}

/** Presets that genuinely fit this spot, and may be offered to the user. */
export function applicablePresets(input: HandInput): RangePreset[] {
  return executablePresets()
    .map((preset) => matchPreset(preset, input))
    .filter((match) => match.rejections.length === 0)
    .map((match) => match.preset);
}

/**
 * Why nothing was offered.
 *
 * Only ever one sentence, and it names the thing about the spot that put it
 * out of range — "no reviewed range exists" is true but useless on its own.
 */
export function unavailableReason(input: HandInput): string {
  if (input.board.length < 3) {
    return "Range analysis needs a flop. Exact equity against a full range preflop would mean enumerating every board for every hand villain can hold, which takes minutes rather than moments — so it is not offered rather than approximated.";
  }
  if (!heroOpened(input.actions)) {
    return "The reviewed ranges available cover spots where you opened the pot and villain responded. This hand does not have you opening, so none of them describes villain here.";
  }
  if (!villainPreflopAction(input.actions)) {
    return "No preflop action was entered for villain, so there is nothing to say which range they arrived with. Add what they did preflop.";
  }
  if (!input.villainPosition) {
    return "Villain's position is not set, and every reviewed range is defined for a specific seat.";
  }
  if (
    input.effectiveStackBb !== undefined &&
    (input.effectiveStackBb < STACK_BAND[0] || input.effectiveStackBb > STACK_BAND[1])
  ) {
    return `The reviewed ranges were solved at 100bb, and defending frequencies are stack-depth sensitive. At ${input.effectiveStackBb}bb they would not describe this spot, so they are not offered.`;
  }
  return `There is currently no reviewed range for ${input.villainPosition} in this spot. StackedPoker only runs range analysis on charts read from a published source — inventing one to fill the gap would defeat the point of the exercise.`;
}
