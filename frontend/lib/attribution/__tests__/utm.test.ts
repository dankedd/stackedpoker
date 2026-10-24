import { describe, expect, it } from "vitest";
import { decodeUtmCookie, encodeUtmCookie, oauthSignupMetadata, utmFromUrl } from "../utm";

describe("utm attribution", () => {
  it("reads the utm_* set from a landing URL", () => {
    expect(utmFromUrl("?utm_source=fb&utm_content=test&x=1", "/preflop-trainer")).toEqual({
      utm_source: "fb",
      utm_content: "test",
      landing_path: "/preflop-trainer",
    });
    expect(utmFromUrl("?ref=abc", "/")).toBeNull();
  });

  it("marks visitors from a shared hand", () => {
    expect(utmFromUrl("?utm_source=share&utm_medium=hand&utm_content=Ab3dE9z", "/signup")?.referred_by_share).toBe("Ab3dE9z");
  });

  it("round-trips the cookie and ignores junk", () => {
    const utm = { utm_source: "fb", utm_content: "test", landing_path: "/" };
    expect(decodeUtmCookie(encodeUtmCookie(utm))).toEqual(utm);
    expect(decodeUtmCookie("not json")).toBeNull();
    expect(decodeUtmCookie(encodeURIComponent('{"utm_source":"fb","evil":"x","utm_term":5}'))).toEqual({ utm_source: "fb" });
    expect(decodeUtmCookie(undefined)).toBeNull();
  });

  describe("oauthSignupMetadata", () => {
    const now = Date.parse("2026-10-26T10:00:00Z");
    const cookie = { utm_source: "fb", utm_content: "test", landing_path: "/" };

    it("writes signup_utm for a brand-new Google account, keeping its metadata", () => {
      const meta = oauthSignupMetadata({ created_at: "2026-10-26T09:58:00Z", user_metadata: { full_name: "Jane" } }, cookie, now);
      expect(meta).toEqual({ full_name: "Jane", signup_utm: cookie });
    });

    it("adds referred_by_share for share visitors", () => {
      const meta = oauthSignupMetadata({ created_at: "2026-10-26T09:59:00Z", user_metadata: {} }, { utm_source: "share", utm_content: "Ab3dE9z" }, now);
      expect((meta?.signup_utm as Record<string, string>).referred_by_share).toBe("Ab3dE9z");
    });

    it("never touches an existing account, an existing signup_utm, or a visit without UTMs", () => {
      expect(oauthSignupMetadata({ created_at: "2026-09-01T10:00:00Z", user_metadata: {} }, cookie, now)).toBeNull();
      expect(oauthSignupMetadata({ created_at: "2026-10-26T09:59:00Z", user_metadata: { signup_utm: { utm_source: "ig" } } }, cookie, now)).toBeNull();
      expect(oauthSignupMetadata({ created_at: "2026-10-26T09:59:00Z", user_metadata: {} }, null, now)).toBeNull();
      expect(oauthSignupMetadata({ created_at: null, user_metadata: {} }, cookie, now)).toBeNull();
    });
  });
});
