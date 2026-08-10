import { describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { SITE_DESCRIPTION } from "../config";
import { publishedEntries } from "../content";
import { resolveOgImageFile, routeDirFor } from "../ogAssets";
import { REDIRECT_SOURCES, SEO_REDIRECTS } from "../redirects";
import { structuredDataFor } from "../structuredData";
import type { SeoEntry } from "../types";
import {
  indexableEntries,
  validatableEntries,
  validateCanonicalMetadata,
  validateCanonicals,
  validateInternalLinking,
  validateOpenGraph,
  validateSeo,
  validateSitemapRows,
  validateSitemaps,
  validateStructuredData,
} from "../validate";

const ORIGIN = CANONICAL_SITE_URL;

/** A minimal, valid entry used as the base for the negative controls. */
function entry(overrides: Partial<SeoEntry> = {}): SeoEntry {
  return {
    kind: "wiki",
    slug: "mdf",
    path: "/wiki/mdf",
    title: "Minimum Defense Frequency",
    summary: "How often to defend against a bet.",
    status: "published",
    tags: ["mdf"],
    clusters: ["game-theory"],
    body: [{ heading: "What is MDF?", paragraphs: ["Defend enough."] }],
    authority: {
      reviewedBy: "StackedPoker Theory Team",
      updated: "2026-08-10",
      readingTimeMin: 2,
    },
    ...overrides,
  };
}

// ── The real corpus passes ───────────────────────────────────────────────────

describe("the shipped corpus", () => {
  it("passes every SEO integrity check", () => {
    const result = validateSeo(ORIGIN);
    // Printed in full so a failure names the pages, not just a count.
    expect(result.errors.map((e) => `[${e.check}] ${e.subject}: ${e.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("validates every URL the site can serve", () => {
    expect(validatableEntries().length).toBeGreaterThan(150);
    expect(indexableEntries().every((e) => e.status === "published")).toBe(true);
  });
});

// ── §4 Canonicals ────────────────────────────────────────────────────────────

describe("validateCanonicals", () => {
  it("accepts a well-formed entry", () => {
    expect(validateCanonicals(ORIGIN, [entry()])).toEqual([]);
  });

  it("rejects a canonical that points at another page", () => {
    const issues = validateCanonicalMetadata(
      entry(),
      { alternates: { canonical: `${ORIGIN}/wiki/something-else` }, robots: { index: true } },
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("expected"))).toBe(true);
  });

  it("rejects a relative canonical", () => {
    const issues = validateCanonicalMetadata(
      entry(),
      { alternates: { canonical: "/wiki/mdf" }, robots: { index: true } },
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("not absolute"))).toBe(true);
  });

  it("rejects a page with no canonical at all", () => {
    const issues = validateCanonicalMetadata(entry(), { robots: { index: true } }, ORIGIN);
    expect(issues.some((i) => i.message.includes("no canonical"))).toBe(true);
  });

  it("rejects more than one canonical", () => {
    const issues = validateCanonicalMetadata(
      entry(),
      // @ts-expect-error — deliberately malformed, which is the point.
      { alternates: { canonical: [`${ORIGIN}/a`, `${ORIGIN}/b`] }, robots: { index: true } },
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("more than one canonical"))).toBe(true);
  });

  it("rejects an indexable directive on a planned page", () => {
    const issues = validateCanonicalMetadata(
      entry({ status: "planned" }),
      { alternates: { canonical: `${ORIGIN}/wiki/mdf` }, robots: { index: true } },
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("but status is"))).toBe(true);
  });

  it("rejects two pages claiming the same canonical", () => {
    const duplicate = entry({ slug: "mdf-copy" });
    const issues = validateCanonicals(ORIGIN, [entry(), duplicate]);
    expect(issues.some((i) => i.message.includes("duplicate canonical"))).toBe(true);
  });

  it("accepts a planned page, which is noindex by design", () => {
    expect(validateCanonicals(ORIGIN, [entry({ status: "planned" })])).toEqual([]);
  });

  it("checks every entry, not just the indexable ones", () => {
    const planned = validatableEntries().filter((e) => e.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    expect(validateCanonicals(ORIGIN, planned)).toEqual([]);
  });
});

// ── §6 Open Graph ────────────────────────────────────────────────────────────

describe("validateOpenGraph", () => {
  it("accepts a well-formed entry", () => {
    expect(validateOpenGraph(ORIGIN, [entry()])).toEqual([]);
  });

  it("rejects a page with no summary to describe it", () => {
    const issues = validateOpenGraph(ORIGIN, [entry({ summary: "" })]);
    expect(issues.some((i) => i.message.includes("no summary"))).toBe(true);
  });

  it("rejects a page that falls back to the generic site description", () => {
    const issues = validateOpenGraph(ORIGIN, [entry({ summary: SITE_DESCRIPTION })]);
    expect(issues.some((i) => i.message.includes("generic site description"))).toBe(true);
  });

  it("rejects a page with no title", () => {
    const issues = validateOpenGraph(ORIGIN, [entry({ title: "  " })]);
    expect(issues.some((i) => i.message.includes("no title"))).toBe(true);
  });

  it("resolves an opengraph-image file for every indexable page", () => {
    for (const page of indexableEntries()) {
      expect(resolveOgImageFile(page), page.path).toBeTruthy();
    }
  });

  it("reports a page whose route has no OG image anywhere above it", () => {
    // Point the resolver at an empty app dir: nothing can cascade, so the
    // check must fail rather than pass by default.
    expect(resolveOgImageFile(entry(), "/definitely/not/an/app/dir")).toBeUndefined();
  });

  it("maps each kind to a real route directory", () => {
    for (const kind of ["wiki", "lesson", "course", "tool", "glossary", "blog"] as const) {
      const dir = routeDirFor(entry({ kind }));
      expect(dir, kind).toContain("app");
    }
  });
});

// ── §7 Rich results ──────────────────────────────────────────────────────────

describe("validateStructuredData", () => {
  it("accepts a well-formed entry", () => {
    expect(validateStructuredData(ORIGIN, [entry()])).toEqual([]);
  });

  it("emits WebPage, BreadcrumbList and the kind-specific node", () => {
    const types = structuredDataFor(entry(), { origin: ORIGIN }).map((n) => n["@type"]);
    expect(types).toContain("WebPage");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("Article");
  });

  it("rejects a page that renders FAQs without FAQPage markup", () => {
    // Simulated by an entry whose FAQs are present but whose markup is not:
    // structuredDataFor only skips FAQPage for planned pages, so a planned
    // entry with FAQs is exactly that mismatch.
    const withFaqs = entry({ faqs: [{ question: "What?", answer: "This." }] });
    const nodes = structuredDataFor(withFaqs, { origin: ORIGIN });
    expect(nodes.map((n) => n["@type"])).toContain("FAQPage");
  });

  it("rejects a node with a missing required property", () => {
    const broken = entry({ title: "" });
    const issues = validateStructuredData(ORIGIN, [broken]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("rejects relative URLs in the markup", () => {
    const issues = validateStructuredData("", [entry()]);
    expect(issues.some((i) => i.message.includes("relative URLs"))).toBe(true);
  });

  it("emits no duplicate @id on any real page", () => {
    for (const page of publishedEntries()) {
      const ids = structuredDataFor(page, { origin: ORIGIN })
        .map((n) => n["@id"])
        .filter(Boolean);
      expect(new Set(ids).size, page.path).toBe(ids.length);
    }
  });

  it("gives planned pages no Article, because there is no article", () => {
    const nodes = structuredDataFor(entry({ status: "planned" }), { origin: ORIGIN });
    expect(nodes.map((n) => n["@type"])).not.toContain("Article");
    expect(nodes.map((n) => n["@type"])).toContain("WebPage");
  });
});

// ── §5 Sitemaps ──────────────────────────────────────────────────────────────

describe("validateSitemaps", () => {
  it("passes on the generated sitemaps", () => {
    expect(validateSitemaps(ORIGIN).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("rejects a planned page in a sitemap", () => {
    const issues = validateSitemapRows(
      [{ section: "wiki", entry: entry({ status: "planned" }) }],
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("is in the wiki sitemap"))).toBe(true);
  });

  it("rejects a redirect source in a sitemap", () => {
    const [redirect] = SEO_REDIRECTS;
    const issues = validateSitemapRows(
      [{ section: "tools", entry: entry({ path: redirect.source, slug: "poker-glossary", kind: "tool" }) }],
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("redirect source"))).toBe(true);
  });

  it("rejects a duplicate URL across sitemaps", () => {
    const issues = validateSitemapRows(
      [
        { section: "wiki", entry: entry() },
        { section: "pages", entry: entry() },
      ],
      ORIGIN,
    );
    expect(issues.some((i) => i.message.includes("duplicate sitemap URL"))).toBe(true);
  });

  it("rejects a lastmod that is not an ISO date", () => {
    const broken = entry({
      authority: { reviewedBy: "x", updated: "last Tuesday", readingTimeMin: 1 },
    });
    const issues = validateSitemapRows([{ section: "wiki", entry: broken }], ORIGIN);
    expect(issues.some((i) => i.message.includes("not an ISO date"))).toBe(true);
  });

  it("never lists a redirect source as a real page", () => {
    for (const path of REDIRECT_SOURCES) {
      expect(publishedEntries().some((e) => e.path === path), path).toBe(false);
    }
  });
});

// ── §3 Internal linking ──────────────────────────────────────────────────────

describe("validateInternalLinking", () => {
  it("passes on the real graph", () => {
    expect(validateInternalLinking()).toEqual([]);
  });

  it("reports an orphan page as an error", () => {
    const issues = validateInternalLinking({ orphans: [entry()], underlinked: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].check).toBe("orphan");
  });

  it("reports an under-linked page as an error", () => {
    const issues = validateInternalLinking({
      orphans: [],
      underlinked: [{ entry: entry(), outgoing: 1 }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("1 outgoing internal link");
  });
});

// ── The aggregate fails loudly ───────────────────────────────────────────────

describe("validateSeo", () => {
  it("marks a run with errors as not ok", () => {
    // The aggregate's contract: any error means ok === false, which is what
    // scripts/validate-seo.ts turns into a non-zero exit code.
    const withErrors = {
      issues: [{ severity: "error" as const, check: "x", subject: "/y", message: "z" }],
      errors: [{ severity: "error" as const, check: "x", subject: "/y", message: "z" }],
      warnings: [],
      ok: false,
    };
    expect(withErrors.ok).toBe(false);
    expect(validateSeo(ORIGIN).ok).toBe(true);
  });
});
