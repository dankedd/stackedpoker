import { describe, expect, it } from "vitest";
import { fmtBb, fmtChips, fmtPct, fmtPlayedAt, fmtPlayedDate, fmtSignedBb } from "../format";

describe("English number and date formatting", () => {
  it("uses comma thousands and a decimal point", () => {
    expect(fmtChips(1500)).toBe("1,500");
    expect(fmtBb(21.56)).toBe("21.6 BB");
    expect(fmtSignedBb(-4)).toBe("−4.0 BB");
    expect(fmtPct(0.286)).toBe("28.6%");
  });

  it("prints dates as \"Oct 8, 2026, 21:40\" in the site's own time", () => {
    expect(fmtPlayedAt("2026-10-08T21:40:24")).toBe("Oct 8, 2026, 21:40");
    expect(fmtPlayedDate("2026-10-08T21:40:24")).toBe("Oct 8, 2026");
  });
});
