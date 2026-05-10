// ── Clockwise seat positions indexed from BTN (0 = BTN/dealer) ─────────────
export const POSITIONS_BY_SIZE: Record<number, string[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "UTG"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "LJ", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"],
};

// ── Oval table seat coordinates for N players ───────────────────────────────
// Seat 0 = hero (bottom-center), seats increase clockwise.
// Values are percentages / transforms for absolute positioning.
export const SEAT_COORDS: Record<
  number,
  ReadonlyArray<{ x: string; y: string; tx: string; ty: string }>
> = {
  2: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom  (hero)
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 1 top
  ],
  3: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom  (hero)
    { x: "83%", y: "20%", tx: "-50%", ty: "0%"    }, // 1 top-right
    { x: "17%", y: "20%", tx: "-50%", ty: "0%"    }, // 2 top-left
  ],
  4: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom
    { x: "92%", y: "50%", tx: "-50%", ty: "-50%"  }, // 1 right
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 2 top
    { x: "8%",  y: "50%", tx: "-50%", ty: "-50%"  }, // 3 left
  ],
  5: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom
    { x: "88%", y: "70%", tx: "-50%", ty: "-100%" }, // 1 bottom-right
    { x: "87%", y: "18%", tx: "-50%", ty: "0%"    }, // 2 top-right
    { x: "13%", y: "18%", tx: "-50%", ty: "0%"    }, // 3 top-left
    { x: "12%", y: "70%", tx: "-50%", ty: "-100%" }, // 4 bottom-left
  ],
  6: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom  (hero)
    { x: "84%", y: "76%", tx: "-50%", ty: "-100%" }, // 1 bottom-right
    { x: "92%", y: "36%", tx: "-50%", ty: "-50%"  }, // 2 right
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 3 top
    { x: "8%",  y: "36%", tx: "-50%", ty: "-50%"  }, // 4 left
    { x: "16%", y: "76%", tx: "-50%", ty: "-100%" }, // 5 bottom-left
  ],
  7: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom
    { x: "79%", y: "82%", tx: "-50%", ty: "-100%" }, // 1 bottom-right
    { x: "94%", y: "53%", tx: "-50%", ty: "-100%" }, // 2 right
    { x: "80%", y: "11%", tx: "-50%", ty: "0%"    }, // 3 top-right
    { x: "20%", y: "11%", tx: "-50%", ty: "0%"    }, // 4 top-left
    { x: "6%",  y: "53%", tx: "-50%", ty: "-50%"  }, // 5 left
    { x: "21%", y: "82%", tx: "-50%", ty: "-100%" }, // 6 bottom-left
  ],
  8: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom
    { x: "76%", y: "84%", tx: "-50%", ty: "-100%" }, // 1 bottom-right
    { x: "93%", y: "59%", tx: "-50%", ty: "-100%" }, // 2 right-low
    { x: "93%", y: "28%", tx: "-50%", ty: "0%"    }, // 3 right-high
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 4 top
    { x: "7%",  y: "28%", tx: "-50%", ty: "0%"    }, // 5 left-high
    { x: "7%",  y: "59%", tx: "-50%", ty: "-50%"  }, // 6 left-low
    { x: "24%", y: "84%", tx: "-50%", ty: "-100%" }, // 7 bottom-left
  ],
  9: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 bottom
    { x: "74%", y: "85%", tx: "-50%", ty: "-100%" }, // 1 bottom-right
    { x: "91%", y: "64%", tx: "-50%", ty: "-100%" }, // 2 right-low
    { x: "94%", y: "36%", tx: "-50%", ty: "-50%"  }, // 3 right-mid
    { x: "78%", y: "9%",  tx: "-50%", ty: "0%"    }, // 4 top-right
    { x: "50%", y: "5%",  tx: "-50%", ty: "0%"    }, // 5 top
    { x: "22%", y: "9%",  tx: "-50%", ty: "0%"    }, // 6 top-left
    { x: "6%",  y: "36%", tx: "-50%", ty: "-50%"  }, // 7 left-mid
    { x: "26%", y: "85%", tx: "-50%", ty: "-100%" }, // 8 bottom-left
  ],
};

// ── Position name normalization ─────────────────────────────────────────────
const ALIASES: Record<string, string> = {
  LOJACK: "LJ",   "LO JACK": "LJ",
  HIJACK: "HJ",   "HI JACK": "HJ",
  CUTOFF: "CO",   "CUT OFF": "CO",
  BUTTON: "BTN",  DEALER: "BTN",  D: "BTN",
  "SMALL BLIND": "SB", SMALLBLIND: "SB",
  "BIG BLIND":   "BB", BIGBLIND:   "BB",
  UTG1: "UTG+1", "UTG 1": "UTG+1",
  UTG2: "UTG+2", "UTG 2": "UTG+2",
};

export function normalizePosition(pos: string): string {
  const upper = pos.toUpperCase().trim();
  return ALIASES[upper] ?? upper;
}

// Clockwise index (0 = BTN) from a position label at a given table size
export function clockwiseIndexOf(pos: string, N: number): number {
  const positions = POSITIONS_BY_SIZE[N] ?? POSITIONS_BY_SIZE[6];
  const idx = positions.indexOf(normalizePosition(pos));
  return idx >= 0 ? idx : 0;
}

// Preflop action order index → clockwise seat index.
// For N >= 3: UTG (preflop idx 0) sits at clockwise idx 3 for 6max,
// so clockwise = (preflopIdx + 3) % N works universally for N >= 3.
// For N = 2 (HU): SB/BTN acts first preflop → same seat order.
export function preflopToClockwise(preflopIdx: number, N: number): number {
  if (N <= 2) return preflopIdx;
  return (preflopIdx + 3) % N;
}
