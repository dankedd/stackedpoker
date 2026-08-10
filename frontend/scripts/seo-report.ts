/**
 * Developer diagnostic: internal-linking health (§8) and content
 * completeness (§10).
 *
 * Read-only — it never fails a build. Use it to answer "what should we write
 * next?" and "which cluster is not pulling its weight?".
 *
 * Run with: npm run seo:report
 */
import {
  renderCompletenessReport,
  renderLinkingReport,
  renderValidationReport,
} from "../lib/seo/report";
import { validateSeo } from "../lib/seo/validate";
import { CANONICAL_SITE_URL } from "../lib/site-url";

export function main() {
  console.log(renderCompletenessReport());
  console.log("");
  console.log(renderLinkingReport());
  console.log("");
  console.log(renderValidationReport(validateSeo(CANONICAL_SITE_URL)));
}
