import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { entriesInCluster, publishedEntries, searchEntries } from "@/lib/seo/content";
import {
  interactiveToolSlugs,
  toolEntries,
  toolEntryBySlug,
  toolHasWidget,
} from "@/lib/seo/content/tools";
import { linkGraph } from "@/lib/seo/graph";
import { entryMetadata } from "@/lib/seo/metadata";
import { resolveOgImageFile } from "@/lib/seo/ogAssets";
import { breadcrumbsFor, relatedTo } from "@/lib/seo/related";
import { entriesForSection } from "@/lib/seo/sitemap";
import { structuredDataFor } from "@/lib/seo/structuredData";
import { validateTools } from "@/lib/seo/validate";
import { calculateBankroll } from "../bankroll";
import { calculateEquity } from "../equity";
import { calculatePotOdds } from "../potOdds";
import { calculateVariance } from "../variance";

/**
 * The tools must be genuinely wired into the SEO architecture, not merely
 * adjacent to it. These assertions run over the real registries, so a tool
 * added later inherits the same requirements without anyone remembering to
 * extend this file.
 */

const TOOL_COMPONENT_DIR = path.resolve(process.cwd(), "components/tools");
const REGISTRY = readFileSync(path.join(TOOL_COMPONENT_DIR, "index.tsx"), "utf8");

const INTERACTIVE = [
  "pot-odds-calculator",
  "equity-calculator",
  "bankroll-calculator",
  "variance-calculator",
  "position-trainer",
  "starting-hand-quiz",
];

function widgetSource(slug: string): string {
  // "pot-odds-calculator" → "PotOddsCalculator.tsx"
  const component = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const file = path.join(TOOL_COMPONENT_DIR, `${component}.tsx`);
  expect(existsSync(file), `${slug} has no component at ${file}`).toBe(true);
  return readFileSync(file, "utf8");
}

describe("widget registry", () => {
  it("ships all six tools from the brief", () => {
    expect(interactiveToolSlugs().sort()).toEqual([...INTERACTIVE].sort());
  });

  it("has a component for every tool that declares a widget", () => {
    for (const slug of interactiveToolSlugs()) {
      expect(REGISTRY, slug).toContain(`"${slug}"`);
      expect(widgetSource(slug).length).toBeGreaterThan(500);
    }
  });

  it("declares no widget the SEO registry does not know about", () => {
    const registered = [...REGISTRY.matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]);
    for (const slug of registered) {
      expect(toolHasWidget(slug), `${slug} is in components/tools but not in the SEO registry`)
        .toBe(true);
    }
  });

  it("passes the build-time tool gate", () => {
    expect(validateTools().map((issue) => `${issue.subject}: ${issue.message}`)).toEqual([]);
  });
});

describe("every published tool is fully integrated into the SEO system", () => {
  const tools = toolEntries().filter((entry) => entry.status === "published");

  it("publishes at least the six new tools plus the existing ones", () => {
    expect(tools.length).toBeGreaterThanOrEqual(8);
  });

  it("has its own SeoEntry with a unique title and summary", () => {
    const titles = tools.map((t) => t.title);
    const summaries = tools.map((t) => t.summary);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  it("generates metadata with a self-referencing canonical", () => {
    for (const tool of tools) {
      const meta = entryMetadata(tool, { origin: CANONICAL_SITE_URL });
      expect(meta.alternates?.canonical, tool.path).toBe(`${CANONICAL_SITE_URL}${tool.path}`);
      expect((meta.robots as { index: boolean }).index, tool.path).toBe(true);
      expect(String(meta.title).length, tool.path).toBeGreaterThan(10);
    }
  });

  it("emits WebPage, BreadcrumbList, SoftwareApplication and FAQPage markup", () => {
    for (const tool of tools) {
      const types = structuredDataFor(tool, { origin: CANONICAL_SITE_URL }).map((n) => n["@type"]);
      expect(types, tool.path).toContain("WebPage");
      expect(types, tool.path).toContain("BreadcrumbList");
      expect(types, tool.path).toContain("SoftwareApplication");
      expect(types, tool.path).toContain("FAQPage");
    }
  });

  it("gets breadcrumbs ending at itself", () => {
    for (const tool of tools) {
      const crumbs = breadcrumbsFor(tool);
      expect(crumbs[0].path).toBe("/");
      expect(crumbs[1].path, tool.path).toBe("/tools");
      expect(crumbs.at(-1)?.path, tool.path).toBe(tool.path);
    }
  });

  it("resolves an OG image", () => {
    for (const tool of tools) {
      expect(resolveOgImageFile(tool), tool.path).toBeTruthy();
    }
  });

  it("appears in the tools sitemap", () => {
    const paths = entriesForSection("tools").map((e) => e.path);
    for (const tool of tools) expect(paths, tool.path).toContain(tool.path);
  });

  it("is findable through internal search", () => {
    for (const tool of tools) {
      const hits = searchEntries(tool.title, 40).map((hit) => hit.entry.path);
      expect(hits, tool.path).toContain(tool.path);
    }
  });

  it("belongs to a topic cluster", () => {
    for (const tool of tools) {
      expect(tool.clusters?.length, tool.path).toBeGreaterThan(0);
      for (const cluster of tool.clusters ?? []) {
        expect(entriesInCluster(cluster).map((e) => e.path), tool.path).toContain(tool.path);
      }
    }
  });

  it("links out to lessons, wiki articles, glossary pages and the other tools", () => {
    for (const tool of tools) {
      const related = tool.relatedPaths ?? [];
      expect(related.some((p) => p.startsWith("/tools/")), `${tool.path} → other tools`).toBe(true);
      expect(
        related.some((p) => p.startsWith("/learn/") || p.startsWith("/wiki/") || p.startsWith("/glossary/")),
        `${tool.path} → content`,
      ).toBe(true);
      expect(relatedTo(tool).length, tool.path).toBeGreaterThanOrEqual(4);
    }
  });

  it("is linked to from elsewhere on the site — no orphan tools", () => {
    const graph = linkGraph();
    for (const tool of tools) {
      expect(graph.pages.get(tool.path)?.incoming.length, tool.path).toBeGreaterThan(0);
    }
  });

  it("is surfaced by existing content through the related-content system", () => {
    const toolPaths = new Set(tools.map((t) => t.path));
    const surfaced = publishedEntries().some(
      (entry) =>
        entry.kind !== "tool" && relatedTo(entry).some((related) => toolPaths.has(related.path)),
    );
    expect(surfaced).toBe(true);
  });
});

describe("every tool page carries its educational content", () => {
  const tools = toolEntries().filter((entry) => entry.status === "published");

  it("has an introduction, a how-it-works, examples, mistakes and a takeaway", () => {
    for (const tool of tools) {
      const headings = (tool.body ?? []).map((section) => section.heading);
      expect(headings.some((h) => /^How .* works$/i.test(h)), tool.path).toBe(true);
      expect(headings, tool.path).toContain("Practical examples");
      expect(headings, tool.path).toContain("Common mistakes");
      expect(headings.at(-1), tool.path).toBe("Key takeaway");
    }
  });

  it("has FAQs and provenance", () => {
    for (const tool of tools) {
      expect(tool.faqs?.length, tool.path).toBeGreaterThanOrEqual(2);
      expect(tool.sourceNote, tool.path).toBeTruthy();
    }
  });

  it("defines its key terms from the glossary rather than restating them", () => {
    const withTerms = tools.filter((tool) =>
      (tool.body ?? []).some((section) => section.heading === "Key terms"),
    );
    expect(withTerms.length).toBeGreaterThanOrEqual(6);
    for (const tool of withTerms) {
      const section = (tool.body ?? []).find((s) => s.heading === "Key terms")!;
      expect(section.definitions?.length, tool.path).toBeGreaterThan(0);
    }
  });
});

describe("worked examples agree with the live calculators", () => {
  /** The page must never show a number the widget would not produce. */
  function examplesFor(slug: string) {
    const entry = toolEntryBySlug(slug)!;
    const section = (entry.body ?? []).find((s) => s.heading === "Practical examples");
    expect(section, slug).toBeTruthy();
    return section!.definitions ?? [];
  }

  it("pot odds", () => {
    const rows = examplesFor("pot-odds-calculator");
    const half = rows.find((row) => row.term === "100 pot, 50 bet");
    expect(half).toBeTruthy();
    const live = calculatePotOdds({ pot: 100, bet: 50 });
    expect(half!.description).toContain(`${live.requiredEquityPct.toFixed(1)}% equity`);
    expect(half!.description).toContain(live.oddsRatio);
  });

  it("equity", () => {
    const rows = examplesFor("equity-calculator");
    const live = calculateEquity(["Ah", "Kh"], ["Qs", "Qd"], ["Jh", "7h", "2c"]);
    const row = rows.find((r) => r.term.startsWith("AhKh vs QsQd"));
    expect(row).toBeTruthy();
    expect(row!.description).toContain(`${(live.heroEquity * 100).toFixed(2)}%`);
    expect(row!.description).toContain(live.boardsEvaluated.toLocaleString("en-US"));
  });

  it("bankroll", () => {
    const rows = examplesFor("bankroll-calculator");
    const live = calculateBankroll({ bankroll: 0, category: "cash", buyIn: 100, buyInCount: 40 });
    const row = rows.find((r) => r.term.startsWith("Cash Games"));
    expect(row).toBeTruthy();
    expect(row!.description).toContain(live.recommendedBankroll.toLocaleString("en-US"));
  });

  it("variance", () => {
    const rows = examplesFor("variance-calculator");
    const live = calculateVariance({ winRateBb100: 3, stdDevBb100: 100, hands: 100000 });
    const row = rows.find((r) => r.term.startsWith("100,000 hands"));
    expect(row).toBeTruthy();
    expect(row!.description).toContain(Math.round(live.lowerBb).toLocaleString("en-US"));
    expect(row!.description).toContain(`${live.probabilityOfLossPct.toFixed(1)}%`);
  });
});

describe("widget implementation requirements", () => {
  it("reports the analytics events the brief asks for", () => {
    // tool opened + attribution live in the shared shell; the rest are the
    // widget's own responsibility.
    const shell = readFileSync(path.join(TOOL_COMPONENT_DIR, "ToolPanel.tsx"), "utf8");
    expect(shell).toContain("SEO_EVENTS.toolOpen");
    expect(shell).toContain("rememberToolUse");
    expect(shell).toContain("SEO_EVENTS.toolShare");

    const fields = readFileSync(path.join(TOOL_COMPONENT_DIR, "ToolFields.tsx"), "utf8");
    expect(fields).toContain("SEO_EVENTS.toolInputChange");

    for (const slug of INTERACTIVE) {
      expect(widgetSource(slug), `${slug} never reports a completed calculation`).toContain(
        "SEO_EVENTS.toolCalculate",
      );
    }
  });

  it("credits a signup to the tool that produced it", () => {
    const signup = readFileSync(path.resolve(process.cwd(), "app/signup/page.tsx"), "utf8");
    expect(signup).toContain("readToolAttribution");
    expect(signup).toContain("SEO_EVENTS.toolAttributedSignup");
  });

  it("offers a reset on every tool", () => {
    for (const slug of INTERACTIVE) {
      expect(widgetSource(slug), `${slug} has no reset`).toContain("onReset");
    }
  });

  it("offers copy/share on every tool", () => {
    for (const slug of INTERACTIVE) {
      expect(widgetSource(slug), `${slug} has no copyable result`).toContain("copyText");
    }
  });

  it("announces results to assistive technology", () => {
    const shell = readFileSync(path.join(TOOL_COMPONENT_DIR, "ToolPanel.tsx"), "utf8");
    expect(shell).toContain('aria-live="polite"');
    // Validation problems interrupt; results do not.
    expect(shell).toContain('role="alert"');
  });

  it("labels every input", () => {
    const fields = readFileSync(path.join(TOOL_COMPONENT_DIR, "ToolFields.tsx"), "utf8");
    expect(fields).toContain("htmlFor={id}");
    expect(fields).toContain('role="radiogroup"');
    expect(fields).toContain("aria-checked");
    // A placeholder is not a label.
    expect(fields).toContain("<label");
  });

  it("shows a validation message rather than a broken result", () => {
    for (const slug of ["pot-odds-calculator", "equity-calculator", "bankroll-calculator", "variance-calculator"]) {
      expect(widgetSource(slug), `${slug} has no error state`).toContain("ToolError");
    }
  });

  it("lays out responsively rather than at a fixed width", () => {
    for (const slug of INTERACTIVE) {
      const source = widgetSource(slug);
      expect(
        /sm:grid-cols|FieldGrid|flex-wrap/.test(source),
        `${slug} has no responsive layout`,
      ).toBe(true);
    }
  });

  it("keeps the page a Server Component and only the widget on the client", () => {
    const page = readFileSync(path.resolve(process.cwd(), "app/tools/[slug]/page.tsx"), "utf8");
    expect(page.startsWith('"use client"')).toBe(false);
    expect(page).toContain("toolWidgetFor");
    for (const slug of INTERACTIVE) {
      expect(widgetSource(slug).startsWith('"use client"'), slug).toBe(true);
    }
  });
});
