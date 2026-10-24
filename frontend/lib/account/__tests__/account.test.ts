import { describe, expect, it, vi } from "vitest";
import { blocksDeletion, deleteAccount, type DeleteDeps } from "../delete";
import { EXPORT_TABLES, buildExport, type ExportClient } from "../export";

describe("blocksDeletion", () => {
  const sub = (status: string, cancel = false, id: string | null = "sub_1") => ({
    status,
    stripe_subscription_id: id,
    cancel_at_period_end: cancel,
  });

  it("blocks while a Stripe subscription would charge again", () => {
    expect(blocksDeletion(sub("active"))).toBe(true);
    expect(blocksDeletion(sub("past_due"))).toBe(true);
  });

  it("allows free accounts, the reverse trial, canceled and ending subscriptions", () => {
    expect(blocksDeletion(null)).toBe(false);
    expect(blocksDeletion(sub("trialing", false, null))).toBe(false);
    expect(blocksDeletion(sub("canceled"))).toBe(false);
    expect(blocksDeletion(sub("active", true))).toBe(false);
  });
});

describe("deleteAccount", () => {
  const deps = (over: Partial<DeleteDeps> = {}): DeleteDeps => ({
    getSubscription: vi.fn(async () => null),
    removeStorageFolder: vi.fn(async () => undefined),
    deleteAuthUser: vi.fn(async () => ({ error: null })),
    ...over,
  });

  it("deletes the auth user and the storage folder", async () => {
    const d = deps();
    expect(await deleteAccount("u1", d)).toEqual({ ok: true });
    expect(d.removeStorageFolder).toHaveBeenCalledWith("avatars", "u1");
    expect(d.deleteAuthUser).toHaveBeenCalledWith("u1");
  });

  it("refuses with an active subscription and touches nothing", async () => {
    const d = deps({
      getSubscription: async () => ({ status: "active", stripe_subscription_id: "sub_1", cancel_at_period_end: false }),
    });
    expect(await deleteAccount("u1", d)).toEqual({ ok: false, error: "active_subscription" });
    expect(d.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("a storage failure does not block deletion; an auth failure is reported", async () => {
    const d = deps({ removeStorageFolder: async () => Promise.reject(new Error("no bucket")) });
    expect(await deleteAccount("u1", d)).toEqual({ ok: true });
    expect(await deleteAccount("u1", deps({ deleteAuthUser: async () => ({ error: new Error("x") }) }))).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("buildExport", () => {
  function fakeClient(rowsPerTable: Record<string, number>, failing: string[] = []): ExportClient & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      from(table) {
        return {
          select: () => ({
            eq: (col: string, v: string) => ({
              range: async (from: number, to: number) => {
                calls.push(`${table}.${col}=${v}[${from}-${to}]`);
                if (failing.includes(table)) return { data: null, error: { message: "relation does not exist" } };
                const n = Math.max(0, Math.min(to + 1, rowsPerTable[table] ?? 0) - from);
                return { data: Array.from({ length: n }, (_, i) => ({ i: from + i })), error: null };
              },
            }),
          }),
        };
      },
      rpc: async () => ({ data: { profile: { handle: "bobby" } }, error: null }),
    };
  }

  it("pages past 1000 rows and always filters on the owner", async () => {
    const c = fakeClient({ hh_hands: 2500 });
    const out = await buildExport(c, { id: "u1", email: "u@x" });
    expect(out.tables.hh_hands).toHaveLength(2500);
    expect(c.calls.filter((x) => x.startsWith("hh_hands"))).toEqual([
      "hh_hands.user_id=u1[0-999]",
      "hh_hands.user_id=u1[1000-1999]",
      "hh_hands.user_id=u1[2000-2999]",
    ]);
    expect(c.calls.find((x) => x.startsWith("profiles."))).toBe("profiles.id=u1[0-999]");
    expect(out.social).toEqual({ profile: { handle: "bobby" } });
  });

  it("skips tables that are missing or unreadable", async () => {
    const out = await buildExport(fakeClient({}, ["bankroll_goals"]), { id: "u1" });
    expect(out.skipped).toEqual(["bankroll_goals"]);
    expect(Object.keys(out.tables)).toHaveLength(EXPORT_TABLES.length - 1);
  });
});
