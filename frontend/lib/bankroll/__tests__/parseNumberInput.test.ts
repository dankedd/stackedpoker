import { describe, expect, it } from "vitest";
import { parseLocaleNumber } from "../parseNumberInput";

describe("parseLocaleNumber", () => {
  it("parses a plain period-decimal number", () => {
    expect(parseLocaleNumber("4.99")).toBe(4.99);
    expect(parseLocaleNumber("100")).toBe(100);
  });

  it("parses a comma-decimal number (EU locale)", () => {
    expect(parseLocaleNumber("4,99")).toBe(4.99);
    expect(parseLocaleNumber("1234,5")).toBe(1234.5);
  });

  it("trims surrounding whitespace", () => {
    expect(parseLocaleNumber("  4,99  ")).toBe(4.99);
  });

  it("returns NaN for genuinely invalid input", () => {
    expect(Number.isNaN(parseLocaleNumber("abc"))).toBe(true);
  });

  it("matches native Number()'s (slightly quirky) handling of an empty string", () => {
    expect(parseLocaleNumber("")).toBe(0);
  });
});
