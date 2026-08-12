import { resetBlogCache } from "./blog";
import { resetGlossaryCache } from "./glossary";
import { resetLandingCache } from "./landing";
import { resetEntryCache } from "./index";
import { resetLessonCaches } from "./lessons";
import { resetSearchCache } from "./search";
import { resetToolCache } from "./tools";
import { resetWikiCache } from "./wiki";

/**
 * Clears every registry's memoised output.
 *
 * The registries memoise because they are read hundreds of times during a
 * build. Tests that add content at runtime — proving the blog pipeline works
 * end to end while POSTS is still empty (§9) — need the caches to forget.
 *
 * This lives in its own module so lib/seo/content/index.ts never imports
 * ./search, which reads back from index and would close an import cycle.
 */
export function resetSeoCaches(): void {
  resetEntryCache();
  resetWikiCache();
  resetGlossaryCache();
  resetLandingCache();
  resetLessonCaches();
  resetToolCache();
  resetBlogCache();
  resetSearchCache();
}
