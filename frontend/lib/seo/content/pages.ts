import { SITE_DESCRIPTION, SITE_TAGLINE } from "../config";
import { ROUTES } from "../routes";
import { blogEntries } from "./blog";
import type { SeoEntry } from "../types";

/**
 * The hand-written marketing/legal pages (§2).
 *
 * They live in the index so they appear in the sitemap, in llms.txt and in
 * internal search alongside generated content — one list, no second registry
 * for "the pages we wrote by hand".
 *
 * No `body` here: these routes render their own bespoke React, so the entry
 * carries metadata and sitemap facts only.
 */

const PAGES: SeoEntry[] = [
  {
    kind: "page",
    slug: "home",
    path: ROUTES.home,
    title: `StackedPoker — ${SITE_TAGLINE}`,
    summary: SITE_DESCRIPTION,
    status: "published",
    tags: ["poker", "poker strategy", "learn poker", "poker training"],
    clusters: ["poker-strategy"],
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    kind: "page",
    slug: "courses",
    path: ROUTES.courses,
    title: "Poker Courses: Preflop to Postflop Lessons",
    summary:
      "Every StackedPoker module, in the order they are meant to be taken — from the rules of Hold'em to range construction.",
    status: "published",
    tags: ["poker course", "poker curriculum", "learn poker"],
    clusters: ["poker-strategy"],
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    kind: "page",
    slug: "wiki",
    path: ROUTES.wiki,
    title: "Poker Strategy Wiki: Concepts Explained",
    summary:
      "Plain-English reference articles on the concepts that decide poker hands: MDF, range advantage, polarization, blockers and more.",
    status: "published",
    tags: ["poker wiki", "poker concepts", "poker theory"],
    clusters: ["poker-strategy"],
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    kind: "page",
    slug: "glossary",
    path: ROUTES.glossary,
    title: "Poker Glossary",
    summary:
      "An A–Z of poker terminology, each term defined in one sentence and linked to the lesson that teaches it.",
    status: "published",
    tags: ["poker glossary", "poker terms", "poker dictionary"],
    clusters: ["glossary"],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    kind: "page",
    slug: "tools",
    path: ROUTES.tools,
    title: "Free Poker Tools",
    summary:
      "Free calculators and trainers for pot odds, outs, expected value and poker terminology.",
    status: "published",
    tags: ["poker tools", "poker calculator", "free poker tools"],
    clusters: ["equity"],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    kind: "page",
    slug: "blog",
    path: ROUTES.blog,
    title: "Poker Strategy Blog",
    summary: "Strategy writing from the StackedPoker Theory Team.",
    // Overridden below: an index with nothing on it is a soft 404, so the hub
    // is noindex until the first post exists. Publishing one flips it back
    // with no code change (§9).
    status: "published",
    tags: ["poker blog", "poker strategy articles"],
    clusters: ["poker-strategy"],
    priority: 0.6,
    changeFrequency: "weekly",
  },
  {
    kind: "page",
    slug: "search",
    path: ROUTES.search,
    title: "Search Poker Topics",
    summary: "Browse StackedPoker by topic — concepts, lessons, terms and tools in one place.",
    status: "published",
    tags: ["poker topics", "poker search"],
    clusters: ["poker-strategy"],
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    kind: "page",
    slug: "pricing",
    path: ROUTES.pricing,
    title: "Pricing: Free Poker Training and Paid Plans",
    summary:
      "StackedPoker plans: a free tier with two full modules, plus Plus and Elite for the complete curriculum.",
    status: "published",
    tags: ["poker training pricing", "poker course cost"],
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    kind: "page",
    slug: "privacy",
    path: ROUTES.privacy,
    title: "Privacy Policy",
    summary: "How StackedPoker handles your data.",
    status: "published",
    tags: [],
    priority: 0.2,
    changeFrequency: "yearly",
  },
  {
    kind: "page",
    slug: "terms",
    path: ROUTES.terms,
    title: "Terms of Service",
    summary: "The terms that govern use of StackedPoker.",
    status: "published",
    tags: [],
    priority: 0.2,
    changeFrequency: "yearly",
  },
];

export function staticPageEntries(): SeoEntry[] {
  const hasPosts = blogEntries().length > 0;
  return PAGES.map((page) =>
    page.slug === "blog" && !hasPosts ? { ...page, status: "planned" as const } : page,
  );
}

export function staticPageEntry(path: string): SeoEntry | undefined {
  return staticPageEntries().find((p) => p.path === path);
}
