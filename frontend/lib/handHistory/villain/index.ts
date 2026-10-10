/**
 * Villain and villain's range, from the Preflop Trainer's charts.
 *
 *   findVillain     the opponent that matters: the only other player left at
 *                   the end, or else the last one who bet or raised
 *   villainRange    reads villain's preflop line and picks the closest chart:
 *                     first in (raise / shove / limp)   → open or push/fold chart
 *                     3-bet / shove / call vs one open  → defense chart, that column
 *                     called or shoved over Hero's 4-bet → "vs 4-bet" chart
 *                     anything else                     → open range + warning
 *
 * Chart data and frequencies come from lib/ranges (the trainer's own files);
 * position and stack follow the preflop check (preflop/lookup.ts): 9-max
 * position by players acting after, effective stack to the nearest bucket.
 * When the exact chart is missing, the nearest one is used and labelled.
 */

import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { ALL_HANDS, displayPos, shouldPush } from "@/lib/ranges/logic";
import type { DefenseChart, DefenseSpot, RangeActionKey } from "@/lib/ranges/types";
import type { WeightedRange } from "@/lib/equity/rangeEquity";
import { lookupRfi, rangePosition } from "../preflop/lookup";
import { NEAR_ALL_IN } from "../preflop/spots";
import { t } from "../strings";
import type { HandEvent, ParsedHand } from "../types";

type Action = Extract<HandEvent, { kind: "action" }>;

export interface VillainRange {
  villain: string;
  /** Villain's 9-max chart position. */
  position: string | null;
  /** Short name of the range used, e.g. "HJ shove vs LJ-open · 15 BB". */
  label: string;
  /** Book page and Hand Range of the chart, when one was used. */
  source: { page: number; hr: string } | null;
  range: WeightedRange;
  /** Set when the range is an approximation; shown as a warning. */
  approximation: string | null;
}

const ORDER_9 = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB", "BB"];

// ── Who ──────────────────────────────────────────────────────────────────────

export function findVillain(hand: ParsedHand): string | null {
  const hero = hand.heroName;
  if (!hero) return null;
  const folded = new Set(hand.events.filter((e): e is Action => e.kind === "action" && e.action === "fold").map((e) => e.player));
  const left = hand.players.filter((p) => p.name !== hero && !folded.has(p.name));
  if (left.length === 1) return left[0].name;
  const aggressors = hand.events.filter(
    (e): e is Action => e.kind === "action" && e.player !== hero && (e.action === "bet" || e.action === "raise"),
  );
  const lastAgg = aggressors.at(-1)?.player;
  if (lastAgg) return lastAgg;
  return left[0]?.name ?? null;
}

// ── Where ────────────────────────────────────────────────────────────────────

/** Players acting after `name` preflop (0 for the big blind). */
export function playersAfter(hand: ParsedHand, name: string): number {
  const bySeat = [...hand.players].sort((a, b) => a.seat - b.seat);
  const bbPost = hand.events.find((e) => e.kind === "post" && e.post === "big_blind");
  const bbName = bbPost && "player" in bbPost ? bbPost.player : hand.players.find((p) => p.position === "BB")?.name;
  const bb = bySeat.findIndex((p) => p.name === bbName);
  const me = bySeat.findIndex((p) => p.name === name);
  if (bb < 0 || me < 0) return -1;
  return (bb - me + bySeat.length) % bySeat.length;
}

export function position9(hand: ParsedHand, name: string): string | null {
  const after = playersAfter(hand, name);
  if (after === 0) return "BB";
  return after > 0 ? rangePosition(after) : null;
}

function nearestPosition(wanted: string, available: string[]): string | null {
  const w = ORDER_9.indexOf(wanted);
  let best: string | null = null;
  for (const p of available) {
    const d = Math.abs(ORDER_9.indexOf(p) - w);
    // On a tie, prefer the earlier (tighter) position.
    if (best === null || d < Math.abs(ORDER_9.indexOf(best) - w) || (d === Math.abs(ORDER_9.indexOf(best) - w) && ORDER_9.indexOf(p) < ORDER_9.indexOf(best))) best = p;
  }
  return best;
}

// ── What ─────────────────────────────────────────────────────────────────────

function stackOf(hand: ParsedHand, name: string): number {
  return hand.players.find((p) => p.name === name)?.stack ?? 0;
}

/** "allin" for an all-in or a raise of 90%+ of the stack (same rule as the preflop check). */
function actionKey(hand: ParsedHand, a: Action): RangeActionKey {
  if (a.action === "call") return a.allIn ? "allin" : "call";
  const stack = stackOf(hand, a.player) - hand.ante;
  if (a.allIn || (stack > 0 && (a.toAmount ?? a.amount) >= NEAR_ALL_IN * stack)) return "allin";
  return "raise";
}

function chartRange(grid: Record<string, number[] | null>, actions: { key: RangeActionKey }[], key: RangeActionKey): WeightedRange {
  const out: WeightedRange = {};
  for (const [h, row] of Object.entries(grid)) {
    if (!row) continue;
    const w = actions.reduce((s, a, i) => s + (a.key === key ? row[i] : 0), 0);
    if (w > 0) out[h] = Math.min(1, w);
  }
  return out;
}

const ACTION_WORD: Partial<Record<RangeActionKey, string>> = { allin: "shove", raise: "3-bet", call: "call", limp: "limp" };

function openRange(hand: ParsedHand, villain: string, key: RangeActionKey): Omit<VillainRange, "approximation"> | null {
  const pos = position9(hand, villain);
  if (!pos || pos === "BB") return null;
  const after = hand.players.filter((p) => playersAfter(hand, p.name) < playersAfter(hand, villain) && p.name !== villain);
  const eff = Math.min(stackOf(hand, villain), Math.max(0, ...after.map((p) => p.stack))) / hand.bigBlind;
  const found = lookupRfi({ kind: "rfi", tablePosition: "", playersBehind: playersAfter(hand, villain), effStackBb: Math.min(eff, 70), hand: "", action: "raise" });
  if (!found.ok) return null;
  const sc = found.scenario;
  let range: WeightedRange;
  let what: string;
  if (sc.kind === "pf") {
    range = {};
    for (const [h, cell] of Object.entries(sc.chart.grid)) if (shouldPush(cell, sc.stack)) range[h] = 1;
    what = "push";
  } else {
    const has = sc.chart.actions.some((a) => a.key === key);
    const k = has ? key : sc.chart.actions.some((a) => a.key === "raise") ? "raise" : "allin";
    range = chartRange(sc.chart.grid, sc.chart.actions, k);
    what = k === "allin" ? "open-shove" : k === "limp" ? "limp" : "open";
  }
  return {
    villain,
    position: pos,
    label: `${displayPos(pos)} ${what} · ${found.ref.bucket} BB`,
    source: { page: found.ref.page, hr: found.ref.hr },
    range,
  };
}

function defenseChart(
  heroPos: string,
  vilPos: string,
  spot: DefenseSpot,
  effBb: number,
): { chart: DefenseChart; notes: string[] } | null {
  const pool = DEFENSE_CHARTS.filter((c) => c.group === "mtt" && c.spot === spot);
  const h = nearestPosition(heroPos, [...new Set(pool.map((c) => c.hero))]);
  if (!h) return null;
  const v = nearestPosition(vilPos, [...new Set(pool.filter((c) => c.hero === h).map((c) => c.vil))]);
  if (!v) return null;
  const charts = pool.filter((c) => c.hero === h && c.vil === v);
  const chart = charts.reduce((b, c) => {
    const d = Math.abs(c.stack - effBb) - Math.abs(b.stack - effBb);
    return d < 0 || (d === 0 && c.stack > b.stack) ? c : b;
  });
  const notes: string[] = [];
  if (h !== heroPos) notes.push(t.range.as(displayPos(heroPos), displayPos(h)));
  if (v !== vilPos) notes.push(t.range.openerAs(displayPos(vilPos), displayPos(v)));
  return { chart, notes };
}

export function villainRange(hand: ParsedHand, villain: string): VillainRange | null {
  const pre = hand.events.filter((e): e is Action => e.kind === "action" && e.street === "preflop");
  const mine = pre.map((a, i) => ({ a, i })).filter((x) => x.a.player === villain && x.a.action !== "fold" && x.a.action !== "check");
  const pos = position9(hand, villain);
  const heroName = hand.heroName;

  const fallback = (why: string): VillainRange | null => {
    const open = openRange(hand, villain, "raise");
    if (!open) {
      const all: WeightedRange = {};
      for (const h of ALL_HANDS) all[h] = 1;
      return { villain, position: pos, label: t.range.allHands, source: null, range: all, approximation: t.range.approxNoRange(why) };
    }
    return { ...open, approximation: t.range.approxOpen(why) };
  };

  if (!mine.length) return fallback(t.range.why.noVoluntary);
  const first = mine[0];
  const before = pre.slice(0, first.i);
  const raisesBefore = before.filter((a) => a.action === "raise");
  const callsBefore = before.filter((a) => a.action === "call");
  const key = actionKey(hand, first.a);

  // First in: open, shove or limp.
  if (!raisesBefore.length && !callsBefore.length) {
    if (mine.length > 1) return fallback(mine.some((m) => actionKey(hand, m.a) === "allin") ? t.range.why.afterShove : t.range.why.after3bet);
    const open = openRange(hand, villain, key === "call" ? "limp" : key);
    return open ? { ...open, approximation: null } : fallback(t.range.why.thisOpen);
  }

  // Facing exactly one raise: the defense charts.
  if (raisesBefore.length === 1 && pos) {
    const opener = raisesBefore[0];
    const openerPos = position9(hand, opener.player);
    if (!openerPos) return fallback(t.range.why.vsThisOpen);
    const effBb = Math.min(stackOf(hand, villain), stackOf(hand, opener.player)) / hand.bigBlind;
    const openerShoved = actionKey(hand, opener) === "allin";
    const spot: DefenseSpot = openerShoved && pos === "BB" && openerPos === "SB" ? "push" : "open";

    // Villain 3-bet, Hero 4-bet, villain called or shoved: the "vs 4-bet" chart.
    if (mine.length > 1) {
      const fourBet = pre.slice(first.i + 1, mine[1].i).find((a) => a.action === "raise");
      if (fourBet && fourBet.player === heroName && opener.player === heroName) {
        const found = defenseChart(pos, openerPos, "4bet", effBb);
        const k2 = actionKey(hand, mine[1].a);
        if (found && found.chart.actions.some((a) => a.key === k2)) {
          return fromDefense(villain, pos, found, k2, (c) => t.range.vs4bet(ACTION_WORD[k2] ?? k2, displayPos(c.vil)), null);
        }
      }
      return fallback(t.range.why.multipleRaises);
    }

    const found = defenseChart(pos, openerPos, spot, effBb);
    if (!found) return fallback(t.range.why.vsThisOpen);
    let k = key;
    const keys: RangeActionKey[] = found.chart.actions.map((a) => a.key);
    const notes = [...found.notes];
    if (!keys.includes(k) && k === "raise" && keys.includes("allin")) {
      k = "allin";
      notes.push(t.range.threeBetAsShove);
    } else if (!keys.includes(k) && k === "allin" && keys.includes("raise")) {
      k = "raise";
      notes.push(t.range.shoveAsThreeBet);
    }
    if (!keys.includes(k)) return fallback(t.range.why.vsThisOpen);
    if (callsBefore.length) notes.push(t.range.callersIgnored(callsBefore.length));
    const what = (c: DefenseChart) => (spot === "push" ? `call vs ${displayPos(c.vil)}-shove` : `${ACTION_WORD[k]} vs ${displayPos(c.vil)}-open`);
    return fromDefense(villain, pos, found, k, what, notes.length ? t.range.approx(notes.join(", ")) : null);
  }

  return fallback(raisesBefore.length > 1 ? t.range.why.multipleRaises : t.range.why.afterLimps);
}

function fromDefense(
  villain: string,
  pos: string,
  found: { chart: DefenseChart; notes: string[] },
  key: RangeActionKey,
  what: (chart: DefenseChart) => string,
  approximation: string | null,
): VillainRange {
  const c = found.chart;
  return {
    villain,
    position: pos,
    // Name the chart actually used, even when it stands in for another spot.
    label: `${displayPos(c.hero)} ${what(c)} · ${c.stack} BB`,
    source: { page: c.page, hr: `Hand Range ${c.n}` },
    range: chartRange(c.grid, c.actions, key),
    approximation,
  };
}

// ── Quick picks ──────────────────────────────────────────────────────────────

export interface RangePreset {
  id: string;
  group: string;
  label: string;
  source: string;
  range: WeightedRange;
}

/**
 * Every trainer range a player in `pos` (9-max) can have: open charts per
 * action, push/fold per stack, and defense columns. For the range editor.
 */
export function rangePresets(pos: string | null): RangePreset[] {
  const out: RangePreset[] = [];
  const word: Partial<Record<RangeActionKey, string>> = { raise: "raise", allin: "shove", limp: "limp", call: "call" };
  if (pos && pos !== "BB") {
    for (const c of MTT_OPEN_CHARTS.filter((x) => x.pos === pos).sort((a, b) => a.stack - b.stack)) {
      for (const a of c.actions.filter((x) => x.key !== "fold")) {
        out.push({
          id: `open-${c.page}-${a.key}`,
          group: t.range.groupOpen,
          label: `${displayPos(pos)} open ${word[a.key]} · ${c.stack} BB`,
          source: `${c.hr} · p. ${c.page}`,
          range: chartRange(c.grid, c.actions, a.key),
        });
      }
    }
    const pf = PUSH_FOLD_CHARTS.find((x) => x.pos === pos);
    if (pf) {
      for (let s = 2; s <= 10; s++) {
        const range: WeightedRange = {};
        for (const [h, cell] of Object.entries(pf.grid)) if (shouldPush(cell, s)) range[h] = 1;
        out.push({ id: `pf-${pf.page}-${s}`, group: t.range.groupPushFold, label: `${displayPos(pos)} push · ${s} BB`, source: `${pf.hr} · p. ${pf.page}`, range });
      }
    }
  }
  for (const c of DEFENSE_CHARTS.filter((x) => x.group === "mtt" && (!pos || x.hero === pos)).sort((a, b) => a.vil.localeCompare(b.vil) || a.stack - b.stack)) {
    for (const a of c.actions.filter((x) => x.key !== "fold")) {
      const spotWord = c.spot === "open" ? `vs ${displayPos(c.vil)}-open` : c.spot === "push" ? `vs ${displayPos(c.vil)}-shove` : c.spot === "4bet" ? `vs 4-bet ${displayPos(c.vil)}` : c.spot === "limp" ? `vs ${displayPos(c.vil)}-limp` : `vs ${displayPos(c.vil)} limp/raise`;
      out.push({
        id: `def-${c.n}-${a.key}`,
        group: t.range.groupVsAction,
        label: `${displayPos(c.hero)} ${a.label.toLowerCase()} ${spotWord} · ${c.stack} BB`,
        source: `Hand Range ${c.n} · p. ${c.page}`,
        range: chartRange(c.grid, c.actions, a.key),
      });
    }
  }
  return out;
}
