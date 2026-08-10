import type { ArticleSection, FaqItem, SeoEntry } from "./types";

/** Average adult reading speed for technical prose. */
const WORDS_PER_MINUTE = 200;

/** Every human-readable string in a section, flattened. */
export function sectionText(section: ArticleSection): string {
  return [
    section.heading,
    ...(section.paragraphs ?? []),
    ...(section.bullets ?? []),
    ...(section.definitions ?? []).flatMap((d) => [d.term, d.description]),
    section.formula ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function entryText(entry: Pick<SeoEntry, "title" | "summary" | "body" | "faqs">): string {
  return [
    entry.title,
    entry.summary,
    ...(entry.body ?? []).map(sectionText),
    ...(entry.faqs ?? []).flatMap((f: FaqItem) => [f.question, f.answer]),
  ].join(" ");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Reading time in whole minutes, derived from the entry's own rendered text.
 *
 * Derived rather than authored on purpose: a hand-set "5 min read" drifts the
 * moment the article is edited, and a wrong one is an anti-trust signal on a
 * page whose entire job is to look authoritative (§17).
 */
export function readingTimeMin(entry: Pick<SeoEntry, "title" | "summary" | "body" | "faqs">): number {
  return Math.max(1, Math.round(wordCount(entryText(entry)) / WORDS_PER_MINUTE));
}
