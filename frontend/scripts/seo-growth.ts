/**
 * The SEO growth audit (Module: SEO Growth Sprint).
 *
 * Developer/admin only, stdout only — never a route. Prints the corpus audit,
 * the keyword/topic map, cluster health, the ranked opportunity score, AI
 * visibility and the backlink shortlist.
 *
 * Read-only: it never fails a build. `npm run seo:validate` is the gate.
 *
 * Run with: npm run seo:growth
 */
import { renderGrowthReport } from "../lib/seo/growthReport";

export function main() {
  console.log(renderGrowthReport());
}
