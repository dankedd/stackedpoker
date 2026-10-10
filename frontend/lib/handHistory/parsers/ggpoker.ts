/**
 * GGPoker tournament hand history parser (PokerCraft export).
 *
 * Pure and synchronous: text in, ParseResult out. Never throws — anything it
 * cannot make sense of becomes a ParseFailure with a readable message, so one bad
 * hand never stops an import.
 *
 * Format notes (PokerCraft export):
 *  - Header: `Poker Hand #TM…: Tournament #…, <name> Hold'em No Limit - Level19(1,500/3,000(350)) - 2026/10/08 21:40:24`
 *  - Amounts use comma thousands separators: `1,500`.
 *  - `raises 3,000 to 6,000` — the SECOND number is the street total.
 *  - In an all-in before the river the `shows` lines come BEFORE the
 *    remaining board; event order is kept exactly as printed.
 *  - `*** SHOWDOWN ***` is printed in every hand, showdown or not, so it is
 *    never used to decide whether there was one (see derive.ts).
 */

import { POSITIONS_BY_SIZE } from "@/lib/replay/positions";
import type { HandEvent, HandPlayer, ParseResult, ParsedHand, Street } from "../types";
import { t } from "../strings";

export const GG_PARSER_ID = "ggpoker";

const HEADER_RE =
  /^Poker Hand #([A-Za-z0-9-]+):\s*(.*?)\s+-\s+Level\s*(\d+)\s*\(([\d,.]+)\/([\d,.]+)(?:\(([\d,.]+)\))?\)\s+-\s+(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/;
const TOURNAMENT_RE = /^Tournament #(\d+),\s*(.*)$/;
const GAME_SPLIT_RE = /^(.*)\s+((?:Hold'em|Holdem|Omaha|PLO|Short Deck)\b.*)$/i;
const TABLE_RE = /^Table '([^']*)'\s+(\d+)-max\s+Seat #(\d+) is the button/;
const SEAT_RE = /^Seat (\d+): (.+?) \(([\d,.]+) in chips\)/;
const STREET_RE = /^\*\*\* (FLOP|TURN|RIVER) \*\*\*\s*(.*)$/;
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

function cardsIn(s: string): string[][] {
  return [...s.matchAll(CARDS_RE)].map((m) => m[1].trim().split(/\s+/).filter(Boolean));
}

function fail(rawText: string, handId: string | null, error: string): ParseResult {
  return { ok: false, failure: { handId, error, rawText } };
}

export function canParseGG(text: string): boolean {
  return /^Poker Hand #[A-Z]{2}/m.test(text);
}

export function parseGGHand(rawText: string): ParseResult {
  const text = rawText.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n").map((l) => l.trimEnd());

  const header = HEADER_RE.exec(lines[0] ?? "");
  const idOnly = /^Poker Hand #([A-Za-z0-9-]+):/.exec(lines[0] ?? "");
  if (!header) {
    return fail(
      rawText,
      idOnly?.[1] ?? null,
      idOnly
        ? t.errors.headerUnknown
        : t.errors.notGgHand,
    );
  }

  const [, handId, rest, level, sb, bb, ante, y, mo, d, h, mi, s] = header;
  const tournament = TOURNAMENT_RE.exec(rest);
  if (!tournament) {
    return fail(rawText, handId, t.errors.notTournament);
  }
  const nameAndGame = GAME_SPLIT_RE.exec(tournament[2]);
  const tournamentName = (nameAndGame ? nameAndGame[1] : tournament[2]).trim();
  const game = nameAndGame ? nameAndGame[2].trim() : "Hold'em No Limit";

  const table = lines.length > 1 ? TABLE_RE.exec(lines[1]) : null;
  if (!table) return fail(rawText, handId, t.errors.noTableLine);

  const hand: ParsedHand = {
    site: "ggpoker",
    handId,
    tournamentId: tournament[1],
    tournamentName: tournamentName || null,
    game,
    level: Number(level),
    smallBlind: parseChips(sb),
    bigBlind: parseChips(bb),
    ante: ante ? parseChips(ante) : 0,
    playedAt: `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:${s}`,
    tableName: table[1],
    maxSeats: Number(table[2]),
    buttonSeat: Number(table[3]),
    players: [],
    heroName: null,
    heroCards: null,
    events: [],
    board: { flop: [], turn: null, river: null },
    shown: {},
    winners: [],
    totalPot: 0,
    rake: 0,
    warnings: [],
  };
  if (!(hand.bigBlind > 0)) return fail(rawText, handId, t.errors.noBigBlind);

  // Seats come right after the table line, before any post.
  let i = 2;
  for (; i < lines.length; i++) {
    const m = SEAT_RE.exec(lines[i]);
    if (!m) break;
    hand.players.push({ seat: Number(m[1]), name: m[2], stack: parseChips(m[3]), isHero: false, position: "" });
  }
  if (hand.players.length < 2) return fail(rawText, handId, t.errors.tooFewPlayers);

  // Longest names first so a name that prefixes another never steals its line.
  const names = hand.players.map((p) => p.name).sort((a, b) => b.length - a.length);
  const lineOwner = (line: string): [string, string] | null => {
    for (const n of names) if (line.startsWith(`${n}: `) || line === `${n}:`) return [n, line.slice(n.length + 1).trim()];
    return null;
  };

  let street: Street = "preflop";
  let inSummary = false;
  // Chips each player has in front of them on the current street (antes excluded — they are dead).
  let streetBets = new Map<string, number>();
  const push = (e: HandEvent) => hand.events.push(e);

  for (; i < lines.length; i++) {
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
    if (line === "*** HOLE CARDS ***" || line === "*** SHOWDOWN ***") continue;

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

    hand.warnings.push(t.errors.unknownLine(line));
  }

  if (!inSummary) return fail(rawText, handId, t.errors.noSummary);
  if (!hand.heroName) return fail(rawText, handId, t.errors.noHeroCards);

  for (const p of hand.players) p.isHero = p.name === hand.heroName;
  assignPositions(hand.players, hand.buttonSeat);

  // Chip conservation check: what went in must equal the pot. A mismatch means
  // a line was misread — keep the hand, but flag it.
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
