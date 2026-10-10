/**
 * The replayer's analysis of a hand — villain, the trainer range used, Hero's
 * equity per street and the pot odds at each decision — in the shape stored
 * in hh_hands.analysis (supabase_hand_history_coach.sql). The AI coach reads
 * it from there (backend/app/engines/hand_review/context.py), so it quotes
 * the same numbers the replayer shows.
 *
 * Only the default range is stored: a range the user edits in the range
 * editor never changes what the coach is told.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RangeEquity } from "@/lib/equity/rangeEquity";
import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import type { PotOddsDecision } from "./potOdds";
import type { ParsedHand, Street } from "./types";
import type { VillainRange } from "./villain";

/** Bump when the analysis logic changes; range edits are covered by the hash. */
const ANALYSIS_LOGIC_VERSION = 1;

let version: string | null = null;
export function analysisVersion(): string {
  version ??= `${ANALYSIS_LOGIC_VERSION}-${fnv1a(JSON.stringify([MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS, DEFENSE_CHARTS]))}`;
  return version;
}

export interface HandAnalysis {
  /** Villain's site player id; the coach anonymises it to "Villain (CO)". */
  villain: string;
  rangeLabel: string;
  rangePct: number;
  approximation: string | null;
  streets: { street: Street; equity: number | null; tie: number | null }[];
  decisions: {
    street: Street;
    /** Index into hand.events of Hero's decision. */
    eventIndex: number;
    toCall: number;
    pot: number;
    required: number;
    stillToAct: number;
    action: PotOddsDecision["action"];
    equity: number | null;
  }[];
}

export function buildAnalysis(
  hand: ParsedHand,
  vr: VillainRange,
  rangePct: number,
  streets: { street: Street }[],
  results: (RangeEquity | null)[],
  decisions: PotOddsDecision[],
): HandAnalysis {
  const eqOn = (s: Street) => results[streets.findIndex((x) => x.street === s)] ?? null;
  return {
    villain: vr.villain,
    rangeLabel: vr.label,
    rangePct,
    approximation: vr.approximation,
    streets: streets.map((s, i) => ({ street: s.street, equity: results[i]?.equity ?? null, tie: results[i]?.tie ?? null })),
    decisions: decisions.map((d) => ({
      street: d.street,
      eventIndex: hand.events.indexOf(d.event),
      toCall: d.toCall,
      pot: d.pot,
      required: d.required,
      stillToAct: d.stillToAct,
      action: d.action,
      equity: eqOn(d.street)?.equity ?? null,
    })),
  };
}

/** Stores the analysis on the caller's own hand (RPC hh_set_analysis). Best-effort. */
export async function saveAnalysis(supabase: SupabaseClient, handRef: string, analysis: HandAnalysis): Promise<boolean> {
  const { error } = await supabase.rpc("hh_set_analysis", { p_id: handRef, p_analysis: analysis, p_version: analysisVersion() });
  return !error;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
