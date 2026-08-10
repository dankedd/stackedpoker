import { SITEMAP_HEADERS, renderSitemapIndex } from "@/lib/seo/sitemap";

/**
 * /sitemap.xml — the sitemap INDEX (§13).
 *
 * Points at one child sitemap per content type. Search Console then reports
 * indexing coverage per section, which turns "some pages are missing" into
 * "the lesson section is at 40%".
 */
export const revalidate = 3600;

export function GET() {
  return new Response(renderSitemapIndex(), { headers: SITEMAP_HEADERS });
}
