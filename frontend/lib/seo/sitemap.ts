import { getSiteUrl } from "@/lib/site-url";
import { DEFAULT_CONTENT_DATE } from "./config";
import { absoluteUrl } from "./routes";
import type { SeoEntry } from "./types";
import { publishedEntries } from "./content";

/**
 * Everything eligible for a sitemap.
 *
 * A sitemap is a list of the URLs a site wants indexed. A page that names a
 * different page as its canonical is, by its own declaration, not one of
 * them — submitting it anyway is the site contradicting itself.
 */
function sitemapEntries() {
  return publishedEntries().filter((entry) => !entry.canonicalTo);
}
import { searchTopicEntries } from "./content/search";

/**
 * XML sitemap generation (§13).
 *
 * Hand-built rather than using Next's `MetadataRoute.Sitemap` helper, for two
 * reasons that both matter at this size:
 *
 *  1. A real sitemap INDEX is required. Sections are split by content type so
 *    Search Console reports coverage per section — "42 of 95 lesson pages
 *    indexed" is actionable in a way that one 300-URL file never is.
 *  2. Image entries need the `image:` namespace, which the helper does not
 *    emit in the form Google Images expects for a per-URL image list.
 *
 * Nothing here maintains its own list of URLs: every section is a filter over
 * the shared content index, so new content appears automatically (§23).
 */

export const SITEMAP_SECTIONS = [
  "pages",
  "courses",
  "lessons",
  "wiki",
  "glossary",
  "blog",
  "tools",
  "topics",
  "images",
] as const;

export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

const KIND_BY_SECTION: Partial<Record<SitemapSection, SeoEntry["kind"]>> = {
  pages: "page",
  courses: "course",
  lessons: "lesson",
  wiki: "wiki",
  glossary: "glossary",
  blog: "blog",
  tools: "tool",
};

/** The entries belonging in one section. Always `published` only. */
export function entriesForSection(section: SitemapSection): SeoEntry[] {
  if (section === "topics") return searchTopicEntries();
  if (section === "images") return sitemapEntries().filter((e) => (e.images?.length ?? 0) > 0);

  const kind = KIND_BY_SECTION[section];
  return kind ? sitemapEntries().filter((e) => e.kind === kind) : [];
}

/** Sections that currently have at least one URL — empty files are omitted. */
export function nonEmptySections(): SitemapSection[] {
  return SITEMAP_SECTIONS.filter((section) => entriesForSection(section).length > 0);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function lastmod(entry: SeoEntry): string {
  return entry.authority?.updated ?? DEFAULT_CONTENT_DATE;
}

/** `<urlset>` XML for one section. */
export function renderSitemap(section: SitemapSection, origin = getSiteUrl()): string {
  const entries = entriesForSection(section);
  const withImages = section === "images";

  const urls = entries
    .map((entry) => {
      const images = withImages
        ? (entry.images ?? [])
            .map(
              (src) =>
                `\n    <image:image><image:loc>${escapeXml(absoluteUrl(src, origin))}</image:loc><image:title>${escapeXml(entry.title)}</image:title></image:image>`,
            )
            .join("")
        : "";

      return [
        "  <url>",
        `    <loc>${escapeXml(absoluteUrl(entry.path, origin))}</loc>`,
        `    <lastmod>${lastmod(entry)}</lastmod>`,
        entry.changeFrequency ? `    <changefreq>${entry.changeFrequency}</changefreq>` : "",
        entry.priority !== undefined ? `    <priority>${entry.priority.toFixed(1)}</priority>` : "",
        images,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const namespaces = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    withImages ? 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces}>\n${urls}\n</urlset>\n`;
}

/** `<sitemapindex>` XML pointing at every non-empty section. */
export function renderSitemapIndex(origin = getSiteUrl()): string {
  const sections = nonEmptySections()
    .map((section) => {
      const entries = entriesForSection(section);
      const newest = entries
        .map(lastmod)
        .sort()
        .at(-1) ?? DEFAULT_CONTENT_DATE;
      return [
        "  <sitemap>",
        `    <loc>${escapeXml(absoluteUrl(`/sitemaps/${section}.xml`, origin))}</loc>`,
        `    <lastmod>${newest}</lastmod>`,
        "  </sitemap>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sections}\n</sitemapindex>\n`;
}

/** Shared cache headers: cheap for crawlers, still fresh within a day. */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
} as const;
