import { describe, expect, it } from "vitest";
import {
  article,
  breadcrumbList,
  course,
  definedTerm,
  definedTermSet,
  faqPage,
  itemList,
  learningResource,
  organization,
  serializeJsonLd,
  softwareApplication,
  validateJsonLd,
  webApplicationTool,
  webSite,
} from "../jsonld";
import { allEntries, publishedEntries } from "../content";
import { courseEntries, LESSONS_BY_MODULE, MODULES_BY_SLUG } from "../content/lessons";
import { glossaryTerms } from "../content/glossary";
import { breadcrumbsFor } from "../related";
import { ROUTES } from "../routes";

const valid = (node: unknown) => validateJsonLd(node);

describe("site-level nodes", () => {
  it("are valid", () => {
    for (const node of [organization(), webSite(), softwareApplication()]) {
      expect(valid(node).errors).toEqual([]);
    }
  });

  it("give Organization and WebSite stable @ids that reference each other", () => {
    const org = organization();
    const site = webSite();
    expect(String(org["@id"])).toMatch(/#organization$/);
    expect(site.publisher).toEqual({ "@id": org["@id"] });
  });
});

describe("page-level builders", () => {
  it("produce a valid BreadcrumbList with 1-based positions", () => {
    const node = breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Poker Wiki", path: "/wiki" },
      { name: "MDF", path: "/wiki/mdf" },
    ]);
    expect(valid(node).errors).toEqual([]);
    const items = node.itemListElement as { position: number }[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("rejects a BreadcrumbList with broken positions", () => {
    const broken = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ "@type": "ListItem", position: 5, name: "x", item: "https://x.test/" }],
    };
    expect(validateJsonLd(broken).valid).toBe(false);
  });

  it("produces a valid FAQPage and rejects an answerless question", () => {
    expect(valid(faqPage([{ question: "What is MDF?", answer: "Minimum defense frequency." }])).errors).toEqual([]);

    const broken = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "What is MDF?" }],
    };
    expect(validateJsonLd(broken).valid).toBe(false);
  });

  it("produces a Course with the hasCourseInstance Google requires", () => {
    const node = course({
      name: "Blockers & Card Removal",
      description: "Card removal and what it does to villain's range.",
      path: "/courses/blockers-module",
      lessonTitles: ["One", "Two"],
      duration: "PT1H30M",
    });
    expect(valid(node).errors).toEqual([]);
    expect(node.hasCourseInstance).toBeTruthy();
  });

  it("produces valid LearningResource, Article, tool and list nodes", () => {
    expect(
      valid(
        learningResource({
          name: "Blockers",
          description: "What blockers do.",
          path: "/learn/blockers",
          teaches: ["blockers"],
          timeRequiredMin: 12,
        }),
      ).errors,
    ).toEqual([]);

    expect(
      valid(
        article({
          headline: "Range advantage",
          description: "What it is.",
          path: "/wiki/range-advantage",
        }),
      ).errors,
    ).toEqual([]);

    expect(
      valid(
        webApplicationTool({
          name: "Pot Odds Calculator",
          description: "Required equity for any bet size.",
          path: "/tools/pot-odds-calculator",
        }),
      ).errors,
    ).toEqual([]);

    expect(
      valid(
        itemList({
          name: "Wiki",
          description: "All articles",
          path: "/wiki",
          entries: publishedEntries().slice(0, 3),
        }),
      ).errors,
    ).toEqual([]);
  });

  it("flags an undefined property rather than silently dropping it", () => {
    const node = { "@context": "https://schema.org", "@type": "DefinedTermSet", name: undefined };
    expect(validateJsonLd(node).valid).toBe(false);
  });
});

/**
 * The builders are exercised against the REAL corpus, not fixtures: a wiki
 * article with an empty summary or a lesson with no title would produce
 * invalid markup on a live URL, and that is what this catches.
 */
describe("generated corpus", () => {
  it("emits a valid Article node for every published wiki page", () => {
    for (const entry of publishedEntries().filter((e) => e.kind === "wiki")) {
      const node = article({
        headline: entry.title,
        description: entry.summary,
        path: entry.path,
        published: entry.authority?.updated,
      });
      expect(validateJsonLd(node).errors, entry.path).toEqual([]);
    }
  });

  it("emits a valid Course node for every module", () => {
    for (const entry of courseEntries()) {
      const module = MODULES_BY_SLUG[entry.slug];
      const node = course({
        name: entry.title,
        description: entry.summary,
        path: entry.path,
        lessonTitles: (LESSONS_BY_MODULE[module.id] ?? []).map((l) => l.title),
      });
      expect(validateJsonLd(node).errors, entry.path).toEqual([]);
    }
  });

  it("emits a valid FAQPage wherever a page has FAQs", () => {
    for (const entry of allEntries().filter((e) => e.faqs?.length)) {
      expect(validateJsonLd(faqPage(entry.faqs!, undefined, entry.path)).errors, entry.path).toEqual(
        [],
      );
    }
  });

  it("emits a valid BreadcrumbList for every entry", () => {
    for (const entry of allEntries()) {
      const crumbs = breadcrumbsFor(entry);
      expect(crumbs[0].path, entry.path).toBe("/");
      if (crumbs.length > 1) {
        expect(validateJsonLd(breadcrumbList(crumbs)).errors, entry.path).toEqual([]);
      }
    }
  });

  it("emits a valid DefinedTerm for every glossary term", () => {
    const set = definedTermSet({ name: "Glossary", description: "Terms", path: ROUTES.glossary });
    expect(validateJsonLd(set).errors).toEqual([]);

    for (const term of glossaryTerms()) {
      const node = definedTerm(
        { name: term.term, description: term.definition, path: `/glossary/x#${term.slug}` },
        ROUTES.glossary,
      );
      expect(validateJsonLd(node).errors, term.term).toEqual([]);
    }
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a description cannot close the script tag", () => {
    const json = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c");
  });
});
