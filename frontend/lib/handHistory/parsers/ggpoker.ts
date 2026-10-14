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

import type { ParseResult, ParsedHand } from "../types";
import { t } from "../strings";
import { fail, finishHand, parseBody, parseChips, splitOnHeader, toLines, type Dialect } from "./shared";

export { assignPositions, parseChips } from "./shared";

export const GG_PARSER_ID = "ggpoker";

const HEADER_RE =
  /^Poker Hand #([A-Za-z0-9-]+):\s*(.*?)\s+-\s+Level\s*(\d+)\s*\(([\d,.]+)\/([\d,.]+)(?:\(([\d,.]+)\))?\)\s+-\s+(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/;
const TOURNAMENT_RE = /^Tournament #(\d+),\s*(.*)$/;
const GAME_SPLIT_RE = /^(.*)\s+((?:Hold'em|Holdem|Omaha|PLO|Short Deck)\b.*)$/i;
const TABLE_RE = /^Table '([^']*)'\s+(\d+)-max\s+Seat #(\d+) is the button/;
const SEAT_RE = /^Seat (\d+): (.+?) \(([\d,.]+) in chips\)/;

const DIALECT: Dialect = { skipLines: new Set(["*** HOLE CARDS ***", "*** SHOWDOWN ***"]) };

/** Each hand starts with "Poker Hand #". */
export function splitGGHands(fileText: string): { hands: string[]; leftover: string } {
  return splitOnHeader(fileText, /Poker Hand #/);
}

export function parseGGHand(rawText: string): ParseResult {
  const { text, lines } = toLines(rawText);

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
    site: GG_PARSER_ID,
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

  const { reachedSummary } = parseBody(hand, lines, i, DIALECT);
  return finishHand(hand, rawText, text, reachedSummary);
}
