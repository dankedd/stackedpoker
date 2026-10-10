/**
 * Data access for the hand history pages (browser client, RLS-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, applyFilters, keysetAfter, reverseOrder, sortColumns, type HandQueryState } from "./filters";
import { dbErrorMessage } from "./importer";
import { parserFor } from "./parsers";
import { PREFLOP_CHECK_VERSION, type PreflopVerdict } from "./preflop";
import { LIST_COLUMNS, preflopColumns, type HandDetailRow, type HandListRow } from "./rows";

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
  in(column: string, values: readonly unknown[]): HandQuery;
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

/** Number of starred hands (ignores filters). */
export async function countFavorites(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from("hh_hands").select("id", { count: "exact", head: true }).eq("is_favorite", true);
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

// ── Favourites ──────────────────────────────────────────────────────────────

/** Stars or unstars a hand; returns the new favorited_at (null when unstarred). */
export async function setFavorite(supabase: SupabaseClient, handRef: string, favorite: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc("hh_set_favorite", { p_id: handRef, p_favorite: favorite });
  if (error) throw new Error(dbErrorMessage(error));
  return (data as string | null) ?? null;
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

// ── Preflop check ───────────────────────────────────────────────────────────

const RECHECK_BATCH = 100;

/**
 * Re-checks every hand whose stored preflop_version differs from the app's —
 * hands imported before the check existed, and all hands after the trainer's
 * ranges change. Re-parses the stored raw text, so a parser fix is picked up
 * too. Returns the number of hands updated.
 */
export async function refreshPreflopChecks(
  supabase: SupabaseClient,
  onProgress?: (done: number) => void,
): Promise<number> {
  let done = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("hh_hands")
      .select("id, raw_text")
      .or(`preflop_version.is.null,preflop_version.neq.${PREFLOP_CHECK_VERSION}`)
      .limit(RECHECK_BATCH);
    if (error) throw new Error(dbErrorMessage(error));
    const rows = (data ?? []) as { id: string; raw_text: string }[];
    if (!rows.length) return done;

    const updates = rows.map((r) => {
      const parser = parserFor(r.raw_text);
      const parsed = parser?.parseHand(r.raw_text);
      // A hand that no longer parses still gets the version, or it would be retried forever.
      const cols = parsed?.ok
        ? preflopColumns(parsed.hand)
        : { preflop_check: null, preflop_position: null, preflop_detail: null, preflop_version: PREFLOP_CHECK_VERSION };
      return { id: r.id, ...cols };
    });
    const { error: rpcError } = await supabase.rpc("hh_set_preflop_checks", { p_rows: updates });
    if (rpcError) throw new Error(dbErrorMessage(rpcError));
    done += rows.length;
    onProgress?.(done);
  }
}

export interface PreflopSummaryRow {
  preflop_check: PreflopVerdict;
  preflop_position: string | null;
  n: number;
}

export async function preflopSummary(supabase: SupabaseClient): Promise<PreflopSummaryRow[]> {
  const { data, error } = await supabase.rpc("hh_preflop_summary");
  if (error) throw new Error(dbErrorMessage(error));
  return ((data ?? []) as PreflopSummaryRow[]).map((r) => ({ ...r, n: Number(r.n) }));
}
