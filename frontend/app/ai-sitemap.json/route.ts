import { renderAiIndex } from "@/lib/seo/llms";

/**
 * /ai-sitemap.json (§15) — the structured content index.
 *
 * Every published URL with its outline, the questions it answers and where
 * its claims come from, so an agent can choose the right page without
 * crawling the site first. Linked from llms.txt, robots.txt and every page's
 * `alternates.types` metadata.
 */
export const revalidate = 3600;

export function GET() {
  return new Response(JSON.stringify(renderAiIndex(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Same-origin JS does not need this, but an agent fetching from a
      // different origin does, and the file is public by design.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
