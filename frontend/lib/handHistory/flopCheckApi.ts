/**
 * Data for the flop check: the precomputed flop row (public read on
 * flop_equity) and Hero's hand position (signed-in backend endpoint, every
 * plan), then lib/handHistory/flopCheck.ts grades. The result is stored on
 * the hand (hh_hands.flop_check / flop_detail, supabase_hand_history_flop.sql)
 * for the overview filter and the coach.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchHandPosition } from "@/lib/flopTrainer/api";
import { displayPos } from "@/lib/flopTrainer/logic";
import { matchFlop, type FlopMatchResult, type FlopSpotMatch } from "@/lib/flopTrainer/match";
import { FLOP_CHECK_VERSION, flopLine, gradeFlop, type FlopCheck, type FlopRowLite, type HandPositionLite } from "./flopCheck";
import { dbErrorMessage } from "./importer";
import { parserFor } from "./parsers";
import type { ParsedHand } from "./types";

const rowCache = new Map<string, Promise<FlopRowLite | null>>();

/** The precomputed flop row, or null when this spot hasn't been analysed (no row). */
export function fetchFlopRow(spotId: string, flop: string, supabase: SupabaseClient = createClient()): Promise<FlopRowLite | null> {
  const key = `${spotId}|${flop}`;
  let p = rowCache.get(key);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase
        .from("flop_equity")
        .select("equity_ip,equity_oop,buckets_ip,buckets_oop,nut_adv,texture")
        .eq("spot_id", spotId)
        .eq("flop", flop)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = data as FlopRowLite;
      return { ...r, equity_ip: Number(r.equity_ip), equity_oop: Number(r.equity_oop) };
    })();
    p.catch(() => rowCache.delete(key));
    rowCache.set(key, p);
  }
  return p;
}

export function spotNames(m: FlopSpotMatch): { ip: string; oop: string } {
  return { ip: displayPos(m.spot.ip), oop: displayPos(m.spot.oop) };
}

export interface FlopAnalysis {
  match: FlopMatchResult;
  row: FlopRowLite | null;
  hand: HandPositionLite | null;
  check: FlopCheck | null;
}

/** Match + data + grade for one hand. `token` is optional: signed out, Hero's hand isn't graded. */
export async function analyseFlop(hand: ParsedHand, token: string | null, supabase?: SupabaseClient): Promise<FlopAnalysis> {
  const match = matchFlop(hand);
  if (!match.ok) return { match, row: null, hand: null, check: null };
  const m = match.match;
  // Spots without precomputed flops show "coming soon": no query for a row that isn't there.
  const row = m.spot.precomputed ? await fetchFlopRow(m.spotId, m.flop, supabase).catch(() => null) : null;
  let pos: HandPositionLite | null = null;
  if (row && token && m.heroSide && m.heroHand) {
    pos = await fetchHandPosition(token, m.spotId, m.flop, m.heroHand, m.heroSide).catch(() => null);
  }
  const check = gradeFlop({ match: m, line: flopLine(hand, m), row, hand: pos, names: spotNames(m) });
  return { match, row, hand: pos, check };
}

/** Columns stored per hand. Hands without a matched spot get no verdict (null), just the version. */
export function flopColumns(a: FlopAnalysis) {
  const detail = a.match.ok && a.check
    ? { spot_id: a.match.match.spotId, flop: a.match.match.flop, hero_side: a.match.match.heroSide, ...a.check }
    : { reason: a.match.ok ? null : a.match.reason };
  return {
    flop_check: a.match.ok && a.check ? a.check.verdict : null,
    flop_detail: detail,
    flop_version: FLOP_CHECK_VERSION,
  };
}

const BATCH = 40;

/**
 * Re-checks hands whose stored flop check is from another version, has none
 * yet, or was "not analysed yet" (a spot loaded since gets graded). Only
 * hands with a flop. Needs a signed-in token for Hero's hand position.
 * `tournament` limits it to one tournament (the tournament summary).
 */
export async function refreshFlopChecks(
  supabase: SupabaseClient,
  token: string,
  onProgress?: (done: number) => void,
  tournament?: { site: string; tournamentId: string },
): Promise<number> {
  let done = 0;
  let after = "00000000-0000-0000-0000-000000000000";
  // Keyset paging by id: "not analysed yet" hands still match the filter after their update.
  for (;;) {
    let q = supabase.from("hh_hands").select("id, raw_text, source, data");
    if (tournament) q = q.eq("site", tournament.site).eq("tournament_id", tournament.tournamentId);
    const { data, error } = await q
      .neq("board", "{}")
      .or(`flop_version.is.null,flop_version.neq.${FLOP_CHECK_VERSION},flop_detail->>reason.eq.not_analysed`)
      .gt("id", after)
      .order("id", { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(dbErrorMessage(error));
    const rows = (data ?? []) as { id: string; raw_text: string; source?: string; data: ParsedHand }[];
    if (!rows.length) return done;
    after = rows[rows.length - 1].id;
    const updates = [];
    for (const r of rows) {
      const parsed = r.source === "manual" ? { ok: true as const, hand: r.data } : parserFor(r.raw_text)?.parseHand(r.raw_text);
      const hand = parsed && parsed.ok ? parsed.hand : null;
      const cols = hand ? flopColumns(await analyseFlop(hand, token, supabase)) : { flop_check: null, flop_detail: null, flop_version: FLOP_CHECK_VERSION };
      updates.push({ id: r.id, ...cols });
    }
    const { error: rpcError } = await supabase.rpc("hh_set_flop_checks", { p_rows: updates });
    if (rpcError) throw new Error(dbErrorMessage(rpcError));
    done += rows.length;
    onProgress?.(done);
  }
}
