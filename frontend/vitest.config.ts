import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    /**
     * Vitest's default is 5s, which several corpus-scale tests exceed only
     * when the rest of the suite is competing for the machine — validating
     * every SEO entry, resolving related content for the whole site, sweeping
     * every puzzle. Which ones tripped varied run to run, so the failures were
     * scheduling noise rather than a signal about any test.
     *
     * Raised, not removed: a test that genuinely hangs still fails, just after
     * long enough to rule out contention as the cause.
     */
    testTimeout: 30_000,
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
