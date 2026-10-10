/**
 * Writes the stored hh_hands rows (data, raw_text, preflop check, replayer
 * analysis) for two hands of the real export to fixtures/coach-rows.json,
 * exactly as the app would store them — the input for the backend's
 * hand-review context tests (backend/tests/test_hand_coach.py). Skipped
 * without the (private, untracked) export.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPreflopTable, type PreflopTableData } from "@/lib/equity/preflopTable";
import { equityVsRange } from "@/lib/equity/rangeEquity";
import { buildAnalysis } from "../analysis";
import { parseGGHand } from "../parsers/ggpoker";
import { potOddsDecisions } from "../potOdds";
import { preflopColumns } from "../rows";
import { splitHands } from "../split";
import type { Street } from "../types";
import { findVillain, villainRange } from "../villain";
import { rangePct } from "@/components/hand-history/RangeEditor";

const DIR = join(__dirname, "fixtures");
const EXPORT = join(DIR, "GG20261008-1802 - Daily Special 10.txt");
const TABLE = join(__dirname, "..", "..", "..", "data", "equity", "preflop-matchups.json");

describe.skipIf(!existsSync(EXPORT))("coach rows for the backend tests", () => {
  it("writes the LJ 55 fold and the AhQd call as stored rows", () => {
    const table = buildPreflopTable(JSON.parse(readFileSync(TABLE, "utf8")) as PreflopTableData);
    const raws = splitHands(readFileSync(EXPORT, "utf8")).hands;
    const rows: Record<string, unknown> = {};
    for (const id of ["TM6510944780", "TM6510945691"]) {
      const raw = raws.find((r) => r.includes(`#${id}:`))!;
      const parsed = parseGGHand(raw);
      if (!parsed.ok) throw new Error(parsed.failure.error);
      const hand = parsed.hand;
      const pf = preflopColumns(hand);
      let analysis = null;
      const villain = findVillain(hand);
      const vr = villain ? villainRange(hand, villain) : null;
      if (vr && hand.heroCards) {
        const b = hand.board;
        const streets: { street: Street; board: string[] }[] = [{ street: "preflop", board: [] }];
        if (b.flop.length === 3) streets.push({ street: "flop", board: [...b.flop] });
        if (b.turn) streets.push({ street: "turn", board: [...b.flop, b.turn] });
        if (b.river) streets.push({ street: "river", board: [...b.flop, b.turn!, b.river] });
        const results = streets.map((s) => equityVsRange(hand.heroCards as [string, string], vr.range, s.board, table));
        analysis = buildAnalysis(hand, vr, rangePct(vr.range), streets, results, potOddsDecisions(hand));
      }
      rows[id] = { data: hand, raw_text: parsed.rawText, preflop_check: pf.preflop_check, preflop_detail: pf.preflop_detail, analysis, favorited_at: null };
    }
    expect((rows.TM6510944780 as { preflop_check: string }).preflop_check).toBe("too_tight");
    expect((rows.TM6510945691 as { analysis: { decisions: unknown[] } }).analysis.decisions).toHaveLength(1);
    writeFileSync(join(DIR, "coach-rows.json"), JSON.stringify(rows, null, 1));
  }, 60_000);
});
