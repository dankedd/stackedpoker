/**
 * Tournament summary: the Stacked score, the mistake count and the four hand
 * filters (tight, loose, mixed, big), computed once from the verdicts the
 * preflop and flop checks stored on each hand. Pure — no database, no React —
 * so it is unit-tested directly (summary.test.ts).
 *
 * Every threshold comes from config.ts. The score is a model on chart
 * frequencies, not EV: nothing here adds poker theory of its own.
 */

import type { FlopCheck, FlopLine, FlopVerdict } from "../flopCheck";
import { FLOP_CHECK_VERSION } from "../flopCheck";
import { PREFLOP_CHECK_VERSION, PREFLOP_ERRORS, type PreflopDetail, type PreflopVerdict, type RangeRef } from "../preflop";
import type { RangeActionKey } from "@/lib/ranges/types";
import { AGGRESSION, SUMMARY_CONFIG, type ScoreLabelKey } from "./config";

/** Bump when this file's logic changes; config and check versions are hashed in. */
const SUMMARY_LOGIC_VERSION = 1;

export const SUMMARY_VERSION = `${SUMMARY_LOGIC_VERSION}-${fnv1a(JSON.stringify([SUMMARY_CONFIG, PREFLOP_CHECK_VERSION, FLOP_CHECK_VERSION]))}`;

export type SummaryFilter = "misplayed" | "tight" | "loose" | "mixed" | "big";
export const SUMMARY_FILTERS: SummaryFilter[] = ["misplayed", "tight", "loose", "mixed", "big"];

export type MistakeSize = "small" | "big";

/** The flop line the check would rather have seen (only for "questionable"). */
export type FlopRecommendation = "check" | "bet" | "bet_small" | "bet_big" | "call" | "fold";

/** The hh_hands columns the summary reads. */
export interface SummarySourceRow {
  id: string;
  played_at: string;
  hero_cards: string[] | null;
  hero_position: string | null;
  pot_bb: number;
  hero_involved: boolean;
  preflop_check: PreflopVerdict | null;
  preflop_detail: PreflopDetail | null;
  flop_check: FlopVerdict | null;
  /** FlopCheck plus spot ids; for unmatched hands only `{ reason }`. */
  flop_detail: (Partial<FlopCheck> & Record<string, unknown>) | null;
}

/** One hand as stored in the summary — enough for a list row, no re-query. */
export interface SummaryHand {
  id: string;
  cards: string[] | null;
  pos: string | null;
  potBb: number;
  playedAt: string;
  /** 0–1; 0 when played well or not graded. */
  penalty: number;
  mistake: MistakeSize | null;
  pre?: { verdict: PreflopVerdict; act: RangeActionKey; exp: RangeActionKey | null; range: RangeRef | null };
  flop?: { verdict: FlopVerdict; line: Omit<FlopLine, "eventIndex">; rec: FlopRecommendation | null };
}

export interface TournamentSummary {
  version: string;
  /** Hands in the tournament when computed; a re-upload that adds hands recomputes. */
  handCount: number;
  /** Hands with at least one graded decision. */
  graded: number;
  /** 0–100, null below SUMMARY_CONFIG.score.minGradedHands. */
  score: number | null;
  mistakes: { total: number; small: number; big: number };
  /** Hand ids per filter, in display order. */
  lists: Record<SummaryFilter, string[]>;
  /** Every hand that appears in a list. */
  hands: Record<string, SummaryHand>;
}

const GRADED_FLOP: FlopVerdict[] = ["good", "ok", "questionable"];
const FLOP_TIGHT = new Set<FlopLine["kind"]>(["fold", "check"]);
const FLOP_LOOSE = new Set<FlopLine["kind"]>(["call", "cbet", "stab", "lead", "raise", "check_raise"]);

// ── Per hand ────────────────────────────────────────────────────────────────

/** The chart action Hero's action was graded as. */
function heroChartAction(d: PreflopDetail): RangeActionKey {
  return (d.graded ?? d.spot.action) as RangeActionKey;
}

/** Frequency of the recommended action minus Hero's (0–1). */
export function preflopGap(d: PreflopDetail): number {
  const f = d.freqs;
  if (!f) return 1;
  const values = Object.values(f).filter((v): v is number => typeof v === "number");
  const best = values.length ? Math.max(...values) : 0;
  const chosen = f[heroChartAction(d)] ?? 0;
  return Math.min(1, Math.max(0, best - chosen));
}

function isPreflopError(v: PreflopVerdict | null): boolean {
  return v != null && PREFLOP_ERRORS.includes(v);
}

function preflopGraded(v: PreflopVerdict | null): boolean {
  return v != null && v !== "not_evaluated";
}

/** Less (-1), equally (0) or more (1) aggressive than the chart's recommendation. */
function aggressionVsChart(d: PreflopDetail): number {
  if (!d.expected) return 0;
  return Math.sign((AGGRESSION[heroChartAction(d)] ?? 0) - (AGGRESSION[d.expected] ?? 0));
}

export function flopRecommendation(check: Partial<FlopCheck>): FlopRecommendation | null {
  const line = check.line;
  if (!line) return null;
  const s = check.advice?.strategy;
  if (s) {
    const small = (s.bet_1_3 ?? 0) + (s.bet_min ?? 0);
    const big = (s.bet_2_3 ?? 0) + (s.bet_1_2 ?? 0);
    const chk = s.check ?? 0;
    if (chk >= small && chk >= big) return "check";
    return small >= big ? "bet_small" : "bet_big";
  }
  switch (line.kind) {
    case "fold":
      return "call";
    case "call":
      return "fold";
    case "cbet":
    case "stab":
    case "lead":
      return "check";
    case "check":
      return "bet";
    case "raise":
    case "check_raise":
      return "call";
    default:
      return null;
  }
}

/** Chart frequencies (0–1) for preflop; book flop strategies are in percent. */
function isMixed(row: SummarySourceRow): boolean {
  const { minFreq, minActions } = SUMMARY_CONFIG.filters.mixed;
  const pre = row.preflop_detail;
  if (preflopGraded(row.preflop_check) && pre?.freqs) {
    const n = Object.values(pre.freqs).filter((v) => typeof v === "number" && v >= minFreq).length;
    if (n >= minActions) return true;
  }
  const s = row.flop_check && GRADED_FLOP.includes(row.flop_check) ? row.flop_detail?.advice?.strategy : undefined;
  if (s) {
    const small = (s.bet_1_3 ?? 0) + (s.bet_min ?? 0);
    const big = (s.bet_2_3 ?? 0) + (s.bet_1_2 ?? 0);
    const n = [small, big, s.check ?? 0].filter((v) => v >= minFreq * 100).length;
    if (n >= minActions) return true;
  }
  return false;
}

export interface HandAssessment {
  graded: boolean;
  penalty: number;
  mistake: MistakeSize | null;
  tight: boolean;
  loose: boolean;
  mixed: boolean;
}

export function assessHand(row: SummarySourceRow): HandAssessment {
  const cfg = SUMMARY_CONFIG;
  const pre = row.preflop_detail;
  const preError = isPreflopError(row.preflop_check) && pre != null;
  const flopGraded = row.flop_check != null && GRADED_FLOP.includes(row.flop_check);
  const flopError = row.flop_check === "questionable";
  const flopKind = row.flop_detail?.line?.kind;

  const prePenalty = preError ? preflopGap(pre!) : 0;
  const flopPenalty = flopError ? cfg.score.flopQuestionablePenalty : 0;

  let mistake: MistakeSize | null = null;
  if (preError) mistake = prePenalty >= cfg.mistakes.bigGap ? "big" : "small";
  if (flopError && mistake !== "big") mistake = cfg.mistakes.flopIsBig ? "big" : "small";

  const agg = preError && row.preflop_check === "wrong_action" ? aggressionVsChart(pre!) : 0;
  const { tight: tc, loose: lc } = cfg.filters;
  const tight =
    row.preflop_check === "too_tight" ||
    (tc.includeWrongAction && agg < 0) ||
    (tc.includeFlop && flopError && flopKind != null && FLOP_TIGHT.has(flopKind));
  const loose =
    row.preflop_check === "too_loose" ||
    (lc.includeWrongAction && agg > 0) ||
    (lc.includeFlop && flopError && flopKind != null && FLOP_LOOSE.has(flopKind));

  return {
    graded: preflopGraded(row.preflop_check) || flopGraded,
    penalty: Math.max(prePenalty, flopPenalty),
    mistake,
    tight,
    loose,
    mixed: isMixed(row),
  };
}

// ── Score ───────────────────────────────────────────────────────────────────

/** 0–100 from the penalties of the graded hands; null below the minimum sample. */
export function computeScore(penalties: number[]): number | null {
  const { minGradedHands, penaltyScale } = SUMMARY_CONFIG.score;
  if (penalties.length < minGradedHands) return null;
  const total = penalties.reduce((a, b) => a + b, 0);
  const raw = 100 * (1 - (penaltyScale * total) / penalties.length);
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function scoreLabel(score: number): ScoreLabelKey {
  return SUMMARY_CONFIG.score.labels.find((l) => score >= l.min)?.key ?? "puntProne";
}

// ── Big pots ────────────────────────────────────────────────────────────────

/** Ids of the big hands, biggest pot first. */
export function bigHands(rows: SummarySourceRow[]): string[] {
  const { minPotBb, topShare, heroInvolvedOnly } = SUMMARY_CONFIG.filters.big;
  const eligible = rows.filter((r) => !heroInvolvedOnly || r.hero_involved).sort(byPot);
  const top = Math.ceil(eligible.length * topShare);
  return eligible.filter((r, i) => i < top || r.pot_bb >= minPotBb).map((r) => r.id);
}

function byPot(a: { pot_bb: number }, b: { pot_bb: number }): number {
  return b.pot_bb - a.pot_bb;
}

// ── Whole tournament ────────────────────────────────────────────────────────

export function computeSummary(rows: SummarySourceRow[]): TournamentSummary {
  const assessed = rows.map((row) => ({ row, a: assessHand(row) }));
  const graded = assessed.filter((x) => x.a.graded);

  // Biggest mistake first; equal penalties by pot size.
  const bySeverity = (x: (typeof assessed)[number], y: (typeof assessed)[number]) => y.a.penalty - x.a.penalty || byPot(x.row, y.row);
  const ids = (xs: typeof assessed) => xs.map((x) => x.row.id);

  const misplayed = assessed.filter((x) => x.a.mistake).sort(bySeverity);
  const lists: Record<SummaryFilter, string[]> = {
    misplayed: ids(misplayed),
    tight: ids(assessed.filter((x) => x.a.tight).sort(bySeverity)),
    loose: ids(assessed.filter((x) => x.a.loose).sort(bySeverity)),
    mixed: ids(assessed.filter((x) => x.a.mixed).sort((x, y) => byPot(x.row, y.row))),
    big: bigHands(rows),
  };

  const listed = new Set(Object.values(lists).flat());
  const hands: Record<string, SummaryHand> = {};
  for (const { row, a } of assessed) {
    if (listed.has(row.id)) hands[row.id] = summaryHand(row, a);
  }

  return {
    version: SUMMARY_VERSION,
    handCount: rows.length,
    graded: graded.length,
    score: computeScore(graded.map((x) => x.a.penalty)),
    mistakes: {
      total: misplayed.length,
      small: misplayed.filter((x) => x.a.mistake === "small").length,
      big: misplayed.filter((x) => x.a.mistake === "big").length,
    },
    lists,
    hands,
  };
}

function summaryHand(row: SummarySourceRow, a: HandAssessment): SummaryHand {
  const h: SummaryHand = {
    id: row.id,
    cards: row.hero_cards,
    pos: row.hero_position,
    potBb: Number(row.pot_bb),
    playedAt: row.played_at,
    penalty: Math.round(a.penalty * 100) / 100,
    mistake: a.mistake,
  };
  const d = row.preflop_detail;
  if (row.preflop_check && preflopGraded(row.preflop_check) && d) {
    h.pre = { verdict: row.preflop_check, act: heroChartAction(d), exp: d.expected, range: d.range };
  }
  const f = row.flop_detail;
  if (row.flop_check && GRADED_FLOP.includes(row.flop_check) && f?.line) {
    const { eventIndex: _drop, ...line } = f.line;
    void _drop;
    h.flop = { verdict: row.flop_check, line, rec: row.flop_check === "questionable" ? flopRecommendation(f) : null };
  }
  return h;
}

/** A stored summary still describes the tournament as it is now. */
export function isSummaryCurrent(s: Pick<TournamentSummary, "version" | "handCount"> | null | undefined, handCount: number): boolean {
  return s != null && s.version === SUMMARY_VERSION && s.handCount === handCount;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
