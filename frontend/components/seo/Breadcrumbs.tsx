import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { breadcrumbsFor } from "@/lib/seo/related";
import type { SeoEntry } from "@/lib/seo/types";

/**
 * Visible breadcrumb navigation (§1, §12).
 *
 * Takes the page's `SeoEntry` and derives the trail itself — there is no prop
 * for passing a hand-written list, which is what makes "never maintain manual
 * breadcrumb lists" structural rather than a convention someone has to
 * remember. Home → Section → Category → Current page, computed by
 * `breadcrumbsFor`.
 *
 * This component renders ONLY the visible nav. The matching BreadcrumbList
 * JSON-LD comes from `structuredDataFor(entry)`, which reads the same
 * `breadcrumbsFor` output — one source, two renderings, and no chance of the
 * markup describing a trail the page does not show. Emitting the node here
 * as well would put two BreadcrumbList entities on one page.
 *
 * Accessibility (§22): a labelled `<nav>` around an ordered list, with the
 * current page carrying `aria-current="page"` and rendered as text rather
 * than as a link to itself.
 */
export function Breadcrumbs({ entry }: { entry: SeoEntry }) {
  const crumbs = breadcrumbsFor(entry);
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-50" />
              )}
              {isLast ? (
                <span aria-current="page" className="text-foreground/80">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="rounded transition-colors hover:text-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
