import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SAMPLE_ACCOUNT, dummyCandidate, sendTestEmail, testRecipients } from "../testSend";
import type { SendInput } from "../resend";

const NOW = Date.parse("2026-10-24T12:00:00Z");

/** Fake service-role client: every table read resolves to `tables[name]`; records which tables were touched. */
function fakeSb(users: object[], tables: Record<string, unknown[]> = {}) {
  const touched: string[] = [];
  const query = (name: string) => {
    const rows = tables[name] ?? [];
    const result = { data: rows, count: rows.length, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "lte", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
    return q;
  };
  const sb = {
    auth: { admin: { listUsers: async () => ({ data: { users }, error: null }) } },
    rpc: async () => ({ data: { streak: 4, active_today: false }, error: null }),
    from: (name: string) => {
      touched.push(name);
      return query(name);
    },
  };
  return { sb: sb as unknown as SupabaseClient, touched };
}

function capture() {
  const sent: SendInput[] = [];
  const send = async (input: SendInput) => {
    sent.push(input);
    return { id: `re_${sent.length}` };
  };
  return { sent, send };
}

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

describe("lifecycle test send", () => {
  it("parses LIFECYCLE_TEST_RECIPIENTS", () => {
    process.env.LIFECYCLE_TEST_RECIPIENTS = " Me@Example.com, other@x.io ,";
    expect([...testRecipients()]).toEqual(["me@example.com", "other@x.io"]);
  });

  it("falls back to dummy data, prefixes the subject, sends only to `to`, writes nothing", async () => {
    const { sb, touched } = fakeSb([]);
    const { sent, send } = capture();
    for (const template of ["day1", "day3", "day7"] as const) {
      const r = await sendTestEmail(sb, { template, to: "me@example.com", now: NOW, send });
      expect(r.data).toMatch(/^dummy/);
      expect(r.subject.startsWith("[TEST] ")).toBe(true);
    }
    expect(sent.map((s) => s.to)).toEqual(["me@example.com", "me@example.com", "me@example.com"]);
    expect(new Set(sent.map((s) => s.idempotencyKey)).size).toBe(3);
    expect(touched).not.toContain("email_log");
    // Dummy day3 shows stats and a weakest spot.
    expect(sent[1].email.summary).toContain("64 hands");
  });

  it("uses the sample account's stats when it exists", async () => {
    const user = { id: "6f1c2a9e-1111-4222-8333-444455556666", email: SAMPLE_ACCOUNT, created_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Manuel A" } };
    const log = [
      ...Array.from({ length: 4 }, () => ({ hand_ref: "open:x:AKs", verdict: "wrong", played_at: "2026-10-20T10:00:00Z" })),
      ...Array.from({ length: 6 }, () => ({ hand_ref: "open:y:72o", verdict: "correct", played_at: "2026-10-21T10:00:00Z" })),
    ];
    const { sb, touched } = fakeSb([user], { trainer_hand_log: log });
    const { sent, send } = capture();
    const r = await sendTestEmail(sb, { template: "day3", to: "me@example.com", now: NOW, send });
    expect(r.data).toBe("sample account");
    expect(r.summary).toContain("10 hands (log), accuracy 60%");
    expect(r.summary).toContain("streak 4");
    expect(sent[0].email.text).toContain("Hi Manuel");
    expect(touched).not.toContain("email_log");
  });

  it("dummy data has stats and a weakest spot", () => {
    const c = dummyCandidate(NOW);
    expect(c.handsTotal).toBeGreaterThan(0);
    expect(c.weakestRef).not.toBeNull();
  });
});
