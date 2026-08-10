/**
 * Site-wide SEO / GEO constants.
 *
 * The ONE place that knows the brand's public identity. Everything else
 * (metadata, JSON-LD, OG images, llms.txt, sitemaps) reads from here, so a
 * rename or a new social profile is a one-line change.
 *
 * The canonical origin itself is NOT duplicated here — it stays in
 * lib/site-url.ts (`getSiteUrl()`), which already encodes the "production
 * always resolves to the canonical custom domain" rule the auth callbacks
 * depend on.
 */

/** Schema.org `name` — the brand as written in product copy. */
export const SITE_NAME = "StackedPoker";

/** Existing product surfaces render it with a space; kept as an alternateName. */
export const SITE_ALTERNATE_NAME = "Stacked Poker";

export const SITE_TAGLINE = "Learn Poker Strategy the Right Way";

/**
 * Default meta description. Deliberately concrete (what the product *is* and
 * what it *does*) rather than adjectival — generative engines quote the
 * factual sentence, not the marketing one.
 */
export const SITE_DESCRIPTION =
  "StackedPoker teaches Texas Hold'em strategy through interactive lessons, range trainers and a searchable poker theory wiki — predict the decision, see the reveal, understand why it works.";

/** Used for the Organization/Person `author` + the on-page authority byline. */
export const AUTHORITY_TEAM = "StackedPoker Theory Team";

export const CONTACT_EMAIL = "support@stackedpokerai.com";

/** Content licence advertised in llms.txt and the AI content index. */
export const CONTENT_LICENSE =
  "© StackedPoker. Free to quote with attribution and a link to the source URL. Not for bulk redistribution.";

/** Open Graph image dimensions — the 1.91:1 ratio every major crawler expects. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const TWITTER_HANDLE = "@stackedpoker";

/** Social / sameAs profiles. Empty entries are filtered out before emitting. */
export const SOCIAL_PROFILES: string[] = [];

/** Search-engine character budgets used by the clamping helpers. */
export const TITLE_MAX_CHARS = 60;
export const DESCRIPTION_MAX_CHARS = 160;

/** Brand colours reused by the generated OG images. */
export const BRAND = {
  background: "#0a0e1a",
  surface: "#121829",
  violet: "#7c5cff",
  blue: "#38bdf8",
  text: "#eef2f8",
  muted: "#8b95ab",
  border: "#242c40",
} as const;

/**
 * Editorially-set launch date for evergreen reference content that has no
 * per-entry `updated` date of its own. A real date beats `new Date()`:
 * a lastmod that changes on every build teaches crawlers to ignore it.
 */
export const DEFAULT_CONTENT_DATE = "2026-08-10";
