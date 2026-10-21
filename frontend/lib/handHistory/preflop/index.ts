/**
 * Preflop check: did Hero play the spot the way the Preflop Trainer's ranges
 * say? Three steps, each its own file so new spots slot in:
 *
 *   spots.ts   recognise the spots (raise first in; vs open / shove / limp /
 *              4-bet / limp-raise; anything else is "other")
 *   lookup.ts  find the trainer's range for it (open/push-fold or defense chart)
 *   grade.ts   grade Hero's action with the trainer's rules
 *
 * A hand can hold two graded decisions (the 3-bet, then the answer to the
 * 4-bet). The hand's verdict is the more severe one; the other is kept in
 * `detail.also`.
 */

import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { actionName, displayPos, type Scenario } from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import { fmtNum } from "../format";
import { t } from "../strings";
import type { ParsedHand } from "../types";
import { gradeAction } from "./grade";
import { chartActionKey, lookupDefense, lookupRfi, rangeFrequencies, type LookupResult } from "./lookup";
import { findSpots } from "./spots";
import type { NotEvaluatedReason, PreflopCheck, PreflopDetail, PreflopSpot, PreflopVerdict } from "./types";

export * from "./types";
export { findRfiSpot, findSpots, handClass } from "./spots";
export { chartActionKey, lookupDefense, lookupRfi, rangePosition } from "./lookup";
export { playersAfter, position9 } from "./positions";
export { gradeAction } from "./grade";

/**
 * Bump when the check's own logic changes; range edits are picked up by the hash.
 * 2: English verdict values and a reason code instead of Dutch text in preflop_detail.
 * 3: defense spots (vs open / shove / limp / 4-bet / limp-raise) against the defense charts.
 */
const CHECK_LOGIC_VERSION = 3;

/**
 * Stored with every result. When the trainer's range JSON or this logic
 * changes, the stored version no longer matches and the hand is re-checked.
 */
export const PREFLOP_CHECK_VERSION = `${CHECK_LOGIC_VERSION}-${fnv1a(JSON.stringify([MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS, DEFENSE_CHARTS]))}`;

/** Null when Hero made no preflop decision (a walk, no cards, no action). */
export function checkPreflop(hand: ParsedHand): PreflopCheck | null {
  const cash = hand.format === "cash";
  // Cash: only the defense charts exist for cash games here; first-in cash hands stay unchecked.
  const spots = findSpots(hand).filter((s) => !(cash && s.kind === "rfi"));
  if (!spots.length) return null;
  const checks = spots.map((s) => checkSpot(s, cash ? "cash" : "mtt"));
  // The most severe decision is the hand's verdict; on a tie the later one.
  const primary = checks.reduce((b, c) => (SEVERITY[c.verdict] >= SEVERITY[b.verdict] ? c : b));
  const other = checks.find((c) => c !== primary);
  if (other) {
    primary.detail.also = { kind: other.detail.spot.kind, verdict: other.verdict, action: other.detail.spot.action, expected: other.detail.expected };
  }
  return primary;
}

const SEVERITY: Record<PreflopVerdict, number> = { not_evaluated: 0, correct: 1, mixed: 2, too_loose: 3, too_tight: 3, wrong_action: 3 };

export function checkSpot(spot: PreflopSpot, group: "mtt" | "cash" = "mtt"): PreflopCheck {
  const notEvaluated = (reason: NotEvaluatedReason, range: PreflopDetail["range"] = null): PreflopCheck => ({
    verdict: "not_evaluated",
    detail: { spot, range, freqs: null, expected: null, reason },
  });
  if (spot.kind === "other") return notEvaluated({ code: "unmatched", why: spot.unmatched ?? "squeeze" });

  const found: LookupResult = spot.kind === "rfi" ? lookupRfi(spot) : lookupDefense(spot, group);
  if (!found.ok) return notEvaluated(found.reason);
  // A defense chart cell of null: the hand never reaches this spot (not a fold).
  if (found.scenario.type === "def" && !found.scenario.chart.grid[spot.hand]) return notEvaluated({ code: "not_in_range" }, found.ref);

  const freqs = rangeFrequencies(found.scenario, spot.hand);
  const graded = chartActionKey(found.scenario, spot.action);
  const { verdict, expected } = gradeAction(freqs, graded);
  return { verdict, detail: { spot, range: found.ref, freqs, expected, ...(graded !== spot.action ? { graded } : {}) } };
}

/** The trainer scenario a stored check was graded against (for chart display and action names). */
export function scenarioFor(detail: PreflopDetail): Scenario | null {
  const r = detail.range;
  if (!r) return null;
  if (r.kind === "defense") {
    const chart = DEFENSE_CHARTS.find((c) => c.n === r.n && c.group === (r.group ?? "mtt"));
    return chart ? { type: "def", kind: "freq", chart, stack: chart.stack, fmt: chart.group, hero: chart.hero, vil: chart.vil, spot: chart.spot } : null;
  }
  if (r.kind === "pushfold") {
    const chart = PUSH_FOLD_CHARTS.find((c) => c.pos === r.position);
    return chart ? { type: "open", kind: "pf", chart, stack: r.bucket, fmt: "mtt", hero: r.position, w: 1 } : null;
  }
  const chart = MTT_OPEN_CHARTS.find((c) => c.pos === r.position && c.stack === r.bucket);
  return chart ? { type: "open", kind: "freq", chart, stack: chart.stack, fmt: "mtt", hero: r.position } : null;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const VERDICT_LABEL: Record<PreflopVerdict, string> = t.verdict;

export const ACTION_LABEL = t.preflop.action as Record<RangeActionKey, string>;

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function reasonText(r: NotEvaluatedReason | undefined): string {
  if (!r) return t.preflop.noMatchingRange;
  switch (r.code) {
    case "no_position":
      return t.preflop.reason.no_position(r.playersBehind);
    case "too_deep":
      return t.preflop.reason.too_deep(r.effStackBb);
    case "too_short":
      return t.preflop.reason.too_short(r.effStackBb);
    case "no_chart":
      return t.preflop.reason.no_chart(displayPos(r.position));
    case "no_defense_chart":
      return t.preflop.reason.no_defense_chart(t.preflop.kind[r.kind], r.hero ? displayPos(r.hero) : "?", r.vil ? displayPos(r.vil) : "?");
    case "unmatched":
      return t.preflop.reason.unmatched[r.why];
    case "not_in_range":
      return t.preflop.reason.not_in_range;
  }
}

/** The chart's name for an action in this check's spot ("3-bet", "Call all-in", "Check"), or the RFI word. */
export function actionLabel(detail: PreflopDetail, k: RangeActionKey): string {
  const sc = scenarioFor(detail);
  if (sc?.type === "def") return actionName(k, sc);
  return ACTION_LABEL[k] ?? k;
}

/** Panel heading: "Facing a CO open (2.2bb) · 25bb · BB". */
export function spotTitle(spot: PreflopSpot): string {
  const bb = fmtNum(spot.effStackBb, 1);
  const hero = spot.tablePosition;
  const v = spot.villain;
  const vil = v?.tablePosition ?? "?";
  switch (spot.kind) {
    case "rfi":
      return t.preflop.title_rfi(hero, bb);
    case "vs_open":
      return t.preflop.title_vs_open(vil, fmtNum(v?.sizeBb ?? 0, 1), bb, hero);
    case "vs_push":
      return t.preflop.title_vs_push(vil, bb, hero);
    case "vs_limp":
      return t.preflop.title_vs_limp(vil, bb, hero);
    case "vs_4bet":
      return t.preflop.title_vs_4bet(vil, bb, hero);
    case "vs_limp_raise":
      return t.preflop.title_vs_limp_raise(vil, bb, hero);
    default:
      return t.preflop.title_other(hero);
  }
}

/** What Hero did, as a verb phrase: "folded", "3-bet to 7 BB", "went all-in". */
function heroDid(detail: PreflopDetail): string {
  const { spot } = detail;
  if (spot.kind === "rfi") return ACTION_LABEL[spot.action] + (spot.action === "raise" && spot.sizeBb ? ` ${fmtNum(spot.sizeBb, 1)} BB` : "");
  if (spot.action === "call") return spot.kind === "vs_limp" ? t.preflop.did.check : t.preflop.did.call;
  if (spot.action === "raise") {
    const sc = scenarioFor(detail);
    const word = sc?.type === "def" ? actionName("raise", sc).toLowerCase() : "raised";
    return `${word}${spot.sizeBb ? ` to ${fmtNum(spot.sizeBb, 1)} BB` : ""}`;
  }
  return t.preflop.did[spot.action] ?? spot.action;
}

export interface CheckText {
  title: string;
  /** "Your range: …" (rfi) / "Chart: …" (defense) or "Not evaluated: …". */
  range: string;
  /** "You: open-raise 2 BB." (rfi) / "You folded → Too tight." (defense). */
  hero: string;
  /** "Fold 15% · Call 65% · 3-bet 20%" for hands the chart plays more than one way. */
  mix: string | null;
  /** "With A9o here: Call 65% · 3-bet 20% · Fold 15%." — every action, even a pure one. */
  withHand: string | null;
  /** One-line reason for the verdict. */
  explain: string | null;
  /** The other decision of this hand, when there was one. */
  also: string | null;
}

/** Every sentence the panel, the overview and the coach use for a check. */
export function describeCheck(c: PreflopCheck): CheckText {
  const d = c.detail;
  const { spot, range, freqs, expected, reason } = d;
  const title = spotTitle(spot);
  const also = d.also ? t.preflop.also(t.preflop.alsoKind[d.also.kind] ?? d.also.kind, VERDICT_LABEL[d.also.verdict]) : null;
  const defense = spot.kind !== "rfi";
  const hero = defense ? t.preflop.youDid(heroDid(d), VERDICT_LABEL[c.verdict]) : t.preflop.you(heroDid(d));
  if (!range || !freqs || !expected) {
    return { title, range: t.preflop.notEvaluated(reasonText(reason)), hero: defense ? t.preflop.youDid(heroDid(d), VERDICT_LABEL.not_evaluated) : hero, mix: null, withHand: null, explain: null, also };
  }
  const label = (k: RangeActionKey) => actionLabel(d, k);
  const played = (Object.entries(freqs) as [RangeActionKey, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const parts = played.map(([k, v]) => `${label(k)} ${pct(v)}`).join(" · ");
  const mix = played.length > 1 ? parts : null;
  const graded = d.graded ?? (spot.action as RangeActionKey);
  const best = label(expected);
  const mine = label(graded);
  const explain =
    c.verdict === "correct"
      ? t.preflop.explain.correct(mine)
      : c.verdict === "mixed"
        ? t.preflop.explain.mixed(mine, best)
        : c.verdict === "too_loose"
          ? t.preflop.explain.too_loose()
          : c.verdict === "too_tight"
            ? t.preflop.explain.too_tight(best)
            : t.preflop.explain.wrong_action(mine, best);
  const rangeText = defense
    ? t.preflop.chartSays(displayPos(range.position), spotWord(d), range.bucket, spot.hand, best)
    : t.preflop.yourRange(displayPos(range.position), range.bucket, spot.hand, ACTION_LABEL[expected]);
  return {
    title,
    range: rangeText,
    hero: hero + (d.graded ? t.preflop.gradedAs(mine) : ""),
    mix,
    withHand: t.preflop.withHand(spot.hand, parts),
    explain,
    also,
  };
}

/** "vs CO open" — the chart's spot in words (trainer naming). */
function spotWord(d: PreflopDetail): string {
  const sc = scenarioFor(d);
  if (sc?.type !== "def") return "";
  const v = displayPos(sc.vil);
  return { open: `vs ${v} open`, push: `vs ${v} shove`, limp: `vs ${v} limp`, "4bet": `vs ${v} 4-bet`, lr: `vs ${v} limp-raise` }[sc.spot];
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
