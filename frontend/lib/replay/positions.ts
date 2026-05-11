// ── Clockwise position names indexed from BTN (0 = BTN/dealer) ─────────────
// "Clockwise" here is the poker clockwise: BTN → SB → BB → UTG → …
// In aerial view this is COUNTERCLOCKWISE, i.e. SB sits to the LEFT of BTN.
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

// ── Oval table seat coordinates ─────────────────────────────────────────────
//
// Seat 0 = hero (bottom-center, always).
// Seats then go LEFT first (counterclockwise in the aerial view) which is the
// correct poker direction: BTN(0) → SB(1, bottom-left) → BB(2, left) → …
//
// This matches every major poker client (PokerStars, GGPoker, Offsuit, etc.)
// where the small blind sits immediately to the LEFT of the dealer button.
//
// x / y are % distances from the container top-left corner.
// tx / ty are CSS translate values to anchor the pod to the seat edge.
//
export const SEAT_COORDS: Record<
  number,
  ReadonlyArray<{ x: string; y: string; tx: string; ty: string }>
> = {
  // ── 2-max (HU) ──────────────────────────────────────────────────────────
  2: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 1 BB   top
  ],

  // ── 3-max ────────────────────────────────────────────────────────────────
  3: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "17%", y: "22%", tx: "-50%", ty: "0%"    }, // 1 SB   top-LEFT
    { x: "83%", y: "22%", tx: "-50%", ty: "0%"    }, // 2 BB   top-right
  ],

  // ── 4-max ────────────────────────────────────────────────────────────────
  4: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "8%",  y: "50%", tx: "-50%", ty: "-50%"  }, // 1 SB   LEFT
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 2 BB   top
    { x: "92%", y: "50%", tx: "-50%", ty: "-50%"  }, // 3 UTG  right
  ],

  // ── 5-max ────────────────────────────────────────────────────────────────
  5: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "12%", y: "70%", tx: "-50%", ty: "-100%" }, // 1 SB   bottom-LEFT
    { x: "13%", y: "18%", tx: "-50%", ty: "0%"    }, // 2 BB   top-left
    { x: "87%", y: "18%", tx: "-50%", ty: "0%"    }, // 3 UTG  top-right
    { x: "88%", y: "70%", tx: "-50%", ty: "-100%" }, // 4 CO   bottom-right
  ],

  // ── 6-max ────────────────────────────────────────────────────────────────
  6: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "16%", y: "76%", tx: "-50%", ty: "-100%" }, // 1 SB   bottom-LEFT ← key
    { x: "8%",  y: "36%", tx: "-50%", ty: "-50%"  }, // 2 BB   left
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 3 UTG  top
    { x: "92%", y: "36%", tx: "-50%", ty: "-50%"  }, // 4 HJ   right
    { x: "84%", y: "76%", tx: "-50%", ty: "-100%" }, // 5 CO   bottom-right
  ],

  // ── 7-max ────────────────────────────────────────────────────────────────
  7: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN  bottom
    { x: "21%", y: "82%", tx: "-50%", ty: "-100%" }, // 1 SB   bottom-left
    { x: "6%",  y: "53%", tx: "-50%", ty: "-50%"  }, // 2 BB   left
    { x: "20%", y: "11%", tx: "-50%", ty: "0%"    }, // 3 UTG  top-left
    { x: "80%", y: "11%", tx: "-50%", ty: "0%"    }, // 4 LJ   top-right
    { x: "94%", y: "53%", tx: "-50%", ty: "-50%"  }, // 5 HJ   right
    { x: "79%", y: "82%", tx: "-50%", ty: "-100%" }, // 6 CO   bottom-right
  ],

  // ── 8-max ────────────────────────────────────────────────────────────────
  8: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN     bottom
    { x: "24%", y: "84%", tx: "-50%", ty: "-100%" }, // 1 SB      bottom-left
    { x: "7%",  y: "59%", tx: "-50%", ty: "-50%"  }, // 2 BB      left-low
    { x: "7%",  y: "28%", tx: "-50%", ty: "0%"    }, // 3 UTG     left-high
    { x: "50%", y: "7%",  tx: "-50%", ty: "0%"    }, // 4 UTG+1   top
    { x: "93%", y: "28%", tx: "-50%", ty: "0%"    }, // 5 LJ      right-high
    { x: "93%", y: "59%", tx: "-50%", ty: "-50%"  }, // 6 HJ      right-low
    { x: "76%", y: "84%", tx: "-50%", ty: "-100%" }, // 7 CO      bottom-right
  ],

  // ── 9-max ────────────────────────────────────────────────────────────────
  9: [
    { x: "50%", y: "93%", tx: "-50%", ty: "-100%" }, // 0 BTN     bottom
    { x: "22%", y: "79%", tx: "-50%", ty: "-100%" }, // 1 SB      bottom-left
    { x: "8%",  y: "56%", tx: "-50%", ty: "-50%"  }, // 2 BB      left-low
    { x: "13%", y: "32%", tx: "-50%", ty: "0%"    }, // 3 UTG     left-high
    { x: "35%", y: "14%", tx: "-50%", ty: "0%"    }, // 4 UTG+1   upper-left
    { x: "65%", y: "14%", tx: "-50%", ty: "0%"    }, // 5 UTG+2   upper-right
    { x: "87%", y: "32%", tx: "-50%", ty: "0%"    }, // 6 LJ      right-high
    { x: "92%", y: "56%", tx: "-50%", ty: "-50%"  }, // 7 HJ      right-low
    { x: "78%", y: "79%", tx: "-50%", ty: "-100%" }, // 8 CO      bottom-right
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
// For N >= 3: (preflopIdx + 3) % N works for all standard table sizes.
// For N = 2: same order (SB/BTN acts first).
export function preflopToClockwise(preflopIdx: number, N: number): number {
  if (N <= 2) return preflopIdx;
  return (preflopIdx + 3) % N;
}
