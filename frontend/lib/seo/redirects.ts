/**
 * Permanent redirects that exist for SEO reasons.
 *
 * Declared here rather than inline in next.config.ts so two things can read
 * the same list: the Next config that serves them, and the sitemap validator
 * that must prove no sitemap ever advertises a URL which 308s (a redirect in
 * a sitemap wastes crawl budget and is flagged by Search Console).
 *
 * Deliberately dependency-free and free of path aliases — next.config.ts
 * imports it relatively, before the `@/*` alias exists.
 */

export interface SeoRedirect {
  source: string;
  destination: string;
  permanent: boolean;
  /** Why the redirect exists. Shown in the SEO report. */
  reason: string;
}

export const SEO_REDIRECTS: SeoRedirect[] = [
  {
    source: "/tools/poker-glossary",
    destination: "/glossary",
    permanent: true,
    reason:
      "The glossary is listed as a free tool but already lives at /glossary; two indexable URLs would compete for the same query.",
  },
];

/** Fast lookup for the validators. */
export const REDIRECT_SOURCES: ReadonlySet<string> = new Set(
  SEO_REDIRECTS.map((r) => r.source),
);
