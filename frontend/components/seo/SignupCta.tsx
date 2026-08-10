import { Sparkles } from "lucide-react";
import type { ContentContext } from "@/lib/seo/analytics";
import { TrackedLink } from "./TrackedLink";

/**
 * The account-creation CTA that closes every public content page (§4).
 *
 * One component, so "wiki → signup", "glossary → signup" and "lesson →
 * signup" are the same tracked event with a different `content_kind`
 * dimension — which is what makes those three funnels comparable in GA4
 * instead of three bespoke events (§21).
 */
export function SignupCta({
  context,
  heading = "Learn this properly — free",
  body = "Create a free StackedPoker account to play the interactive lessons behind this page, keep your progress and track concept mastery.",
  placement = "footer",
}: {
  context: ContentContext;
  heading?: string;
  body?: string;
  placement?: string;
}) {
  return (
    <aside
      aria-labelledby="cta-heading"
      className="mt-12 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/12 via-card/60 to-blue-500/8 p-6 sm:p-8"
    >
      <div className="flex items-center gap-2 text-violet-300">
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Free account</span>
      </div>

      <h2 id="cta-heading" className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <TrackedLink
          href="/signup"
          context={context}
          label={`${placement}-signup`}
          event="cta"
          className="inline-flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-6 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Create a free account
        </TrackedLink>

        <TrackedLink
          href="/courses"
          context={context}
          label={`${placement}-courses`}
          event="cta"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse the curriculum
        </TrackedLink>
      </div>
    </aside>
  );
}
