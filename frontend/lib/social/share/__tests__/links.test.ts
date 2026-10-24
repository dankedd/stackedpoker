import { describe, expect, it } from "vitest";
import { embedCode, shareUrl, signupFromShareUrl, socialShareUrl, SLUG_RE } from "../api";

describe("share links", () => {
  it("builds the public, embed and signup URLs", () => {
    expect(shareUrl("Ab3dE9z", "http://localhost:3000")).toBe("http://localhost:3000/h/Ab3dE9z");
    expect(embedCode("Ab3dE9z", "http://localhost:3000")).toContain('src="http://localhost:3000/embed/h/Ab3dE9z"');
    expect(signupFromShareUrl("Ab3dE9z")).toBe("/signup?utm_source=share&utm_medium=hand&utm_content=Ab3dE9z");
  });

  it("encodes text for the social targets", () => {
    const url = "https://stackedpokerai.com/h/Ab3dE9z";
    expect(socialShareUrl("whatsapp", url, "Call or fold?")).toBe(`https://wa.me/?text=${encodeURIComponent(`Call or fold? ${url}`)}`);
    expect(socialShareUrl("x", url, "A & B")).toContain("text=A%20%26%20B");
    expect(socialShareUrl("reddit", url, "Q")).toContain(`url=${encodeURIComponent(url)}`);
  });

  it("accepts only 7-character slugs", () => {
    expect(SLUG_RE.test("Ab3dE9z")).toBe(true);
    for (const bad of ["Ab3dE9", "Ab3dE9zz", "Ab3-E9z", "../../x"]) expect(SLUG_RE.test(bad)).toBe(false);
  });
});
