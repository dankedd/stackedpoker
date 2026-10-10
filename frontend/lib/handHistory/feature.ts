/**
 * Feature flag for the hand history section (/hands).
 *
 * OFF unless NEXT_PUBLIC_FEATURE_HAND_HISTORY === "true". While off there is
 * no header item and every route under /hands 404s. Read at build time —
 * changing it needs a redeploy. Turn it on only after
 * supabase_hand_history.sql has been run in the Supabase SQL editor.
 */
export const HAND_HISTORY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_HAND_HISTORY === "true";

export const HANDS_PATH = "/hands";
export const HANDS_IMPORT_PATH = "/hands/import";
