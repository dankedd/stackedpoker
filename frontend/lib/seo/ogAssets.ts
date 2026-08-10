import { existsSync } from "node:fs";
import path from "node:path";
import type { SeoEntry } from "./types";

/**
 * Resolves which `opengraph-image` file serves a given page (§6).
 *
 * NODE-ONLY. Imported by the validator and its tests, never by anything under
 * app/ — the `node:fs` import would break a client bundle, which is the point:
 * an accidental import fails loudly instead of silently shipping.
 *
 * Next.js's metadata-file convention cascades: a route uses the nearest
 * `opengraph-image` at or above it in the app directory. This walks the same
 * chain, so "does this page have an OG image?" is answered by the same rule
 * the framework applies rather than by an assumption.
 */

const APP_DIR = path.resolve(process.cwd(), "app");

/** Route directory (with dynamic segments) that renders each content kind. */
const ROUTE_DIR_BY_KIND: Record<SeoEntry["kind"], string> = {
  page: "",
  course: "courses/[slug]",
  lesson: "learn/[slug]",
  wiki: "wiki/[slug]",
  glossary: "glossary/[letter]",
  blog: "blog/[slug]",
  tool: "tools/[slug]",
  search: "search/[query]",
};

const IMAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js", "png", "jpg", "jpeg", "gif"];

/**
 * The route directory for a page. Hub pages ("/wiki", "/tools", …) are `page`
 * entries whose directory is their own path, not the dynamic child route.
 */
export function routeDirFor(entry: SeoEntry, appDir = APP_DIR): string {
  if (entry.kind === "page") {
    const segments = entry.path.split("/").filter(Boolean);
    return path.join(appDir, ...segments);
  }
  return path.join(appDir, ...ROUTE_DIR_BY_KIND[entry.kind].split("/").filter(Boolean));
}

/** The nearest `opengraph-image.*` at or above the page's route directory. */
export function resolveOgImageFile(entry: SeoEntry, appDir = APP_DIR): string | undefined {
  let dir = routeDirFor(entry, appDir);

  for (;;) {
    for (const extension of IMAGE_EXTENSIONS) {
      const candidate = path.join(dir, `opengraph-image.${extension}`);
      if (existsSync(candidate)) return candidate;
    }
    if (path.resolve(dir) === path.resolve(appDir)) return undefined;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
