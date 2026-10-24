/**
 * Flop decision check: how did Hero play the flop, measured against the
 * flop data the Flop Equity Trainer precomputed from Modern Poker Theory's
 * ranges? Deliberately milder than the preflop check — there is no solver
 * output per hand, only range-level book guidelines:
 *
 *   good          in line with the guideline for this hand and board
 *   ok            fine / a reasonable mix; or nothing in the data argues against it
 *   questionable  the data argues against it (never "wrong" without a hard basis)
 *   not_evaluated a line the check doesn't grade (leads, no data, Hero not in the pot)
 *
 * The guidelines, in our own words (pages are 1-based PDF pages):
 *  - IP c-bets (Hero raised preflop and is in position, villain checked):
 *    the c-bet profile of lib/flopTrainer/phase3.ts (Diagrams 56–57, p.677–679;
 *    exact book strategy on the six example flops, p.684–698). High-frequency
 *    boards: betting nearly everything is fine (p.680). Mid/low boards: bet a
 *    polarized range and check back good-but-not-great hands (p.680–681);
 *    checking back strong hands that block the opponent is allowed (p.681).
 *  - Facing a bet: compare the hand's equity with the pot odds; hands with
 *    little equity should fold even to small bets, MDF is not the guide (p.727).
 *    Equity here is against villain's whole range, which flatters a hand facing
 *    a bet — so only clear cases are called questionable.
 *  - OOP raiser: the book's OOP raiser c-bets more often (p.726); graded on the
 *    hand only.
 * Hero's hand: its Equity Bucket and range percentile from the precomputed
 * per-hand equities (backend /api/flop-trainer/hand-position).
 */

import { cbetAdvice, type CbetAdvice } from "@/lib/flopTrainer/phase3";
import type { BucketKey, Buckets, NutAdv } from "@/lib/flopTrainer/logic";
import type { FlopSpotMatch } from "@/lib/flopTrainer/match";
import { potOddsDecisions } from "./potOdds";
import type { HandEvent, ParsedHand } from "./types";

type Action = Extract<HandEvent, { kind: "action" }>;

export type FlopVerdict = "good" | "ok" | "questionable" | "not_evaluated";
export const FLOP_VERDICTS: FlopVerdict[] = ["questionable", "ok", "good", "not_evaluated"];

/** Bump when the grading changes: stored checks are redone on the next /hands visit. */
export const FLOP_CHECK_VERSION = "1";

export type FlopLineKind = "cbet" | "check" | "check_raise" | "call" | "fold" | "raise" | "lead" | "stab" | "none";
export type SizeClass = "small" | "medium" | "big";

/** Hero's flop line, from the hand history alone. */
export interface FlopLine {
  kind: FlopLineKind;
  /** Hero's own bet (c-bet, lead, stab) as % of the pot. */
  betPct?: number;
  size?: SizeClass;
  /** The bet Hero faced (call / fold / raise / check-raise). */
  facing?: { pct: number; required: number; byPfr: boolean };
  /** The flop event that is graded (for the replayer's badge). */
  eventIndex: number | null;
}

export interface HandPositionLite {
  in_range: boolean;
  equity?: number;
  bucket?: BucketKey;
  top_pct?: number;
}

export interface FlopRowLite {
  equity_ip: number;
  equity_oop: number;
  buckets_ip: Buckets;
  buckets_oop: Buckets;
  nut_adv: NutAdv;
  texture: string[];
}

export interface FlopCheck {
  verdict: FlopVerdict;
  line: FlopLine;
  /** Short reason for not_evaluated. */
  reason?: "lead" | "no_decision" | "hero_not_in_pot" | "no_hand_data" | "not_analysed";
  /** The c-bet guideline used (IP raiser, villain checked). */
  advice?: Pick<CbetAdvice, "size" | "band" | "bands" | "source" | "strategy">;
  hand?: HandPositionLite;
  /** 1–2 sentences, own words. */
  explain: string;
}

export const sizeClass = (pct: number): SizeClass => (pct <= 40 ? "small" : pct >= 60 ? "big" : "medium");

// ── Step 1: Hero's flop line ─────────────────────────────────────────────────

export function flopLine(hand: ParsedHand, match: FlopSpotMatch): FlopLine {
  const hero = hand.heroName;
  if (!hero || !match.heroSide) return { kind: "none", eventIndex: null };
  const events = hand.events;
  const flopStart = events.findIndex((e) => e.kind === "deal" && e.street === "flop");
  if (flopStart < 0) return { kind: "none", eventIndex: null };

  // Pot at the start of the flop: everything put in before it, minus returned bets.
  let pot = 0;
  for (const e of events.slice(0, flopStart)) {
    if (e.kind === "post") pot += e.amount;
    else if (e.kind === "action") pot += e.amount;
    else if (e.kind === "uncalled") pot -= e.amount;
  }
  const flop = events.map((e, i) => ({ e, i })).filter((x): x is { e: Action; i: number } => x.e.kind === "action" && x.e.street === "flop");
  const heroActs = flop.filter((x) => x.e.player === hero);
  if (!heroActs.length) return { kind: "none", eventIndex: null };

  const decisions = potOddsDecisions(hand).filter((d) => d.street === "flop");
  const facingOf = (idx: number, bettor: string, betPct: number) => {
    const d = decisions.find((x) => x.event === events[idx]);
    return { pct: Math.round(betPct), required: d?.required ?? 0, byPfr: bettor === match.situation.pfrName };
  };

  // Walk the flop: track the pot so bet sizes are a share of the pot at that moment.
  let running = pot;
  let lastBet: { player: string; pct: number } | null = null;
  let heroChecked = false;
  for (const { e, i } of flop) {
    if (e.player !== hero) {
      if (e.action === "bet" || e.action === "raise") lastBet = { player: e.player, pct: (100 * e.amount) / Math.max(1, running) };
      running += e.amount;
      continue;
    }
    // Hero's action.
    if (e.action === "check") {
      heroChecked = true;
      running += 0;
      // Graded later: either the response to a bet, or a check through.
      continue;
    }
    if (e.action === "bet") {
      const betPct = Math.round((100 * e.amount) / Math.max(1, running));
      const kind: FlopLineKind = match.heroIsPfr ? "cbet" : match.heroSide === "oop" ? "lead" : "stab";
      return { kind, betPct, size: sizeClass(betPct), eventIndex: i };
    }
    if (lastBet) {
      const facing = facingOf(i, lastBet.player, lastBet.pct);
      if (e.action === "fold") return { kind: "fold", facing, eventIndex: i };
      if (e.action === "call") return { kind: "call", facing, eventIndex: i };
      if (e.action === "raise") return { kind: heroChecked ? "check_raise" : "raise", facing, eventIndex: i };
    }
    return { kind: "none", eventIndex: i };
  }
  // Hero checked and nobody bet after: a check through (as raiser: a check-back / check).
  if (heroChecked) return { kind: "check", eventIndex: heroActs[heroActs.length - 1].i };
  return { kind: "none", eventIndex: null };
}

// ── Step 2: grade ────────────────────────────────────────────────────────────

const BUCKET_WORD: Record<BucketKey, string> = { strong: "Strong", good: "Good", weak: "Weak", trash: "Trash" };
const LINE_WORD: Record<FlopLineKind, string> = {
  cbet: "c-bet",
  check: "check",
  check_raise: "check-raise",
  call: "call",
  fold: "fold",
  raise: "raise",
  lead: "lead",
  stab: "bet",
  none: "—",
};

export function flopLineLabel(l: FlopLine): string {
  if (l.kind === "cbet" || l.kind === "lead" || l.kind === "stab") return `${LINE_WORD[l.kind]} ${l.betPct}% pot`;
  if (l.facing) return `${LINE_WORD[l.kind]} vs ${l.facing.pct}% pot bet`;
  return LINE_WORD[l.kind];
}

export interface FlopCheckInput {
  match: FlopSpotMatch;
  line: FlopLine;
  row: FlopRowLite | null;
  hand: HandPositionLite | null;
  /** Display names ("BTN", "BB"). */
  names: { ip: string; oop: string };
}

export function gradeFlop({ match, line, row, hand, names }: FlopCheckInput): FlopCheck {
  const base = { line };
  if (!match.heroSide) return { ...base, verdict: "not_evaluated", reason: "hero_not_in_pot", explain: "Hero wasn't in this pot." };
  if (!row) return { ...base, verdict: "not_evaluated", reason: "not_analysed", explain: "This spot's flops haven't been analysed yet." };
  if (line.kind === "none") return { ...base, verdict: "not_evaluated", reason: "no_decision", explain: "Hero made no flop decision." };
  if (line.kind === "lead") {
    return { ...base, verdict: "not_evaluated", reason: "lead", explain: "Leads (betting into the preflop raiser) aren't graded: there's no reliable reference for most boards." };
  }

  const heroName = match.heroSide === "ip" ? names.ip : names.oop;
  const nut = row.nut_adv.leader === "IP" ? names.ip : row.nut_adv.leader === "OOP" ? names.oop : null;
  const nutText = nut
    ? `${nut} has the nut advantage (${Math.round(Math.max(row.nut_adv.ip, row.nut_adv.oop))}% vs ${Math.round(Math.min(row.nut_adv.ip, row.nut_adv.oop))}% Strong hands)`
    : `neither side has a clear nut advantage`;
  const b = hand?.equity !== undefined ? hand.bucket : undefined;
  const handText = b ? `your hand is ${BUCKET_WORD[b]} (${Math.round(hand!.equity!)}% equity${hand!.in_range && hand!.top_pct !== undefined ? `, top ${Math.max(1, Math.round(hand!.top_pct))}% of your range` : ", outside the range"})` : null;
  const did = flopLineLabel(line);

  // ── IP raiser, villain checked: the c-bet guideline ──
  const ipCbetSpot = match.heroIsPfr && match.heroSide === "ip" && match.spot.pot === "srp";
  if (ipCbetSpot && (line.kind === "cbet" || line.kind === "check")) {
    const a = cbetAdvice(match.spotId, match.flop, row.buckets_ip, row.buckets_oop, row.texture);
    const advice = { size: a.size, band: a.band, bands: a.bands, source: a.source, strategy: a.strategy };
    if (a.source === "book" && a.strategy) {
      const s = a.strategy;
      const small = (s.bet_1_3 ?? 0) + (s.bet_min ?? 0);
      const big = (s.bet_2_3 ?? 0) + (s.bet_1_2 ?? 0);
      const f = line.kind === "check" ? s.check ?? 0 : line.size === "small" ? small : line.size === "big" ? big : small + big;
      const verdict: FlopVerdict = f >= 30 ? "good" : f >= 10 ? "ok" : "questionable";
      return {
        ...base,
        verdict,
        advice,
        hand: hand ?? undefined,
        explain: `The reference strategy for this flop: ${heroName} bets small ${Math.round(small)}%, big ${Math.round(big)}%, checks ${Math.round(s.check ?? 0)}%. Your ${did} is a line the range takes ${Math.round(f)}% of the time.`,
      };
    }
    const bandWord = a.band === "high" ? "bets almost its whole range (80%+)" : a.band === "mid" ? "bets 60–80% and checks back part of its range" : "checks a lot (bets under 60%)";
    const sizeWord = a.size === "small" ? "small (≤ 1/3 pot)" : "big (1/2–2/3 pot)";
    const lead = `On this board ${nutText}; the range ${bandWord}, mostly ${sizeWord}.`;
    let verdict: FlopVerdict;
    let why: string;
    if (line.kind === "cbet") {
      const sizeOk = line.size === "medium" || line.size === a.size;
      if (a.band === "high") {
        verdict = sizeOk ? "good" : "ok";
        why = sizeOk ? "Betting here is standard." : `Betting is standard, but the guideline prefers ${sizeWord}.`;
      } else if (b === "good" || (b === "weak" && line.size === "big")) {
        verdict = "questionable";
        // The hand itself is already in the explanation (handText, below): don't repeat it.
        why = "On a board like this, good-but-not-great hands are usually checked back and the betting range is polarized.";
      } else {
        verdict = sizeOk ? (b ? "good" : "ok") : "ok";
        why = b === "strong" ? "A strong hand belongs in the betting range." : b === "trash" ? "A bluff with a hand that can't check down fits a polarized betting range." : sizeOk ? "Reasonable." : `Reasonable, though the guideline prefers ${sizeWord}.`;
      }
    } else {
      // Checked back.
      if (a.band === "high") {
        verdict = "ok";
        why = b === "strong" ? "Checking a strong hand is allowed when it blocks villain's continuing hands, but here the range bets almost everything." : "The range can bet nearly everything here, but checking some hands loses little.";
      } else if (b === "strong") {
        verdict = "ok";
        why = "Strong hands are mostly bet; checking some back is allowed when they block villain's continuing hands.";
      } else {
        verdict = "good";
        why = b === "trash" ? "Giving up with little equity is fine on a board that suits the caller." : "Checking back a good-but-not-great hand is standard on boards like this.";
      }
    }
    return { ...base, verdict, advice, hand: hand ?? undefined, explain: `${lead} ${handText ? `${capital(handText)}. ` : ""}${why}` };
  }

  if (!b) return { ...base, verdict: "not_evaluated", reason: "no_hand_data", explain: "Sign in to grade this decision: it needs your hand's equity on this flop." };
  const intro = `${capital(nutText)}; ${handText}.`;

  // ── Facing a bet: equity vs pot odds (p.727) ──
  if (line.facing && (line.kind === "call" || line.kind === "fold" || line.kind === "raise" || line.kind === "check_raise")) {
    const r = Math.round(line.facing.required * 100);
    const e = Math.round(hand!.equity!);
    const odds = `you needed ${r}% equity to call`;
    let verdict: FlopVerdict;
    let why: string;
    if (line.kind === "fold") {
      if (b === "strong") [verdict, why] = ["questionable", `Folding a Strong hand gives up a lot: ${odds}.`];
      else if (b === "good") [verdict, why] = r <= 25 ? ["questionable", `Against a small bet ${odds}; a Good hand usually continues.`] : ["ok", `Against a big bet folding some Good hands is fine (${odds}).`];
      else if (b === "weak") [verdict, why] = e > r + 10 ? ["ok", `Close: ${odds}, and villain's betting range is stronger than the range average.`] : ["good", `Folding a weak hand is fine (${odds}).`];
      else [verdict, why] = ["good", `Folding little equity is right even against small bets (${odds}).`];
    } else if (line.kind === "call") {
      if (b === "trash") [verdict, why] = e < r ? ["questionable", `Calling with ${e}% equity when ${odds} loses money.`] : ["ok", `Thin: ${odds}, and villain's betting range is stronger than average.`];
      else [verdict, why] = ["good", `Your equity covers the price (${odds}).`];
    } else {
      // raise / check-raise
      if (b === "strong") [verdict, why] = ["good", "Raising a Strong hand builds the pot."];
      else if (b === "trash") [verdict, why] = ["ok", "A raise as a bluff: fine in moderation, a balanced raising range mixes strong hands with some bluffs."];
      else [verdict, why] = ["ok", "Raising a medium-strength hand is unusual; calling is the more common line."];
    }
    return { ...base, verdict, hand: hand ?? undefined, explain: `${intro} ${why}` };
  }

  // ── OOP raiser c-bet / check, IP caller stab / check, OOP caller check-through ──
  let verdict: FlopVerdict = "ok";
  let why: string;
  if (line.kind === "cbet") {
    verdict = b === "strong" || b === "good" ? "good" : "ok";
    why = match.heroSide === "oop" ? "Out of position the raiser c-bets often and bigger." : "A c-bet here is reasonable.";
  } else if (line.kind === "stab") {
    why = "Betting when the raiser checks is a reasonable try.";
  } else {
    verdict = b === "strong" ? "ok" : "good";
    why = b === "strong" ? "Checking a Strong hand works sometimes, but betting usually gets more value." : "Checking this hand is standard.";
  }
  return { ...base, verdict, hand: hand ?? undefined, explain: `${intro} ${why}` };
}

function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
