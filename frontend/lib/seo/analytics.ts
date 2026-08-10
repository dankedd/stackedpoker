/**
 * SEO / content analytics events (§21).
 *
 * Thin typed wrapper over the GA4 tag already mounted in app/layout.tsx.
 * Nothing here loads a script or reads config — if `gtag` is absent (local
 * development, an ad blocker, a server render) every call is a no-op, so
 * call sites never need a guard of their own.
 *
 * Event names are snake_case and fixed in one place because GA4 treats a
 * typo as a brand-new event: `wiki_cta_click` and `wikiCtaClick` would show
 * up as two unrelated metrics that can never be merged retroactively.
 */

export const SEO_EVENTS = {
  /** A call-to-action on a public content page was clicked. */
  contentCtaClick: "content_cta_click",
  /** An internal link between content pages was followed. */
  internalLinkClick: "internal_link_click",
  /** A query was run from the on-site search box. */
  internalSearch: "internal_search",
  /** A topic/search landing page was viewed with N results. */
  searchResultsView: "search_results_view",
  /** A reader crossed a scroll-depth threshold on a content page. */
  scrollDepth: "scroll_depth",
  /** A free tool was used (as opposed to merely viewed). */
  toolUse: "tool_use",
} as const;

export type SeoEventName = (typeof SEO_EVENTS)[keyof typeof SEO_EVENTS];

type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event" | "config" | "js", ...args: unknown[]) => void;
  }
}

export function trackEvent(name: SeoEventName, params: GtagParams = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const clean: GtagParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") clean[key] = value;
  }
  window.gtag("event", name, clean);
}

/**
 * Standard dimensions attached to every content-page event, so organic
 * traffic can be sliced by content type and topic in GA4 without a separate
 * report per surface.
 */
export interface ContentContext {
  contentKind: string;
  contentSlug: string;
  cluster?: string;
}

export function contentParams(context: ContentContext): GtagParams {
  return {
    content_kind: context.contentKind,
    content_slug: context.contentSlug,
    content_cluster: context.cluster,
  };
}

/** Scroll-depth thresholds, in percent of document height. */
export const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 100] as const;
