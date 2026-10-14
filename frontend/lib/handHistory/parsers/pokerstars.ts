/**
 * PokerStars tournament hand history parser (English client).
 *
 * Same output as the GGPoker parser; only the header, the seat lines and a
 * few status lines differ, the rest is shared (./shared.ts). Reference: the
 * backend's single-hand parser (backend/app/parsers/pokerstars.py).
 *
 * Format notes:
 *  - Header: `PokerStars Hand #254448573187: Tournament #3593839181, $0.98+$0.12 USD Hold'em No Limit - Level IV (50/100) - 2026/10/08 21:40:24 CET [2026/10/08 15:40:24 ET]`
 *    · the buy-in sits between the tournament number and the game;
 *    · the level is a Roman numeral (Spin & Go: "Match Round I, Level II");
 *    · the first time is in the player's chosen zone, the bracketed one is
 *      always ET. `playedAt` is stored in UTC, converted from the ET time.
 *  - Zoom hands start with "PokerStars Zoom Hand #", old ones with "PokerStars Game #".
 *  - Antes are not in the header: every player posts them as separate lines
 *    (`posts the ante 10`), or only the big blind does (big blind ante).
 *  - Seats can carry a bounty: `Seat 3: Name (1500 in chips, $2.50 bounty)`.
 *  - The showdown marker is `*** SHOW DOWN ***` (with a space).
 *  - Players are named; lines like "Name is disconnected" or "Name finished
 *    the tournament in 5th place" have no colon and carry no chips.
 */

import type { HandEvent, ParseResult, ParsedHand } from "../types";
import { t } from "../strings";
import { fail, finishHand, parseBody, parseChips, splitOnHeader, toLines, type Dialect } from "./shared";

export const PS_PARSER_ID = "pokerstars";

const HAND_START = /PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #/;
const HEADER_RE = /^PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #(\d+):\s*(.*)$/;
const TOURNAMENT_RE = /^Tournament #(\d+),\s*(.*?)\s+-\s+(.*)$/;
const GAME_SPLIT_RE = /^(.*?)\s*((?:Hold'em|Holdem|Omaha|5 Card Omaha|Courchevel|Razz|7 Card Stud|Triple Draw|Badugi)\b.*)$/i;
const LEVEL_RE = /Level\s+([IVXLCDM]+|\d+)\s*\(([\d,.]+)\/([\d,.]+)\)/;
const TIME_RE = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([A-Z]{2,5})?/g;
const TABLE_RE = /^Table '([^']*)'\s+(\d+)-max\s+Seat #(\d+) is the button/;
const SEAT_RE = /^Seat (\d+): (.+?) \(([\d,.]+) in chips(?:,[^)]*)?\)/;

const DIALECT: Dialect = {
  skipLines: new Set(["*** HOLE CARDS ***", "*** SHOW DOWN ***", "*** SHOWDOWN ***"]),
  // Status and tournament lines: no colon, no chips moved in this hand.
  ignoreNameLine: (rest) =>
    /^(is disconnected|is connected|has timed out|is sitting out|has returned|joins the table|leaves the table|finished the tournament|wins the tournament|re-buys|takes the add-on|wins (?:the )?\$?[\d,.]+ (?:bounty|for eliminating)|wins an entry|wins a |said, |will be allowed to play|was removed from the table|is the new )/.test(
      rest,
    ),
};

/** Fixed offsets (hours from UTC) of the zone labels PokerStars prints, when no ET time is given. */
const ZONE_OFFSET_HOURS: Record<string, number> = {
  UTC: 0, GMT: 0, WET: 0, WEST: 1, BST: 1, CET: 1, CEST: 2, EET: 2, EEST: 3, MSK: 3,
};

/** Each hand starts with "PokerStars Hand #", "PokerStars Zoom Hand #" or "PokerStars Game #". */
export function splitPSHands(fileText: string): { hands: string[]; leftover: string } {
  return splitOnHeader(fileText, HAND_START);
}

export function romanToNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i]];
    if (!cur) return null;
    const next = v[s[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total || null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

/** Offset of `timeZone` from UTC at the given instant, in ms (local − UTC). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

/** A wall-clock time in America/New_York (ET, daylight saving included) → UTC. */
export function easternToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number): string {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = wall - zoneOffsetMs(wall, "America/New_York");
  // Second pass settles the hour around a daylight-saving switch.
  utc = wall - zoneOffsetMs(utc, "America/New_York");
  return iso(utc);
}

/** The hand's time in UTC, from the ET time PokerStars always prints (or a known fixed zone). */
export function playedAtUtc(timePart: string): string | null {
  const times = [...timePart.matchAll(TIME_RE)];
  const pick = times.find((m) => m[7] === "ET") ?? times[0];
  if (!pick) return null;
  const [y, mo, d, h, mi, s] = pick.slice(1, 7).map(Number);
  const zone = pick[7] ?? "ET";
  if (zone === "ET") return easternToUtc(y, mo, d, h, mi, s);
  const offset = ZONE_OFFSET_HOURS[zone];
  if (offset === undefined) return null;
  return iso(Date.UTC(y, mo - 1, d, h, mi, s) - offset * 3_600_000);
}

/**
 * Per-player ante. Every player posting the same ante: that amount. Only one
 * player posting one (a big blind ante): 0, because nobody else's stack is
 * reduced by it — the ante line itself stays in the events and the pot.
 */
function antePerPlayer(events: HandEvent[]): number {
  const amounts = new Map<string, number>();
  for (const e of events) if (e.kind === "post" && e.post === "ante") amounts.set(e.player, e.amount);
  if (amounts.size < 2) return 0;
  const count = new Map<number, number>();
  for (const a of amounts.values()) count.set(a, (count.get(a) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export function parsePSHand(rawText: string): ParseResult {
  const { text, lines } = toLines(rawText);

  const header = HEADER_RE.exec(lines[0] ?? "");
  if (!header) return fail(rawText, null, t.errors.notPsHand);
  const [, handId, rest] = header;

  const tournament = TOURNAMENT_RE.exec(rest);
  if (!tournament) return fail(rawText, handId, t.errors.notTournament);
  const [, tournamentId, buyInAndGame, levelAndTime] = tournament;

  const level = LEVEL_RE.exec(levelAndTime);
  if (!level) return fail(rawText, handId, t.errors.psHeaderUnknown);
  const playedAt = playedAtUtc(levelAndTime);
  if (!playedAt) return fail(rawText, handId, t.errors.psTimeUnknown);

  const nameAndGame = GAME_SPLIT_RE.exec(buyInAndGame);
  // PokerStars has no tournament name in the hand; the buy-in identifies it ("$0.98+$0.12 USD", "Freeroll").
  const buyIn = (nameAndGame ? nameAndGame[1] : buyInAndGame).trim();
  const game = nameAndGame ? nameAndGame[2].trim() : "Hold'em No Limit";

  const table = lines.length > 1 ? TABLE_RE.exec(lines[1]) : null;
  if (!table) return fail(rawText, handId, t.errors.noTableLine);

  const hand: ParsedHand = {
    site: PS_PARSER_ID,
    handId,
    tournamentId,
    tournamentName: buyIn || null,
    game,
    level: romanToNumber(level[1]),
    smallBlind: parseChips(level[2]),
    bigBlind: parseChips(level[3]),
    ante: 0,
    playedAt,
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

  let i = 2;
  for (; i < lines.length; i++) {
    const m = SEAT_RE.exec(lines[i]);
    if (!m) break;
    hand.players.push({ seat: Number(m[1]), name: m[2], stack: parseChips(m[3]), isHero: false, position: "" });
  }
  if (hand.players.length < 2) return fail(rawText, handId, t.errors.tooFewPlayers);

  const { reachedSummary } = parseBody(hand, lines, i, DIALECT);
  hand.ante = antePerPlayer(hand.events);
  return finishHand(hand, rawText, text, reachedSummary);
}
