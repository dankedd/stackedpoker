import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { missingFields, providerProfile, syncOAuthProfile, type ProfileFields, type ProfilesClient } from "../profileSync";

const GOOGLE = { full_name: "Ada Lovelace", name: "Ada", avatar_url: "https://lh3.googleusercontent.com/a/x", picture: "https://lh3.googleusercontent.com/a/y" };

type DbError = { code?: string; message: string } | null;

/** In-memory `profiles` with just the calls syncOAuthProfile makes. */
function fakeClient(row: ProfileFields | null, errors: { read?: DbError; update?: DbError; insert?: DbError } = {}) {
  const calls: { op: string; values?: unknown }[] = [];
  let current = row;
  const client: ProfilesClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push({ op: "read" });
            return { data: errors.read ? null : current, error: errors.read ?? null };
          },
        }),
      }),
      update: (values) => ({
        eq: async () => {
          calls.push({ op: "update", values });
          if (!errors.update) current = { ...current!, ...values };
          return { error: errors.update ?? null };
        },
      }),
      insert: async (values) => {
        calls.push({ op: "insert", values });
        return { error: errors.insert ?? null };
      },
    }),
  };
  return { client, calls, get row() { return current; } };
}

describe("providerProfile", () => {
  it("prefers full_name and avatar_url, falls back to name and picture", () => {
    expect(providerProfile(GOOGLE)).toEqual({ full_name: "Ada Lovelace", avatar_url: GOOGLE.avatar_url });
    expect(providerProfile({ name: "Ada", picture: GOOGLE.picture })).toEqual({ full_name: "Ada", avatar_url: GOOGLE.picture });
    expect(providerProfile({ full_name: "  ", avatar_url: 42 })).toEqual({ full_name: null, avatar_url: null });
    expect(providerProfile(undefined)).toEqual({ full_name: null, avatar_url: null });
  });
});

describe("missingFields", () => {
  it("fills only what is empty, never overwrites", () => {
    const g = providerProfile(GOOGLE);
    expect(missingFields({ full_name: null, avatar_url: null }, g)).toEqual(g);
    expect(missingFields({ full_name: "Own name", avatar_url: null }, g)).toEqual({ avatar_url: g.avatar_url });
    expect(missingFields({ full_name: "Own name", avatar_url: "own.png" }, g)).toEqual({});
  });
});

describe("syncOAuthProfile", () => {
  it("fills name and avatar on the row the signup trigger created", async () => {
    const db = fakeClient({ full_name: null, avatar_url: null });
    const r = await syncOAuthProfile(db.client, { id: "u1", user_metadata: GOOGLE });
    expect(r).toEqual({ status: "updated", fields: ["full_name", "avatar_url"] });
    expect(db.row).toEqual({ full_name: "Ada Lovelace", avatar_url: GOOGLE.avatar_url });
  });

  it("returning login with a complete profile writes nothing", async () => {
    const db = fakeClient({ full_name: "Ada Lovelace", avatar_url: "own.png" });
    expect(await syncOAuthProfile(db.client, { id: "u1", user_metadata: GOOGLE })).toEqual({ status: "unchanged" });
    expect(db.calls.map((c) => c.op)).toEqual(["read"]);
  });

  it("never sends email or other columns", async () => {
    const db = fakeClient({ full_name: null, avatar_url: null });
    await syncOAuthProfile(db.client, { id: "u1", user_metadata: { ...GOOGLE, email: "a@b.c" } });
    const update = db.calls.find((c) => c.op === "update")!;
    expect(Object.keys(update.values as object).sort()).toEqual(["avatar_url", "full_name"]);
  });

  it("creates the row when the trigger did not", async () => {
    const db = fakeClient(null);
    expect(await syncOAuthProfile(db.client, { id: "u1", user_metadata: GOOGLE })).toEqual({ status: "created", fields: ["full_name", "avatar_url"] });
    expect(db.calls[1]).toEqual({ op: "insert", values: { id: "u1", full_name: "Ada Lovelace", avatar_url: GOOGLE.avatar_url } });
  });

  it("does not touch the database for an email account without provider data", async () => {
    const db = fakeClient({ full_name: null, avatar_url: null });
    expect(await syncOAuthProfile(db.client, { id: "u1", user_metadata: { username: "ada" } })).toEqual({ status: "unchanged" });
    expect(db.calls).toEqual([]);
  });

  it("returns the real Postgres error, e.g. a missing column", async () => {
    const db = fakeClient(null, { read: { code: "42703", message: "column profiles.full_name does not exist" } });
    expect(await syncOAuthProfile(db.client, { id: "u1", user_metadata: GOOGLE })).toEqual({
      status: "error",
      step: "read",
      error: "42703 column profiles.full_name does not exist",
    });
  });

  it("reports a failed update", async () => {
    const db = fakeClient({ full_name: null, avatar_url: null }, { update: { code: "42501", message: "permission denied for table profiles" } });
    const r = await syncOAuthProfile(db.client, { id: "u1", user_metadata: GOOGLE });
    expect(r).toEqual({ status: "error", step: "update", error: "42501 permission denied for table profiles" });
  });
});

describe("auth callback", () => {
  const src = readFileSync(path.resolve(__dirname, "../../../app/auth/callback/route.ts"), "utf-8");
  it("no longer writes email to profiles, and logs profile errors as errors", () => {
    expect(src).not.toMatch(/email:\s*user\.email/);
    expect(src).toContain("syncOAuthProfile(");
    expect(src).toMatch(/console\.error\(`\[auth\/callback\] profile/);
    expect(src).not.toContain("profile upsert warning");
  });
});
