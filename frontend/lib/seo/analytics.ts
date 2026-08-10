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
  /** A tool page was opened — the denominator for every tool funnel. */
  toolOpen: "tool_open",
  /** A calculation or quiz answer completed successfully. */
  toolCalculate: "tool_calculate",
  /** An input changed. Reported once per field per session, not per keystroke. */
  toolInputChange: "tool_input_change",
  /** A result was copied or shared. */
  toolShare: "tool_share",
  /** An account was created by someone who had used a tool first. */
  toolAttributedSignup: "tool_attributed_signup",
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

// ── Tool attribution (§ "account created after using tool") ──────────────────

const TOOL_ATTRIBUTION_KEY = "sp_tool_attribution";

/**
 * Remembers that this visitor used a tool, so a later signup can be credited
 * to it.
 *
 * sessionStorage, not a cookie: it needs no consent banner, dies with the tab,
 * and never leaves the browser. It carries a slug and nothing else — no
 * identifiers, no inputs, nothing about the hand anybody analysed.
 */
export function rememberToolUse(toolSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOOL_ATTRIBUTION_KEY, toolSlug);
  } catch {
    // Private mode or a full quota — attribution is optional, the tool is not.
  }
}

export function readToolAttribution(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOOL_ATTRIBUTION_KEY);
  } catch {
    return null;
  }
}

export function clearToolAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOOL_ATTRIBUTION_KEY);
  } catch {
    // Nothing to do — the value expires with the session anyway.
  }
}
