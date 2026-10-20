/**
 * Feature flag for the hand history section (/hands).
 *
 * ON unless NEXT_PUBLIC_FEATURE_HAND_HISTORY === "false" — a kill switch.
 * While off there is no header item and every route under /hands 404s.
 * Read at build time, so changing it needs a redeploy. Needs
 * supabase_hand_history.sql to have been run in the Supabase SQL editor.
 */
export const HAND_HISTORY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_HAND_HISTORY !== "false";

export const HANDS_PATH = "/hands";
export const HANDS_IMPORT_PATH = "/hands/import";
/** Enter a hand by hand; the list of manual hands is HANDS_PATH + "?manual=1". */
export const HANDS_MANUAL_PATH = "/hands/manual";
export const HANDS_MANUAL_LIST = `${HANDS_PATH}?manual=1`;
