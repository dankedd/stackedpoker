import type { ReplayAnalysis } from "@/lib/types";
import {
  POSITIONS_BY_SIZE,
  normalizePosition,
  clockwiseIndexOf,
  preflopToClockwise,
} from "./positions";

export interface SeatDescriptor {
  seatIndex: number;         // 0 = hero (bottom), clockwise
  playerName: string | null; // null = empty seat (no one sat here)
  position: string;          // "BTN", "SB", "BB", "UTG", …
  isHero: boolean;
  isSitting: boolean;        // false → ghost seat (position exists but no player)
  cards: string[];           // known face-up cards; empty → show card backs
  cardsKnown: boolean;       // true → render face-up PlayingCard
  foldedAtStep: number | null; // the step index at which this player folded
}

export function buildSeatMap(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary, actions } = analysis;

  // ── 1. Collect unique players in preflop first-appearance order ──────────
  // Preflop action order reliably reflects position order for seat assignment.
  const preflopActions = actions.filter((a) => a.street === "preflop");
  const source = preflopActions.length > 0 ? preflopActions : actions;

  const seenNames = new Set<string>();
  const orderedPlayers: Array<{ name: string; isHero: boolean }> = [];
  for (const a of source) {
    if (!seenNames.has(a.player)) {
      seenNames.add(a.player);
      orderedPlayers.push({ name: a.player, isHero: !!a.is_hero });
    }
  }
  // Include any player who only appears postflop (edge case)
  for (const a of actions) {
    if (!seenNames.has(a.player)) {
      seenNames.add(a.player);
      orderedPlayers.push({ name: a.player, isHero: !!a.is_hero });
    }
  }

  const N = Math.min(Math.max(orderedPlayers.length, 2), 9);
  const positions = POSITIONS_BY_SIZE[N] ?? POSITIONS_BY_SIZE[6];

  // ── 2. Find hero ─────────────────────────────────────────────────────────
  const heroEntry = orderedPlayers.find((p) => p.isHero);
  const heroName =
    heroEntry?.name ?? actions.find((a) => a.is_hero)?.player ?? "Hero";
  const heroOrderIdx = orderedPlayers.findIndex((p) => p.isHero);

  // ── 3. Anchor calibration: hero's known position ──────────────────────────
  const heroKnownPos = normalizePosition(hand_summary.hero_position);
  const heroKnownCW = clockwiseIndexOf(heroKnownPos, N);

  // Raw clockwise of hero according to preflop order
  const heroRawCW =
    heroOrderIdx >= 0 ? preflopToClockwise(heroOrderIdx, N) : heroKnownCW;
  // Offset so derived positions align with known hero position
  const calibration = (heroKnownCW - heroRawCW + N) % N;

  // ── 4. Assign clockwise indices to all players ────────────────────────────
  const cwOf = new Map<string, number>();
  for (let i = 0; i < orderedPlayers.length; i++) {
    const raw = preflopToClockwise(i, N);
    cwOf.set(orderedPlayers[i].name, (raw + calibration) % N);
  }

  // ── 5. Determine fold steps ───────────────────────────────────────────────
  const foldedAtStep = new Map<string, number>();
  actions.forEach((a, step) => {
    if (a.action === "fold" && !foldedAtStep.has(a.player)) {
      foldedAtStep.set(a.player, step);
    }
  });

  // ── 6. Resolve main villain's visual seat ────────────────────────────────
  // hand_summary may carry villain position + cards for the primary opponent.
  const villainRawPos = hand_summary.villain_position;
  const villainNormPos = villainRawPos ? normalizePosition(villainRawPos) : null;
  const villainKnownCW =
    villainNormPos ? clockwiseIndexOf(villainNormPos, N) : null;
  const villainVisualSeat =
    villainKnownCW !== null
      ? (villainKnownCW - heroKnownCW + N) % N
      : null;

  // ── 7. Build seat descriptors ─────────────────────────────────────────────
  const seatOf = new Map<number, SeatDescriptor>();

  // Hero is always visual seat 0 (bottom)
  seatOf.set(0, {
    seatIndex: 0,
    playerName: heroName,
    position: heroKnownPos,
    isHero: true,
    isSitting: true,
    cards: hand_summary.hero_cards ?? [],
    cardsKnown: true,
    foldedAtStep: foldedAtStep.get(heroName) ?? null,
  });

  // Non-hero players
  for (const { name, isHero } of orderedPlayers) {
    if (isHero) continue;

    const cw = cwOf.get(name) ?? 1;
    const visualSeat = (cw - heroKnownCW + N) % N;

    // Check if this player is the primary villain with known cards
    const isKnownVillain =
      villainVisualSeat !== null && visualSeat === villainVisualSeat;
    const knownCards = isKnownVillain
      ? (hand_summary.villain_cards ?? [])
      : [];

    if (!seatOf.has(visualSeat)) {
      seatOf.set(visualSeat, {
        seatIndex: visualSeat,
        playerName: name,
        position: positions[cw] ?? "?",
        isHero: false,
        isSitting: true,
        cards: knownCards,
        cardsKnown: knownCards.length > 0,
        foldedAtStep: foldedAtStep.get(name) ?? null,
      });
    }
  }

  // Fill remaining seats as empty ghost positions
  for (let i = 0; i < N; i++) {
    if (!seatOf.has(i)) {
      const cw = (heroKnownCW + i) % N;
      seatOf.set(i, {
        seatIndex: i,
        playerName: null,
        position: positions[cw] ?? "—",
        isHero: false,
        isSitting: false,
        cards: [],
        cardsKnown: false,
        foldedAtStep: null,
      });
    }
  }

  return Array.from({ length: N }, (_, i) => seatOf.get(i)!);
}
