import Link from "next/link";
import { BadgeCheck, CalendarDays, Clock, GraduationCap, Layers } from "lucide-react";
import { coursePath } from "@/lib/seo/routes";
import type { AuthoritySignals } from "@/lib/seo/types";

/**
 * Authority signals shown on every educational page (§17).
 *
 * Reviewer, last-updated date, reading time, difficulty and the module the
 * concept is taught in. These are E-E-A-T signals for Google and attribution
 * anchors for generative engines — an LLM asked "who says so?" needs a named
 * reviewer and a date in the text, not in a meta tag.
 *
 * The date is a real `<time datetime>` so it is machine-readable, and the
 * whole strip is rendered from derived values (reading time is computed from
 * the page's own words) rather than hand-set numbers that would go stale.
 */
export function AuthorityByline({
  authority,
  moduleTitle,
  className = "",
}: {
  authority: AuthoritySignals;
  /** Display title for `authority.relatedModuleSlug`, when it resolves. */
  moduleTitle?: string;
  className?: string;
}) {
  const updated = new Date(`${authority.updated}T00:00:00Z`);
  const updatedLabel = Number.isNaN(updated.valueOf())
    ? authority.updated
    : updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 text-violet-400" />
        Reviewed by <span className="text-foreground/80">{authority.reviewedBy}</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
        Updated <time dateTime={authority.updated}>{updatedLabel}</time>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
        {authority.readingTimeMin} min read
      </span>

      {authority.difficulty && (
        <span className="inline-flex items-center gap-1.5">
          <GraduationCap aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="capitalize">{authority.difficulty}</span>
        </span>
      )}

      {authority.relatedModuleSlug && moduleTitle && (
        <span className="inline-flex items-center gap-1.5">
          <Layers aria-hidden="true" className="h-3.5 w-3.5" />
          <Link
            href={coursePath(authority.relatedModuleSlug)}
            className="rounded underline-offset-4 transition-colors hover:text-violet-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {moduleTitle}
          </Link>
        </span>
      )}
    </div>
  );
}
