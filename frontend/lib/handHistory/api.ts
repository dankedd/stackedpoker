/**
 * Data access for the hand history pages (browser client, RLS-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, applyFilters, keysetAfter, reverseOrder, sortColumns, type HandQueryState } from "./filters";
import { dbErrorMessage } from "./importer";
import { LIST_COLUMNS, type HandDetailRow, type HandListRow } from "./rows";

export interface TournamentRow {
  site: string;
  tournament_id: string;
  name: string | null;
  hand_count: number;
  first_hand_at: string | null;
  last_hand_at: string | null;
}

export interface HandNote {
  id: string;
  body: string;
  updated_at: string;
}

/**
 * The query-builder methods used here. supabase-js's own generics on a
 * select string this long make TypeScript give up ("excessively deep"), so
 * the builder is narrowed to this shape once, at creation.
 */
interface HandQuery extends PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null; count: number | null }> {
  gte(column: string, value: unknown): HandQuery;
  eq(column: string, value: unknown): HandQuery;
  or(filter: string): HandQuery;
  order(column: string, opts: { ascending: boolean }): HandQuery;
  range(from: number, to: number): HandQuery;
  limit(n: number): HandQuery;
}

function handsQuery(supabase: SupabaseClient, columns: string, opts?: { count: "exact" }): HandQuery {
  return supabase.from("hh_hands").select(columns, opts) as unknown as HandQuery;
}

function orderBy(q: HandQuery, cols: { column: string; ascending: boolean }[]): HandQuery {
  return cols.reduce((acc, c) => acc.order(c.column, { ascending: c.ascending }), q);
}

export async function listHands(supabase: SupabaseClient, s: HandQueryState): Promise<{ rows: HandListRow[]; count: number }> {
  const from = (s.page - 1) * PAGE_SIZE;
  const q = orderBy(applyFilters(handsQuery(supabase, LIST_COLUMNS, { count: "exact" }), s.filters), sortColumns(s.sort, s.dir));
  const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(dbErrorMessage(error));
  return { rows: (data ?? []) as unknown as HandListRow[], count: count ?? 0 };
}

export async function listTournaments(supabase: SupabaseClient): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from("hh_tournaments")
    .select("site, tournament_id, name, hand_count, first_hand_at, last_hand_at")
    .order("last_hand_at", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(dbErrorMessage(error));
  return (data ?? []) as TournamentRow[];
}

/** Total hands the user has imported (ignores filters). */
export async function countAllHands(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from("hh_hands").select("id", { count: "exact", head: true });
  if (error) throw new Error(dbErrorMessage(error));
  return count ?? 0;
}

export async function getHand(supabase: SupabaseClient, id: string): Promise<(HandDetailRow & { hero_net_chips: number; pot_chips: number }) | null> {
  const { data, error } = await supabase
    .from("hh_hands")
    .select(`${LIST_COLUMNS}, data, hero_net_chips, pot_chips`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(dbErrorMessage(error));
  return data as unknown as (HandDetailRow & { hero_net_chips: number; pot_chips: number }) | null;
}

/** Previous/next hand id within the filtered, sorted overview list. */
export async function neighbours(
  supabase: SupabaseClient,
  current: Record<string, unknown>,
  s: HandQueryState,
): Promise<{ prevId: string | null; nextId: string | null }> {
  const cols = sortColumns(s.sort, s.dir);
  const one = async (order: typeof cols) => {
    const q = orderBy(applyFilters(handsQuery(supabase, "id"), s.filters), order).or(keysetAfter(order, current));
    const { data, error } = await q.limit(1);
    if (error) throw new Error(dbErrorMessage(error));
    return (data?.[0] as { id: string } | undefined)?.id ?? null;
  };
  const [nextId, prevId] = await Promise.all([one(cols), one(reverseOrder(cols))]);
  return { prevId, nextId };
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function getNote(supabase: SupabaseClient, handRef: string): Promise<HandNote | null> {
  const { data, error } = await supabase
    .from("hh_hand_notes")
    .select("id, body, updated_at")
    .eq("hand_ref", handRef)
    .eq("street", "hand")
    .maybeSingle();
  if (error) throw new Error(dbErrorMessage(error));
  return data as HandNote | null;
}

/** Saves the whole-hand note; an empty body deletes it. */
export async function saveNote(supabase: SupabaseClient, userId: string, handRef: string, body: string): Promise<HandNote | null> {
  if (!body.trim()) {
    await deleteNote(supabase, handRef);
    return null;
  }
  const { data, error } = await supabase
    .from("hh_hand_notes")
    .upsert({ user_id: userId, hand_ref: handRef, street: "hand", body }, { onConflict: "hand_ref,street" })
    .select("id, body, updated_at")
    .single();
  if (error) throw new Error(dbErrorMessage(error));
  return data as HandNote;
}

export async function deleteNote(supabase: SupabaseClient, handRef: string): Promise<void> {
  const { error } = await supabase.from("hh_hand_notes").delete().eq("hand_ref", handRef).eq("street", "hand");
  if (error) throw new Error(dbErrorMessage(error));
}
