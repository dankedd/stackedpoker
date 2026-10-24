/**
 * Meta Pixel: consent, event helper and UTM attribution.
 *
 * The pixel script itself is mounted by components/analytics/MetaPixel.tsx,
 * and only after the visitor accepted in the consent banner. Every call here
 * is a no-op without consent, so call sites never need a guard of their own.
 */

import { UTM_COOKIE, UTM_COOKIE_MAX_AGE, decodeUtmCookie, encodeUtmCookie, utmFromUrl, withShareReferral, type Utm as AttributionUtm } from "@/lib/attribution/utm";

export const META_PIXEL_ID = "1410902550592365";

// ── Consent ─────────────────────────────────────────────────────────────────

export type Consent = "granted" | "denied";

const CONSENT_KEY = "sp_consent";
/** Fired on window when the visitor makes or changes a choice. */
export const CONSENT_CHANGE_EVENT = "sp-consent-change";
/** Fired on window by "Cookie settings" to reopen the banner. */
export const CONSENT_OPEN_EVENT = "sp-consent-open";

export function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked: the choice still holds for this page view.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_CHANGE_EVENT, { detail: value }));
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

// ── Events ──────────────────────────────────────────────────────────────────

type Fbq = (...args: unknown[]) => void;
type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

// Events fired during hydration can land before the pixel's inline script has
// run. They wait here and MetaPixel flushes them once window.fbq exists.
const pending: ["track" | "trackCustom", string, Params | undefined][] = [];

function send(method: "track" | "trackCustom", event: string, params?: Params) {
  if (typeof window === "undefined" || readConsent() !== "granted") return;
  if (window.fbq) window.fbq(method, event, params);
  else pending.push([method, event, params]);
}

/** A Meta standard event (PageView, CompleteRegistration, ViewContent, Subscribe…). */
export function track(event: string, params?: Params) {
  send("track", event, params);
}

/** One of our own event names, e.g. SignupPromptShown. */
export function trackCustom(event: string, params?: Params) {
  send("trackCustom", event, params);
}

export function flushPending() {
  if (!window.fbq) return;
  for (const [method, event, params] of pending.splice(0)) window.fbq(method, event, params);
}

/** Pro, per month incl. VAT — the only paid plan (/pricing). */
export const PRO_VALUE_EUR = 7.99;

const CHECKOUT_KEY = "sp_checkout_source";

/** Remembers which upgrade moment sent the user to Stripe, for the Subscribe event on return. */
export function rememberCheckoutSource(source: string) {
  try {
    window.localStorage.setItem(CHECKOUT_KEY, source);
  } catch {}
}

/**
 * Subscribe, fired once on the Stripe success return (/dashboard?upgraded=1&source=…).
 * The source comes from the return URL (set by the server) or, failing that,
 * from what was remembered when checkout started.
 */
export function trackSubscribe(sourceFromUrl?: string | null) {
  let remembered: string | null = null;
  try {
    remembered = window.localStorage.getItem(CHECKOUT_KEY);
    window.localStorage.removeItem(CHECKOUT_KEY);
  } catch {}
  const source = sourceFromUrl || remembered || "unknown";
  track("Subscribe", { value: PRO_VALUE_EUR, currency: "EUR", content_name: "pro", source });
}

/** An upgrade prompt became visible (limit modal, trial banner, trial-ended screen). */
export function trackUpgradePromptShown(trigger: string) {
  trackCustom("UpgradePromptShown", { trigger });
}

// ── UTM attribution ─────────────────────────────────────────────────────────
// lib/attribution/utm.ts is the one implementation (also used by the
// middleware and the OAuth callback). The session copy is what the email
// signup form reads; the sp_utm cookie survives a Google signup round trip.

const UTM_KEY = "sp_utm";

export type Utm = AttributionUtm;

/** Keeps the first utm_* set of the session (sessionStorage) and of the visit (cookie, if the middleware missed it). */
export function captureUtm() {
  try {
    const utm = utmFromUrl(window.location.search, window.location.pathname);
    if (!utm) return;
    if (!window.sessionStorage.getItem(UTM_KEY)) window.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    if (!document.cookie.split("; ").some((c) => c.startsWith(`${UTM_COOKIE}=`))) {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${UTM_COOKIE}=${encodeUtmCookie(utm)}; Max-Age=${UTM_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    }
  } catch {}
}

/** The session's first utm_* set, else the visit's first-touch cookie. */
export function readUtm(): Utm | null {
  try {
    const raw = window.sessionStorage.getItem(UTM_KEY);
    if (raw) return withShareReferral(JSON.parse(raw) as Utm);
  } catch {}
  try {
    const c = document.cookie.split("; ").find((x) => x.startsWith(`${UTM_COOKIE}=`));
    return c ? decodeUtmCookie(c.slice(UTM_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}
