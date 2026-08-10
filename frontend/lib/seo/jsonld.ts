import { getSiteUrl } from "@/lib/site-url";
import {
  AUTHORITY_TEAM,
  CONTACT_EMAIL,
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SOCIAL_PROFILES,
} from "./config";
import { absoluteUrl } from "./routes";
import type { FaqItem, SeoEntry } from "./types";

/**
 * JSON-LD builders + a schema validator (§3).
 *
 * Two rules hold everywhere in this file:
 *
 * 1. Every node carries a stable `@id` built from its canonical URL, so the
 *    graph nodes on a page reference each other instead of repeating
 *    themselves. Google and the LLM crawlers both dereference `@id`.
 * 2. Nothing is emitted that the page does not visibly render. A FAQPage
 *    with questions that only exist in the markup is a manual-action risk,
 *    so `faqPage()` is always fed the same array the FAQ component renders.
 */

export type JsonLdNode = Record<string, unknown>;

const ORG_ID = "#organization";
const SITE_ID = "#website";

function id(fragment: string, origin = getSiteUrl()): string {
  return `${origin.replace(/\/$/, "")}/${fragment.replace(/^\/?#?/, "#")}`;
}

// ── Site-level nodes ─────────────────────────────────────────────────────────

export function organization(origin = getSiteUrl()): JsonLdNode {
  const sameAs = SOCIAL_PROFILES.filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": id(ORG_ID, origin),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    url: origin,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icon.png", origin),
    },
    description: SITE_DESCRIPTION,
    email: CONTACT_EMAIL,
    knowsAbout: [
      "Texas Hold'em strategy",
      "Game theory optimal poker",
      "Preflop ranges",
      "Postflop strategy",
      "Poker mathematics",
    ],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function webSite(origin = getSiteUrl()): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": id(SITE_ID, origin),
    name: SITE_NAME,
    url: origin,
    description: SITE_DESCRIPTION,
    publisher: { "@id": id(ORG_ID, origin) },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin.replace(/\/$/, "")}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplication(origin = getSiteUrl()): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: origin,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web browser",
    description: SITE_DESCRIPTION,
    publisher: { "@id": id(ORG_ID, origin) },
    // Priced tiers exist (see app/pricing) alongside a genuinely free tier;
    // both are declared so the offer block is not misleading.
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "EUR",
        category: "free",
        url: absoluteUrl("/pricing", origin),
      },
    ],
  };
}

// ── Page-level nodes ─────────────────────────────────────────────────────────

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function breadcrumbList(items: BreadcrumbEntry[], origin = getSiteUrl()): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, origin),
    })),
  };
}

export function faqPage(faqs: FaqItem[], origin = getSiteUrl(), pagePath?: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(pagePath ? { "@id": `${absoluteUrl(pagePath, origin)}#faq` } : {}),
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export interface CourseInput {
  name: string;
  description: string;
  path: string;
  /** Lesson titles, in order — becomes the syllabus. */
  lessonTitles?: string[];
  difficulty?: string;
  /** ISO 8601 duration, e.g. "PT3H20M". */
  duration?: string;
}

export function course(input: CourseInput, origin = getSiteUrl()): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: input.name,
    description: input.description,
    url,
    provider: { "@id": id(ORG_ID, origin) },
    inLanguage: "en",
    // Required by Google's Course rich result: how the course is delivered.
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: input.duration ?? "PT1H",
    },
    ...(input.difficulty ? { educationalLevel: input.difficulty } : {}),
    ...(input.lessonTitles?.length
      ? {
          syllabusSections: input.lessonTitles.map((title, index) => ({
            "@type": "Syllabus",
            name: title,
            position: index + 1,
          })),
        }
      : {}),
  };
}

export interface LearningResourceInput {
  name: string;
  description: string;
  path: string;
  /** Concept names this lesson teaches. */
  teaches?: string[];
  difficulty?: string;
  /** Minutes. Converted to an ISO 8601 duration. */
  timeRequiredMin?: number;
  updated?: string;
  partOfCoursePath?: string;
}

export function learningResource(
  input: LearningResourceInput,
  origin = getSiteUrl(),
): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#lesson`,
    name: input.name,
    description: input.description,
    url,
    learningResourceType: "Interactive lesson",
    inLanguage: "en",
    provider: { "@id": id(ORG_ID, origin) },
    publisher: { "@id": id(ORG_ID, origin) },
    ...(input.teaches?.length ? { teaches: input.teaches } : {}),
    ...(input.difficulty ? { educationalLevel: input.difficulty } : {}),
    ...(input.timeRequiredMin ? { timeRequired: `PT${Math.round(input.timeRequiredMin)}M` } : {}),
    ...(input.updated ? { dateModified: input.updated } : {}),
    ...(input.partOfCoursePath
      ? { isPartOf: { "@id": `${absoluteUrl(input.partOfCoursePath, origin)}#course` } }
      : {}),
  };
}

export interface ArticleInput {
  headline: string;
  description: string;
  path: string;
  published?: string;
  modified?: string;
  section?: string;
  keywords?: string[];
  /** Word count of the rendered body — an E-E-A-T depth signal. */
  wordCount?: number;
}

export function article(input: ArticleInput, origin = getSiteUrl()): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: AUTHORITY_TEAM, url: origin },
    publisher: { "@id": id(ORG_ID, origin) },
    inLanguage: "en",
    ...(input.published ? { datePublished: input.published } : {}),
    ...(input.modified ? { dateModified: input.modified } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
  };
}

/** A glossary term. `DefinedTerm` inside a `DefinedTermSet` is the correct pair. */
export function definedTerm(
  term: { name: string; description: string; path: string },
  setPath: string,
  origin = getSiteUrl(),
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${absoluteUrl(term.path, origin)}#${encodeURIComponent(term.name.toLowerCase())}`,
    name: term.name,
    description: term.description,
    inDefinedTermSet: { "@id": `${absoluteUrl(setPath, origin)}#termset` },
  };
}

export function definedTermSet(
  input: { name: string; description: string; path: string },
  origin = getSiteUrl(),
): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${url}#termset`,
    name: input.name,
    description: input.description,
    url,
    publisher: { "@id": id(ORG_ID, origin) },
  };
}

/** Collection/hub pages — `/wiki`, `/tools`, a search results page. */
export function itemList(
  input: { name: string; description: string; path: string; entries: SeoEntry[] },
  origin = getSiteUrl(),
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(input.path, origin)}#list`,
    name: input.name,
    description: input.description,
    numberOfItems: input.entries.length,
    itemListElement: input.entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.title,
      url: absoluteUrl(entry.path, origin),
    })),
  };
}

export function webApplicationTool(
  input: { name: string; description: string; path: string; category?: string },
  origin = getSiteUrl(),
): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#tool`,
    name: input.name,
    description: input.description,
    url,
    applicationCategory: input.category ?? "EducationalApplication",
    applicationSubCategory: "Poker calculator",
    operatingSystem: "Web browser",
    publisher: { "@id": id(ORG_ID, origin) },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  };
}

// ── Validation (§3) ──────────────────────────────────────────────────────────

/**
 * Required properties per schema type. Deliberately a subset: these are the
 * fields Google's structured-data tests treat as *required* (not merely
 * recommended), so a passing validation here means the rich result is
 * eligible rather than merely well-formed.
 */
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Organization: ["name", "url"],
  WebSite: ["name", "url"],
  SoftwareApplication: ["name", "applicationCategory", "offers"],
  BreadcrumbList: ["itemListElement"],
  FAQPage: ["mainEntity"],
  Course: ["name", "description", "provider", "hasCourseInstance"],
  LearningResource: ["name", "description"],
  Article: ["headline", "author", "publisher"],
  DefinedTerm: ["name", "description", "inDefinedTermSet"],
  DefinedTermSet: ["name"],
  ItemList: ["itemListElement"],
};

export interface JsonLdValidation {
  valid: boolean;
  errors: string[];
}

/** Structural validation of one node (recursing into FAQ/breadcrumb children). */
export function validateJsonLd(node: unknown): JsonLdValidation {
  const errors: string[] = [];

  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return { valid: false, errors: ["node must be a plain object"] };
  }
  const record = node as JsonLdNode;

  if (record["@context"] !== "https://schema.org") {
    errors.push('missing or wrong "@context" (expected "https://schema.org")');
  }

  const type = record["@type"];
  if (typeof type !== "string" || !type) {
    errors.push('missing "@type"');
    return { valid: false, errors };
  }

  for (const prop of REQUIRED_PROPERTIES[type] ?? []) {
    const value = record[prop];
    if (value === undefined || value === null || value === "") {
      errors.push(`${type}: missing required property "${prop}"`);
    } else if (Array.isArray(value) && value.length === 0) {
      errors.push(`${type}: required property "${prop}" is empty`);
    }
  }

  if (type === "FAQPage" && Array.isArray(record.mainEntity)) {
    record.mainEntity.forEach((q, i) => {
      const question = q as JsonLdNode;
      if (!question.name) errors.push(`FAQPage: question ${i} has no name`);
      const answer = question.acceptedAnswer as JsonLdNode | undefined;
      if (!answer?.text) errors.push(`FAQPage: question ${i} has no acceptedAnswer.text`);
    });
  }

  if (type === "BreadcrumbList" && Array.isArray(record.itemListElement)) {
    record.itemListElement.forEach((entry, i) => {
      const listItem = entry as JsonLdNode;
      if (listItem.position !== i + 1) {
        errors.push(`BreadcrumbList: item ${i} has position ${String(listItem.position)}, expected ${i + 1}`);
      }
      if (!listItem.name) errors.push(`BreadcrumbList: item ${i} has no name`);
      if (!listItem.item) errors.push(`BreadcrumbList: item ${i} has no item URL`);
    });
  }

  // `undefined` survives object spread but not JSON.stringify. Catching it
  // here keeps builders from silently emitting half-populated nodes.
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) errors.push(`${type}: property "${key}" is undefined`);
  }

  return { valid: errors.length === 0, errors };
}

/** Throws on an invalid node — used by tests and by <JsonLd> in development. */
export function assertValidJsonLd(node: unknown): void {
  const { valid, errors } = validateJsonLd(node);
  if (!valid) {
    throw new Error(`Invalid JSON-LD:\n  - ${errors.join("\n  - ")}`);
  }
}

/**
 * Serialises a node for a `<script type="application/ld+json">` body.
 * `<` is escaped so a stray closing tag inside a description can never
 * terminate the script element early.
 */
export function serializeJsonLd(node: unknown): string {
  return JSON.stringify(node, (_key, value) => (value === undefined ? undefined : value))
    .replace(/</g, "\\u003c");
}
