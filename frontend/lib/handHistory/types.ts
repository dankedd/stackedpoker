/**
 * Hand history — site-independent data model.
 *
 * Every site parser (lib/handHistory/parsers/*) produces a `ParsedHand`; the
 * import pipeline, the database row mapping (rows.ts) and the replayer
 * timeline (timeline.ts) only ever read this shape. Adding a site means
 * adding a parser, nothing else.
 *
 * All amounts are in chips, exactly as printed by the site. Big-blind values
 * are derived (derive.ts) and never stored instead of the chip amounts.
 */

export type Street = "preflop" | "flop" | "turn" | "river";
export const STREETS: readonly Street[] = ["preflop", "flop", "turn", "river"];

export type PostKind = "ante" | "small_blind" | "big_blind" | "straddle";
export type BetAction = "fold" | "check" | "call" | "bet" | "raise";

/**
 * One line of the hand, in the order the site printed it. The order is kept
 * as-is because it carries meaning: in an all-in before the river, GGPoker
 * prints the `shows` lines BEFORE the remaining board is dealt, and the
 * replayer must show the cards in that same order.
 */
export type HandEvent =
  | { kind: "post"; street: "preflop"; player: string; post: PostKind; amount: number; allIn: boolean }
  | {
      kind: "action";
      street: Street;
      player: string;
      action: BetAction;
      /** Chips added by this action (call/bet amount; for a raise: the increment). */
      amount: number;
      /** For a raise: the street total the player raised to. */
      toAmount?: number;
      allIn: boolean;
    }
  | { kind: "uncalled"; street: Street; player: string; amount: number }
  | { kind: "show"; street: Street; player: string; cards: string[] }
  | { kind: "deal"; street: Exclude<Street, "preflop">; cards: string[] }
  | { kind: "collect"; street: Street; player: string; amount: number };

export interface HandPlayer {
  seat: number;
  name: string;
  /** Stack at the start of the hand, before antes and blinds. */
  stack: number;
  isHero: boolean;
  /** BTN/SB/BB/UTG/... derived from the button and the occupied seats. */
  position: string;
}

export interface HandBoard {
  flop: string[];
  turn: string | null;
  river: string | null;
}

export interface HandWinner {
  player: string;
  amount: number;
}

export interface ParsedHand {
  site: "ggpoker";
  handId: string;
  tournamentId: string | null;
  tournamentName: string | null;
  /** e.g. "Hold'em No Limit". */
  game: string;
  level: number | null;
  smallBlind: number;
  bigBlind: number;
  /** Ante per player (0 when none). */
  ante: number;
  /** Local time as printed by the site, ISO form without zone: "2026-10-08T21:40:24". */
  playedAt: string;
  tableName: string;
  maxSeats: number;
  buttonSeat: number;
  players: HandPlayer[];
  heroName: string | null;
  heroCards: string[] | null;
  events: HandEvent[];
  board: HandBoard;
  /** Cards each player showed, keyed by player name. */
  shown: Record<string, string[]>;
  winners: HandWinner[];
  totalPot: number;
  rake: number;
  /** Lines the parser did not recognise but could safely ignore. */
  warnings: string[];
}

/** Values computed from a ParsedHand (derive.ts). */
export interface HandDerived {
  potBb: number;
  heroPosition: string | null;
  /** Chips hero put in, after any uncalled bet was returned. */
  heroInvested: number;
  heroCollected: number;
  heroNetChips: number;
  heroNetBb: number;
  /** Hero collected chips from the pot (also true for a split pot). */
  heroWon: boolean;
  /** Two or more players were still in at the end. */
  wentToShowdown: boolean;
  /** Hero called, bet or raised on some street, or showed down (derive.ts). */
  heroInvolved: boolean;
  /** heroInvested in big blinds: antes and blinds included, uncalled bets returned. */
  heroInvestedBb: number;
  heroAllIn: boolean;
  /** Last street that was dealt. */
  lastStreet: Street;
}

/** A hand that could not be parsed — reported, never fatal to the import. */
export interface ParseFailure {
  /** Hand ID when the header line was readable. */
  handId: string | null;
  error: string;
  rawText: string;
  fileName?: string;
}

export type ParseResult =
  | { ok: true; hand: ParsedHand; rawText: string }
  | { ok: false; failure: ParseFailure };
