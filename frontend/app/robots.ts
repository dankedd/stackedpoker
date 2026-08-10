import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { PRIVATE_LEARN_SEGMENTS, PRIVATE_PATH_PREFIXES, absoluteUrl } from "@/lib/seo/routes";

/**
 * robots.txt (§14).
 *
 * The disallow list is DERIVED from lib/seo/routes.ts — the same module
 * middleware.ts uses to decide who gets redirected to /login. Hand-writing a
 * second list is how a robots.txt ends up advertising a URL that 302s to a
 * login page, or (worse) allowing one that should never have been public.
 *
 * AI crawlers are named explicitly rather than left to the wildcard rule.
 * Being quoted by ChatGPT, Claude, Gemini and Perplexity is a primary goal
 * here (§15, §16), and several of those crawlers are conservative when a
 * site does not mention them. Training crawlers and live retrieval fetchers
 * are listed as separate groups so the two can diverge later without anyone
 * having to work out which agent is which.
 */

/** Crawlers that fetch a page to answer a user's question right now. */
const AI_RETRIEVAL_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-User",
  "Claude-SearchBot",
];

/** Crawlers that collect content for model training / grounding corpora. */
const AI_TRAINING_AGENTS = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl();

  const disallow = [
    // Gated product surfaces. Robots.txt matches by prefix, so "/dashboard"
    // covers "/dashboard" and everything beneath it.
    // /signup is deliberately kept crawlable: every content CTA points at it,
    // and blocking a heavily-linked URL produces "indexed though blocked"
    // warnings rather than keeping it out of the index.
    ...PRIVATE_PATH_PREFIXES.filter((prefix) => prefix !== "/signup"),
    // The /learn hub itself is the signed-in app. "$" anchors the match so
    // this does not also block the public /learn/<lesson-slug> pages.
    "/learn$",
    ...[...PRIVATE_LEARN_SEGMENTS].map((segment) => `/learn/${segment}`),
    // Tracking-parameter variants are duplicates of a canonical URL.
    "/*?*utm_",
    "/*?*ref=",
  ];

  const allow = [
    "/",
    "/wiki",
    "/glossary",
    "/courses",
    "/tools",
    "/blog",
    "/search",
    "/pricing",
    "/llms.txt",
    "/ai-sitemap.json",
  ];

  return {
    rules: [
      { userAgent: "*", allow, disallow },
      { userAgent: AI_RETRIEVAL_AGENTS, allow, disallow },
      { userAgent: AI_TRAINING_AGENTS, allow, disallow },
    ],
    sitemap: absoluteUrl("/sitemap.xml", origin),
    host: origin,
  };
}
