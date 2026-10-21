import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed one-click unsubscribe tokens: `<user id>.<HMAC-SHA256>`. No login
 * and no expiry (an old email's link must keep working), and nothing secret
 * in the token itself — it only proves we issued it for that user id.
 *
 * Server-only: needs EMAIL_TOKEN_SECRET.
 */

const PURPOSE = "unsubscribe:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret(): string {
  const s = process.env.EMAIL_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("EMAIL_TOKEN_SECRET is missing or shorter than 32 characters");
  return s;
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key).update(PURPOSE + userId).digest("base64url");
}

export function unsubscribeToken(userId: string, key = secret()): string {
  return `${userId}.${sign(userId, key)}`;
}

/** The user id the token was issued for, or null if it is not one of ours. */
export function verifyUnsubscribeToken(token: string | null | undefined, key = secret()): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const userId = token.slice(0, dot).toLowerCase();
  if (!UUID.test(userId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId, key));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
