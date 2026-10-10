/**
 * The real middleware.ts, run as a signed-out visitor, a normal user and an
 * admin, with Supabase faked. Checks that dev-only features (lib/features.ts)
 * are blocked server-side, not just hidden in the menu.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Who = { user: { id: string } | null; tier: string; onboarded: boolean };
let who: Who = { user: null, tier: "free", onboarded: true };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: who.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { subscription_tier: who.tier, assessment_completed: who.onboarded } }),
        }),
      }),
    }),
  }),
}));

const { middleware } = await import("../../middleware");

async function visit(path: string) {
  const res = await middleware(new NextRequest(new URL(path, "https://stackedpokerai.com")));
  const loc = res.headers.get("location");
  return { redirect: loc ? new URL(loc).pathname : null, robots: res.headers.get("x-robots-tag") };
}

const GATED = ["/learn", "/learn/lesson/think-in-ranges", "/learn/module/blockers-module", "/learn/journey", "/progress", "/puzzles", "/puzzles/some-puzzle"];

describe("dev-only features are blocked server-side", () => {
  beforeEach(() => {
    who = { user: null, tier: "free", onboarded: true };
  });

  it("signed-out visitors are sent to the homepage", async () => {
    for (const p of GATED) expect((await visit(p)).redirect, p).toBe("/");
  });

  it("normal logged-in users (free and paid) are sent to the homepage", async () => {
    for (const tier of ["free", "pro", "premium"]) {
      who = { user: { id: "u1" }, tier, onboarded: true };
      for (const p of GATED) expect((await visit(p)).redirect, `${tier} ${p}`).toBe("/");
    }
  });

  it("admins get through, with noindex", async () => {
    who = { user: { id: "a1" }, tier: "admin", onboarded: true };
    for (const p of GATED) {
      const r = await visit(p);
      expect(r.redirect, p).toBeNull();
      expect(r.robots, p).toBe("noindex, nofollow");
    }
  });

  it("public lesson pages and other routes are untouched", async () => {
    expect(await visit("/learn/think-in-ranges")).toEqual({ redirect: null, robots: null });
    expect((await visit("/preflop-trainer")).redirect).toBeNull();
    expect((await visit("/")).redirect).toBeNull();
  });
});
