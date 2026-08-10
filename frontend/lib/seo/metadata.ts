import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import {
  DESCRIPTION_MAX_CHARS,
  SITE_DESCRIPTION,
  SITE_NAME,
  TITLE_MAX_CHARS,
  TWITTER_HANDLE,
} from "./config";
import { absoluteUrl, normalizePath } from "./routes";
import type { SeoEntry } from "./types";

/**
 * Centralised metadata generation (§1).
 *
 * Every route calls `buildMetadata` (or `entryMetadata`, which derives the
 * inputs from a content record) so titles, descriptions, canonicals, Open
 * Graph, Twitter cards and robots directives are produced by ONE code path.
 * That is what makes the "no duplicate metadata" guarantee testable rather
 * than aspirational — see lib/seo/__tests__/metadata.test.ts.
 *
 * Open Graph images are intentionally NOT set here. Next.js's
 * `opengraph-image` file convention already injects the correct absolute URL
 * per route segment, and setting `openGraph.images` in code would override
 * it. Twitter falls back to the Open Graph image when no twitter:image is
 * present, which is why only the card type is declared below.
 */

export interface BuildMetadataInput {
  /** Page-specific title, WITHOUT the brand suffix. */
  title: string;
  description: string;
  /** Root-relative canonical path, e.g. "/wiki/mdf". */
  path: string;
  keywords?: string[];
  /** Defaults to true. `false` emits a full noindex/nofollow directive. */
  index?: boolean;
  /** "article" unlocks published/modified time in the OG tags. */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** OG article section, e.g. "Poker Theory". */
  section?: string;
  authors?: string[];
  /**
   * Origin to resolve the canonical against. Defaults to `getSiteUrl()`,
   * which is what every page wants. The build-time validator overrides it so
   * it can check the PRODUCTION canonical even though the validation run
   * itself is not NODE_ENV=production — otherwise it would verify localhost
   * URLs and pass on canonicals that are wrong in the only environment that
   * ships.
   */
  origin?: string;
}

/**
 * Truncates on a word boundary and appends an ellipsis, so a clamped string
 * never ends mid-word (which reads as broken in a SERP snippet).
 */
export function clamp(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[,;:.\-—]+$/, "")}…`;
}

/**
 * `<title>` text: "Page Title | StackedPoker".
 *
 * The brand suffix is dropped rather than truncated when the page title
 * alone already fills the budget — a cut-off brand name is worse than none.
 */
export function buildTitle(pageTitle: string): string {
  const trimmed = pageTitle.replace(/\s+/g, " ").trim();
  const suffix = ` | ${SITE_NAME}`;
  if (trimmed.endsWith(suffix) || trimmed === SITE_NAME) return clamp(trimmed, TITLE_MAX_CHARS);
  if (trimmed.length + suffix.length <= TITLE_MAX_CHARS) return `${trimmed}${suffix}`;
  return clamp(trimmed, TITLE_MAX_CHARS);
}

/** Joins sentence fragments into one clamped meta description. */
export function buildDescription(...parts: (string | undefined | null)[]): string {
  const joined = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim().replace(/\s+/g, " "))
    .join(" ")
    .replace(/\s+([.,;:])/g, "$1");
  return clamp(joined || SITE_DESCRIPTION, DESCRIPTION_MAX_CHARS);
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const origin = input.origin ?? getSiteUrl();
  const path = normalizePath(input.path);
  const canonical = absoluteUrl(path, origin);
  const title = buildTitle(input.title);
  const description = buildDescription(input.description);
  const indexable = input.index !== false;

  return {
    title,
    description,
    keywords: input.keywords?.length ? input.keywords : undefined,
    authors: input.authors?.map((name) => ({ name })),
    alternates: {
      canonical,
      types: {
        // A single, always-valid discovery hint for feed readers and the
        // AI crawlers that look for one.
        "application/json": absoluteUrl("/ai-sitemap.json", origin),
      },
    },
    robots: indexable
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : // noindex, FOLLOW — not nofollow. A planned article or an uncurated
        // search page should stay out of the index while still passing link
        // equity to the real pages it links to; nofollow would strand it.
        { index: false, follow: true, nocache: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_US",
      type: input.type ?? "website",
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime ?? input.publishedTime,
            section: input.section,
            authors: input.authors,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
    },
  };
}

/**
 * Qualifier appended to the `<title>` (never the `<h1>`) for kinds whose
 * names legitimately collide with another surface.
 *
 * A lesson called "Range Advantage" and the wiki article on range advantage
 * are different pages that deserve different SERP entries; without a
 * qualifier they compete for the same query with the same title, and Google
 * picks one and drops the other. The on-page `<h1>` stays clean, because
 * inside the page the breadcrumb already says which kind of page it is.
 */
const TITLE_QUALIFIER: Partial<Record<SeoEntry["kind"], string>> = {
  lesson: "Poker Lesson",
  course: "Poker Course",
};

/**
 * Metadata straight from a content record — the path every generated page
 * uses, so a new wiki article or tool inherits correct metadata with zero
 * extra code (§23).
 */
export function entryMetadata(entry: SeoEntry, overrides: Partial<BuildMetadataInput> = {}): Metadata {
  const qualifier = TITLE_QUALIFIER[entry.kind];

  return buildMetadata({
    title: qualifier ? `${entry.title} — ${qualifier}` : entry.title,
    description: entry.summary,
    path: entry.path,
    keywords: entry.tags,
    // `planned` content is real routing with no published body behind it —
    // indexing it would be a thin-content signal against the whole domain.
    index: entry.status === "published",
    type: entry.kind === "blog" || entry.kind === "wiki" ? "article" : "website",
    publishedTime: entry.authority?.updated,
    modifiedTime: entry.authority?.updated,
    section: entry.clusters?.[0],
    authors: entry.authority ? [entry.authority.reviewedBy] : undefined,
    ...overrides,
  });
}
