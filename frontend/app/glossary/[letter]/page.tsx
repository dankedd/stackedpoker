import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthorityByline } from "@/components/seo/AuthorityByline";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedContent } from "@/components/seo/RelatedContent";
import { ScrollDepthTracker } from "@/components/seo/ScrollDepthTracker";
import { SignupCta } from "@/components/seo/SignupCta";
import {
  glossaryEntryForLetter,
  glossaryLetters,
  letterLabel,
  termsForLetter,
  type GlossaryTerm,
} from "@/lib/seo/content/glossary";
import { relatedTo } from "@/lib/seo/related";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { glossaryLetterPath } from "@/lib/seo/routes";

/**
 * One letter of the glossary (§6).
 *
 * Terms are rendered in full here rather than each getting its own URL — a
 * one-sentence definition on a dedicated page is thin content that would
 * compete with the wiki article on the same term. Each term still gets its
 * own `id` anchor and its own DefinedTerm node, so it is individually
 * linkable and individually machine-readable.
 *
 * Only populated letters exist: `generateStaticParams` is built from the
 * data, so there is no /glossary/x page with nothing on it.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return glossaryLetters().map((letter) => ({ letter }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ letter: string }>;
}): Promise<Metadata> {
  const { letter } = await params;
  const entry = glossaryEntryForLetter(letter);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function GlossaryLetterPage({
  params,
}: {
  params: Promise<{ letter: string }>;
}) {
  const { letter } = await params;
  const entry = glossaryEntryForLetter(letter);
  if (!entry) notFound();

  const terms = termsForLetter(letter);
  const letters = glossaryLetters();
  const context = { contentKind: "glossary", contentSlug: entry.slug };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />
      <ScrollDepthTracker context={context} />

      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Poker Glossary
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Poker Terms Starting With {letterLabel(letter)}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {terms.length} poker term{terms.length === 1 ? "" : "s"} beginning with{" "}
            {letterLabel(letter)}, each defined and linked to the concept article and lesson that
            teach it.
          </p>
          {entry.authority && (
            <AuthorityByline
              authority={entry.authority}
              className="mt-5 border-t border-border/50 pt-4"
            />
          )}
        </header>

        <nav aria-label="Glossary letters" className="mt-8">
          <ul className="flex flex-wrap gap-1.5">
            {letters.map((l) => (
              <li key={l}>
                <Link
                  href={glossaryLetterPath(l)}
                  aria-current={l === letter.toLowerCase() ? "page" : undefined}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    l === letter.toLowerCase()
                      ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                      : "border-border/50 bg-card/30 text-muted-foreground hover:border-violet-500/40 hover:text-foreground"
                  }`}
                >
                  {letterLabel(l)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <dl className="mt-10 space-y-4">
          {terms.map((term) => (
            <TermCard key={term.slug} term={term} />
          ))}
        </dl>

        <RelatedContent
          entries={relatedTo(entry, { limit: 4 })}
          context={context}
          heading="Go deeper"
          description="Concept articles and lessons covering the terms on this page."
        />

        <SignupCta context={context} />
      </main>

      <Footer />
    </div>
  );
}

function TermCard({ term }: { term: GlossaryTerm }) {
  return (
    <div id={term.slug} className="scroll-mt-24 rounded-xl border border-border/60 bg-card/40 p-4">
      <dt className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-foreground">{term.term}</span>
        {term.difficulty && (
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {term.difficulty}
          </span>
        )}
      </dt>

      <dd className="mt-2 space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{term.definition}</p>

        {term.example && (
          <p className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Example: </span>
            {term.example}
          </p>
        )}

        {(term.wikiPath || term.lessonPaths.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs">
            {term.wikiPath && (
              <Link
                href={term.wikiPath}
                className="inline-flex items-center gap-1 rounded text-violet-400 underline-offset-4 transition-colors hover:text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Full article
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            )}
            {term.lessonPaths.slice(0, 2).map((lesson) => (
              <Link
                key={lesson.path}
                href={lesson.path}
                className="inline-flex items-center gap-1 rounded text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookOpen aria-hidden="true" className="h-3 w-3" />
                {lesson.title}
              </Link>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}
