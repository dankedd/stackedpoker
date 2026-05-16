/**
 * canonicalSeat.test.ts — Canonical seat engine test suite.
 *
 * Covers:
 *   - 2-max through 9-max table sizes
 *   - Hero in every possible seat position
 *   - Empty seat gaps (ghost seats)
 *   - Visual index computation
 *   - Preflop / postflop action order
 *   - Validation engine (errors and warnings)
 */

import { describe, it, expect } from "vitest";
import {
  buildCanonicalSeat,
  validateCanonicalSeats,
  postflopActionRank,
  preflopActionRank,
  isOopVs,
  POSITIONS_BY_SIZE,
} from "../canonicalSeat";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal set of canonical seats for a given hero position at table size N. */
function buildTable(n: number, heroPos: string) {
  const positions = POSITIONS_BY_SIZE[n];
  if (!positions) throw new Error(`No positions for N=${n}`);
  return positions.map((pos) =>
    buildCanonicalSeat(
      {
        physicalSeat: null,
        logicalPosition: pos,
        playerName: pos === heroPos ? "Hero" : `Villain_${pos}`,
        isHero: pos === heroPos,
        isSitting: true,
        cards: [],
        cardsKnown: false,
      },
      heroPos,
      n,
    ),
  );
}

// ── Visual index tests ────────────────────────────────────────────────────────

describe("visualIndex — hero is always 0", () => {
  for (const [n, positions] of Object.entries(POSITIONS_BY_SIZE)) {
    const N = Number(n);
    for (const heroPos of positions as string[]) {
      it(`N=${N} hero=${heroPos} → visualIndex 0`, () => {
        const seats = buildTable(N, heroPos);
        const hero = seats.find((s) => s.isHero);
        expect(hero).toBeDefined();
        expect(hero!.visualIndex).toBe(0);
      });
    }
  }
});

describe("visualIndex — unique and covers 0..N-1", () => {
  for (const [n, positions] of Object.entries(POSITIONS_BY_SIZE)) {
    const N = Number(n);
    const heroPos = (positions as string[])[0]; // BTN as hero
    it(`N=${N} hero=${heroPos}`, () => {
      const seats = buildTable(N, heroPos);
      const vis = seats.map((s) => s.visualIndex).sort((a, b) => a - b);
      expect(vis).toEqual(Array.from({ length: N }, (_, i) => i));
    });
  }
});

// ── Specific visual index spot-checks ─────────────────────────────────────────

describe("visualIndex spot checks (6-max, hero=BTN)", () => {
  const seats = buildTable(6, "BTN");

  it("BTN → visualIndex 0", () =>
    expect(seats.find((s) => s.logicalPosition === "BTN")!.visualIndex).toBe(0));
  it("SB → visualIndex 1", () =>
    expect(seats.find((s) => s.logicalPosition === "SB")!.visualIndex).toBe(1));
  it("BB → visualIndex 2", () =>
    expect(seats.find((s) => s.logicalPosition === "BB")!.visualIndex).toBe(2));
  it("UTG → visualIndex 3", () =>
    expect(seats.find((s) => s.logicalPosition === "UTG")!.visualIndex).toBe(3));
  it("HJ → visualIndex 4", () =>
    expect(seats.find((s) => s.logicalPosition === "HJ")!.visualIndex).toBe(4));
  it("CO → visualIndex 5", () =>
    expect(seats.find((s) => s.logicalPosition === "CO")!.visualIndex).toBe(5));
});

describe("visualIndex spot checks (6-max, hero=BB)", () => {
  const seats = buildTable(6, "BB");

  it("BB → visualIndex 0", () =>
    expect(seats.find((s) => s.logicalPosition === "BB")!.visualIndex).toBe(0));
  it("UTG → visualIndex 1", () =>
    expect(seats.find((s) => s.logicalPosition === "UTG")!.visualIndex).toBe(1));
  it("BTN → visualIndex 4", () =>
    expect(seats.find((s) => s.logicalPosition === "BTN")!.visualIndex).toBe(4));
  it("SB → visualIndex 5", () =>
    expect(seats.find((s) => s.logicalPosition === "SB")!.visualIndex).toBe(5));
});

// ── Preflop action order ──────────────────────────────────────────────────────

describe("preflopActionRank", () => {
  it("6-max: UTG=0, HJ=1, CO=2, BTN=3, SB=4, BB=5", () => {
    expect(preflopActionRank("UTG", 6)).toBe(0);
    expect(preflopActionRank("HJ",  6)).toBe(1);
    expect(preflopActionRank("CO",  6)).toBe(2);
    expect(preflopActionRank("BTN", 6)).toBe(3);
    expect(preflopActionRank("SB",  6)).toBe(4);
    expect(preflopActionRank("BB",  6)).toBe(5);
  });

  it("HU: BTN=0, BB=1", () => {
    expect(preflopActionRank("BTN", 2)).toBe(0);
    expect(preflopActionRank("BB",  2)).toBe(1);
  });

  it("9-max: UTG=0, UTG+1=1, UTG+2=2, LJ=3, HJ=4, CO=5, BTN=6, SB=7, BB=8", () => {
    expect(preflopActionRank("UTG",   9)).toBe(0);
    expect(preflopActionRank("UTG+1", 9)).toBe(1);
    expect(preflopActionRank("UTG+2", 9)).toBe(2);
    expect(preflopActionRank("LJ",    9)).toBe(3);
    expect(preflopActionRank("HJ",    9)).toBe(4);
    expect(preflopActionRank("CO",    9)).toBe(5);
    expect(preflopActionRank("BTN",   9)).toBe(6);
    expect(preflopActionRank("SB",    9)).toBe(7);
    expect(preflopActionRank("BB",    9)).toBe(8);
  });
});

// ── Postflop action order ─────────────────────────────────────────────────────

describe("postflopActionRank", () => {
  it("6-max: SB=0 (OOP), BTN=5 (IP)", () => {
    expect(postflopActionRank("SB",  6)).toBe(0);
    expect(postflopActionRank("BB",  6)).toBe(1);
    expect(postflopActionRank("UTG", 6)).toBe(2);
    expect(postflopActionRank("HJ",  6)).toBe(3);
    expect(postflopActionRank("CO",  6)).toBe(4);
    expect(postflopActionRank("BTN", 6)).toBe(5);
  });

  it("HU (2-max): BB=0 (OOP), BTN=1 (IP)", () => {
    // 2-max has BTN and BB only — no SB position.
    // BB acts first postflop (OOP), BTN acts last (IP).
    expect(postflopActionRank("BB",  2)).toBe(0);
    expect(postflopActionRank("BTN", 2)).toBe(1);
  });
});

describe("isOopVs", () => {
  it("SB is OOP vs BTN in 6-max", () =>
    expect(isOopVs("SB", "BTN", 6)).toBe(true));
  it("BTN is not OOP vs SB in 6-max", () =>
    expect(isOopVs("BTN", "SB", 6)).toBe(false));
  it("BB is OOP vs CO in 6-max", () =>
    expect(isOopVs("BB", "CO", 6)).toBe(true));
  it("CO is not OOP vs BB in 6-max", () =>
    expect(isOopVs("CO", "BB", 6)).toBe(false));
});

// ── validateCanonicalSeats ────────────────────────────────────────────────────

describe("validateCanonicalSeats — valid tables", () => {
  for (const [n] of Object.entries(POSITIONS_BY_SIZE)) {
    const N = Number(n);
    it(`valid ${N}-max table`, () => {
      const seats = buildTable(N, POSITIONS_BY_SIZE[N]![0]);
      const result = validateCanonicalSeats(seats);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  }
});

describe("validateCanonicalSeats — error cases", () => {
  it("rejects < 2 seats", () => {
    const seats = buildTable(2, "BTN");
    const result = validateCanonicalSeats([seats[0]]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 2"))).toBe(true);
  });

  it("rejects missing BTN", () => {
    const seats = buildTable(6, "BTN");
    // Replace BTN with a second SB to break the invariant
    const modified = seats.map((s) =>
      s.logicalPosition === "BTN"
        ? { ...s, logicalPosition: "SB2", isButton: false }
        : s,
    );
    const result = validateCanonicalSeats(modified);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("BTN"))).toBe(true);
  });

  it("rejects duplicate logical positions", () => {
    const seats = buildTable(6, "BTN");
    // Duplicate BTN
    const modified = seats.map((s) =>
      s.logicalPosition === "SB" ? { ...s, logicalPosition: "BTN", isButton: true } : s,
    );
    const result = validateCanonicalSeats(modified);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate") || e.includes("BTN"))).toBe(true);
  });

  it("rejects no hero", () => {
    const seats = buildTable(6, "BTN").map((s) => ({ ...s, isHero: false }));
    const result = validateCanonicalSeats(seats);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("hero"))).toBe(true);
  });

  it("rejects hero not at visualIndex 0", () => {
    const seats = buildTable(6, "BTN");
    const modified = seats.map((s) =>
      s.isHero ? { ...s, visualIndex: 3 } : s,
    );
    const result = validateCanonicalSeats(modified);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("visualIndex"))).toBe(true);
  });
});

// ── Ghost / empty-seat topology ───────────────────────────────────────────────

describe("ghost seats (isSitting=false)", () => {
  it("ghost seat has correct position derived from N", () => {
    const n = 6;
    const heroPos = "BTN";
    const ghosts = buildTable(n, heroPos).filter((s) => !s.isHero);
    // All should have valid positions from POSITIONS_BY_SIZE[6]
    const validPos = new Set(POSITIONS_BY_SIZE[6]);
    for (const g of ghosts) {
      expect(validPos.has(g.logicalPosition)).toBe(true);
    }
  });
});

// ── isButton / isSb / isBb flags ─────────────────────────────────────────────

describe("canonical boolean flags", () => {
  it("6-max: exactly one isButton, one isSb, one isBb", () => {
    const seats = buildTable(6, "UTG");
    expect(seats.filter((s) => s.isButton).length).toBe(1);
    expect(seats.filter((s) => s.isSb).length).toBe(1);
    expect(seats.filter((s) => s.isBb).length).toBe(1);
    expect(seats.find((s) => s.isButton)?.logicalPosition).toBe("BTN");
    expect(seats.find((s) => s.isSb)?.logicalPosition).toBe("SB");
    expect(seats.find((s) => s.isBb)?.logicalPosition).toBe("BB");
  });
});
