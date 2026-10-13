import type { Verdict } from "./logic";

/**
 * Preflop Trainer progress for signed-out visitors, and the sign-up prompt
 * that offers to save it.
 *
 * Everything lives in localStorage so a refresh or a new tab keeps the count.
 * When storage is blocked (some private windows) every function is a no-op:
 * the trainer still works, nothing is counted and no prompt appears.
 *
 * The progress mirrors the server's trainer row for signed-in users
 * (trainer_highscores: hands_played, current streak, best_streak) plus the
 * per-spot right/wrong counts that only guests have. After sign-up or log-in
 * it is merged into the account by merge_guest_trainer_progress()
 * (supabase_guest_trainer_progress.sql) and cleared here.
 */

export const GUEST_HANDS_KEY = "sp_guest_hands";
export const GUEST_PROGRESS_KEY = "sp_guest_progress";
const PROMPT_KEY = "sp_guest_prompt";
const BANNER_CLOSED_KEY = "sp_guest_banner_closed";
const INTENT_KEY = "sp_signup_intent";

export interface SpotRecord {
  right: number;
  wrong: number;
}

export interface GuestProgress {
  v: 1;
  hands_played: number;
  /** Right = correct or mixed (a real part of the strategy), as in the trainer's score. */
  right: number;
  wrong: number;
  streak: number;
  best_streak: number;
  spots: Record<string, SpotRecord>;
}

export type PromptTrigger = "hand_5" | "hand_20";
export type SignupSource = "trainer_prompt_5" | "trainer_prompt_20" | "trainer_banner" | "trainer_limit";

export const PROMPT_AT: Record<PromptTrigger, number> = { hand_5: 5, hand_20: 20 };
export const SOURCE_FOR: Record<PromptTrigger | "banner", SignupSource> = {
  hand_5: "trainer_prompt_5",
  hand_20: "trainer_prompt_20",
  banner: "trainer_banner",
};

// ── Pure rules (unit-tested) ────────────────────────────────────────────────

export function emptyProgress(): GuestProgress {
  return { v: 1, hands_played: 0, right: 0, wrong: 0, streak: 0, best_streak: 0, spots: {} };
}

/** One answered hand, right or wrong. Same streak rule as the server: wrong resets, mixed keeps it. */
export function addHand(p: GuestProgress, spot: string, verdict: Verdict): GuestProgress {
  const right = verdict !== "wrong";
  const streak = right ? p.streak + 1 : 0;
  const s = p.spots[spot] ?? { right: 0, wrong: 0 };
  return {
    ...p,
    hands_played: p.hands_played + 1,
    right: p.right + (right ? 1 : 0),
    wrong: p.wrong + (right ? 0 : 1),
    streak,
    best_streak: Math.max(p.best_streak, streak),
    spots: { ...p.spots, [spot]: { right: s.right + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1) } },
  };
}

/** The modal due after this many hands, if it was not shown before. Hand 20 wins over a missed hand 5. */
export function promptDue(hands: number, seen: readonly PromptTrigger[]): PromptTrigger | null {
  if (hands >= PROMPT_AT.hand_20 && !seen.includes("hand_20")) return "hand_20";
  if (hands >= PROMPT_AT.hand_5 && !seen.includes("hand_5")) return "hand_5";
  return null;
}

/** The "not saved" banner: after the first modal was closed, unless closed this session. */
export function bannerVisible(seen: readonly PromptTrigger[], closedThisSession: boolean): boolean {
  return seen.length > 0 && !closedThisSession;
}

/** The spot answered wrong most often, if any hand was wrong. Ties go to the spot seen first. */
export function worstSpot(p: GuestProgress): string | null {
  let best: string | null = null;
  let max = 0;
  for (const [spot, r] of Object.entries(p.spots)) {
    if (r.wrong > max) {
      max = r.wrong;
      best = spot;
    }
  }
  return best;
}

function isProgress(x: unknown): x is GuestProgress {
  const p = x as GuestProgress;
  return (
    !!p &&
    p.v === 1 &&
    [p.hands_played, p.right, p.wrong, p.streak, p.best_streak].every((n) => Number.isInteger(n) && n >= 0) &&
    typeof p.spots === "object" &&
    p.spots !== null
  );
}

// ── Storage ─────────────────────────────────────────────────────────────────

function local(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("sp_storage_test", "1");
    s.removeItem("sp_storage_test");
    return s;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return typeof window !== "undefined" && local() !== null;
}

export function readProgress(): GuestProgress | null {
  try {
    const raw = local()?.getItem(GUEST_PROGRESS_KEY);
    const p = raw ? (JSON.parse(raw) as unknown) : null;
    return isProgress(p) ? p : null;
  } catch {
    return null;
  }
}

/** Records one answered hand; returns the new progress, or null when storage is blocked. */
export function recordGuestHand(spot: string, verdict: Verdict): GuestProgress | null {
  const s = local();
  if (!s) return null;
  const p = addHand(readProgress() ?? emptyProgress(), spot, verdict);
  try {
    s.setItem(GUEST_PROGRESS_KEY, JSON.stringify(p));
    s.setItem(GUEST_HANDS_KEY, String(p.hands_played));
  } catch {
    return null;
  }
  return p;
}

export function readSeenPrompts(): PromptTrigger[] {
  try {
    const v = JSON.parse(local()?.getItem(PROMPT_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((t): t is PromptTrigger => t === "hand_5" || t === "hand_20") : [];
  } catch {
    return [];
  }
}

export function markPromptSeen(t: PromptTrigger) {
  const seen = readSeenPrompts();
  // Hand 20 also covers hand 5, so a late first prompt is never followed by an older one.
  const next = t === "hand_20" ? ["hand_5", "hand_20"] : [...seen, t];
  try {
    local()?.setItem(PROMPT_KEY, JSON.stringify([...new Set(next)]));
  } catch {}
}

export function bannerClosedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(BANNER_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function closeBannerForSession() {
  try {
    window.sessionStorage.setItem(BANNER_CLOSED_KEY, "1");
  } catch {}
}

/** Everything a guest built up, once it is safely in the account. */
export function clearGuestProgress() {
  const s = local();
  if (!s) return;
  for (const k of [GUEST_PROGRESS_KEY, GUEST_HANDS_KEY, PROMPT_KEY, INTENT_KEY]) s.removeItem(k);
  try {
    window.sessionStorage.removeItem(BANNER_CLOSED_KEY);
  } catch {}
}

// ── Sign-up intent ──────────────────────────────────────────────────────────
//
// Set when a guest clicks sign up / log in from the prompt or banner. It
// survives the round trip through Google or the confirmation email (same
// browser), so the account can be credited to the prompt and the visitor sent
// back to the trainer setup they came from.

export interface SignupIntent {
  source: SignupSource;
  /** Path + query of the trainer page, always a same-site path. */
  return_to: string;
  at: number;
}

const INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The prompts plus the hand-50 limit screen (components/preflop-trainer/TrainerLimit.tsx). */
const KNOWN_SOURCES: readonly SignupSource[] = [...Object.values(SOURCE_FOR), "trainer_limit"];

/** Only same-site paths: "/x", never "//host" or "https://host". */
export function safeReturnPath(path: string | null | undefined): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : null;
}

export function rememberSignupIntent(source: SignupSource, returnTo: string) {
  const path = safeReturnPath(returnTo);
  if (!path) return;
  try {
    local()?.setItem(INTENT_KEY, JSON.stringify({ source, return_to: path, at: Date.now() } satisfies SignupIntent));
  } catch {}
}

export function readSignupIntent(now = Date.now()): SignupIntent | null {
  try {
    const v = JSON.parse(local()?.getItem(INTENT_KEY) ?? "null") as SignupIntent | null;
    if (!v || now - v.at > INTENT_MAX_AGE_MS || !safeReturnPath(v.return_to)) return null;
    if (!KNOWN_SOURCES.includes(v.source)) return null;
    return v;
  } catch {
    return null;
  }
}

// ── Merge into the account ──────────────────────────────────────────────────

export type MergeRpc = (
  fn: "merge_guest_trainer_progress",
  args: { p_progress: GuestProgress },
) => PromiseLike<{ error: { message: string } | null }>;

/**
 * Sends the guest's progress to the signed-in account and clears it locally,
 * but only after the server confirmed. "kept" means it failed and stays for
 * the next try; "nothing" means there was nothing to merge.
 */
export async function mergeGuestProgressIntoAccount(rpc: MergeRpc): Promise<"merged" | "kept" | "nothing"> {
  const progress = readProgress();
  if (!progress || progress.hands_played === 0) return "nothing";
  const { error } = await rpc("merge_guest_trainer_progress", { p_progress: progress });
  if (error) return "kept";
  clearGuestProgress();
  return "merged";
}

/** Signed out and auth finished loading: the only state in which guest counting and prompts run. */
export function isGuestVisitor(user: unknown, authLoading: boolean): boolean {
  return !authLoading && !user;
}
