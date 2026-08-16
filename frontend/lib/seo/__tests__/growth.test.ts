import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import {
  AI_PROMPTS,
  OBSERVATIONS,
  promptVisibility,
  validateObservation,
  visibilitySummary,
  type AiObservation,
} from "../aiVisibility";
import { allEntries, publishedEntries } from "../content";
import { landingEntries } from "../content/landing";
import { entryMetadata } from "../metadata";
import { funnelStage, intentOf, primaryQuestion, INTENT_WEIGHT } from "../intent";
import {
  backlinkTargets,
  clusterHealth,
  CLUSTER_ROLES,
  linkWorthyAssets,
  opportunities,
  topicCoverage,
} from "../opportunity";
import { renderGrowthReport } from "../growthReport";
import { structuredDataFor } from "../structuredData";
import { TOPICS } from "../topics";
import { validateContentQuality, validateSeo } from "../validate";

// ── Intent ───────────────────────────────────────────────────────────────────

describe("search intent", () => {
  it("classifies every indexable page", () => {
    for (const entry of publishedEntries()) {
      expect(INTENT_WEIGHT[intentOf(entry)], entry.path).toBeGreaterThan(0);
    }
  });

  it("treats the money pages as commercial and the reference as informational", () => {
    const byPath = new Map(allEntries().map((e) => [e.path, e]));
    expect(intentOf(byPath.get("/")!)).toBe("commercial");
    expect(intentOf(byPath.get("/pricing")!)).toBe("commercial");
    expect(intentOf(byPath.get("/poker-training")!)).toBe("commercial");
    expect(intentOf(byPath.get("/wiki/mdf")!)).toBe("informational");
    expect(intentOf(byPath.get("/tools/pot-odds-calculator")!)).toBe("transactional");
  });

  it("orders the funnel from definition to decision", () => {
    const byPath = new Map(allEntries().map((e) => [e.path, e]));
    expect(funnelStage(byPath.get("/glossary/c")!)).toBeLessThan(funnelStage(byPath.get("/wiki/mdf")!));
    expect(funnelStage(byPath.get("/wiki/mdf")!)).toBeLessThan(
      funnelStage(byPath.get("/tools/pot-odds-calculator")!),
    );
  });

  it("states a question for every page", () => {
    for (const entry of publishedEntries()) {
      expect(primaryQuestion(entry).length, entry.path).toBeGreaterThan(10);
    }
  });
});

// ── Topic map ────────────────────────────────────────────────────────────────

describe("topic map", () => {
  it("has unique ids and at least one query each", () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of TOPICS) {
      expect(topic.queries.length, topic.id).toBeGreaterThan(0);
      expect(topic.rationale.length, topic.id).toBeGreaterThan(30);
    }
  });

  it("invents no search volumes", () => {
    // The constraint is explicit: no volume data exists, so any number that
    // looked like one would be fabricated. Priority is a word, not a figure.
    const source = readFileSync(path.resolve(process.cwd(), "lib/seo/topics.ts"), "utf8");
    expect(source).not.toMatch(/volume\s*[:=]\s*\d/i);
    expect(source).not.toMatch(/searches\s*per\s*month/i);
    for (const topic of TOPICS) {
      expect(["high", "medium", "low"]).toContain(topic.priority);
    }
  });

  it("keeps every Dutch topic low priority while the site is English-only", () => {
    const dutch = TOPICS.filter((t) => t.language === "nl");
    expect(dutch.length).toBeGreaterThan(0);
    for (const topic of dutch) {
      expect(topic.priority, topic.id).toBe("low");
    }
  });

  it("only counts a page as covering a topic when it covers the whole phrase", () => {
    const coverage = topicCoverage();
    // "poker hand analyzer" now HAS a page — it was the top-scoring content
    // gap this model identified, and it has since been built. What the strict
    // matcher still guarantees is that coverage stays small and specific
    // rather than counting every page containing the word "hand".
    const analyzer = coverage.find((c) => c.topic.id === "hand-analyzer")!;
    expect(analyzer.anchor?.path).toBe("/tools/poker-hand-analyzer");
    expect(analyzer.matches.length).toBeLessThan(5);

    // A topic that IS covered still reports coverage.
    const potOdds = coverage.find((c) => c.topic.id === "pot-odds")!;
    expect(potOdds.matches.length).toBeGreaterThan(0);
    expect(potOdds.anchor).toBeTruthy();
  });

  it("points an informational topic at an explainer, not at a tool sharing a word", () => {
    const position = topicCoverage().find((c) => c.topic.id === "position")!;
    if (position.anchor) expect(intentOf(position.anchor)).toBe(position.topic.intent);
  });
});

// ── Clusters and opportunity ─────────────────────────────────────────────────

describe("cluster health", () => {
  const health = clusterHealth();

  it("scores every topical cluster on every role", () => {
    expect(health.length).toBeGreaterThan(5);
    for (const cluster of health) {
      for (const role of CLUSTER_ROLES) {
        expect(typeof cluster.roles[role], `${cluster.id}.${role}`).toBe("boolean");
      }
      expect(cluster.completeness).toBeGreaterThanOrEqual(0);
      expect(cluster.completeness).toBeLessThanOrEqual(1);
      expect(cluster.completeness).toBeCloseTo(
        (CLUSTER_ROLES.length - cluster.missing.length) / CLUSTER_ROLES.length,
        10,
      );
    }
  });

  it("credits glossary coverage through the terms, not the alphabet", () => {
    // Glossary pages are grouped A–Z, so without this every topical cluster
    // would report a glossary gap it does not have.
    const equity = health.find((c) => c.id === "equity")!;
    expect(equity.roles.glossary).toBe(true);
  });

  it("ranks an unanchored cluster above a merely incomplete one", () => {
    const unanchored = health.filter((c) => !c.roles.wiki);
    for (const cluster of unanchored) expect(cluster.priority).toBe("HIGH");
  });
});

describe("opportunity score", () => {
  const rows = opportunities();

  it("ranks every topic and sorts by score", () => {
    expect(rows.length).toBe(TOPICS.length);
    const scores = rows.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("shows its working", () => {
    for (const row of rows) {
      expect(row.reason.length, row.id).toBeGreaterThan(20);
      expect(row.recommendation.length, row.id).toBeGreaterThan(20);
      expect(["content", "authority", "none"]).toContain(row.gap);
    }
  });

  it("separates a content gap from an authority gap", () => {
    // The distinction the whole exercise turns on: a topic with no page is a
    // content gap; a well-linked page that still is not winning is not.
    const noPage = rows.filter((r) => !r.path);
    expect(noPage.length).toBeGreaterThan(0);
    for (const row of noPage) expect(row.gap).toBe("content");

    for (const row of backlinkTargets()) {
      expect(row.path, row.id).toBeTruthy();
      expect(row.recommendation).toMatch(/outside the site/);
    }
  });

  it("nominates only genuinely strong pages as link targets", () => {
    for (const asset of linkWorthyAssets()) {
      expect(["tool", "wiki"]).toContain(asset.kind);
      expect(asset.status).toBe("published");
    }
  });
});

// ── AI visibility ────────────────────────────────────────────────────────────

describe("AI visibility dataset", () => {
  it("has unique prompt ids across several intents and both languages", () => {
    const ids = AI_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(AI_PROMPTS.map((p) => p.intent)).size).toBeGreaterThanOrEqual(4);
    expect(AI_PROMPTS.some((p) => p.language === "nl")).toBe(true);
    expect(AI_PROMPTS.length).toBeGreaterThan(20);
  });

  it("only nominates target pages that exist", () => {
    const known = new Set(allEntries().map((e) => e.path));
    for (const prompt of AI_PROMPTS) {
      if (prompt.targetPath) expect(known.has(prompt.targetPath), prompt.id).toBe(true);
    }
  });

  it("reports an untested prompt as never-tested, not as absent", () => {
    // The distinction that keeps the dataset honest: we have not run these,
    // so we do not know that we are missing — only that we have not looked.
    expect(OBSERVATIONS).toEqual([]);
    const summary = visibilitySummary();
    expect(summary.neverTested).toBe(summary.total);
    expect(summary.mentioned).toBe(0);
    expect(summary.absent).toBe(0);
  });

  it("classifies each prompt as a content or authority gap", () => {
    for (const row of promptVisibility()) {
      expect(["content", "authority", "none"]).toContain(row.gap);
      expect(row.recommendation.length).toBeGreaterThan(20);
      // A prompt with no nominated page is a content gap by definition.
      if (!row.hasTargetPage) expect(row.gap).toBe("content");
    }
  });

  it("validates a recorded observation", () => {
    const good: AiObservation = {
      promptId: AI_PROMPTS[0].id,
      date: "2026-08-12",
      platform: "perplexity",
      mentioned: true,
      rank: 2,
      competitors: ["GTO Wizard"],
      citations: ["https://stackedpokerai.com/courses"],
    };
    expect(validateObservation(good)).toEqual([]);

    expect(validateObservation({ ...good, promptId: "nope" })).toContain('unknown promptId "nope"');
    expect(validateObservation({ ...good, date: "yesterday" })[0]).toMatch(/ISO date/);
    expect(validateObservation({ ...good, citations: ["/courses"] })[0]).toMatch(/absolute URL/);
    expect(validateObservation({ ...good, mentioned: false })[0]).toMatch(/did not mention us/);
  });
});

// ── The landing page ─────────────────────────────────────────────────────────

describe("commercial landing page", () => {
  const entry = landingEntries()[0];

  it("is a normal SeoEntry in the one content index", () => {
    expect(allEntries().some((e) => e.path === entry.path)).toBe(true);
    expect(entry.status).toBe("published");
  });

  it("gets the full treatment from the existing pipeline", () => {
    const meta = entryMetadata(entry, { origin: CANONICAL_SITE_URL });
    expect(meta.alternates?.canonical).toBe(`${CANONICAL_SITE_URL}/poker-training`);
    const types = structuredDataFor(entry, { origin: CANONICAL_SITE_URL }).map((n) => n["@type"]);
    expect(types).toContain("WebPage");
    expect(types).toContain("FAQPage");
  });

  it("makes no competitor claims", () => {
    // Judged on the rendered content, not the source: a comment explaining
    // the rule is not a claim, and only what ships can mislead a reader.
    const rendered = JSON.stringify(entry);
    for (const rival of ["GTO Wizard", "PokerTracker", "Upswing", "Run It Once", "PioSolver"]) {
      expect(rendered, rival).not.toContain(rival);
    }
    expect(rendered).not.toMatch(/better than|beats? the competition|unlike other/i);
  });

  it("does not restate prices, which live on /pricing", () => {
    const text = JSON.stringify(entry);
    expect(text).not.toMatch(/€\s*\d/);
    expect(entry.relatedPaths).toContain("/pricing");
  });

  it("derives its figures from the registries", () => {
    // The counts in the copy must match the live corpus, or the page is
    // marketing fiction the moment content changes.
    const lessons = publishedEntries().filter((e) => e.kind === "lesson").length;
    const modules = publishedEntries().filter((e) => e.kind === "course").length;
    expect(entry.summary).toContain(String(lessons));
    expect(entry.summary).toContain(String(modules));
  });
});

// ── Gates ────────────────────────────────────────────────────────────────────

describe("growth validation gates", () => {
  it("adds thin-content, weak-title, broken-link and cluster-anchor checks", () => {
    const checks = new Set(validateContentQuality().map((i) => i.check));
    // Warnings are expected; errors are not.
    const errors = validateContentQuality().filter((i) => i.severity === "error");
    expect(errors.map((e) => `${e.subject}: ${e.message}`)).toEqual([]);
    expect([...checks].every((c) =>
      ["thin-content", "weak-title", "broken-link", "cluster-authority"].includes(c),
    )).toBe(true);
  });

  it("keeps the whole corpus passing", () => {
    const result = validateSeo(CANONICAL_SITE_URL);
    expect(result.errors.map((e) => `[${e.check}] ${e.subject}: ${e.message}`)).toEqual([]);
  });
});

// ── The reports stay developer-only ──────────────────────────────────────────

describe("growth reporting is not reachable over HTTP", () => {
  const appDir = path.resolve(process.cwd(), "app");
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }
  const routeFiles = walk(appDir).filter((f) => /\.(tsx?|jsx?)$/.test(f));

  it("has no route importing the growth report, opportunity model or AI dataset", () => {
    for (const module of ["lib/seo/growthReport", "lib/seo/opportunity", "lib/seo/aiVisibility"]) {
      const offenders = routeFiles.filter((file) => readFileSync(file, "utf8").includes(module));
      expect(offenders, module).toEqual([]);
    }
  });

  it("renders a report without throwing", () => {
    const report = renderGrowthReport();
    expect(report).toContain("SEO HEALTH");
    expect(report).toContain("KEYWORD / TOPIC MAP");
    expect(report).toContain("TOPIC CLUSTER HEALTH");
    expect(report).toContain("SEO OPPORTUNITY SCORE");
    expect(report).toContain("AI VISIBILITY");
    expect(report).toContain("BACKLINK OPPORTUNITIES");
  });
});
