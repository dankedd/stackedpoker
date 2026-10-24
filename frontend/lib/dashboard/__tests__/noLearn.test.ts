import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";

/**
 * Learn is offline: nothing on the dashboard may link to /learn or talk about
 * learning, and no block may name a book or source (project rule, see
 * scripts/check-no-source-refs.mjs for the build-wide guard).
 */
const root = path.resolve(__dirname, "../../..");
const files = [
  "app/dashboard/page.tsx",
  ...readdirSync(path.join(root, "components/dashboard"))
    .filter((f) => f.endsWith(".tsx") && f !== "PuzzleTrainingPanel.tsx")
    .map((f) => `components/dashboard/${f}`),
  ...readdirSync(path.join(root, "lib/dashboard"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `lib/dashboard/${f}`),
];
const code = (rel: string) =>
  readFileSync(path.join(root, rel), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("dashboard without Learn", () => {
  it.each(files)("%s has no /learn link and no Learn copy", (f) => {
    const src = code(f);
    expect(src).not.toMatch(/["'`]\/learn/);
    expect(src).not.toMatch(/\b(continue learning|keep building your poker foundation|learning path|lesson)/i);
    expect(src).not.toMatch(/@\/lib\/learn\//);
    expect(src).not.toMatch(/modern poker theory|acevedo/i);
  });
});
