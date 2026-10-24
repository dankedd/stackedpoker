/**
 * Signup attribution that survives every signup method.
 *
 * The first utm_* set a visitor arrives with is kept in a first-party cookie
 * (sp_utm, 30 days, set by middleware.ts on the landing request and by
 * captureUtm() in the browser). Email signups send it with signUp(); OAuth
 * signups (Google) can't carry signup data through the provider, so
 * app/auth/callback writes it into user_metadata.signup_utm for a brand-new
 * account. A visitor from a shared hand (utm_source=share) also gets
 * referred_by_share = the share's slug (utm_content).
 *
 * Pure functions only: used by the middleware, the callback and the browser.
 */

export const UTM_COOKIE = "sp_utm";
export const UTM_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Utm = Partial<Record<(typeof UTM_FIELDS)[number] | "landing_path" | "referred_by_share", string>>;

/** The utm_* set in a URL's query, or null when there is none. */
export function utmFromUrl(search: string | URLSearchParams, pathname: string): Utm | null {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const utm: Utm = {};
  for (const f of UTM_FIELDS) {
    const v = q.get(f);
    if (v) utm[f] = v.slice(0, 200);
  }
  if (!Object.keys(utm).length) return null;
  utm.landing_path = pathname.slice(0, 200);
  return withShareReferral(utm);
}

/** utm_source=share → referred_by_share = the share slug. */
export function withShareReferral(utm: Utm): Utm {
  if (utm.utm_source === "share" && utm.utm_content && !utm.referred_by_share) {
    return { ...utm, referred_by_share: utm.utm_content };
  }
  return utm;
}

/** For document.cookie. (Next.js response.cookies.set() encodes on its own: pass JSON.stringify(utm) there.) */
export function encodeUtmCookie(utm: Utm): string {
  return encodeURIComponent(JSON.stringify(utm));
}

/** Accepts the cookie value raw, URL-encoded once or twice (whichever path set or read it). */
export function decodeUtmCookie(raw: string | null | undefined): Utm | null {
  if (!raw) return null;
  let text = raw;
  for (let i = 0; i < 3 && !text.trimStart().startsWith("{"); i++) {
    try {
      text = decodeURIComponent(text);
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Utm = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && ([...UTM_FIELDS, "landing_path", "referred_by_share"] as string[]).includes(k)) {
        out[k as keyof Utm] = v.slice(0, 200);
      }
    }
    return Object.keys(out).length ? withShareReferral(out) : null;
  } catch {
    return null;
  }
}

/** A sign-in within this long after account creation is the signup itself. */
export const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

/**
 * The user_metadata to write after an OAuth sign-in, or null: only for a
 * brand-new account that has no signup_utm yet, and only when a UTM cookie
 * exists. Returns the FULL metadata (admin updates replace it).
 */
export function oauthSignupMetadata(
  user: { created_at?: string | null; user_metadata?: Record<string, unknown> | null },
  cookieUtm: Utm | null,
  now = Date.now(),
): Record<string, unknown> | null {
  if (!cookieUtm) return null;
  const meta = user.user_metadata ?? {};
  if (meta.signup_utm) return null;
  const created = user.created_at ? Date.parse(user.created_at) : NaN;
  if (!Number.isFinite(created) || now - created > NEW_ACCOUNT_WINDOW_MS) return null;
  return { ...meta, signup_utm: withShareReferral(cookieUtm) };
}
