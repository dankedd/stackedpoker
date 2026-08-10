/**
 * Canonical route builders + the one authoritative public/private split.
 *
 * Both middleware.ts (which decides who gets redirected to /login) and
 * app/robots.ts (which decides what crawlers may fetch) import from here.
 * Keeping them on the same source removes the classic failure mode where
 * robots.txt advertises a URL that middleware 302s to the login page.
 */

/** Root-relative canonical paths for every hub. */
export const ROUTES = {
  home: "/",
  pricing: "/pricing",
  courses: "/courses",
  wiki: "/wiki",
  glossary: "/glossary",
  blog: "/blog",
  tools: "/tools",
  search: "/search",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const lessonPath = (slug: string) => `/learn/${slug}`;
export const coursePath = (slug: string) => `/courses/${slug}`;
export const wikiPath = (slug: string) => `/wiki/${slug}`;
export const glossaryLetterPath = (letter: string) => `/glossary/${letter.toLowerCase()}`;
export const blogPath = (slug: string) => `/blog/${slug}`;
export const toolPath = (slug: string) => `/tools/${slug}`;
export const searchPath = (query: string) => `/search/${query}`;

/** The authenticated lesson player — deliberately NOT indexable. */
export const lessonPlayerPath = (slug: string) => `/learn/lesson/${slug}`;

/**
 * Second path segments under /learn that belong to the signed-in product.
 * Everything else under /learn (i.e. `/learn/<lesson-slug>`) is a public SEO
 * page, so a new lesson becomes crawlable with no routing change (§23).
 *
 * `/learn` itself (no second segment) stays private — it is the app hub.
 */
export const PRIVATE_LEARN_SEGMENTS = new Set([
  "lesson",
  "module",
  "journey",
  "path",
]);

/** Path prefixes that must never be indexed or served to a signed-out user. */
export const PRIVATE_PATH_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings",
  "/progress",
  "/history",
  "/bankroll",
  "/coach",
  "/coaching",
  "/community",
  "/challenges",
  "/solver",
  "/admin",
  "/auth",
  "/login",
  "/signup",
  "/api",
];

/**
 * True when `pathname` is a public marketing/SEO surface.
 *
 * Written as a pure string check (no Next.js imports) so middleware, route
 * handlers and unit tests can all call it.
 */
export function isPublicSeoPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }

  if (path === "/learn") return false;
  if (path.startsWith("/learn/")) {
    const segments = path.split("/").filter(Boolean); // ["learn", ...]
    if (segments.length !== 2) return false;
    return !PRIVATE_LEARN_SEGMENTS.has(segments[1]);
  }

  return true;
}

/** Collapses duplicate slashes and strips the trailing slash (except root). */
export function normalizePath(pathname: string): string {
  const collapsed = `/${pathname}`.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : "/";
}

/** Root-relative path → absolute URL against the canonical origin. */
export function absoluteUrl(path: string, origin: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin.replace(/\/$/, "")}${normalizePath(path)}`;
}

/**
 * Lowercase, hyphenated, ASCII-only slug. Used to turn concept ids
 * (`cbet_theory`) and free-text queries into stable URL segments.
 */
export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    // Strip combining diacritics left behind by NFKD (é -> e + U+0301 -> e).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
