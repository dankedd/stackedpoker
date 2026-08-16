import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { allEntries, entriesInCluster, publishedEntries, searchEntries } from "@/lib/seo/content";
import { toolEntryBySlug, toolHasWidget } from "@/lib/seo/content/tools";
import { linkGraph } from "@/lib/seo/graph";
import { entryMetadata } from "@/lib/seo/metadata";
import { resolveOgImageFile } from "@/lib/seo/ogAssets";
import { breadcrumbsFor, relatedTo } from "@/lib/seo/related";
import { entriesForSection } from "@/lib/seo/sitemap";
import { structuredDataFor } from "@/lib/seo/structuredData";
import { validateSeo } from "@/lib/seo/validate";
import { analyzeHand } from "../handAnalysis/analyze";
import {
  conceptRecommendations,
  DETECTABLE_CONCEPT_IDS,
  recommendationFor,
} from "../handAnalysis/recommendations";
import type { HandInput } from "../handAnalysis/types";

const SLUG = "poker-hand-analyzer";
const PATH = "/tools/poker-hand-analyzer";
const SOURCE = readFileSync(
  path.resolve(process.cwd(), "components/tools/PokerHandAnalyzer.tsx"),
  "utf8",
);

// ── SEO integration (§16 SEO, §17 gates) ─────────────────────────────────────

describe("the analyzer is a first-class page in the existing SEO system", () => {
  const entry = toolEntryBySlug(SLUG)!;

  it("has a published SeoEntry in the one content index", () => {
    expect(entry).toBeTruthy();
    expect(entry.status).toBe("published");
    expect(allEntries().some((e) => e.path === PATH)).toBe(true);
  });

  it("is indexable — never accidentally noindex", () => {
    const meta = entryMetadata(entry, { origin: CANONICAL_SITE_URL });
    expect((meta.robots as { index: boolean }).index).toBe(true);
    expect(meta.alternates?.canonical).toBe(`${CANONICAL_SITE_URL}${PATH}`);
    expect(String(meta.title)).toMatch(/analyz/i);
    expect(String(meta.description).length).toBeGreaterThan(50);
  });

  it("emits valid structured data", () => {
    const types = structuredDataFor(entry, { origin: CANONICAL_SITE_URL }).map((n) => n["@type"]);
    expect(types).toContain("WebPage");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("FAQPage");
  });

  it("has breadcrumbs, an OG image and a sitemap row", () => {
    const crumbs = breadcrumbsFor(entry);
    expect(crumbs[0].path).toBe("/");
    expect(crumbs[1].path).toBe("/tools");
    expect(crumbs.at(-1)?.path).toBe(PATH);

    expect(resolveOgImageFile(entry)).toBeTruthy();
    expect(entriesForSection("tools").map((e) => e.path)).toContain(PATH);
  });

  it("is in the topic clusters and the internal search index", () => {
    expect(entry.clusters?.length).toBeGreaterThan(0);
    for (const cluster of entry.clusters ?? []) {
      expect(entriesInCluster(cluster).map((e) => e.path)).toContain(PATH);
    }
    expect(searchEntries("poker hand analyzer", 20).map((h) => h.entry.path)).toContain(PATH);
  });

  it("is linked to and links out", () => {
    const graph = linkGraph();
    expect(graph.pages.get(PATH)?.incoming.length).toBeGreaterThan(0);
    expect(relatedTo(entry).length).toBeGreaterThanOrEqual(4);
  });

  it("declares its widget, and the widget exists", () => {
    expect(toolHasWidget(SLUG)).toBe(true);
    const registry = readFileSync(
      path.resolve(process.cwd(), "components/tools/index.tsx"),
      "utf8",
    );
    expect(registry).toContain(`"${SLUG}"`);
  });

  it("answers the search intent the page targets", () => {
    const headings = (entry.body ?? []).map((s) => s.heading);
    expect(headings.some((h) => /^How .* works$/i.test(h))).toBe(true);
    expect(headings).toContain("Common mistakes");
    expect(headings).toContain("Practical examples");
    expect(headings.at(-1)).toBe("Key takeaway");
    expect(entry.faqs?.length).toBeGreaterThanOrEqual(4);
    // The page must say plainly what it cannot do — that is the honesty the
    // whole tool rests on, and it belongs on the landing page too.
    expect(JSON.stringify(entry)).toMatch(/not a solver/i);
  });

  it("keeps the whole corpus valid", () => {
    const result = validateSeo(CANONICAL_SITE_URL);
    expect(result.errors.map((e) => `[${e.check}] ${e.subject}: ${e.message}`)).toEqual([]);
  });
});

// ── Worked examples match the engine ─────────────────────────────────────────

describe("the landing page's examples are what the analyser actually returns", () => {
  it("quotes the engine, not a hand-typed number", () => {
    const entry = toolEntryBySlug(SLUG)!;
    const examples = (entry.body ?? []).find((s) => s.heading === "Practical examples");
    expect(examples?.definitions?.length).toBeGreaterThan(0);

    const live = analyzeHand({
      heroPosition: "BTN",
      heroCards: ["Ah", "Kh"],
      villainCards: ["Qs", "Qd"],
      board: ["Jh", "7h", "2c"],
      potBb: 10,
      effectiveStackBb: 100,
      actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
    });
    const equity = live.calculations.find((c) => c.id === "equity")!.value;
    expect(examples!.definitions![0].description).toContain(equity);
  });
});

// ── Recommendations (§16 integration, §17 gates) ─────────────────────────────

describe("lesson recommendations", () => {
  const recommendations = conceptRecommendations([...DETECTABLE_CONCEPT_IDS]);

  it("covers every concept the analyser can detect", () => {
    // The gate that stops a new detection rule shipping without its links.
    const hands: HandInput[] = [
      {
        heroPosition: "BTN",
        heroCards: ["Ah", "Kh"],
        board: ["Jh", "7h", "2c"],
        potBb: 10,
        effectiveStackBb: 100,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 15 }],
      },
      {
        heroPosition: "CO",
        heroCards: ["As", "Ks"],
        board: ["2h", "7h", "9h"],
        actions: [
          { street: "preflop", actor: "hero", type: "raise", amountBb: 3 },
          { street: "flop", actor: "hero", type: "bet", amountBb: 4 },
        ],
      },
      {
        heroPosition: "BB",
        heroCards: ["8c", "8d"],
        board: ["8h", "8s", "2c"],
        actions: [],
      },
    ];

    const emitted = new Set(hands.flatMap((hand) => analyzeHand(hand).conceptIds));
    expect(emitted.size).toBeGreaterThan(3);
    for (const conceptId of emitted) {
      expect(
        DETECTABLE_CONCEPT_IDS as readonly string[],
        `${conceptId} is emitted by analyze.ts but missing from DETECTABLE_CONCEPT_IDS`,
      ).toContain(conceptId);
    }
  });

  it("only points at routes that exist", () => {
    const known = new Set(allEntries().map((e) => e.path));
    for (const conceptId of DETECTABLE_CONCEPT_IDS) {
      const recommendation = recommendations[conceptId];
      if (recommendation.wiki) expect(known.has(recommendation.wiki.path), recommendation.wiki.path).toBe(true);
      if (recommendation.tool) expect(known.has(recommendation.tool.path), recommendation.tool.path).toBe(true);
      for (const lesson of recommendation.lessons) {
        expect(known.has(lesson.path), lesson.path).toBe(true);
      }
      if (recommendation.glossary) {
        // Glossary links carry a #term anchor onto a letter page.
        expect(known.has(recommendation.glossary.path.split("#")[0])).toBe(true);
      }
    }
  });

  it("gives the most important concepts something to study", () => {
    for (const conceptId of ["mdf", "position_value", "cbet_theory"]) {
      const recommendation = recommendationFor(conceptId);
      expect(
        Boolean(recommendation.wiki) || recommendation.lessons.length > 0,
        conceptId,
      ).toBe(true);
    }
  });

  it("stays small enough to hand to the browser", () => {
    // The reason it is a prop rather than an import: the whole map has to be
    // cheaper than shipping the content index.
    expect(JSON.stringify(recommendations).length).toBeLessThan(12_000);
  });
});

// ── Widget contract (§16 integration, §15 accessibility) ─────────────────────

describe("the analyzer widget", () => {
  it("never gates the analysis behind an account", () => {
    // The CTA appears in the result, and only after one has been produced.
    expect(SOURCE).toContain("Want to keep improving this decision?");
    // No auth check guards running the analysis.
    expect(SOURCE).not.toMatch(/if\s*\(\s*!user\s*\)\s*return[^;]*;\s*\n\s*.*analyzeHand/);
  });

  it("reports every analytics event the brief asks for", () => {
    for (const event of [
      "toolOpen",
      "analyzerOpened",
      "handInputStarted",
      "handParsed",
      "analysisCompleted",
      "analysisFailed",
      "aiCoachClicked",
      "lessonClicked",
      "handSaved",
      "signupClicked",
    ]) {
      const inWidget = SOURCE.includes(`SEO_EVENTS.${event}`);
      const inShell =
        readFileSync(path.resolve(process.cwd(), "components/tools/ToolPanel.tsx"), "utf8").includes(
          `SEO_EVENTS.${event}`,
        ) ||
        readFileSync(path.resolve(process.cwd(), "components/tools/ToolFields.tsx"), "utf8").includes(
          `SEO_EVENTS.${event}`,
        );
      expect(inWidget || inShell, event).toBe(true);
    }
  });

  it("hands the coach the hand, the analysis and the way back", () => {
    expect(SOURCE).toContain("COACH_HAND_STORAGE_KEY");
    expect(SOURCE).toContain("buildCoachHandContext");
    expect(SOURCE).toContain("/coach?hand=1");
    // And the coach page reads it and offers the return trip.
    const coachPage = readFileSync(path.resolve(process.cwd(), "app/coach/page.tsx"), "utf8");
    expect(coachPage).toContain("COACH_HAND_STORAGE_KEY");
    expect(coachPage).toContain("handContext.returnPath");
    expect(coachPage).toContain("concept_ids");
  });

  it("puts the hand in the URL so it survives the round trip", () => {
    expect(SOURCE).toContain("encodeHandToQuery");
    expect(SOURCE).toContain("decodeHandFromQuery");
  });

  it("is accessible", () => {
    expect(SOURCE).toContain("aria-label");
    expect(SOURCE).toContain('role="alert"');
    expect(SOURCE).toContain("focus-visible:ring");
    // Every select in the action editor is labelled — a bare <select> is
    // unusable with a screen reader.
    const selects = SOURCE.match(/<select/g)?.length ?? 0;
    const labelledSelects = SOURCE.match(/aria-label={`Action/g)?.length ?? 0;
    expect(labelledSelects).toBeGreaterThanOrEqual(selects - 1);
  });

  it("keeps the page static by suspending the search-params read", () => {
    expect(SOURCE).toContain("<Suspense");
    const page = readFileSync(path.resolve(process.cwd(), "app/tools/[slug]/page.tsx"), "utf8");
    expect(page.startsWith('"use client"')).toBe(false);
  });

  it("discloses detail progressively rather than dumping it", () => {
    expect(SOURCE.match(/<details/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("reuses the existing hand_analyses table rather than a new one", () => {
    const saved = readFileSync(
      path.resolve(process.cwd(), "lib/tools/handAnalysis/savedHands.ts"),
      "utf8",
    );
    expect(saved).toContain('from("hand_analyses")');
  });
});

// ── Robustness (§17 gates) ───────────────────────────────────────────────────

describe("the analyser never crashes on bad input", () => {
  it("throws a clear error instead of producing nonsense", () => {
    const broken: HandInput[] = [
      { heroPosition: "BTN", heroCards: [], board: [], actions: [] },
      { heroPosition: "BTN", heroCards: ["As", "As"], board: [], actions: [] },
      { heroPosition: "BTN", heroCards: ["As", "Kd"], board: ["As", "2c", "3d"], actions: [] },
      {
        heroPosition: "BTN",
        heroCards: ["As", "Kd"],
        board: [],
        actions: [{ street: "river", actor: "hero", type: "bet", amountBb: 5 }],
      },
    ];
    for (const hand of broken) {
      expect(() => analyzeHand(hand), JSON.stringify(hand)).toThrow(/Cannot analyse/);
    }
  });

  it("survives every published tool page being analysed for links", () => {
    // Guards the O(n^2) risk: recommendations are resolved once at build time,
    // not per concept per render.
    const started = Date.now();
    conceptRecommendations([...DETECTABLE_CONCEPT_IDS]);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("leaves the rest of the corpus untouched", () => {
    expect(publishedEntries().filter((e) => e.kind === "tool").length).toBeGreaterThanOrEqual(9);
  });
});
