import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignupCta } from "@/components/seo/SignupCta";
import {
  glossaryLetters,
  glossaryTerms,
  letterLabel,
  termsForLetter,
} from "@/lib/seo/content/glossary";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { glossaryLetterPath, ROUTES } from "@/lib/seo/routes";

/**
 * The glossary hub (§6).
 *
 * Its job is navigation, not content: an A–Z index that hands crawl equity
 * to the letter pages, which is where the definitions actually live. The
 * DefinedTermSet node here is the parent every DefinedTerm on those pages
 * points back to via `inDefinedTermSet`.
 */
export const revalidate = 86400;

const entry = staticPageEntry(ROUTES.glossary)!;

export const metadata: Metadata = entryMetadata(entry);

export default function GlossaryIndexPage() {
  const letters = glossaryLetters();
  const total = glossaryTerms().length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            A–Z
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Poker Glossary
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {total} poker terms, each defined in a sentence and linked to the concept article and
            interactive lesson that go deeper. No jargon left unexplained.
          </p>
        </header>

        <nav aria-label="Glossary letters" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {letters.map((letter) => (
              <li key={letter}>
                <Link
                  href={glossaryLetterPath(letter)}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-border/60 bg-card/40 px-3 text-sm font-semibold uppercase text-foreground transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Poker terms starting with ${letterLabel(letter)}`}
                >
                  {letterLabel(letter)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 space-y-10">
          {letters.map((letter) => {
            const terms = termsForLetter(letter);
            return (
              <section key={letter} aria-labelledby={`letter-${letter}`}>
                <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-2">
                  <h2
                    id={`letter-${letter}`}
                    className="text-lg font-semibold uppercase tracking-tight text-foreground"
                  >
                    {letterLabel(letter)}
                  </h2>
                  <Link
                    href={glossaryLetterPath(letter)}
                    className="rounded text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-violet-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {terms.length} term{terms.length === 1 ? "" : "s"}
                  </Link>
                </div>

                <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
                  {terms.map((term) => (
                    <li key={term.slug}>
                      <Link
                        href={`${glossaryLetterPath(letter)}#${term.slug}`}
                        className="inline-flex rounded-full border border-border/50 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {term.term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <SignupCta
          context={{ contentKind: "page", contentSlug: "glossary" }}
          heading="Knowing the word isn't knowing the play"
          body="Every term here is taught properly inside a StackedPoker lesson — with a real spot, a decision you have to commit to, and the reasoning behind the answer."
        />
      </main>

      <Footer />
    </div>
  );
}
