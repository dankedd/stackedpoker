/**
 * Import pipeline: files → hand texts → ParsedHands → database.
 *
 * Reading and parsing are pure and run entirely in the browser (no upload of
 * the export, no external service). Saving goes straight to Supabase under
 * the user's own session, so RLS decides what may be written.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parserFor, type HandParser } from "./parsers";
import { toInsertRow } from "./rows";
import { splitHands } from "./split";
import type { ParseFailure, ParsedHand } from "./types";
import { ZipError, isZip, readZip } from "./zip";

export interface SourceText {
  fileName: string;
  text: string;
}

export interface FileError {
  fileName: string;
  error: string;
}

export interface ParsedEntry {
  hand: ParsedHand;
  rawText: string;
  parser: HandParser;
  fileName: string;
}

export interface ParseOutcome {
  entries: ParsedEntry[];
  failures: ParseFailure[];
  fileErrors: FileError[];
  /** Same hand ID seen twice within this upload. */
  duplicatesInUpload: number;
}

export interface ImportSummary {
  tournaments: number;
  imported: number;
  skipped: number;
  failures: ParseFailure[];
  fileErrors: FileError[];
  importId: string | null;
}

export type ImportPhase = "reading" | "parsing" | "saving" | "done";

export interface ImportProgress {
  phase: ImportPhase;
  done: number;
  total: number;
}

const BATCH_SIZE = 200;
const MAX_STORED_FAILURES = 200;
const MAX_STORED_RAW = 4000;

// ── Reading ─────────────────────────────────────────────────────────────────

/** Expands .zip files and reads .txt files. Anything else becomes a FileError. */
export async function readFiles(
  files: { name: string; arrayBuffer(): Promise<ArrayBuffer> }[],
  onProgress?: (p: ImportProgress) => void,
): Promise<{ texts: SourceText[]; fileErrors: FileError[] }> {
  const texts: SourceText[] = [];
  const fileErrors: FileError[] = [];
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.({ phase: "reading", done: i, total: files.length });
    const lower = f.name.toLowerCase();
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (lower.endsWith(".zip") || isZip(bytes)) {
        const entries = readZip(bytes).filter((e) => e.name.toLowerCase().endsWith(".txt") && !e.name.startsWith("__MACOSX/"));
        if (!entries.length) fileErrors.push({ fileName: f.name, error: "Dit zip-bestand bevat geen .txt-bestanden." });
        for (const e of entries) {
          try {
            texts.push({ fileName: `${f.name} › ${e.name.split("/").pop()}`, text: await e.text() });
          } catch (err) {
            fileErrors.push({ fileName: `${f.name} › ${e.name}`, error: messageOf(err, "Kon dit bestand in de zip niet uitpakken.") });
          }
        }
      } else if (lower.endsWith(".txt")) {
        texts.push({ fileName: f.name, text: decoder.decode(bytes) });
      } else {
        fileErrors.push({ fileName: f.name, error: "Bestandstype niet ondersteund. Upload .txt- of .zip-bestanden uit PokerCraft." });
      }
    } catch (err) {
      fileErrors.push({ fileName: f.name, error: messageOf(err, "Kon dit bestand niet lezen.") });
    }
  }
  onProgress?.({ phase: "reading", done: files.length, total: files.length });
  return { texts, fileErrors };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

export function parseTexts(texts: SourceText[]): ParseOutcome {
  const out: ParseOutcome = { entries: [], failures: [], fileErrors: [], duplicatesInUpload: 0 };
  const seen = new Set<string>();

  for (const { fileName, text } of texts) {
    const parser = parserFor(text);
    if (!parser) {
      out.fileErrors.push({ fileName, error: "Geen GGPoker-handen gevonden in dit bestand." });
      continue;
    }
    const { hands, leftover } = splitHands(text);
    if (leftover) {
      out.failures.push({ handId: null, error: "Tekst vóór de eerste hand is overgeslagen.", rawText: leftover, fileName });
    }
    for (const raw of hands) {
      let result;
      try {
        result = parser.parseHand(raw);
      } catch (err) {
        // Parsers should never throw; if one does, the import still goes on.
        result = { ok: false as const, failure: { handId: null, error: messageOf(err, "Onverwachte fout tijdens het parsen."), rawText: raw } };
      }
      if (!result.ok) {
        out.failures.push({ ...result.failure, fileName });
        continue;
      }
      const key = `${result.hand.site}:${result.hand.handId}`;
      if (seen.has(key)) {
        out.duplicatesInUpload++;
        continue;
      }
      seen.add(key);
      out.entries.push({ hand: result.hand, rawText: result.rawText, parser, fileName });
    }
  }
  // Oldest first: exports list the newest hand at the top.
  out.entries.sort((a, b) => a.hand.playedAt.localeCompare(b.hand.playedAt));
  return out;
}

// ── Saving ──────────────────────────────────────────────────────────────────

export async function saveHands(
  supabase: SupabaseClient,
  userId: string,
  fileNames: string[],
  parsed: ParseOutcome,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportSummary> {
  const failures = [...parsed.failures];
  const tournaments = new Map<string, { site: string; tournament_id: string; name: string | null }>();
  for (const { hand } of parsed.entries) {
    if (hand.tournamentId) {
      tournaments.set(`${hand.site}:${hand.tournamentId}`, { site: hand.site, tournament_id: hand.tournamentId, name: hand.tournamentName });
    }
  }

  const { data: importRow, error: importErr } = await supabase
    .from("hh_imports")
    .insert({ user_id: userId, file_names: fileNames.slice(0, 200) })
    .select("id")
    .single();
  if (importErr) throw new Error(dbErrorMessage(importErr));
  const importId = (importRow as { id: string }).id;

  if (tournaments.size) {
    const { error } = await supabase
      .from("hh_tournaments")
      .upsert([...tournaments.values()].map((t) => ({ ...t, user_id: userId })), {
        onConflict: "user_id,site,tournament_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(dbErrorMessage(error));
  }

  let imported = 0;
  let skipped = parsed.duplicatesInUpload;
  const total = parsed.entries.length;
  onProgress?.({ phase: "saving", done: 0, total });

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = parsed.entries.slice(i, i + BATCH_SIZE);
    const rows = batch.map((e) => toInsertRow(e.hand, e.rawText, { userId, importId, parser: e.parser }));
    let result = await insertBatch(supabase, rows);
    if (result.error) result = await insertBatch(supabase, rows); // one retry for a network blip
    if (result.error) {
      const msg = `Opslaan mislukt: ${dbErrorMessage(result.error)}`;
      for (const e of batch) failures.push({ handId: e.hand.handId, error: msg, rawText: e.rawText, fileName: e.fileName });
    } else {
      imported += result.inserted;
      skipped += batch.length - result.inserted;
    }
    onProgress?.({ phase: "saving", done: Math.min(i + BATCH_SIZE, total), total });
  }

  // The log is best-effort: the hands are already saved if this fails.
  await supabase
    .from("hh_imports")
    .update({
      tournaments_count: tournaments.size,
      hands_imported: imported,
      hands_skipped: skipped,
      hands_failed: failures.length,
      failures: failures.slice(0, MAX_STORED_FAILURES).map((f) => ({ ...f, rawText: f.rawText.slice(0, MAX_STORED_RAW) })),
      finished_at: new Date().toISOString(),
    })
    .eq("id", importId);

  onProgress?.({ phase: "done", done: total, total });
  return { tournaments: tournaments.size, imported, skipped, failures, fileErrors: parsed.fileErrors, importId };
}

async function insertBatch(supabase: SupabaseClient, rows: unknown[]) {
  // ON CONFLICT DO NOTHING + RETURNING: only rows actually inserted come back.
  const { data, error } = await supabase
    .from("hh_hands")
    .upsert(rows, { onConflict: "user_id,site,hand_id", ignoreDuplicates: true })
    .select("hand_id");
  return { inserted: data?.length ?? 0, error };
}

// ── Errors ──────────────────────────────────────────────────────────────────

export function dbErrorMessage(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return "Onbekende fout.";
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST200") {
    return "De database is nog niet ingericht voor handgeschiedenis (supabase_hand_history.sql is niet uitgevoerd).";
  }
  if (err.code === "42501") return "Geen toestemming. Log opnieuw in en probeer het nog eens.";
  if (/fetch|network|Failed to fetch/i.test(err.message ?? "")) return "Geen verbinding met de server. Controleer je internet en probeer het opnieuw.";
  return err.message ? `Databasefout: ${err.message}` : "Onbekende databasefout.";
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ZipError) return err.message;
  return fallback;
}
