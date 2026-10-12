/**
 * Meta Pixel: consent, event helper and UTM attribution.
 *
 * The pixel script itself is mounted by components/analytics/MetaPixel.tsx,
 * and only after the visitor accepted in the consent banner. Every call here
 * is a no-op without consent, so call sites never need a guard of their own.
 */

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
const pending: [string, Params | undefined][] = [];

export function track(event: string, params?: Params) {
  if (typeof window === "undefined" || readConsent() !== "granted") return;
  if (window.fbq) window.fbq("track", event, params);
  else pending.push([event, params]);
}

export function flushPending() {
  if (!window.fbq) return;
  for (const [event, params] of pending.splice(0)) window.fbq("track", event, params);
}

/** Monthly prices in EUR, as listed on /pricing (PLUS_PRICE / ELITE_PRICE). */
export const PLAN_VALUE_EUR = { pro: 7.99, premium: 11.99 } as const;

const CHECKOUT_KEY = "sp_checkout_plan";

/** Remembers which plan went to Stripe, so the return page can report its value. */
export function rememberCheckoutPlan(plan: keyof typeof PLAN_VALUE_EUR) {
  try {
    window.localStorage.setItem(CHECKOUT_KEY, plan);
  } catch {}
}

/** Subscribe, fired once on the Stripe success return (/dashboard?upgraded=1). */
export function trackSubscribe() {
  let plan: string | null = null;
  try {
    plan = window.localStorage.getItem(CHECKOUT_KEY);
    window.localStorage.removeItem(CHECKOUT_KEY);
  } catch {}
  const value = plan === "pro" || plan === "premium" ? PLAN_VALUE_EUR[plan] : undefined;
  track("Subscribe", value !== undefined ? { value, currency: "EUR", content_name: plan! } : { currency: "EUR" });
}

// ── UTM attribution ─────────────────────────────────────────────────────────

const UTM_KEY = "sp_utm";
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Utm = Partial<Record<(typeof UTM_FIELDS)[number] | "landing_path", string>>;

/** Keeps the first utm_* set of the session (sessionStorage, first-party only). */
export function captureUtm() {
  try {
    if (window.sessionStorage.getItem(UTM_KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const utm: Utm = {};
    for (const f of UTM_FIELDS) {
      const v = q.get(f);
      if (v) utm[f] = v.slice(0, 200);
    }
    if (!Object.keys(utm).length) return;
    utm.landing_path = window.location.pathname;
    window.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {}
}

export function readUtm(): Utm | null {
  try {
    const raw = window.sessionStorage.getItem(UTM_KEY);
    return raw ? (JSON.parse(raw) as Utm) : null;
  } catch {
    return null;
  }
}
