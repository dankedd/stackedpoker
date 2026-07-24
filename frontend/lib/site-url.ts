/**
 * Single source of truth for the app's canonical origin.
 *
 * Production always resolves to the canonical custom domain — never to the
 * request's own host — so a stray x-forwarded-host, a direct hit on the
 * *.vercel.app deployment URL, or a misconfigured proxy can never leak into
 * an OAuth/email/callback redirect. Local dev keeps using the real local
 * origin so ports other than 3000 still work.
 */
export const CANONICAL_SITE_URL = "https://stackedpokerai.com";

export function getSiteUrl(devOrigin?: string): string {
  if (process.env.NODE_ENV === "production") {
    return (process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_SITE_URL).replace(/\/$/, "");
  }
  return (devOrigin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
