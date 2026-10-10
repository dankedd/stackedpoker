/**
 * ParsedHand ⇄ database row (supabase_hand_history.sql). The only place that
 * knows column names, so a schema change touches one file.
 */

import { deriveHand } from "./derive";
import type { HandParser } from "./parsers";
import type { ParsedHand } from "./types";

export interface HandInsertRow {
  user_id: string;
  site: string;
  hand_id: string;
  tournament_id: string | null;
  import_id: string | null;
  played_at: string;
  level: number | null;
  small_blind: number;
  big_blind: number;
  ante: number;
  table_name: string;
  max_seats: number;
  button_seat: number;
  player_count: number;
  hero_position: string | null;
  hero_cards: string[] | null;
  board: string[];
  last_street: string;
  pot_chips: number;
  pot_bb: number;
  hero_net_chips: number;
  hero_net_bb: number;
  hero_won: boolean;
  went_to_showdown: boolean;
  hero_all_in: boolean;
  data: ParsedHand;
  raw_text: string;
  parser: string;
  parser_version: number;
}

export function boardCards(hand: ParsedHand): string[] {
  return [...hand.board.flop, ...(hand.board.turn ? [hand.board.turn] : []), ...(hand.board.river ? [hand.board.river] : [])];
}

export function toInsertRow(
  hand: ParsedHand,
  rawText: string,
  ctx: { userId: string; importId: string | null; parser: Pick<HandParser, "id" | "version"> },
): HandInsertRow {
  const d = deriveHand(hand);
  return {
    user_id: ctx.userId,
    site: hand.site,
    hand_id: hand.handId,
    tournament_id: hand.tournamentId,
    import_id: ctx.importId,
    played_at: hand.playedAt,
    level: hand.level,
    small_blind: hand.smallBlind,
    big_blind: hand.bigBlind,
    ante: hand.ante,
    table_name: hand.tableName,
    max_seats: hand.maxSeats,
    button_seat: hand.buttonSeat,
    player_count: hand.players.length,
    hero_position: d.heroPosition,
    hero_cards: hand.heroCards,
    board: boardCards(hand),
    last_street: d.lastStreet,
    pot_chips: hand.totalPot,
    pot_bb: d.potBb,
    hero_net_chips: d.heroNetChips,
    hero_net_bb: d.heroNetBb,
    hero_won: d.heroWon,
    went_to_showdown: d.wentToShowdown,
    hero_all_in: d.heroAllIn,
    data: hand,
    raw_text: rawText,
    parser: ctx.parser.id,
    parser_version: ctx.parser.version,
  };
}

/** Columns the overview list needs — never `data` or `raw_text`. */
export const LIST_COLUMNS =
  "id, hand_id, tournament_id, played_at, level, big_blind, hero_position, hero_cards, board, pot_bb, hero_net_bb, hero_won, hero_all_in, went_to_showdown, has_note, hh_tournaments(name)";

export interface HandListRow {
  id: string;
  hand_id: string;
  tournament_id: string | null;
  played_at: string;
  level: number | null;
  big_blind: number;
  hero_position: string | null;
  hero_cards: string[] | null;
  board: string[];
  pot_bb: number;
  hero_net_bb: number;
  hero_won: boolean;
  hero_all_in: boolean;
  went_to_showdown: boolean;
  has_note: boolean;
  hh_tournaments: { name: string | null } | null;
}

export interface HandDetailRow extends HandListRow {
  data: ParsedHand;
}
