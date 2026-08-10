import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_DESCRIPTION } from "./config";
import { allEntries } from "./content";
import { searchTopicEntries } from "./content/search";
import { findOrphans, MIN_OUTGOING_LINKS, type OrphanReport } from "./graph";
import { validateJsonLd, type JsonLdNode } from "./jsonld";
import { entryMetadata } from "./metadata";
import { resolveOgImageFile } from "./ogAssets";
import { REDIRECT_SOURCES } from "./redirects";
import { absoluteUrl } from "./routes";
import { entriesForSection, nonEmptySections } from "./sitemap";
import { hubListEntries, structuredDataFor } from "./structuredData";
import type { SeoEntry } from "./types";

/**
 * SEO integrity validation (§3–§7).
 *
 * Every check runs against the real content index and the real generated
 * output — the same `entryMetadata` the pages call, the same
 * `structuredDataFor` they render, the same sitemap XML that ships. A
 * validator that reconstructs its own expectation of the output proves
 * nothing about the output.
 *
 * `error` fails the build (see scripts/validate-seo.ts, wired to `prebuild`).
 * `warning` is reported but does not block, and is reserved for things that
 * are suboptimal rather than broken.
 */

export type IssueSeverity = "error" | "warning";

export interface SeoIssue {
  severity: IssueSeverity;
  /** Which validator produced it. */
  check: string;
  /** The page or artefact at fault. */
  subject: string;
  message: string;
}

const error = (check: string, subject: string, message: string): SeoIssue => ({
  severity: "error",
  check,
  subject,
  message,
});

const warning = (check: string, subject: string, message: string): SeoIssue => ({
  severity: "warning",
  check,
  subject,
  message,
});

/** Everything with a URL: the content index plus the generated topic pages. */
export function validatableEntries(): SeoEntry[] {
  return [...allEntries(), ...searchTopicEntries()];
}

/** The subset that should be indexed — the set every validator cares about. */
export function indexableEntries(): SeoEntry[] {
  return validatableEntries().filter((e) => e.status === "published");
}

// ── §4 Canonical validation ──────────────────────────────────────────────────

/**
 * Canonical rules for ONE page, given the metadata that page actually emits.
 *
 * Takes the metadata rather than deriving it, so the check is a real
 * assertion about generated output instead of a tautology — a validator that
 * builds the value it then verifies can never fail.
 */
export function validateCanonicalMetadata(
  entry: SeoEntry,
  meta: Metadata,
  origin = getSiteUrl(),
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  {
    const canonical = meta.alternates?.canonical;

    if (!canonical) {
      issues.push(error("canonical", entry.path, "no canonical URL"));
      return issues;
    }
    if (Array.isArray(canonical)) {
      issues.push(error("canonical", entry.path, "more than one canonical URL"));
      return issues;
    }

    const href = typeof canonical === "string" ? canonical : String(canonical);

    if (!/^https?:\/\//i.test(href)) {
      issues.push(error("canonical", entry.path, `canonical is not absolute: ${href}`));
      return issues;
    }

    const expected = absoluteUrl(entry.path, origin);
    if (href !== expected) {
      issues.push(
        error("canonical", entry.path, `canonical points at ${href}, expected ${expected}`),
      );
    }

    // Duplicate canonicals across pages = two URLs claiming to be the same
    // page. Planned pages are noindex, so they are checked for shape but are
    // allowed to share nothing — they still must not collide.
    const robots = meta.robots as { index?: boolean } | undefined;
    const shouldIndex = entry.status === "published";
    if (robots?.index !== shouldIndex) {
      issues.push(
        error(
          "canonical",
          entry.path,
          `robots index=${String(robots?.index)} but status is "${entry.status}"`,
        ),
      );
    }
  }

  return issues;
}

export function validateCanonicals(
  origin = getSiteUrl(),
  entries: SeoEntry[] = validatableEntries(),
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const seen = new Map<string, string>();

  for (const entry of entries) {
    const meta = entryMetadata(entry, { origin });
    issues.push(...validateCanonicalMetadata(entry, meta, origin));

    // Cross-page rule: two URLs must never claim the same canonical.
    const canonical = meta.alternates?.canonical;
    const href = typeof canonical === "string" ? canonical : undefined;
    if (!href) continue;

    const previous = seen.get(href);
    if (previous) {
      issues.push(
        error("canonical", entry.path, `duplicate canonical, already claimed by ${previous}`),
      );
    } else {
      seen.set(href, entry.path);
    }
  }

  return issues;
}

// ── §6 Open Graph validation ─────────────────────────────────────────────────

export function validateOpenGraph(
  origin = getSiteUrl(),
  entries: SeoEntry[] = indexableEntries(),
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  if (OG_IMAGE_WIDTH !== 1200 || OG_IMAGE_HEIGHT !== 630) {
    issues.push(
      error(
        "open-graph",
        "lib/seo/config.ts",
        `OG image is ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}; crawlers expect 1200x630`,
      ),
    );
  }

  for (const entry of entries) {
    const meta: Metadata = entryMetadata(entry, { origin });

    // Checked on the ENTRY, not the metadata: buildDescription substitutes
    // the site-wide default for an empty summary, so the generated tag looks
    // fine while the page silently shares its description with every other
    // page that forgot one.
    if (!entry.title.trim()) issues.push(error("open-graph", entry.path, "entry has no title"));
    if (!entry.summary.trim()) {
      issues.push(error("open-graph", entry.path, "entry has no summary to describe it"));
    } else if (entry.summary.trim() === SITE_DESCRIPTION && entry.path !== "/") {
      // The homepage is the one page the site description legitimately
      // describes; anywhere else it means a page shipped without its own.
      issues.push(
        error("open-graph", entry.path, "summary is the generic site description"),
      );
    }

    if (!meta.title) issues.push(error("open-graph", entry.path, "no <title>"));
    if (!meta.description) issues.push(error("open-graph", entry.path, "no meta description"));
    if (!meta.openGraph?.title) issues.push(error("open-graph", entry.path, "no og:title"));
    if (!meta.openGraph?.description) {
      issues.push(error("open-graph", entry.path, "no og:description"));
    }
    if (!meta.openGraph?.url) issues.push(error("open-graph", entry.path, "no og:url"));

    const twitter = meta.twitter as { card?: string; title?: string } | undefined;
    if (twitter?.card !== "summary_large_image") {
      issues.push(
        error("open-graph", entry.path, `twitter:card is "${String(twitter?.card)}"`),
      );
    }
    if (!twitter?.title) issues.push(error("open-graph", entry.path, "no twitter:title"));

    // Next.js derives twitter:image from opengraph-image when no twitter-image
    // exists, so one resolved asset covers both tags.
    const ogFile = resolveOgImageFile(entry);
    if (!ogFile) {
      issues.push(
        error("open-graph", entry.path, "no opengraph-image file resolves for this route"),
      );
    }
  }

  return issues;
}

// ── §7 Rich Results validation ───────────────────────────────────────────────

/** Types that must be present on a page of each kind. */
const REQUIRED_TYPES: Partial<Record<SeoEntry["kind"], string[]>> = {
  wiki: ["WebPage", "BreadcrumbList", "Article"],
  blog: ["WebPage", "BreadcrumbList", "Article"],
  course: ["WebPage", "BreadcrumbList", "Course"],
  lesson: ["WebPage", "BreadcrumbList", "LearningResource"],
  tool: ["WebPage", "BreadcrumbList", "SoftwareApplication"],
  glossary: ["WebPage", "BreadcrumbList", "DefinedTermSet"],
  search: ["WebPage", "BreadcrumbList"],
  page: ["WebPage"],
};

function nodeTypes(nodes: JsonLdNode[]): string[] {
  return nodes.map((n) => String(n["@type"]));
}

/**
 * Properties whose values are URLs. Checked by name rather than by "does the
 * string start with a slash", so a description or a formula containing a
 * slash is never mistaken for a relative link.
 */
const URL_PROPERTIES = new Set([
  "url",
  "@id",
  "item",
  "logo",
  "target",
  "urlTemplate",
  "contentUrl",
  "sameAs",
  "mainEntityOfPage",
]);

/** Root-relative URLs found anywhere in a node's URL-valued properties. */
function relativeUrls(value: unknown, inUrlProperty = false, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (inUrlProperty && value.startsWith("/")) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => relativeUrls(v, inUrlProperty, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      relativeUrls(v, URL_PROPERTIES.has(key), out);
    }
  }
  return out;
}

export function validateStructuredData(
  origin = getSiteUrl(),
  entries: SeoEntry[] = validatableEntries(),
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  for (const entry of entries) {
    const nodes = structuredDataFor(entry, { listEntries: hubListEntries(entry), origin });

    for (const node of nodes) {
      const result = validateJsonLd(node);
      if (!result.valid) {
        issues.push(
          error(
            "structured-data",
            entry.path,
            `${String(node["@type"])}: ${result.errors.join("; ")}`,
          ),
        );
      }
    }

    // Required types per kind — only for pages that actually publish content.
    if (entry.status === "published") {
      const present = new Set(nodeTypes(nodes));
      for (const required of REQUIRED_TYPES[entry.kind] ?? []) {
        if (!present.has(required)) {
          issues.push(
            error("structured-data", entry.path, `missing required ${required} node`),
          );
        }
      }

      if (entry.faqs?.length && !present.has("FAQPage")) {
        issues.push(
          error("structured-data", entry.path, "page renders FAQs but emits no FAQPage node"),
        );
      }
    }

    // A page must not emit the same entity twice — duplicate @ids merge into
    // one node in the knowledge graph and silently drop half the data.
    const ids = nodes.map((n) => n["@id"]).filter((id): id is string => typeof id === "string");
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicateIds.length) {
      issues.push(
        error("structured-data", entry.path, `duplicate @id: ${[...new Set(duplicateIds)].join(", ")}`),
      );
    }

    // Every URL in the markup must be absolute; a relative one resolves
    // against the crawler's base, not ours.
    const relative = [...new Set(nodes.flatMap((n) => relativeUrls(n)))];
    if (relative.length) {
      issues.push(
        error("structured-data", entry.path, `relative URLs in JSON-LD: ${relative.join(", ")}`),
      );
    }
  }

  return issues;
}

// ── §5 Sitemap validation ────────────────────────────────────────────────────

/** One (section, entry) pair as it appears in a generated sitemap. */
export interface SitemapRow {
  section: string;
  entry: SeoEntry;
}

/**
 * The sitemap rules, as a pure function over the rows a sitemap contains.
 * Split out from `validateSitemaps` so the rules can be exercised against
 * deliberately broken rows — a validator nobody has watched fail is not a
 * validator.
 */
export function validateSitemapRows(rows: SitemapRow[], origin = getSiteUrl()): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const seen = new Map<string, string>();

  for (const { section, entry } of rows) {
    {
      const url = absoluteUrl(entry.path, origin);

      if (entry.status !== "published") {
        issues.push(
          error("sitemap", entry.path, `"${entry.status}" page is in the ${section} sitemap`),
        );
      }

      if (REDIRECT_SOURCES.has(entry.path)) {
        issues.push(error("sitemap", entry.path, `redirect source is in the ${section} sitemap`));
      }

      const previous = seen.get(url);
      if (previous) {
        issues.push(
          error("sitemap", entry.path, `duplicate sitemap URL, already in ${previous}`),
        );
      } else {
        seen.set(url, section);
      }

      // lastmod must come from the content, never from the build clock —
      // a lastmod that moves on every deploy teaches crawlers to ignore it.
      const lastmod = entry.authority?.updated;
      if (lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
        issues.push(error("sitemap", entry.path, `lastmod is not an ISO date: ${lastmod}`));
      }
    }
  }

  return issues;
}

export function validateSitemaps(origin = getSiteUrl()): SeoIssue[] {
  const rows: SitemapRow[] = nonEmptySections().flatMap((section) =>
    entriesForSection(section).map((entry) => ({ section, entry })),
  );

  const issues = validateSitemapRows(rows, origin);

  // Everything indexable should be IN a sitemap, not merely absent from the
  // wrong one.
  const inSitemaps = new Set(rows.map((r) => r.entry.path));
  for (const entry of indexableEntries()) {
    if (!inSitemaps.has(entry.path)) {
      issues.push(warning("sitemap", entry.path, "indexable page is in no sitemap"));
    }
  }

  return issues;
}

// ── §3 Orphan validation ─────────────────────────────────────────────────────

export function validateInternalLinking(report: OrphanReport = findOrphans()): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const { orphans, underlinked } = report;

  for (const entry of orphans) {
    issues.push(
      error("orphan", entry.path, "indexable page has zero incoming internal links"),
    );
  }

  for (const { entry, outgoing } of underlinked) {
    issues.push(
      error(
        "internal-links",
        entry.path,
        `only ${outgoing} outgoing internal link${outgoing === 1 ? "" : "s"} (minimum ${MIN_OUTGOING_LINKS})`,
      ),
    );
  }

  return issues;
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  issues: SeoIssue[];
  errors: SeoIssue[];
  warnings: SeoIssue[];
  ok: boolean;
}

export function validateSeo(origin = getSiteUrl()): ValidationResult {
  const issues = [
    ...validateCanonicals(origin),
    ...validateOpenGraph(origin),
    ...validateStructuredData(origin),
    ...validateSitemaps(origin),
    ...validateInternalLinking(),
  ];

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return { issues, errors, warnings, ok: errors.length === 0 };
}
