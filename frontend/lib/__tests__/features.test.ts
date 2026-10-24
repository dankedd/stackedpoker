import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURES, canUseFeature, gatedFeatureForPath, hasDevAccess, isFeaturePublic } from "../features";

describe("feature availability", () => {
  it("Learn, Puzzles and Social are dev-only for now", () => {
    expect(FEATURES).toEqual({ learn: "dev", puzzles: "dev", social: "dev" });
    expect(isFeaturePublic("learn")).toBe(false);
    expect(isFeaturePublic("puzzles")).toBe(false);
  });

  it("only the admin tier has dev access", () => {
    expect(hasDevAccess("admin")).toBe(true);
    for (const t of ["free", "pro", "premium", null, undefined, "bogus"]) expect(hasDevAccess(t)).toBe(false);
    expect(canUseFeature("learn", "admin")).toBe(true);
    expect(canUseFeature("learn", "premium")).toBe(false);
    expect(canUseFeature("puzzles", null)).toBe(false);
  });

  it("gates every Learn and Puzzles app route, but not the public lesson pages", () => {
    const gated = ["/learn", "/learn/journey", "/learn/lesson/abc", "/learn/module/m", "/learn/path/beginner", "/progress", "/puzzles", "/puzzles/some-puzzle"];
    for (const p of gated) expect(gatedFeatureForPath(p), p).not.toBeNull();
    expect(gatedFeatureForPath("/puzzles/x")).toBe("puzzles");
    // Public SEO lesson overview — stays open and indexable by decision.
    expect(gatedFeatureForPath("/learn/think-in-ranges")).toBeNull();
    for (const p of ["/", "/hands", "/preflop-trainer", "/learning", "/puzzlesque", "/dashboard"]) expect(gatedFeatureForPath(p), p).toBeNull();
  });

  it("gates the social routes without catching look-alikes", () => {
    for (const p of ["/u/bobby", "/admin/moderation", "/forum", "/messages/x"]) {
      expect(gatedFeatureForPath(p), p).toBe("social");
    }
    for (const p of ["/hands", "/hands/1", "/help", "/upgrade", "/admin/debug-strategy"]) expect(gatedFeatureForPath(p), p).toBeNull();
  });

  it("keeps shared hands public: the links users send out", () => {
    for (const p of ["/h/Ab3dE9z", "/h/Ab3dE9z/opengraph-image", "/embed/h/Ab3dE9z"]) expect(gatedFeatureForPath(p), p).toBeNull();
  });

  it("matches the backend's copy (backend/app/services/features.py)", () => {
    const py = readFileSync(join(__dirname, "..", "..", "..", "backend", "app", "services", "features.py"), "utf8");
    const block = py.slice(py.indexOf("FEATURES"), py.indexOf("}", py.indexOf("FEATURES")));
    const backend = Object.fromEntries([...block.matchAll(/"(\w+)":\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
    expect(backend).toEqual(FEATURES);
  });
});
