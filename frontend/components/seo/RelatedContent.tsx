import { ArrowUpRight } from "lucide-react";
import type { ContentContext } from "@/lib/seo/analytics";
import type { SeoEntry } from "@/lib/seo/types";
import { TrackedLink } from "./TrackedLink";

const KIND_LABEL: Record<SeoEntry["kind"], string> = {
  page: "Page",
  course: "Module",
  lesson: "Lesson",
  wiki: "Concept",
  glossary: "Glossary",
  blog: "Article",
  tool: "Free tool",
  search: "Topic",
};

/**
 * The "related pages" strip every content page ends with (§7).
 *
 * Fed by `relatedTo()`, so the links are computed rather than curated and a
 * new page joins the graph on its own. Each card states the kind of thing it
 * links to, which is what makes the cross-kind links (concept → lesson →
 * tool) legible instead of looking like a list of near-duplicates.
 */
export function RelatedContent({
  entries,
  context,
  heading = "Related",
  description,
}: {
  entries: SeoEntry[];
  context: ContentContext;
  heading?: string;
  description?: string;
}) {
  if (!entries.length) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <h2 id="related-heading" className="text-xl font-semibold tracking-tight text-foreground">
        {heading}
      </h2>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.path}>
            <TrackedLink
              href={entry.path}
              context={context}
              label={`related-${entry.kind}`}
              className="group flex h-full flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-violet-400/80">
                {KIND_LABEL[entry.kind]}
              </span>
              <span className="mt-1 flex items-start justify-between gap-2 text-sm font-medium text-foreground">
                {entry.title}
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                />
              </span>
              <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {entry.summary}
              </span>
            </TrackedLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
