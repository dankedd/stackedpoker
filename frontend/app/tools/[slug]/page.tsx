import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ContentPage } from "@/components/seo/ContentPage";
import { TrackedLink } from "@/components/seo/TrackedLink";
import { toolWidgetFor } from "@/components/tools";
import { PokerHandAnalyzer } from "@/components/tools/PokerHandAnalyzer";
import {
  conceptRecommendations,
  DETECTABLE_CONCEPT_IDS,
} from "@/lib/tools/handAnalysis/recommendations";
import { toolEntries, toolEntryBySlug, toolLivePath } from "@/lib/seo/content/tools";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * A free-tool landing page (§9).
 *
 * `published` tools teach the calculation with numbers computed from
 * lib/theory/math.ts; `planned` tools render the shared "not published yet"
 * notice and are noindex. Either way the route, metadata, structured data
 * and internal links already exist, so shipping the interactive widget later
 * is a content change rather than an SEO project.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return toolEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = toolEntryBySlug(slug);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = toolEntryBySlug(slug);
  if (!entry) notFound();

  const livePath = toolLivePath(slug);
  const context = { contentKind: entry.kind, contentSlug: entry.slug, cluster: entry.clusters?.[0] };
  // The interactive widget, when this tool has one. The page around it stays
  // a Server Component — only the calculator itself is client-side (§UX).
  const Widget = toolWidgetFor(slug);

  // The analyzer is the one widget that needs data from the content index —
  // its "what to study next" links. Resolving them HERE, in the Server
  // Component, keeps the registries out of the browser bundle; every other
  // widget is self-contained and renders through the generic lookup.
  const widget =
    slug === "poker-hand-analyzer" ? (
      <PokerHandAnalyzer recommendations={conceptRecommendations([...DETECTABLE_CONCEPT_IDS])} />
    ) : Widget ? (
      <Widget />
    ) : null;

  return (
    <ContentPage
      entry={entry}
      eyebrow="Free poker tool"
      ctaHeading="Get the reps, not just the formula"
      ctaBody="StackedPoker turns this maths into decisions you actually have to make, hand after hand. Free account, no card required."
      intro={
        widget ? (
          widget
        ) : livePath ? (
          <div className="mt-8 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-5">
            <p className="text-sm text-muted-foreground">
              This one is live already — no account needed.
            </p>
            <TrackedLink
              href={livePath}
              context={context}
              label="tool-live"
              event="cta"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Open {entry.title}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </TrackedLink>
          </div>
        ) : entry.status === "published" ? (
          <p className="mt-8 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            The interactive calculator is still being built. Everything below is the maths it will
            run on — computed with the same functions StackedPoker uses in its lessons, so the
            numbers are the real ones.
          </p>
        ) : null
      }
    />
  );
}
