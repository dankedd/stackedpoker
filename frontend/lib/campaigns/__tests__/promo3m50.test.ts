import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendInput } from "@/lib/lifecycle/resend";
import { senderFor } from "@/lib/lifecycle/resend";
import {
  CAMPAIGN,
  PROMO_CODE,
  REQUIRED_ENV,
  fetchPromo,
  loadAudience,
  missingEnv,
  promoProblem,
  renderFor,
  selectAudience,
  sendCampaign,
  sendPromoTest,
  type PromoState,
  type Recipient,
} from "../promo3m50";

const NOW = Date.parse("2026-10-25T10:00:00Z");
const DAY = 86_400_000;

const row = (id: string, email: string, plan = "free", extra: Record<string, unknown> = {}) => ({
  user_id: id,
  email,
  name: null,
  timezone: "Europe/Amsterdam",
  plan,
  ...extra,
});

/** email_log as a table with the (user_id, template) unique key; rpc returns `candidates`. */
function fakeSb(candidates: Record<string, unknown>[] = [], log: { id: number; user_id: string; template: string; provider_id?: string }[] = []) {
  let nextId = 100;
  const sb = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      expect(fn).toBe("promo_email_candidates");
      expect(args.p_template).toBe(CAMPAIGN);
      return { data: candidates, error: null };
    },
    from: (table: string) => {
      expect(table).toBe("email_log");
      return {
        select: () => ({ eq: (_c: string, t: string) => ({ limit: async () => ({ data: log.filter((l) => l.template === t), error: null }) }) }),
        upsert: (v: { user_id: string; template: string }) => ({
          select: async () => {
            if (log.some((l) => l.user_id === v.user_id && l.template === v.template)) return { data: [], error: null };
            const r = { id: nextId++, user_id: v.user_id, template: v.template };
            log.push(r);
            return { data: [{ id: r.id }], error: null };
          },
        }),
        update: (v: { provider_id: string }) => ({
          eq: async (_c: string, id: number) => {
            const r = log.find((l) => l.id === id);
            if (r) r.provider_id = v.provider_id;
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (_c: string, id: number) => {
            log.splice(log.findIndex((l) => l.id === id), 1);
            return { error: null };
          },
        }),
      };
    },
  };
  return { sb: sb as unknown as SupabaseClient, log };
}

function capture(fail: (input: SendInput, n: number) => Error | null = () => null) {
  const sent: SendInput[] = [];
  let calls = 0;
  const send = async (input: SendInput) => {
    const err = fail(input, ++calls);
    if (err) throw err;
    sent.push(input);
    return { id: `re_${sent.length}` };
  };
  return { sent, send };
}

const promo = (over: Partial<PromoState> = {}): PromoState => ({
  id: "promo_1",
  code: PROMO_CODE,
  active: true,
  expiresAt: new Date(NOW + 7 * DAY - 60_000).toISOString(),
  amountOff: 400,
  currency: "eur",
  months: 3,
  ...over,
});

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.LIFECYCLE_SITE_URL = "https://stackedpokerai.com";
  process.env.LIFECYCLE_EXCLUDE_EMAILS = "qa@stacked.test";
});

describe("promo_3m_50 audience", () => {
  it("never selects Pro or trial users", () => {
    const { recipients, skipped } = selectAudience([
      row("u1", "free@x.io"),
      row("u2", "pro@x.io", "pro"),
      row("u3", "trial@x.io", "trial"),
      row("u4", "unknown@x.io", ""),
    ]);
    expect(recipients.map((r) => r.userId)).toEqual(["u1"]);
    expect(skipped.map((s) => s.reason)).toEqual(["plan is pro, not free", "plan is trial, not free", "plan is unknown, not free"]);
  });

  it("drops duplicates by user id and by email, case-insensitively", () => {
    const { recipients, skipped } = selectAudience([
      row("u1", "Sam@X.io"),
      row("u1", "sam@x.io"),
      row("u2", "sam@x.io "),
      row("u3", "other@x.io"),
    ]);
    expect(recipients.map((r) => r.userId)).toEqual(["u1", "u3"]);
    expect(skipped.map((s) => s.reason)).toEqual(["duplicate", "duplicate"]);
  });

  it("skips test accounts, users already sent this campaign, and rows without an address", () => {
    const { recipients, skipped } = selectAudience([row("u1", "QA@stacked.test"), row("u2", "a@x.io"), row("u3", "")], {
      excluded: new Set(["qa@stacked.test"]),
      alreadySent: new Set(["u2"]),
    });
    expect(recipients).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual(["test account (LIFECYCLE_EXCLUDE_EMAILS)", `already in email_log (${CAMPAIGN})`, "no email address"]);
  });

  it("loadAudience re-checks email_log and LIFECYCLE_EXCLUDE_EMAILS on top of the SQL", async () => {
    const { sb } = fakeSb([row("u1", "a@x.io"), row("u2", "b@x.io"), row("u3", "qa@stacked.test")], [{ id: 1, user_id: "u2", template: CAMPAIGN }, { id: 2, user_id: "u1", template: "day7" }]);
    const { recipients } = await loadAudience(sb, NOW);
    expect(recipients.map((r) => r.userId)).toEqual(["u1"]);
  });
});

describe("promo_3m_50 Stripe code", () => {
  it("reads the code and uses the earlier of the code's and the coupon's end", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({
        data: [{ id: "promo_1", code: "STACKED50", active: true, expires_at: 1_761_900_000, coupon: { valid: true, redeem_by: 1_761_800_000, amount_off: 400, currency: "eur", duration_in_months: 3 } }],
      }));
    }) as unknown as typeof fetch;
    const p = await fetchPromo(PROMO_CODE, "sk_test_abc", fakeFetch);
    expect(p).toMatchObject({ id: "promo_1", active: true, amountOff: 400, months: 3, expiresAt: new Date(1_761_800_000 * 1000).toISOString() });
    expect(seen!.url).toContain("code=STACKED50");
    expect((seen!.init!.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_abc");
  });

  it("returns null when the code does not exist", async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ data: [] }))) as unknown as typeof fetch;
    expect(await fetchPromo(PROMO_CODE, "sk", fakeFetch)).toBeNull();
  });

  it("blocks a real send unless the code is active, €4.00 off for 3 months and ends about 7 days out", () => {
    expect(promoProblem(promo(), NOW)).toBeNull();
    expect(promoProblem(null, NOW)).toMatch(/not found/);
    expect(promoProblem(promo({ active: false }), NOW)).toMatch(/not active/);
    expect(promoProblem(promo({ amountOff: 50 }), NOW)).toMatch(/€4.00 off/);
    expect(promoProblem(promo({ expiresAt: null }), NOW)).toMatch(/no expiry/);
    expect(promoProblem(promo({ expiresAt: new Date(NOW + 3 * DAY).toISOString() }), NOW)).toMatch(/3\.0 days/);
    expect(promoProblem(promo({ expiresAt: new Date(NOW + 10 * DAY).toISOString() }), NOW)).toMatch(/10\.0 days/);
  });
});

describe("promo_3m_50 email", () => {
  const r: Recipient = { userId: "11111111-1111-4111-8111-111111111111", email: "sam@x.io", name: "Sam Smith", timezone: "Europe/Amsterdam", plan: "free" };
  const render = () => renderFor(r, "2026-11-01T09:00:00Z");

  it("has the subject, one button with the code applied, the deadline and the P.S.", () => {
    const email = render();
    expect(email.subject).toBe("50% off Stacked Poker Pro for 3 months (7 days only)");
    expect(email.html.match(/<a href="[^"]*\/checkout\?/g)).toHaveLength(1);
    expect(email.html).toContain("/checkout?source=promo_3m_50&amp;promo=STACKED50");
    expect(email.text).toContain("/checkout?source=promo_3m_50&promo=STACKED50");
    expect(email.text).toContain("Hi Sam, Manuel here.");
    expect(email.text).toContain("€3.99/month for your first 3 months, then the regular €7.99/month");
    expect(email.text).toContain("Sunday, November 1 at 10:00");
    expect(email.text).toMatch(/P\.S\. .*reply/);
    for (const feature of ["Preflop Trainer", "Flop Trainer", "hand analyzer", "Stacked score"]) expect(email.text).toContain(feature);
  });

  it("keeps the existing unsubscribe link and comes from Manuel with replies to the reply-to address", () => {
    const email = render();
    expect(email.html).toContain("https://stackedpokerai.com/unsubscribe?t=11111111-1111-4111-8111-111111111111.");
    process.env.LIFECYCLE_REPLY_TO = "manuel@stacked.test";
    expect(senderFor("promo_3m_50")).toEqual({ from: "Manuel from Stacked Poker <coach@stackedpokerai.com>", replyTo: "manuel@stacked.test" });
  });
});

describe("promo_3m_50 sending", () => {
  const recipients = (n: number): Recipient[] =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, email: `p${i}@x.io`, name: null, timezone: "Europe/Amsterdam", plan: "free" }));

  it("claims, sends and logs every recipient once, with a stable idempotency key", async () => {
    const { sb, log } = fakeSb();
    const { sent, send } = capture();
    const res = await sendCampaign(sb, recipients(3), { expiresAt: promo().expiresAt!, now: NOW, send, spacingMs: 0 });
    expect(res).toMatchObject({ sent: 3, failed: 0 });
    expect(sent.map((s) => s.to)).toEqual(["p0@x.io", "p1@x.io", "p2@x.io"]);
    expect(sent.map((s) => s.idempotencyKey)).toEqual(["promo_3m_50-u0", "promo_3m_50-u1", "promo_3m_50-u2"]);
    expect(log.map((l) => [l.user_id, l.template, l.provider_id])).toEqual([["u0", CAMPAIGN, "re_1"], ["u1", CAMPAIGN, "re_2"], ["u2", CAMPAIGN, "re_3"]]);

    // A second run (or a concurrent one) mails nobody again.
    const again = await sendCampaign(sb, recipients(3), { expiresAt: promo().expiresAt!, now: NOW, send, spacingMs: 0 });
    expect(again).toMatchObject({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(3);
  });

  it("removes the claim when Resend refuses, so a re-run retries it", async () => {
    const { sb, log } = fakeSb();
    const { send } = capture((input) => (input.to === "p1@x.io" ? new Error("Resend 422: invalid") : null));
    const res = await sendCampaign(sb, recipients(3), { expiresAt: promo().expiresAt!, now: NOW, send, spacingMs: 0 });
    expect(res).toMatchObject({ sent: 2, failed: 1 });
    expect(log.map((l) => l.user_id)).toEqual(["u0", "u2"]);
  });

  it("waits and retries when Resend rate-limits", async () => {
    const { sb } = fakeSb();
    const { sent, send } = capture((_i, n) => (n === 1 ? new Error("Resend 429: rate limit") : null));
    const res = await sendCampaign(sb, recipients(1), { expiresAt: promo().expiresAt!, now: NOW, send, spacingMs: 1 });
    expect(res.sent).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("test send: [TEST] subject to that one address, no database", async () => {
    const { sent, send } = capture();
    const r = await sendPromoTest("me@x.io", { expiresAt: promo().expiresAt!, send });
    expect(r.subject.startsWith("[TEST] ")).toBe(true);
    expect(sent.map((s) => s.to)).toEqual(["me@x.io"]);
  });

  it("requires the four keys plus the Supabase URL and reply-to address", () => {
    expect(REQUIRED_ENV).toEqual(expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_TOKEN_SECRET", "STRIPE_SECRET_KEY"]));
    const full = Object.fromEntries(REQUIRED_ENV.map((k) => [k, "x"]));
    expect(missingEnv(full)).toEqual([]);
    expect(missingEnv({ ...full, STRIPE_SECRET_KEY: " ", RESEND_API_KEY: undefined })).toEqual(["RESEND_API_KEY", "STRIPE_SECRET_KEY"]);
  });
});
