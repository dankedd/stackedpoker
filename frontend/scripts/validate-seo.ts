/**
 * Fails the build when SEO integrity is broken.
 *
 * Wired to npm's `prebuild` hook, so `npm run build` cannot produce a
 * deployment with orphan pages, wrong canonicals, missing Open Graph
 * metadata, invalid structured data or a sitemap containing pages that
 * should never be indexed. Shipping those silently is the failure mode this
 * whole file exists to prevent — a broken canonical is invisible until
 * traffic has already been lost.
 *
 * Run directly with: npm run seo:validate
 */
import { renderValidationReport } from "../lib/seo/report";
import { validateSeo } from "../lib/seo/validate";
import { CANONICAL_SITE_URL } from "../lib/site-url";

export function main() {
  // Always validate against the production origin. Running under
  // NODE_ENV=development would otherwise check localhost canonicals and pass
  // on URLs that are wrong in the only environment that matters.
  const result = validateSeo(CANONICAL_SITE_URL);

  console.log(renderValidationReport(result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}
