/**
 * Daily hand count for signed-out Preflop Trainer visitors.
 *
 * Guests have no account, so this can only live in the browser: it is a
 * nudge to create a (free) account at hand 50, not a security boundary.
 * Signed-in limits are enforced by the server (consume_usage in
 * supabase_subscriptions.sql).
 *
 * The day is the Europe/Amsterdam calendar day, like the server's.
 */

const KEY = "sp_guest_daily_hands";
const ZONE = "Europe/Amsterdam";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-13" — the Amsterdam calendar day of `ms`. */
export function amsterdamDay(ms: number): string {
  return dayFmt.format(new Date(ms));
}

/**
 * The next 00:00 in Amsterdam after `now`, as epoch ms. Searches by the hour
 * then the minute so the 23- and 25-hour DST days come out right without a
 * timezone library.
 */
export function nextAmsterdamMidnight(now: number): number {
  const today = amsterdamDay(now);
  const HOUR = 3_600_000;
  const MIN = 60_000;
  let t = now;
  while (amsterdamDay(t + HOUR) === today) t += HOUR;
  while (amsterdamDay(t + MIN) === today) t += MIN;
  // t is in the last minute of the day; midnight is the next whole minute.
  return Math.floor((t + MIN) / MIN) * MIN;
}

interface Stored {
  day: string;
  count: number;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    return typeof v?.day === "string" && typeof v?.count === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Hands answered today; 0 on a new Amsterdam day or when storage is blocked. */
export function guestHandsToday(now = Date.now()): number {
  const v = read();
  return v && v.day === amsterdamDay(now) ? v.count : 0;
}

/** Counts one hand and returns today's total (0 when storage is blocked). */
export function recordGuestDailyHand(now = Date.now()): number {
  const day = amsterdamDay(now);
  const v = read();
  const count = (v && v.day === day ? v.count : 0) + 1;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ day, count }));
    return count;
  } catch {
    return 0;
  }
}
