/**
 * Tournament summary — database access (supabase_hand_history_summary.sql).
 *
 * The summary is computed once (compute.ts) and stored on hh_tournaments;
 * later visits only read it. `ensureSummary` recomputes when the stored one
 * is missing, from an older version, or from before more hands were added.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshPreflopChecks } from "../api";
import { refreshFlopChecks } from "../flopCheckApi";
import { dbErrorMessage } from "../importer";
import { SUMMARY_CONFIG } from "./config";
import { computeSummary, isSummaryCurrent, type SummarySourceRow, type TournamentSummary } from "./compute";

export interface SummaryTournament {
  id: string;
  site: string;
  tournament_id: string;
  name: string | null;
  hand_count: number;
  first_hand_at: string | null;
  last_hand_at: string | null;
  score: number | null;
  summary: TournamentSummary | null;
}

export interface PreviousScore {
  score: number;
  name: string | null;
  last_hand_at: string | null;
}

export interface ScoreHistoryRow {
  id: string;
  name: string | null;
  score: number;
  last_hand_at: string | null;
}

const TOURNAMENT_COLUMNS = "id, site, tournament_id, name, hand_count, first_hand_at, last_hand_at, score, summary";
const SOURCE_COLUMNS = "id, played_at, hero_cards, hero_position, pot_bb, hero_involved, preflop_check, preflop_detail, flop_check, flop_detail";
/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000;

export async function getSummaryTournament(supabase: SupabaseClient, id: string): Promise<SummaryTournament | null> {
  const { data, error } = await supabase.from("hh_tournaments").select(TOURNAMENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(dbErrorMessage(error));
  return data as SummaryTournament | null;
}

/** The hh_tournaments id of an uploaded tournament (the importer only knows site + tournament id). */
export async function findTournamentId(supabase: SupabaseClient, site: string, tournamentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("hh_tournaments")
    .select("id")
    .eq("site", site)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (error) throw new Error(dbErrorMessage(error));
  return (data as { id: string } | null)?.id ?? null;
}

export async function fetchSummaryRows(supabase: SupabaseClient, site: string, tournamentId: string): Promise<SummarySourceRow[]> {
  const rows: SummarySourceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("hh_hands")
      .select(SOURCE_COLUMNS)
      .eq("site", site)
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(dbErrorMessage(error));
    const page = (data ?? []) as unknown as SummarySourceRow[];
    rows.push(...page.map((r) => ({ ...r, pot_bb: Number(r.pot_bb) })));
    if (page.length < PAGE) return rows;
  }
}

export async function saveSummary(supabase: SupabaseClient, id: string, summary: TournamentSummary): Promise<void> {
  const { error } = await supabase.rpc("hh_set_tournament_summary", {
    p_id: id,
    p_score: summary.score,
    p_summary: summary,
    p_version: summary.version,
  });
  if (error) throw new Error(dbErrorMessage(error));
}

export async function previousScore(supabase: SupabaseClient, id: string): Promise<PreviousScore | null> {
  const { data, error } = await supabase.rpc("hh_previous_tournament_score", { p_id: id });
  if (error) throw new Error(dbErrorMessage(error));
  const row = ((data ?? []) as PreviousScore[])[0];
  return row ? { ...row, score: Number(row.score) } : null;
}

/** Scored tournaments, newest first. RLS limits Free accounts to their latest one. */
export async function scoreHistory(supabase: SupabaseClient): Promise<ScoreHistoryRow[]> {
  const { data, error } = await supabase
    .from("hh_tournaments")
    .select("id, name, score, last_hand_at")
    .not("score", "is", null)
    .order("last_hand_at", { ascending: false, nullsFirst: false })
    .limit(SUMMARY_CONFIG.historyLength);
  if (error) throw new Error(dbErrorMessage(error));
  return (data ?? []) as ScoreHistoryRow[];
}

export type SummaryStage = "preflop" | "flop" | "saving";

/**
 * The stored summary when it is current; otherwise brings the checks up to
 * date, computes, stores and returns it. `onPreliminary` gets a summary from
 * the preflop checks alone, so the page has numbers while the flop is graded.
 */
export async function ensureSummary(
  supabase: SupabaseClient,
  t: SummaryTournament,
  token: string | null,
  cb: { onStage?: (s: SummaryStage, done?: number) => void; onPreliminary?: (s: TournamentSummary) => void } = {},
): Promise<TournamentSummary> {
  if (isSummaryCurrent(t.summary, t.hand_count)) return t.summary!;

  cb.onStage?.("preflop");
  await refreshPreflopChecks(supabase);
  let rows = await fetchSummaryRows(supabase, t.site, t.tournament_id);
  cb.onPreliminary?.(computeSummary(rows));

  // Without a token Hero's flop hand can't be graded: show the preflop-only
  // summary but don't store it, so a signed-in visit completes it.
  if (!token) return computeSummary(rows);
  cb.onStage?.("flop", 0);
  const changed = await refreshFlopChecks(supabase, token, (n) => cb.onStage?.("flop", n), { site: t.site, tournamentId: t.tournament_id });
  if (changed) rows = await fetchSummaryRows(supabase, t.site, t.tournament_id);

  const summary = computeSummary(rows);
  // Compared with hh_tournaments.hand_count (kept by a trigger) on the next visit.
  summary.handCount = t.hand_count;
  cb.onStage?.("saving");
  await saveSummary(supabase, t.id, summary);
  return summary;
}
