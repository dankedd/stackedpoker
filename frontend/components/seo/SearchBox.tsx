"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { toSlug } from "@/lib/seo/routes";

/**
 * On-site search (§21 "internal search").
 *
 * Submitting navigates to the canonical `/search/<slug>` URL rather than a
 * query string, so a search a visitor actually ran lands on the same
 * indexable topic page a crawler sees — one URL per topic instead of two.
 * The query is reported to GA4 so internal-search demand can drive what gets
 * written next.
 */
export function SearchBox({ placeholder = "Search poker concepts, lessons and terms" }: { placeholder?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (!query) return;
        trackEvent(SEO_EVENTS.internalSearch, { search_term: query.toLowerCase() });
        router.push(`/search/${toSlug(query)}`);
      }}
      className="flex gap-2"
    >
      <label htmlFor="site-search" className="sr-only">
        Search StackedPoker
      </label>
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="site-search"
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Search
      </button>
    </form>
  );
}
