import type { ChartProvenance } from "@/lib/learn/bbDefenseComplete";

/**
 * What makes a range executable.
 *
 * The codebase already had the hard part of this: `ChartProvenance.derivation`
 * (lib/learn/bbDefenseComplete.ts) records, per chart, HOW the numbers were
 * obtained — transcribed, derived, extracted-and-cross-validated, or modelled.
 * That vocabulary was designed for exactly this question, so this module maps
 * onto it rather than introducing a second, competing notion of "reviewed"
 * that could drift out of step with it.
 *
 * The mapping is the whole policy, and it is deliberately conservative:
 *
 *   exact_transcription ─┐
 *   exact_derived        ├─→ reviewed     — may drive a real equity calculation
 *   reconstructed       ─┘
 *   pedagogical_model    ──→ illustrative — teaching material, never executed
 *
 * `reconstructed` counts as reviewed because of what the word means HERE: a
 * chart read out of a source diagram by a documented, uniform, non-cherry-picked
 * process, then cross-validated against the source's own printed aggregate. A
 * chart built by distributing an aggregate percentage across hands nobody named
 * is NOT that, and its own file says so — those files are `pedagogical_model`,
 * and they stay out of the engine.
 */

export type RangeSourceStatus = "reviewed" | "illustrative" | "planned";

const REVIEWED_DERIVATIONS: ChartProvenance["derivation"][] = [
  "exact_transcription",
  "exact_derived",
  "reconstructed",
];

export function sourceStatusOf(provenance: ChartProvenance): RangeSourceStatus {
  return REVIEWED_DERIVATIONS.includes(provenance.derivation) ? "reviewed" : "illustrative";
}

/** The single gate. Nothing else in the codebase decides what may be executed. */
export function isExecutable(status: RangeSourceStatus): boolean {
  return status === "reviewed";
}

/** One line of attribution, built from the existing provenance record. */
export function citation(provenance: ChartProvenance): string {
  return `${provenance.figure} — ${provenance.source}, p.${provenance.page}.`;
}

/**
 * How the numbers were obtained, in a sentence a reader can weigh.
 *
 * Shown next to every range analysis. A user who is told "reviewed" and nothing
 * else has been asked to trust a label; a user who is told the chart was read
 * out of a diagram and checked against the book's own printed percentage can
 * decide for themselves how much weight it carries.
 */
export function derivationNote(provenance: ChartProvenance): string {
  switch (provenance.derivation) {
    case "exact_transcription":
      return "Copied verbatim from a table in the source.";
    case "exact_derived":
      return "Computed from the source's own numbers by unambiguous arithmetic.";
    case "reconstructed":
      return "Read from the source's own chart diagram by documented pixel measurement, then cross-validated against the aggregate percentage the source prints under that chart.";
    case "pedagogical_model":
      return "A teaching simplification, not solver output — not used for calculation.";
  }
}
