/**
 * Which lifecycle email (if any) a user gets on today's run.
 *
 * The facts come from lifecycle_email_candidates() (supabase_retention.sql),
 * which already drops everyone excluded for good (test accounts, opted out,
 * unconfirmed, older than 15 days). This file only applies the timing rules,
 * so they can be unit-tested without a database:
 *
 *   day1  24–48 h after signup, nothing played today
 *   day3  from 48 h after signup (until day 7), nothing played for 2+ days
 *   day7  7–15 days after signup, nothing played for 2+ days — the last one
 *
 * Separately, trial_ending goes to anyone still on the reverse trial whose
 * trial ends within TRIAL_ENDING_MS (the daily cron makes that "about two
 * days before"), whatever their activity. It is not part of the day-1/3/7
 * flow: it ignores the 44 h gap and the "active again" stop.
 *
 * Each template is sent at most once (email_log's unique constraint is the
 * real guarantee), at least 44 h apart — the cron runs daily, so that is
 * "not on the next run" — and the flow stops for good once the user is
 * active after any email we sent.
 */

export type Template = "day1" | "day3" | "day7" | "trial_ending";

export const TEMPLATES: readonly Template[] = ["day1", "day3", "day7", "trial_ending"];

/** Every email_log template: the lifecycle flow plus one-time campaigns (lib/campaigns). */
export type EmailTemplate = Template | "promo_3m_50";

export interface Candidate {
  userId: string;
  email: string;
  name: string | null;
  signedUpAt: string;
  timezone: string;
  lastActiveAt: string | null;
  activeToday: boolean;
  streak: number;
  handsTotal: number;
  handsGood: number;
  handsSource: "log" | "estimate";
  weakestRef: string | null;
  weakestHands: number | null;
  weakestWrong: number | null;
  emailsSent: Partial<Record<Template, string>>;
  lastEmailAt: string | null;
  /** effective_plan(): free | trial | pro. */
  plan: string | null;
  trialEndsAt: string | null;
}

export type Decision = { template: Template; reason: string } | { template: null; reason: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const MIN_GAP_MS = 44 * HOUR;
export const INACTIVE_MS = 2 * DAY;
/** The first daily run with at most this much trial left sends trial_ending. */
export const TRIAL_ENDING_MS = 60 * HOUR;

const ms = (iso: string) => new Date(iso).getTime();

export function decide(c: Candidate, now: number, excluded: ReadonlySet<string> = new Set()): Decision {
  if (excluded.has(c.email.toLowerCase())) return { template: null, reason: "test account (LIFECYCLE_EXCLUDE_EMAILS)" };

  if (c.plan === "trial" && c.trialEndsAt && !c.emailsSent.trial_ending) {
    const left = ms(c.trialEndsAt) - now;
    if (left > 0 && left <= TRIAL_ENDING_MS) return { template: "trial_ending", reason: "trial ends within 60h" };
  }
  if (c.emailsSent.day7) return { template: null, reason: "flow finished (day7 sent)" };

  const lastActive = c.lastActiveAt ? ms(c.lastActiveAt) : null;
  const lastEmail = c.lastEmailAt ? ms(c.lastEmailAt) : null;
  if (lastEmail !== null && lastActive !== null && lastActive > lastEmail) {
    return { template: null, reason: "active again after the last email — flow stopped" };
  }
  if (lastEmail !== null && now - lastEmail < MIN_GAP_MS) return { template: null, reason: "emailed less than 44h ago" };

  const age = now - ms(c.signedUpAt);
  const inactiveFor = now - (lastActive ?? ms(c.signedUpAt));
  const inactive = inactiveFor >= INACTIVE_MS;

  if (age >= 15 * DAY) return { template: null, reason: "signed up more than 15 days ago" };
  if (age >= 7 * DAY) {
    return inactive ? { template: "day7", reason: "7+ days since signup, inactive 2+ days" } : { template: null, reason: "day 7+, but active in the last 2 days" };
  }
  if (age >= 2 * DAY) {
    if (c.emailsSent.day3) return { template: null, reason: "day3 already sent, waiting for day 7" };
    return inactive ? { template: "day3", reason: "2+ days since signup, inactive 2+ days" } : { template: null, reason: "day 2–7, but active in the last 2 days" };
  }
  if (age >= DAY) {
    if (c.emailsSent.day1) return { template: null, reason: "day1 already sent" };
    return c.activeToday ? { template: null, reason: "day 1, but already played today" } : { template: "day1", reason: "24–48h since signup, nothing played today" };
  }
  return { template: null, reason: "signed up less than 24h ago" };
}

/** Correct-or-mixed share in %, or null when there are too few hands to say. */
export function accuracyPct(c: Pick<Candidate, "handsTotal" | "handsGood">): number | null {
  if (c.handsTotal < 5) return null;
  return Math.round((Math.min(c.handsGood, c.handsTotal) / c.handsTotal) * 100);
}

/** Maps a row of lifecycle_email_candidates() to a Candidate. */
export function parseCandidate(r: Record<string, unknown>): Candidate {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const intOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const sentRaw = (r.emails_sent && typeof r.emails_sent === "object" ? r.emails_sent : {}) as Record<string, unknown>;
  const emailsSent: Partial<Record<Template, string>> = {};
  for (const t of TEMPLATES) {
    const v = str(sentRaw[t]);
    if (v) emailsSent[t] = v;
  }
  return {
    userId: String(r.user_id),
    email: String(r.email),
    name: str(r.name),
    signedUpAt: String(r.signed_up_at),
    timezone: str(r.timezone) ?? "Europe/Amsterdam",
    lastActiveAt: str(r.last_active_at),
    activeToday: r.active_today === true,
    streak: int(r.streak),
    handsTotal: int(r.hands_total),
    handsGood: int(r.hands_good),
    handsSource: r.hands_source === "log" ? "log" : "estimate",
    weakestRef: str(r.weakest_ref),
    weakestHands: intOrNull(r.weakest_hands),
    weakestWrong: intOrNull(r.weakest_wrong),
    emailsSent,
    lastEmailAt: str(r.last_email_at),
    plan: str(r.plan),
    trialEndsAt: str(r.trial_ends_at),
  };
}

/** First name only, so "Hi Sam," and not "Hi Sam Streak,". */
export function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length <= 40 ? first : null;
}
