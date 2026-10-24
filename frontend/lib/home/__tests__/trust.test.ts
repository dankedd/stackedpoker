import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_HANDS_SHOWN, MIN_PLAYERS_SHOWN, getSiteStats } from "../stats";
import { TESTIMONIALS, visibleTestimonials, type Testimonial } from "../testimonials";

describe("homepage counters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stub(body: unknown, ok = true) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
  }

  it("never shows a zero or a small count", async () => {
    stub({ players: 0, hands: 0, top: [] });
    expect(await getSiteStats()).toEqual({ players: null, hands: null, top: [] });
    stub({ players: MIN_PLAYERS_SHOWN - 1, hands: MIN_HANDS_SHOWN - 1, top: [] });
    expect(await getSiteStats()).toMatchObject({ players: null, hands: null });
  });

  it("shows real counts from the thresholds up", async () => {
    stub({ players: MIN_PLAYERS_SHOWN, hands: MIN_HANDS_SHOWN, top: [] });
    expect(await getSiteStats()).toMatchObject({ players: MIN_PLAYERS_SHOWN, hands: MIN_HANDS_SHOWN });
  });

  it("a failed call shows nothing at all", async () => {
    stub({}, false);
    expect(await getSiteStats()).toBeNull();
  });
});

describe("testimonials", () => {
  const real: Testimonial = { quote: "Real quote", name: "Real Person", placeholder: false };
  const fake: Testimonial = { quote: "PLACEHOLDER", name: "PLACEHOLDER", placeholder: true };

  it("placeholders never render in a production build", () => {
    expect(visibleTestimonials([real, fake], "production")).toEqual([real]);
    expect(visibleTestimonials([fake], "production")).toEqual([]);
    expect(visibleTestimonials([real, fake], "development")).toEqual([real, fake]);
  });

  it("every entry still marked as a placeholder says so in its text", () => {
    for (const t of TESTIMONIALS.filter((x) => x.placeholder)) {
      expect(t.quote).toContain("PLACEHOLDER");
      expect(t.name).toContain("PLACEHOLDER");
    }
  });
});
