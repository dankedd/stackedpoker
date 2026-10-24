import { describe, expect, it } from "vitest";
import { HANDLE, handleFormatError, normalizeHandle, socialErrorMessage } from "../strings";

describe("socialErrorMessage", () => {
  it("maps database errors and bare RPC codes", () => {
    expect(socialErrorMessage("social:text_hate")).toBe("That language isn't allowed here.");
    expect(socialErrorMessage("duplicate")).toMatch(/already reported/);
    expect(socialErrorMessage("social:banned")).toMatch(/can't post/);
  });

  it("names the action for rate limits", () => {
    expect(socialErrorMessage("social:rate_limited:share")).toMatch(/share limit/);
    expect(socialErrorMessage("social:rate_limited:message")).toMatch(/too fast/);
    expect(socialErrorMessage("social:rate_limited:something_new")).toMatch(/Slow down/);
  });

  it("falls back to a generic message", () => {
    expect(socialErrorMessage(null)).toMatch(/Something went wrong/);
    expect(socialErrorMessage("JWT expired")).toMatch(/Something went wrong/);
  });
});

describe("handle format", () => {
  it("normalises like the database", () => {
    expect(normalizeHandle("  @River_Rat ")).toBe("river_rat");
  });

  it("gives instant feedback on length and characters", () => {
    expect(handleFormatError("")).toBeNull();
    expect(handleFormatError("@ok_name")).toBeNull();
    expect(handleFormatError("ab")).toBe(HANDLE.errors.length);
    expect(handleFormatError("a".repeat(21))).toBe(HANDLE.errors.length);
    expect(handleFormatError("has.dot")).toBe(HANDLE.errors.characters);
    expect(handleFormatError("_lead")).toBe(HANDLE.errors.characters);
    expect(handleFormatError("Upper_Case")).toBeNull(); // lowercased before saving
  });
});
