import { describe, expect, it } from "vitest";
import { aiCoachDailyLimit, canAccessModule } from "@/lib/entitlements";
import { LEARNING_MODULES } from "@/lib/learn/curriculumPublic.generated";
import { MTT_RFI_CHARTS } from "@/lib/learn/mttRfiBaselines";
import { allEntries, publishedEntries, entryByPath } from "@/lib/seo/content";
import { pillarEntries } from "@/lib/seo/content/pillars";
import { glossaryEntries } from "@/lib/seo/content/glossary";
import { linkGraph } from "@/lib/seo/graph";
import { entryMetadata } from "@/lib/seo/metadata";
import { entryText, wordCount } from "@/lib/seo/reading";
import { entriesForSection, nonEmptySections } from "@/lib/seo/sitemap";
import { structuredDataFor } from "@/lib/seo/structuredData";
import { DECLINED_TOPICS } from "@/lib/seo/topics";
import { AI_PROMPTS } from "@/lib/seo/aiVisibility";

/**
 * The SEO Opportunity Sprint's two mechanisms.
 *
 * `canonicalTo` — the fix for 20 thin glossary letter pages, which had to be
 * something other than padding them.
 * The pillars — three pages that own a search intent the site could only
 * half-answer, and which must not turn into unsourced generalisation.
 */

/** Every path submitted across every sitemap section. */
function sitemapPaths(): Set<string> {
  return new Set(
    nonEmptySections().flatMap((section) => entriesForSection(section).map((e) => e.path)),
  );
}

// ── canonicalTo ──────────────────────────────────────────────────────────────

describe("a page can defer to the page that owns its content", () => {
  const letters = glossaryEntries();

  it("every glossary letter page defers to /glossary", () => {
    expect(letters.length).toBeGreaterThan(10);
    for (const entry of letters) {
      expect(entry.canonicalTo, entry.path).toBe("/glossary");
      // Still published: the content exists, it just is not the canonical home.
      expect(entry.status, entry.path).toBe("published");
    }
  });

  it("the canonical tag points at the owner, not at itself", () => {
    for (const entry of letters) {
      const canonical = entryMetadata(entry).alternates?.canonical;
      expect(String(canonical), entry.path).toMatch(/\/glossary$/);
    }
  });

  it("a deferring page stays indexable and crawlable — it is not noindex", () => {
    // The distinction that makes this different from `planned`: these pages
    // are real, linked and followed. They simply do not compete.
    for (const entry of letters.slice(0, 3)) {
      const robots = entryMetadata(entry).robots as { index?: boolean } | undefined;
      expect(robots?.index, entry.path).toBe(true);
    }
  });

  it("no deferring page is submitted in a sitemap", () => {
    const urls = sitemapPaths();
    for (const entry of letters) {
      expect(urls.has(entry.path), `${entry.path} must not be in a sitemap`).toBe(false);
    }
    // The owner still is.
    expect(urls.has("/glossary")).toBe(true);
  });

  it("keeps its outgoing links working, which is the point of keeping it", () => {
    const graph = linkGraph();
    for (const entry of letters.slice(0, 5)) {
      expect(graph.pages.get(entry.path)?.outgoing.length ?? 0, entry.path).toBeGreaterThan(0);
    }
  });

  it("every declared target is a real, published page that does not itself defer", () => {
    for (const entry of allEntries()) {
      if (!entry.canonicalTo) continue;
      const target = entryByPath(entry.canonicalTo);
      expect(target, `${entry.path} -> ${entry.canonicalTo}`).toBeTruthy();
      expect(target!.status).toBe("published");
      expect(target!.canonicalTo).toBeUndefined();
    }
  });
});

// ── The pillar pages ─────────────────────────────────────────────────────────

describe("the pillar pages earn their URL", () => {
  const pillars = pillarEntries();

  it("ships the three the sprint decided on", () => {
    expect(pillars.map((p) => p.path).sort()).toEqual([
      "/free-poker-training",
      "/preflop-charts",
      "/texas-holdem-strategy",
    ]);
  });

  it("each is substantial without being padded", () => {
    for (const entry of pillars) {
      const words = wordCount(entryText(entry));
      expect(words, entry.path).toBeGreaterThan(400);
      expect(entry.body!.length, entry.path).toBeGreaterThanOrEqual(6);
      expect(entry.faqs!.length, entry.path).toBeGreaterThanOrEqual(4);
    }
  });

  it("each declares a source note, an authority record and a cluster", () => {
    for (const entry of pillars) {
      expect(entry.sourceNote, entry.path).toBeTruthy();
      expect(entry.authority?.reviewedBy, entry.path).toBeTruthy();
      expect(entry.clusters?.length, entry.path).toBeGreaterThan(0);
    }
  });

  it("each is self-canonical, indexable and in a sitemap", () => {
    const urls = sitemapPaths();
    for (const entry of pillars) {
      expect(entry.canonicalTo, entry.path).toBeUndefined();
      const robots = entryMetadata(entry).robots as { index?: boolean } | undefined;
      expect(robots?.index, entry.path).toBe(true);
      expect(urls.has(entry.path), entry.path).toBe(true);
    }
  });

  it("each emits valid structured data including its FAQs", () => {
    for (const entry of pillars) {
      const nodes = structuredDataFor(entry);
      const types = nodes.map((n) => n["@type"]);
      expect(types, entry.path).toContain("BreadcrumbList");
      expect(types.some((t) => t === "FAQPage"), entry.path).toBe(true);
    }
  });

  it("none is an orphan, and each links onward", () => {
    const graph = linkGraph();
    for (const entry of pillars) {
      const node = graph.pages.get(entry.path);
      expect(node, entry.path).toBeTruthy();
      expect(node!.incoming.length, `${entry.path} incoming`).toBeGreaterThan(0);
      expect(node!.outgoing.length, `${entry.path} outgoing`).toBeGreaterThan(3);
    }
  });

  it("no two pages share a title", () => {
    const titles = publishedEntries().map((e) => String(entryMetadata(e).title));
    expect(new Set(titles).size).toBe(titles.length);
  });
});

// ── The claims on those pages ────────────────────────────────────────────────

describe("the pillars state nothing they cannot back", () => {
  const byPath = (p: string) => pillarEntries().find((e) => e.path === p)!;

  it("the charts page counts real charts, and names their figures", () => {
    const entry = byPath("/preflop-charts");
    const text = entryText(entry);
    // The count is derived, so it must equal the registries.
    const expected = Object.keys(MTT_RFI_CHARTS).length + 5 + 1;
    expect(text).toContain(String(expected));
    expect(text).toMatch(/Modern Poker Theory/);
    expect(text).toMatch(/Hand Ranges 96 to 139/);
    expect(text).toMatch(/Hand Ranges 76 to 84/);
    expect(text).toMatch(/Hand Range 66/);
  });

  it("the charts page states the gap instead of filling it", () => {
    const text = entryText(byPath("/preflop-charts"));
    expect(text).toMatch(/deliberately missing|no chart here/i);
    expect(text).toMatch(/no published figure has been extracted/i);
  });

  it("the free page's access claims come from the entitlement code", () => {
    const modules = [...LEARNING_MODULES].sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
    const freeCount = modules.filter((m) => canAccessModule("free", m, modules)).length;
    const text = entryText(byPath("/free-poker-training"));

    // The real gate says two full modules and three coach messages a day. If
    // either moves, this assertion fails before the page can mislead anybody.
    expect(freeCount).toBeGreaterThan(0);
    expect(text).toContain(String(freeCount));
    expect(text).toContain(String(aiCoachDailyLimit("free")));
  });

  it("the free page never claims everything is free", () => {
    const text = entryText(byPath("/free-poker-training")).toLowerCase();
    expect(text).toMatch(/what is not free|remaining modules/);
    expect(text).not.toMatch(/everything is free|完全|all free forever/);
    // And it does not restate a price, which would be a second copy to drift.
    expect(text).not.toMatch(/\$\d|€\d|\d+ ?(?:usd|eur) ?(?:\/|per) ?month/);
  });

  it("no pillar names a competitor", () => {
    for (const entry of pillarEntries()) {
      const text = entryText(entry).toLowerCase();
      for (const brand of ["gto wizard", "pokerstars school", "run it once", "upswing", "solversolutions"]) {
        expect(text.includes(brand), `${entry.path} mentions ${brand}`).toBe(false);
      }
    }
  });

  it("no pillar invents a frequency, a range or a solver claim", () => {
    for (const entry of pillarEntries()) {
      const text = entryText(entry);
      // A bare percentage would be a strategy claim these pages have no source
      // for. The only numbers allowed are counts derived from the registries.
      expect(text, entry.path).not.toMatch(/\b\d{1,2}(\.\d+)?% of the time\b/);
      expect(text, entry.path).not.toMatch(/\bsolver says\b/i);
      expect(text, entry.path).not.toMatch(/\bthe optimal (range|frequency)\b/i);
      expect(text, entry.path).not.toMatch(/\bGTO(-| )?(approved|correct|optimal)\b/i);
    }
  });
});

// ── The decisions that were NOT to publish ───────────────────────────────────

describe("declined opportunities stay declined on purpose", () => {
  it("records why, and what would change the answer", () => {
    expect(DECLINED_TOPICS.length).toBeGreaterThanOrEqual(2);
    for (const declined of DECLINED_TOPICS) {
      expect(declined.queries.length).toBeGreaterThan(0);
      expect(declined.rationale.length).toBeGreaterThan(80);
      expect(declined.reconsiderIf.length).toBeGreaterThan(30);
    }
  });

  it("no page was published for a declined query", () => {
    const declinedQueries = DECLINED_TOPICS.flatMap((d) => d.queries);
    for (const entry of publishedEntries()) {
      const haystack = `${entry.title} ${entry.slug}`.toLowerCase();
      for (const query of declinedQueries) {
        // A page whose TITLE or SLUG targets a declined query would mean the
        // decision was reversed without the record being updated.
        if (query.includes("gto wizard")) {
          expect(haystack.includes("gto wizard"), `${entry.path} targets "${query}"`).toBe(false);
        }
      }
    }
  });
});

// ── AI visibility ────────────────────────────────────────────────────────────

describe("AI prompts point at pages that now exist", () => {
  it("every declared target resolves to a published page", () => {
    for (const prompt of AI_PROMPTS) {
      if (!prompt.targetPath) continue;
      const target = publishedEntries().find((e) => e.path === prompt.targetPath);
      expect(target, `${prompt.id}: ${prompt.targetPath}`).toBeTruthy();
      expect(target!.canonicalTo, `${prompt.id} points at a deferring page`).toBeUndefined();
    }
  });

  it("the preflop-chart prompt finally has an owner", () => {
    const prompt = AI_PROMPTS.find((p) => p.prompt === "Where can I see preflop range charts?");
    expect(prompt?.targetPath).toBe("/preflop-charts");
  });
});
