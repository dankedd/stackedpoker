import { renderLlmsTxt } from "@/lib/seo/llms";

/**
 * /llms.txt (§15) — what this site is, for a language model.
 *
 * Served as text/plain so it renders in a terminal, a browser and an agent's
 * fetch alike.
 */
export const revalidate = 3600;

export function GET() {
  return new Response(renderLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
