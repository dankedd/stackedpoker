/**
 * Display name copy (Settings). The rules themselves live in the database
 * (display_name_problem() in supabase_display_name.sql); this file only maps
 * its error codes to messages.
 */

export const DISPLAY_NAME = {
  label: "Display name",
  help: "Shown on the leaderboard instead of your email. Leave empty to appear as “Player” plus a short code.",
  placeholder: "e.g. RiverRat",
  save: "Save",
  saving: "Saving…",
  saved: "Display name saved",
  cleared: "Display name removed",
  errors: {
    length: "Use 3 to 20 characters.",
    characters: "Use letters, numbers, _ . or - only, starting with a letter or number.",
    reserved: "That name is reserved. Please pick another.",
    profanity: "That name isn't allowed. Please pick another.",
    email: "Don't use your email address as your name. It would be shown publicly.",
    taken: "That name is already taken.",
    generic: "Could not save. Please try again.",
  } as Record<string, string>,
};

/** Instant feedback before the round trip; the database has the final say. */
export function displayNameFormatError(name: string): string | null {
  const v = name.trim();
  if (!v) return null;
  if (v.length < 3 || v.length > 20) return DISPLAY_NAME.errors.length;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v)) return DISPLAY_NAME.errors.characters;
  return null;
}
