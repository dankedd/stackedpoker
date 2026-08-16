import { createClient } from "@/lib/supabase/client";
import type { HandAction, HandAnalysis, HandInput, Position } from "./types";

/**
 * Saved hands (§12).
 *
 * Reuses the `hand_analyses` table that already exists in supabase_schema.sql
 * rather than adding a second one. That table was built for exactly this shape
 * — hero position, cards, board, actions, effective stack, plus jsonb columns
 * for the analysis output — and already carries the row-level-security policy
 * that limits every row to its owner. A new table would have duplicated both.
 *
 * Anonymous users never touch this path: the analyser works fully without an
 * account, and saving is the first thing that needs one.
 */

export interface SavedHandRow {
  id: string;
  analyzed_at: string;
  hero_position: string | null;
  hero_cards: string[] | null;
  board: string[] | null;
  actions: HandAction[] | null;
  effective_stack_bb: number | null;
  spot_classification: SavedSpot | null;
  findings: SavedFindings | null;
}

/**
 * The rest of the input, in the jsonb column the table already has.
 *
 * `hand_analyses` has dedicated columns for position, cards, board, actions and
 * stack, but none for the pot or for villain — so those ride here rather than
 * in a migration that would add two columns to a shipped table for one tool.
 * Everything needed to REBUILD the exact `HandInput` is therefore stored, which
 * is what makes reopening a saved hand a recomputation rather than a replay of
 * whatever prose was rendered last time (§9).
 */
export interface SavedSpot {
  street?: string;
  potBb?: number | null;
  villainPosition?: string | null;
  villainCards?: string[] | null;
  /** The reviewed range this analysis was conditioned on, if any (§14). */
  villainRangePresetId?: string | null;
  source: "hand_analyzer";
}

/**
 * What goes in the `findings` jsonb column.
 *
 * The conclusion and the concepts, not the prose: the analysis can be
 * recomputed from the stored hand at any time, so storing the rendered text
 * would only create something that could go stale against the engine.
 */
export interface SavedFindings {
  verdict: HandAnalysis["verdict"];
  confidence: HandAnalysis["confidence"];
  verdictBasis: string;
  conceptIds: string[];
  /** The lesson recommended at the time, so the row is a to-do as well as a record. */
  recommendedLessonPath?: string;
  /**
   * The range the verdict was conditioned on, if any.
   *
   * The verdict VALUE already encodes conditionality, so this is not what
   * makes the row honest — it is here so the saved list can say which chart,
   * without re-running the analysis to find out.
   */
  villainRangePresetId?: string;
  source: "hand_analyzer";
}

export interface SaveHandResult {
  ok: boolean;
  error?: string;
}

export async function saveAnalyzedHand(
  hand: HandInput,
  analysis: HandAnalysis,
  options: { rawHandText?: string; recommendedLessonPath?: string } = {},
): Promise<SaveHandResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need an account to save hands." };

  const findings: SavedFindings = {
    verdict: analysis.verdict,
    confidence: analysis.confidence,
    verdictBasis: analysis.verdictBasis,
    conceptIds: analysis.conceptIds,
    ...(options.recommendedLessonPath
      ? { recommendedLessonPath: options.recommendedLessonPath }
      : {}),
    ...(analysis.conditional ? { villainRangePresetId: analysis.conditional.presetId } : {}),
    source: "hand_analyzer",
  };

  const { error } = await supabase.from("hand_analyses").insert({
    user_id: user.id,
    // The table's CHECK allows 'text' | 'image'; a manually entered hand is
    // still text input, and `raw_hand_text` is null when nothing was pasted.
    input_type: "text",
    raw_hand_text: options.rawHandText ?? null,
    hero_position: hand.heroPosition,
    hero_cards: hand.heroCards,
    board: hand.board,
    actions: hand.actions,
    effective_stack_bb: hand.effectiveStackBb ?? null,
    board_texture:
      analysis.calculations.find((c) => c.id === "board-texture")?.value ?? null,
    spot_classification: {
      street: analysis.summary.street,
      potBb: hand.potBb ?? null,
      villainPosition: hand.villainPosition ?? null,
      villainCards: hand.villainCards ?? null,
      villainRangePresetId: hand.villainRangePresetId ?? null,
      source: "hand_analyzer",
    } satisfies SavedSpot,
    findings,
    mistakes_count: analysis.verdict === "unprofitable-by-the-maths" ? 1 : 0,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const ROW_COLUMNS =
  "id, analyzed_at, hero_position, hero_cards, board, actions, effective_stack_bb, spot_classification, findings";

/** The rows behind "My analysed hands". Newest first. */
export async function listAnalyzedHands(limit = 20): Promise<SavedHandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_analyses")
    .select(ROW_COLUMNS)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  // RLS already restricts this to the caller's own rows, so no user filter is
  // needed here — and adding one would imply the policy could not be trusted.
  if (error || !data) return [];
  return data as unknown as SavedHandRow[];
}

/** Removes a saved hand. RLS makes this a no-op on anyone else's row. */
export async function deleteAnalyzedHand(id: string): Promise<SaveHandResult> {
  const supabase = createClient();
  const { error } = await supabase.from("hand_analyses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Rebuilds the exact input that was analysed (§9).
 *
 * Returns null rather than a half-hand when the row predates this tool or was
 * written by another surface: the analyser would then re-analyse something the
 * user never entered, which is worse than declining to reopen it.
 */
export function handFromSavedRow(row: SavedHandRow): HandInput | null {
  if (!row.hero_position || !row.hero_cards || row.hero_cards.length !== 2) return null;
  const spot = row.spot_classification ?? undefined;

  return {
    heroPosition: row.hero_position as Position,
    heroCards: row.hero_cards,
    board: row.board ?? [],
    actions: row.actions ?? [],
    ...(spot?.villainPosition ? { villainPosition: spot.villainPosition as Position } : {}),
    ...(spot?.villainCards?.length === 2 ? { villainCards: spot.villainCards } : {}),
    ...(typeof spot?.potBb === "number" ? { potBb: spot.potBb } : {}),
    ...(spot?.villainRangePresetId ? { villainRangePresetId: spot.villainRangePresetId } : {}),
    ...(typeof row.effective_stack_bb === "number"
      ? { effectiveStackBb: row.effective_stack_bb }
      : {}),
  };
}

/** Free-text filter over the saved list — cards, position, board or verdict. */
export function filterSavedHands(rows: SavedHandRow[], query: string): SavedHandRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      ...(row.hero_cards ?? []),
      ...(row.board ?? []),
      row.hero_position ?? "",
      row.findings?.verdict ?? "",
      row.spot_classification?.street ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
