import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { ContentContext } from "@/lib/seo/analytics";
import { relatedTo } from "@/lib/seo/related";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import type { SeoEntry } from "@/lib/seo/types";
import { ArticleBody } from "./ArticleBody";
import { AuthorityByline } from "./AuthorityByline";
import { Breadcrumbs } from "./Breadcrumbs";
import { FaqSection } from "./FaqSection";
import { RelatedContent } from "./RelatedContent";
import { JsonLd } from "./JsonLd";
import { ScrollDepthTracker } from "./ScrollDepthTracker";
import { SignupCta } from "./SignupCta";

/**
 * The one layout every public content page renders through — wiki articles,
 * public lesson pages, course pages, tool pages, glossary letters and blog
 * posts (§5 "the layout should be reusable", §20).
 *
 * Doing it once is what makes the site-wide guarantees structural rather
 * than per-page promises: breadcrumbs + BreadcrumbList, an `<h1>` that exists
 * exactly once, the authority byline, FAQ HTML + FAQPage JSON-LD, computed
 * related links, the signup CTA and scroll tracking are all present on every
 * page because there is no code path that renders one without them.
 *
 * A Server Component. The only client JavaScript it pulls in is the tracking
 * on links and the scroll listener, so these pages ship almost no JS (§19).
 */
export function ContentPage({
  entry,
  /** Rendered between the header and the article body — e.g. a stat strip. */
  intro,
  /** Rendered after the article body, before the FAQ. */
  children,
  /** Display title for the entry's related module, when it resolves. */
  moduleTitle,
  /** Overrides the computed related entries. */
  related,
  /** Eyebrow label above the H1, e.g. "Poker Wiki". */
  eyebrow,
  ctaHeading,
  ctaBody,
}: {
  entry: SeoEntry;
  intro?: ReactNode;
  children?: ReactNode;
  moduleTitle?: string;
  related?: SeoEntry[];
  eyebrow?: string;
  ctaHeading?: string;
  ctaBody?: string;
}) {
  const context: ContentContext = {
    contentKind: entry.kind,
    contentSlug: entry.slug,
    cluster: entry.clusters?.[0],
  };

  const relatedEntries = related ?? relatedTo(entry);
  const isPlanned = entry.status === "planned";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* All of this page's structured data, from one resolver (§7): WebPage,
          BreadcrumbList, the kind-specific node (Article / Course /
          LearningResource / SoftwareApplication) and FAQPage. The build-time
          validator checks this exact output. */}
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />
      <ScrollDepthTracker context={context} />

      {/* `<main>` is the single landmark wrapping the page content (§22). */}
      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            {entry.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{entry.summary}</p>

          {entry.authority && (
            <AuthorityByline
              authority={entry.authority}
              moduleTitle={moduleTitle}
              className="mt-5 border-t border-border/50 pt-4"
            />
          )}
        </header>

        {isPlanned && <PlannedNotice entry={entry} />}

        {intro}

        {entry.body && entry.body.length > 0 && (
          <div className="mt-10">
            <ArticleBody sections={entry.body} />
          </div>
        )}

        {children}

        {/* The FAQ markup is emitted by structuredDataFor above, so the
            component renders the questions only — two FAQPage nodes on one
            URL is an invalid-structured-data warning. */}
        {entry.faqs && entry.faqs.length > 0 && (
          <FaqSection faqs={entry.faqs} emitJsonLd={false} />
        )}

        <RelatedContent
          entries={relatedEntries}
          context={context}
          description="Concepts, lessons and tools that build on this page."
        />

        <SignupCta context={context} heading={ctaHeading} body={ctaBody} />

        {entry.sourceNote && (
          // Visible provenance. CLAUDE.md requires every poker claim to be
          // traceable; saying so on the page is also the attribution anchor
          // a generative engine needs when it cites us.
          <p className="mt-10 border-t border-border/50 pt-4 text-xs leading-relaxed text-muted-foreground/80">
            <span className="font-medium text-muted-foreground">Source: </span>
            {entry.sourceNote}
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
}

/**
 * Shown on `planned` routes. Deliberately blunt: the page exists so the URL
 * and the internal links are stable, and it says outright that there is no
 * article yet rather than padding the space with generated prose. These
 * pages are also noindex and absent from every sitemap.
 */
function PlannedNotice({ entry }: { entry: SeoEntry }) {
  return (
    <div
      role="note"
      className="mt-8 flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4"
    >
      <Construction aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-amber-200">This article has not been published yet.</p>
        <p className="leading-relaxed text-muted-foreground">
          StackedPoker does not publish poker theory it cannot trace to a reviewed source, so this
          page stays empty until the {entry.title} material is written and reviewed. It is excluded
          from search engines in the meantime. The related pages below cover the nearest topics that
          are ready.
        </p>
      </div>
    </div>
  );
}
