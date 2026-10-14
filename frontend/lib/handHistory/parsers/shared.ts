/**
 * The part of a hand history every PokerStars-style format shares: the action
 * lines after the seats, the summary, and the checks once a hand is read.
 * GGPoker copied PokerStars' text format, so both parsers only differ in their
 * header and seat lines and hand everything else to these functions.
 *
 * Pure: text in, ParsedHand fields out. Never throws.
 */

import { POSITIONS_BY_SIZE } from "@/lib/replay/positions";
import type { HandEvent, HandPlayer, ParseResult, ParsedHand, Street } from "../types";
import { t } from "../strings";

export const STREET_RE = /^\*\*\* (FLOP|TURN|RIVER) \*\*\*\s*(.*)$/;
const CARDS_RE = /\[([^\]]*)\]/g;
const UNCALLED_RE = /^Uncalled bet \(([\d,.]+)\) returned to (.+)$/;
const COLLECTED_RE = /^(.+?) collected ([\d,.]+) from (?:the )?(?:main |side )?pot/;
const DEALT_RE = /^Dealt to (\S+)(?:\s*\[([^\]]*)\])?/;
const TOTAL_POT_RE = /^Total pot ([\d,.]+)(?:.*?\|\s*Rake ([\d,.]+))?/;
const ALL_IN_SUFFIX = /\s+and is all-in\s*$/;

/** "64,676" → 64676. */
export function parseChips(s: string): number {
  return Number(s.replace(/,/g, ""));
}

export function cardsIn(s: string): string[][] {
  return [...s.matchAll(CARDS_RE)].map((m) => m[1].trim().split(/\s+/).filter(Boolean));
}

export function fail(rawText: string, handId: string | null, error: string): ParseResult {
  return { ok: false, failure: { handId, error, rawText } };
}

/** Normalises line endings and a BOM, as every parser needs. */
export function toLines(rawText: string): { text: string; lines: string[] } {
  const text = rawText.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  return { text, lines: text.split("\n").map((l) => l.trimEnd()) };
}

/**
 * Splits an export into the raw text of each hand on the site's header line
 * — rather than on blank lines, which a hand can itself contain. Anything
 * before the first header is returned as `leftover` so it can be reported.
 */
export function splitOnHeader(fileText: string, header: RegExp): { hands: string[]; leftover: string } {
  const text = fileText.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const starts = new RegExp(`^(?=${header.source})`, "m");
  const startsHand = new RegExp(`^(?:${header.source})`);
  const parts = text.split(starts);
  const leftover = parts.length && !startsHand.test(parts[0]) ? parts.shift()!.trim() : "";
  return { hands: parts.map((p) => p.trim()).filter(Boolean), leftover };
}

export interface Dialect {
  /** Marker lines that carry nothing to replay. */
  skipLines: ReadonlySet<string>;
  /**
   * A line that starts with a player's name but has no "Name: " owner part
   * (PokerStars' "X is disconnected", "X finished the tournament in 5th
   * place"). true: ignore it silently instead of reporting an unknown line.
   */
  ignoreNameLine?: (rest: string) => boolean;
}

/**
 * Reads everything after the seat lines into `hand`: posts, actions, streets,
 * showdowns, collections and the summary's total pot. Returns whether the
 * summary was reached (a hand without one is incomplete).
 */
export function parseBody(hand: ParsedHand, lines: string[], start: number, dialect: Dialect): { reachedSummary: boolean } {
  // Longest names first so a name that prefixes another never steals its line.
  const names = hand.players.map((p) => p.name).sort((a, b) => b.length - a.length);
  const lineOwner = (line: string): [string, string] | null => {
    for (const n of names) if (line.startsWith(`${n}: `) || line === `${n}:`) return [n, line.slice(n.length + 1).trim()];
    return null;
  };
  const namePrefix = (line: string): string | null => {
    for (const n of names) if (line.startsWith(`${n} `)) return line.slice(n.length + 1);
    return null;
  };

  let street: Street = "preflop";
  let inSummary = false;
  // Chips each player has in front of them on the current street (antes excluded — they are dead).
  let streetBets = new Map<string, number>();
  const push = (e: HandEvent) => hand.events.push(e);

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (inSummary) {
      const tp = TOTAL_POT_RE.exec(line);
      if (tp) {
        hand.totalPot = parseChips(tp[1]);
        hand.rake = tp[2] ? parseChips(tp[2]) : 0;
      }
      continue; // the rest of the summary repeats what the body already said
    }

    if (line === "*** SUMMARY ***") {
      inSummary = true;
      continue;
    }
    if (dialect.skipLines.has(line)) continue;

    const st = STREET_RE.exec(line);
    if (st) {
      const groups = cardsIn(st[2]);
      const newCards = groups[groups.length - 1] ?? [];
      const s = st[1].toLowerCase() as Exclude<Street, "preflop">;
      street = s;
      streetBets = new Map();
      if (s === "flop") hand.board.flop = newCards;
      else if (s === "turn") hand.board.turn = newCards[0] ?? null;
      else hand.board.river = newCards[0] ?? null;
      push({ kind: "deal", street: s, cards: newCards });
      continue;
    }

    const dealt = DEALT_RE.exec(line);
    if (dealt) {
      if (dealt[2]) {
        hand.heroName = dealt[1];
        hand.heroCards = dealt[2].trim().split(/\s+/);
      }
      continue;
    }

    const unc = UNCALLED_RE.exec(line);
    if (unc) {
      const player = unc[2].trim();
      const amount = parseChips(unc[1]);
      streetBets.set(player, (streetBets.get(player) ?? 0) - amount);
      push({ kind: "uncalled", street, player, amount });
      continue;
    }

    const col = COLLECTED_RE.exec(line);
    if (col && hand.players.some((p) => p.name === col[1])) {
      const amount = parseChips(col[2]);
      push({ kind: "collect", street, player: col[1], amount });
      const w = hand.winners.find((x) => x.player === col[1]);
      if (w) w.amount += amount;
      else hand.winners.push({ player: col[1], amount });
      continue;
    }

    const owned = lineOwner(line);
    if (owned) {
      const [player, rawBody] = owned;
      const allIn = ALL_IN_SUFFIX.test(rawBody);
      const body = rawBody.replace(ALL_IN_SUFFIX, "");
      let m: RegExpExecArray | null;

      if ((m = /^posts the ante ([\d,.]+)$/.exec(body))) {
        push({ kind: "post", street: "preflop", player, post: "ante", amount: parseChips(m[1]), allIn });
      } else if ((m = /^posts (small blind|big blind|straddle) ([\d,.]+)$/.exec(body))) {
        const amount = parseChips(m[2]);
        const post = m[1] === "small blind" ? "small_blind" : m[1] === "big blind" ? "big_blind" : "straddle";
        streetBets.set(player, (streetBets.get(player) ?? 0) + amount);
        push({ kind: "post", street: "preflop", player, post, amount, allIn });
      } else if (body === "folds") {
        push({ kind: "action", street, player, action: "fold", amount: 0, allIn: false });
      } else if (body === "checks") {
        push({ kind: "action", street, player, action: "check", amount: 0, allIn: false });
      } else if ((m = /^(calls|bets) ([\d,.]+)$/.exec(body))) {
        const amount = parseChips(m[2]);
        streetBets.set(player, (streetBets.get(player) ?? 0) + amount);
        push({ kind: "action", street, player, action: m[1] === "calls" ? "call" : "bet", amount, allIn });
      } else if ((m = /^raises ([\d,.]+) to ([\d,.]+)$/.exec(body))) {
        const toAmount = parseChips(m[2]);
        const amount = toAmount - (streetBets.get(player) ?? 0);
        streetBets.set(player, toAmount);
        push({ kind: "action", street, player, action: "raise", amount, toAmount, allIn });
      } else if ((m = /^shows \[([^\]]*)\]/.exec(body))) {
        const cards = m[1].trim().split(/\s+/).filter(Boolean);
        hand.shown[player] = cards;
        push({ kind: "show", street, player, cards });
      } else if (/^(mucks|doesn't show|sits out|is sitting out|has timed out|is disconnected|is connected|has returned)/.test(body)) {
        // Status lines without chips — nothing to replay.
      } else {
        hand.warnings.push(t.errors.unknownLine(line));
      }
      continue;
    }

    const rest = dialect.ignoreNameLine ? namePrefix(line) : null;
    if (rest !== null && dialect.ignoreNameLine!(rest)) continue;

    hand.warnings.push(t.errors.unknownLine(line));
  }

  return { reachedSummary: inSummary };
}

/**
 * The checks every parsed hand goes through: complete, hero known, positions
 * assigned, and the chips adding up (a mismatch keeps the hand but flags it).
 */
export function finishHand(hand: ParsedHand, rawText: string, text: string, reachedSummary: boolean): ParseResult {
  if (!reachedSummary) return fail(rawText, hand.handId, t.errors.noSummary);
  if (!hand.heroName) return fail(rawText, hand.handId, t.errors.noHeroCards);

  for (const p of hand.players) p.isHero = p.name === hand.heroName;
  assignPositions(hand.players, hand.buttonSeat);

  const invested = new Map<string, number>();
  for (const e of hand.events) {
    if (e.kind === "post" || e.kind === "action") invested.set(e.player, (invested.get(e.player) ?? 0) + e.amount);
    if (e.kind === "uncalled") invested.set(e.player, (invested.get(e.player) ?? 0) - e.amount);
  }
  const putIn = [...invested.values()].reduce((a, b) => a + b, 0);
  if (hand.totalPot > 0 && Math.abs(putIn - hand.totalPot) > 0.001) {
    hand.warnings.push(t.errors.potMismatch(putIn, hand.totalPot));
  }
  const collected = hand.winners.reduce((a, w) => a + w.amount, 0);
  if (hand.totalPot > 0 && Math.abs(collected + hand.rake - hand.totalPot) > 0.001) {
    hand.warnings.push(t.errors.payoutMismatch(collected, hand.totalPot));
  }

  return { ok: true, hand, rawText: text };
}

/**
 * BTN/SB/BB/UTG/… by walking the occupied seats clockwise from the button.
 * Names follow lib/replay/positions.ts so the whole site uses one vocabulary.
 */
export function assignPositions(players: HandPlayer[], buttonSeat: number): void {
  const bySeat = [...players].sort((a, b) => a.seat - b.seat);
  const start = bySeat.findIndex((p) => p.seat >= buttonSeat);
  const order = start < 0 ? bySeat : [...bySeat.slice(start), ...bySeat.slice(0, start)];
  const buttonOccupied = order[0]?.seat === buttonSeat;
  const n = order.length;
  // Dead button: the first occupied seat after it is the SB, nobody is BTN.
  const labels = buttonOccupied ? positionNames(n) : positionNames(n + 1).slice(1);
  order.forEach((p, k) => (p.position = labels[k] ?? `S${p.seat}`));
}

function positionNames(n: number): string[] {
  if (POSITIONS_BY_SIZE[n]) return POSITIONS_BY_SIZE[n];
  // 10-max: one more early seat than 9-max.
  const nine = POSITIONS_BY_SIZE[9];
  return [...nine.slice(0, 6), "UTG+3", ...nine.slice(6)].slice(0, n);
}
