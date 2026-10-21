import { describe, expect, it, beforeAll } from "vitest";
import { accuracyPct, decide, firstName, parseCandidate, type Candidate } from "../plan";
import { unsubscribeToken, verifyUnsubscribeToken } from "../token";
import { renderEmail, escapeHtml } from "../templates";
import { spotInfo, teaserSpot } from "../spots";
import { runLifecycleEmails } from "../run";
import { DEFENSE_CHARTS, OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.parse("2026-10-20T16:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function cand(over: Partial<Candidate> = {}): Candidate {
  return {
    userId: "6f1c2a9e-1111-4222-8333-444455556666",
    email: "player@test.com",
    name: "Sam Streak",
    signedUpAt: ago(30 * H),
    timezone: "Europe/Amsterdam",
    lastActiveAt: ago(28 * H),
    activeToday: false,
    streak: 1,
    handsTotal: 40,
    handsGood: 30,
    handsSource: "log",
    weakestRef: null,
    weakestHands: null,
    weakestWrong: null,
    emailsSent: {},
    lastEmailAt: null,
    ...over,
  };
}

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

describe("decide", () => {
  it("day1: 24–48h after signup and nothing played today", () => {
    expect(decide(cand(), NOW).template).toBe("day1");
    expect(decide(cand({ activeToday: true }), NOW).template).toBeNull();
    expect(decide(cand({ signedUpAt: ago(20 * H) }), NOW).template).toBeNull();
    expect(decide(cand({ emailsSent: { day1: ago(1 * H) }, lastEmailAt: ago(1 * H) }), NOW).template).toBeNull();
  });

  it("day3: from 48h, after 2+ inactive days, not right after day1", () => {
    const base = { signedUpAt: ago(3 * D), lastActiveAt: ago(3 * D - H) };
    expect(decide(cand(base), NOW).template).toBe("day3");
    expect(decide(cand({ ...base, lastActiveAt: ago(30 * H) }), NOW).template).toBeNull();
    // Never played at all counts as inactive since signup.
    expect(decide(cand({ ...base, lastActiveAt: null, handsTotal: 0 }), NOW).template).toBe("day3");
    // day1 went out 24h ago: wait one more run.
    expect(decide(cand({ ...base, emailsSent: { day1: ago(24 * H) }, lastEmailAt: ago(24 * H) }), NOW).template).toBeNull();
    expect(decide(cand({ ...base, emailsSent: { day1: ago(48 * H) }, lastEmailAt: ago(48 * H) }), NOW).template).toBe("day3");
  });

  it("day7: 7–15 days, inactive, the last one", () => {
    const base = { signedUpAt: ago(7 * D + H), lastActiveAt: ago(6 * D) };
    expect(decide(cand(base), NOW).template).toBe("day7");
    expect(decide(cand({ ...base, emailsSent: { day7: ago(3 * D) }, lastEmailAt: ago(3 * D) }), NOW).template).toBeNull();
    expect(decide(cand({ ...base, signedUpAt: ago(16 * D) }), NOW).template).toBeNull();
  });

  it("stops the flow once the user is active after an email", () => {
    const c = cand({
      signedUpAt: ago(8 * D),
      emailsSent: { day1: ago(7 * D), day3: ago(5 * D) },
      lastEmailAt: ago(5 * D),
      lastActiveAt: ago(4 * D),
    });
    const d = decide(c, NOW);
    expect(d.template).toBeNull();
    expect(d.reason).toMatch(/active again/);
  });

  it("skips excluded test accounts, case-insensitively", () => {
    expect(decide(cand({ email: "Me@Test.com" }), NOW, new Set(["me@test.com"])).template).toBeNull();
  });
});

describe("helpers", () => {
  it("accuracy needs 5 hands", () => {
    expect(accuracyPct({ handsTotal: 4, handsGood: 4 })).toBeNull();
    expect(accuracyPct({ handsTotal: 40, handsGood: 30 })).toBe(75);
    expect(accuracyPct({ handsTotal: 10, handsGood: 12 })).toBe(100);
  });

  it("first name only", () => {
    expect(firstName("Sam Streak")).toBe("Sam");
    expect(firstName("  ")).toBeNull();
    expect(firstName(null)).toBeNull();
  });

  it("parses an RPC row", () => {
    const c = parseCandidate({
      user_id: "u1",
      email: "a@b.c",
      name: null,
      signed_up_at: "2026-10-19T10:00:00Z",
      timezone: null,
      last_active_at: null,
      active_today: false,
      streak: 0,
      hands_total: 0,
      hands_good: 0,
      hands_source: "estimate",
      weakest_ref: null,
      weakest_hands: null,
      weakest_wrong: null,
      emails_sent: { day1: "2026-10-20T16:00:00Z", bogus: "x" },
      last_email_at: "2026-10-20T16:00:00Z",
    });
    expect(c.timezone).toBe("Europe/Amsterdam");
    expect(c.emailsSent).toEqual({ day1: "2026-10-20T16:00:00Z" });
  });
});

describe("unsubscribe token", () => {
  it("round-trips and rejects tampering", () => {
    const id = "6f1c2a9e-1111-4222-8333-444455556666";
    const t = unsubscribeToken(id);
    expect(verifyUnsubscribeToken(t)).toBe(id);
    expect(verifyUnsubscribeToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyUnsubscribeToken(t.replace("6f1c", "7f1c"))).toBeNull();
    expect(verifyUnsubscribeToken(unsubscribeToken(id, "another-secret-another-secret-12345"))).toBeNull();
    expect(verifyUnsubscribeToken("nonsense")).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
  });
});

describe("spots", () => {
  it("teaser is a real chart spot and deterministic per seed", () => {
    const a = teaserSpot("u:2026-10-20");
    expect(teaserSpot("u:2026-10-20")).toEqual(a);
    expect(a.headline).toMatch(/^[A-Z+0-9]+ · \d+bb( cash)? · [AKQJT2-9]{2}[so]?$/);
    expect(a.question.length).toBeGreaterThan(5);
  });

  it("labels every chart the trainer can log", () => {
    for (const c of PUSH_FOLD_CHARTS) expect(spotInfo(`pushfold:${c.page}`)?.label).toMatch(/push\/fold/);
    for (const c of OPEN_CHARTS) expect(spotInfo(`open:${c.page}`)?.label).toMatch(/open at \d+bb/);
    for (const c of DEFENSE_CHARTS) expect(spotInfo(`defense:${c.n}`)?.label).toMatch(/ vs /);
    expect(spotInfo("open:99999")).toBeNull();
    expect(spotInfo("pushfold:" + PUSH_FOLD_CHARTS[0].page)?.query).toBe("?type=open&game=pf");
  });
});

describe("templates", () => {
  const ctx = { siteUrl: "https://stackedpokerai.com", unsubscribeUrl: "https://stackedpokerai.com/unsubscribe?t=x", seed: "s" };

  it("day1 has the teaser, UTM link, streak, unsubscribe and a text part", () => {
    const e = renderEmail("day1", cand(), ctx);
    expect(e.subject).toBe("Don't lose your 1-day streak 🔥");
    expect(e.html).toContain("utm_source=email&amp;utm_medium=lifecycle&amp;utm_campaign=day1");
    expect(e.text).toContain("/preflop-trainer?utm_source=email&utm_medium=lifecycle&utm_campaign=day1");
    expect(e.html).toContain("Hi Sam,");
    expect(e.html).toContain(escapeHtml(ctx.unsubscribeUrl));
    expect(e.text).toContain(ctx.unsubscribeUrl);
    expect(renderEmail("day1", cand({ streak: 0 }), ctx).subject).toBe("Today's preflop spots are ready");
  });

  it("day3 shows hands, accuracy and the weakest spot with its trainer filter", () => {
    const ref = `pushfold:${PUSH_FOLD_CHARTS[0].page}`;
    const e = renderEmail("day3", cand({ streak: 0, weakestRef: ref, weakestHands: 6, weakestWrong: 4 }), ctx);
    expect(e.subject).toMatch(/^Your weakest spot: .+ push\/fold/);
    expect(e.text).toContain("Hands answered: 40");
    expect(e.text).toContain("Accuracy: 75%");
    expect(e.text).toContain("(4 of 6 wrong)");
    expect(e.text).toContain("/preflop-trainer?type=open&game=pf&utm_source=email&utm_medium=lifecycle&utm_campaign=day3");
    expect(e.text).toContain("Start a streak today");
    const none = renderEmail("day3", cand({ handsTotal: 0, handsGood: 0 }), ctx);
    expect(none.subject).toBe("Your first preflop spot is waiting");
    expect(none.text).not.toContain("Accuracy");
  });

  it("day7 is a short founder note", () => {
    const e = renderEmail("day7", cand({ name: null }), ctx);
    expect(e.subject).toBe("What was missing?");
    expect(e.text).toMatch(/^Hey, Manuel here/);
    expect(e.text).toContain("40 hands");
  });

  it("escapes names", () => {
    const e = renderEmail("day1", cand({ name: "<script>x</script>" }), ctx);
    expect(e.html).not.toContain("<script>x");
  });
});

describe("runLifecycleEmails", () => {
  function fakeSupabase(rows: Record<string, unknown>[]) {
    const log: { user_id: string; template: string; id: number; provider_id?: string }[] = [];
    let id = 0;
    const sb = {
      rpc: async () => ({ data: rows, error: null }),
      from: () => ({
        upsert: (row: { user_id: string; template: string }) => ({
          select: async () => {
            if (log.some((l) => l.user_id === row.user_id && l.template === row.template)) return { data: [], error: null };
            const r = { ...row, id: ++id };
            log.push(r);
            return { data: [{ id: r.id }], error: null };
          },
        }),
        update: (v: { provider_id: string }) => ({
          eq: async (_k: string, rid: number) => {
            const r = log.find((l) => l.id === rid);
            if (r) r.provider_id = v.provider_id;
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (_k: string, rid: number) => {
            log.splice(log.findIndex((l) => l.id === rid), 1);
            return { error: null };
          },
        }),
      }),
    };
    return { sb, log };
  }

  const row = (email: string, signedUpAgo: number) => ({
    user_id: `00000000-0000-4000-8000-${email.length.toString().padStart(12, "0")}`,
    email,
    name: null,
    signed_up_at: ago(signedUpAgo),
    timezone: "Europe/Amsterdam",
    last_active_at: null,
    active_today: false,
    streak: 0,
    hands_total: 0,
    hands_good: 0,
    hands_source: "estimate",
    weakest_ref: null,
    weakest_hands: null,
    weakest_wrong: null,
    emails_sent: {},
    last_email_at: null,
  });

  it("dry run sends and writes nothing", async () => {
    const { sb, log } = fakeSupabase([row("a@t.co", 30 * H), row("bb@t.co", 2 * H)]);
    const sent: string[] = [];
    const r = await runLifecycleEmails(sb as never, { now: NOW, dry: true, send: async (i) => (sent.push(i.to), { id: "x" }), spacingMs: 0 });
    expect(r.results.map((x) => [x.email, x.status, x.template])).toEqual([
      ["a@t.co", "would_send", "day1"],
      ["bb@t.co", "skipped", null],
    ]);
    expect(sent).toEqual([]);
    expect(log).toEqual([]);
  });

  it("claims before sending, records the id, and releases the claim on failure", async () => {
    const { sb, log } = fakeSupabase([row("a@t.co", 30 * H), row("ccc@t.co", 3 * D)]);
    const r = await runLifecycleEmails(sb as never, {
      now: NOW,
      dry: false,
      spacingMs: 0,
      send: async (i) => {
        expect(i.oneClickUrl).toMatch(/\/api\/email\/unsubscribe\?t=/);
        if (i.to === "ccc@t.co") throw new Error("Resend 422: bad");
        return { id: "msg_1" };
      },
    });
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(1);
    expect(log).toEqual([expect.objectContaining({ template: "day1", provider_id: "msg_1" })]);

    // A second run the same day: the claim blocks a duplicate.
    const again = await runLifecycleEmails(sb as never, { now: NOW, dry: false, spacingMs: 0, send: async () => ({ id: "msg_2" }) });
    expect(again.results.find((x) => x.email === "a@t.co")?.reason).toMatch(/already in email_log/);
  });
});
