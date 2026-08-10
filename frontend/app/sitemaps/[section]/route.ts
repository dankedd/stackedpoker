import {
  SITEMAP_HEADERS,
  SITEMAP_SECTIONS,
  nonEmptySections,
  renderSitemap,
  type SitemapSection,
} from "@/lib/seo/sitemap";

/**
 * /sitemaps/<section>.xml — one child sitemap per content type (§13).
 *
 * The ".xml" suffix is part of the dynamic segment rather than a route
 * folder, which keeps a single handler serving every section. Sections are
 * pre-rendered from the content index, so adding a lesson or wiki article
 * changes the output with no code change here.
 */
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return nonEmptySections().map((section) => ({ section: `${section}.xml` }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  const name = section.replace(/\.xml$/, "") as SitemapSection;

  if (!SITEMAP_SECTIONS.includes(name)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(renderSitemap(name), { headers: SITEMAP_HEADERS });
}
