/**
 * Manual hand entry — saving.
 *
 * A manual hand goes into hh_hands through the same row mapping as an import
 * (rows.ts toInsertRow), with site/source "manual" (supabase_manual_hands.sql).
 * New hands are inserted; edits go through hh_update_manual_hand(), which only
 * accepts the user's own manual hands. Free for everyone, no limit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { saveNote, setFavorite } from "../api";
import { amountFormatter } from "../format";
import { dbErrorMessage } from "../importer";
import { toInsertRow } from "../rows";
import { buildTimeline, describeStep } from "../timeline";
import type { ParsedHand } from "../types";

export const MANUAL_PARSER = { id: "manual", version: 1 } as const;

/** The hand as readable lines; stored as raw_text (the "original text" view). */
export function manualRawText(hand: ParsedHand): string {
  const fmt = amountFormatter("chips", hand.bigBlind);
  const head = [
    `Manual hand${hand.tournamentName ? ` · ${hand.tournamentName}` : ""}${hand.format === "cash" ? " · Cash" : ""}`,
    `Blinds ${fmt(hand.smallBlind)}/${fmt(hand.bigBlind)}${hand.ante ? ` · ante ${fmt(hand.ante)}` : ""} · ${hand.players.length} players`,
    `Hero (${hand.players.find((p) => p.isHero)?.position ?? "?"}) ${hand.heroCards?.join(" ") ?? ""}`,
    "",
  ];
  return [...head, ...buildTimeline(hand).slice(1).map((s) => describeStep(s, fmt))].join("\n");
}

export interface SaveOptions {
  userId: string;
  /** Editing this saved hand (hh_hands id); new hand when null. */
  editId: string | null;
  note: string;
  starred: boolean;
}

/** Saves and returns the hand's id. Throws with a readable message. */
export async function saveManualHand(supabase: SupabaseClient, hand: ParsedHand, opts: SaveOptions): Promise<string> {
  if (hand.tournamentId) {
    const { error } = await supabase
      .from("hh_tournaments")
      .upsert([{ user_id: opts.userId, site: "manual", tournament_id: hand.tournamentId, name: hand.tournamentName }], {
        onConflict: "user_id,site,tournament_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(dbErrorMessage(error));
  }

  const row = { ...toInsertRow(hand, manualRawText(hand), { userId: opts.userId, importId: null, parser: MANUAL_PARSER }), source: "manual" };
  let id: string;
  if (opts.editId) {
    const { error } = await supabase.rpc("hh_update_manual_hand", { p_id: opts.editId, p_row: row });
    if (error) throw new Error(dbErrorMessage(error));
    id = opts.editId;
  } else {
    const { data, error } = await supabase.from("hh_hands").insert(row).select("id").single();
    if (error) throw new Error(dbErrorMessage(error));
    id = (data as { id: string }).id;
  }

  // The hand is saved; note and star are extras that may fail on their own.
  await saveNote(supabase, opts.userId, id, opts.note).catch(() => null);
  if (opts.starred || opts.editId) await setFavorite(supabase, id, opts.starred).catch(() => null);
  return id;
}

/** Usage log (manual entry vs uploads). Best effort. */
export async function logManualEvent(
  supabase: SupabaseClient,
  userId: string,
  kind: "started" | "saved" | "edited",
  gameType: "tournament" | "cash",
  streetsEntered: number | null,
): Promise<void> {
  await supabase.from("hh_manual_events").insert({ user_id: userId, kind, game_type: gameType, streets_entered: streetsEntered });
}

export async function deleteManualHand(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("hh_hands").delete().eq("id", id).eq("source", "manual");
  if (error) throw new Error(dbErrorMessage(error));
}
