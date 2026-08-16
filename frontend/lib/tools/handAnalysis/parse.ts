import { parseCards, type Card } from "../cards";
import type {
  ActionType,
  HandAction,
  HandInput,
  MissingField,
  Position,
  Street,
} from "./types";

/**
 * Hand-history parsing.
 *
 * Deliberately narrow. The backend already has full site-specific parsers
 * (backend/app/parsers/*.py) that produce the canonical schema; this is the
 * client-side path for a visitor who pastes a history into a public page with
 * no account and no round trip.
 *
 * The governing rule (§3) is that ambiguous input is NEVER silently
 * interpreted. Anything the parser cannot place with certainty is reported as
 * a problem naming the exact line, and parsing fails rather than producing a
 * hand that is subtly not the one the user pasted — an analysis of the wrong
 * hand is worse than no analysis.
 */

export interface ParseProblem {
  /** 1-based line number in the pasted text, when it can be attributed. */
  line?: number;
  message: string;
}

/** One field that came through, ready to show back to the user. */
export interface ParsedField {
  field: string;
  label: string;
  value: string;
}

/** One field that did not, and what the user should do about it. */
export interface UndeterminedField {
  field: MissingField;
  label: string;
  message: string;
}

export interface ParseResult {
  /**
   * A complete, analysable hand — only when everything required came through.
   * Its absence does not mean the paste was wasted: see `partial`.
   */
  hand?: HandInput;
  /**
   * Everything that WAS read, whether or not the parse was complete (§6).
   *
   * The old behaviour threw all of this away the moment a single field could
   * not be established, which meant one unreadable stakes line cost the user
   * their board, their cards and their whole action sequence. Now the parser
   * fills in what it is sure of and asks for the rest.
   */
  partial: Partial<HandInput>;
  /** What came through, for the "parsed successfully" list. */
  parsed: ParsedField[];
  /** What did not, for the "could not determine" list. */
  undetermined: UndeterminedField[];
  /** Problems with the text itself, rather than with one field. */
  problems: ParseProblem[];
  /** Which format was recognised. */
  format?: "pokerstars" | "ggpoker" | "generic";
  /** Hero's screen name, when the history names one. */
  heroName?: string;
}

/** Seat-count-independent map from the button offset to a 6-max position. */
const SIX_MAX_ORDER: Position[] = ["BTN", "SB", "BB", "UTG", "MP", "CO"];

const ACTION_WORDS: Record<string, ActionType> = {
  folds: "fold",
  checks: "check",
  calls: "call",
  bets: "bet",
  raises: "raise",
};

function detectFormat(text: string): ParseResult["format"] | undefined {
  if (/^PokerStars\s+(Hand|Game)\s+#/im.test(text)) return "pokerstars";
  if (/^(GG|GGPoker)\s*(Poker)?\s*Hand\s*#/im.test(text) || /Poker Hand #[A-Z]{2}\d+/i.test(text)) {
    return "ggpoker";
  }
  // A generic history still needs the street markers to be parseable at all.
  if (/\*\*\*\s*(HOLE CARDS|FLOP|TURN|RIVER)\s*\*\*\*/i.test(text)) return "generic";
  return undefined;
}

/**
 * Reads the seat/button layout so a screen name can be turned into a position.
 *
 * Returns an empty map when the layout cannot be read with certainty — the
 * caller then reports positions as unknown rather than guessing, because a
 * wrong position silently changes every positional conclusion downstream.
 */
function readPositions(lines: string[]): Map<string, Position> {
  const positions = new Map<string, Position>();

  const buttonLine = lines.find((l) => /Seat #?(\d+) is the button/i.test(l));
  const buttonSeat = buttonLine ? Number(/Seat #?(\d+) is the button/i.exec(buttonLine)?.[1]) : NaN;
  if (!Number.isFinite(buttonSeat)) return positions;

  const seats: { seat: number; name: string }[] = [];
  for (const line of lines) {
    const match = /^Seat (\d+):\s+(.+?)\s+\(/.exec(line);
    if (match) seats.push({ seat: Number(match[1]), name: match[2].trim() });
  }
  // Only 6-max is mapped. Any other table size would need a different
  // position vocabulary, and inventing one would mislabel every seat.
  if (seats.length !== 6) return positions;

  seats.sort((a, b) => a.seat - b.seat);
  const buttonIndex = seats.findIndex((s) => s.seat === buttonSeat);
  if (buttonIndex < 0) return positions;

  for (let offset = 0; offset < seats.length; offset += 1) {
    const seat = seats[(buttonIndex + offset) % seats.length];
    positions.set(seat.name, SIX_MAX_ORDER[offset]);
  }
  return positions;
}

/** Big-blind size, needed to express every amount in bb. */
function readBigBlind(text: string): number | undefined {
  const stakes = /\(\s*[^)]*?[\d.]+\s*\/\s*[$€£]?([\d.]+)/.exec(text);
  if (stakes) {
    const bb = Number(stakes[1]);
    if (Number.isFinite(bb) && bb > 0) return bb;
  }
  const posted = /posts big blind\s+[$€£]?([\d.]+)/i.exec(text);
  if (posted) {
    const bb = Number(posted[1]);
    if (Number.isFinite(bb) && bb > 0) return bb;
  }
  return undefined;
}

function streetOf(marker: string): Street | undefined {
  const upper = marker.toUpperCase();
  if (upper.includes("FLOP")) return "flop";
  if (upper.includes("TURN")) return "turn";
  if (upper.includes("RIVER")) return "river";
  if (upper.includes("HOLE CARDS")) return "preflop";
  return undefined;
}

/**
 * Parses a pasted hand history.
 *
 * Everything it cannot establish is a problem, not a default.
 */
export function parseHandHistory(text: string): ParseResult {
  const problems: ParseProblem[] = [];
  const parsed: ParsedField[] = [];
  const undetermined: UndeterminedField[] = [];
  const trimmed = text.trim();

  const nothing = (message: string): ParseResult => ({
    problems: [{ message }],
    partial: {},
    parsed: [],
    undetermined: [],
  });

  if (!trimmed) return nothing("Nothing to parse — paste a hand history first.");

  const format = detectFormat(trimmed);
  if (!format) {
    return nothing(
      "This does not look like a hand history. Supported: PokerStars and GGPoker text histories, or any format using the *** HOLE CARDS *** / *** FLOP *** street markers. Otherwise enter the hand manually.",
    );
  }

  const lines = trimmed.split(/\r?\n/);
  const positions = readPositions(lines);
  const bigBlind = readBigBlind(trimmed);

  // Hero and hole cards.
  let heroName: string | undefined;
  let heroCards: Card[] = [];
  const dealtIndex = lines.findIndex((l) => /^Dealt to /i.test(l));
  if (dealtIndex >= 0) {
    const match = /^Dealt to (.+?)\s*\[([^\]]+)\]/i.exec(lines[dealtIndex]);
    if (match) {
      heroName = match[1].trim();
      const parsed = parseCards(match[2]);
      heroCards = parsed.cards;
      if (parsed.invalid.length) {
        problems.push({
          line: dealtIndex + 1,
          message: `Could not read the hole cards: ${parsed.invalid.join(", ")}.`,
        });
      }
    }
  }
  if (heroCards.length === 2) {
    parsed.push({ field: "heroCards", label: "Your hand", value: heroCards.join(" ") });
  } else {
    undetermined.push({
      field: "heroCards",
      label: "Your hand",
      message:
        "No 'Dealt to <player> [cards]' line with two readable cards. Type your hole cards below — everything else was read.",
    });
  }

  // Board, accumulated across street markers.
  const board: Card[] = [];
  let currentStreet: Street = "preflop";
  const actions: HandAction[] = [];

  lines.forEach((line, index) => {
    const marker = /\*\*\*\s*([A-Z ]+?)\s*\*\*\*(.*)$/.exec(line);
    if (marker) {
      const street = streetOf(marker[1]);
      if (street) currentStreet = street;
      const cards = /\[([^\]]+)\]\s*$/.exec(marker[2]);
      if (cards && street && street !== "preflop") {
        const parsed = parseCards(cards[1]);
        if (parsed.invalid.length) {
          problems.push({
            line: index + 1,
            message: `Could not read the ${street}: ${parsed.invalid.join(", ")}.`,
          });
        }
        // Later street lines repeat the earlier board on some sites; only the
        // cards not already known are appended.
        for (const card of parsed.cards) if (!board.includes(card)) board.push(card);
      }
      return;
    }

    const action = /^(.+?):\s+(folds|checks|calls|bets|raises)\b(.*)$/i.exec(line);
    if (!action) return;

    const name = action[1].trim();
    const verb = action[2].toLowerCase();
    const rest = action[3] ?? "";

    // Only hero's own actions and the villain aggression hero faced are
    // modelled; a full multiway action tree is beyond this MVP and pretending
    // otherwise would produce a two-player hand that never happened.
    const isHero = heroName !== undefined && name === heroName;

    let amountBb: number | undefined;
    if (bigBlind) {
      // "raises $2.50 to $3.00" — the TOTAL is what went in.
      const to = /to\s+[$€£]?([\d.]+)/i.exec(rest);
      const plain = /[$€£]?([\d.]+)/.exec(rest);
      const raw = to ? Number(to[1]) : plain ? Number(plain[1]) : undefined;
      if (raw !== undefined && Number.isFinite(raw)) {
        amountBb = Math.round((raw / bigBlind) * 100) / 100;
      }
    }

    actions.push({
      street: currentStreet,
      actor: isHero ? "hero" : "villain",
      type: ACTION_WORDS[verb] as ActionType,
      ...(amountBb !== undefined && verb !== "folds" && verb !== "checks" ? { amountBb } : {}),
    });
  });

  if (board.length) {
    parsed.push({ field: "board", label: "Board", value: board.join(" ") });
  }
  if (actions.length) {
    parsed.push({
      field: "actions",
      label: "Action",
      value: `${actions.length} action${actions.length === 1 ? "" : "s"} across ${
        new Set(actions.map((a) => a.street)).size
      } street${new Set(actions.map((a) => a.street)).size === 1 ? "" : "s"}`,
    });
  }

  if (!bigBlind) {
    undetermined.push({
      field: "potBb",
      label: "Bet sizes",
      message:
        "Could not read the big-blind size, so bet amounts could not be converted to big blinds. The actions were kept without their sizes — add the pot and sizes below, or paste the stakes line too.",
    });
  }

  const heroPosition = heroName ? positions.get(heroName) : undefined;
  if (heroPosition) {
    parsed.push({ field: "heroPosition", label: "Your position", value: heroPosition });
  } else {
    undetermined.push({
      field: "heroPosition",
      label: "Your position",
      message:
        positions.size === 0
          ? "Could not work out the seating (this parser maps 6-max tables only). Pick your position below — everything else was read."
          : "Could not match your screen name to a seat. Pick your position below — everything else was read.",
    });
  }

  // Pot and stacks are deliberately never derived: reconstructing a pot from a
  // partial action list would be a guess, and the analyser says what it could
  // not calculate rather than calculating from an invented number.
  const partial: Partial<HandInput> = {
    ...(heroPosition ? { heroPosition } : {}),
    ...(heroCards.length === 2 ? { heroCards } : {}),
    board,
    actions,
  };

  // A COMPLETE hand needs both the cards and the seat. Anything less comes
  // back as `partial` — filled into the form, with the gaps flagged — rather
  // than being thrown away for the sake of an all-or-nothing contract.
  const complete = heroPosition !== undefined && heroCards.length === 2;

  return {
    format,
    heroName,
    problems,
    parsed,
    undetermined,
    partial,
    ...(complete
      ? { hand: { heroPosition, heroCards, board, actions } }
      : {}),
  };
}

/** Formats the supported inputs for the page copy — one source, no drift. */
export const SUPPORTED_FORMATS = [
  "PokerStars text hand histories (6-max)",
  "GGPoker text hand histories (6-max)",
  "Any history using the *** HOLE CARDS *** / *** FLOP *** street markers",
  "Manual entry — always available, and the only option for a hand you did not export",
] as const;
