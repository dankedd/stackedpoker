import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveHand } from "@/lib/handHistory/derive";
import { checkPreflop } from "@/lib/handHistory/preflop";
import { potOddsDecisions } from "@/lib/handHistory/potOdds";
import { buildTimeline, totalOnTable } from "@/lib/handHistory/timeline";
import { findVillain, villainRange } from "@/lib/handHistory/villain";
import type { ParsedHand } from "@/lib/handHistory/types";
import { exampleHands } from "@/lib/onboarding/exampleTournament";
import { buildManualHand, computePots, manualTournamentId, resolveShowdown } from "../build";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import {
  foldToHeroSteps,
  HERO,
  legalActions,
  ManualHandError,
  positionsFor,
  replay,
  streetsEntered,
  validateSetup,
  type ManualSetup,
  type ManualStep,
} from "../engine";

const setup = (over: Partial<ManualSetup> = {}): ManualSetup => ({
  format: "tournament",
  playerCount: 8,
  smallBlind: 500,
  bigBlind: 1000,
  ante: 125,
  anteType: "per_player",
  level: 10,
  heroPosition: "UTG",
  heroStack: 25000,
  stacks: {},
  heroCards: ["9s", "4d"],
  tournamentName: "Example Tournament $10",
  playedAt: "2026-10-08T19:13:27",
  buyIn: "",
  live: false,
  venue: "",
  ...over,
});

const act = (player: string, action: Extract<ManualStep, { kind: "action" }>["action"], to?: number): ManualStep => ({ kind: "action", player, action, ...(to != null ? { to } : {}) });
const deal = (street: "flop" | "turn" | "river", ...cards: string[]): ManualStep => ({ kind: "deal", street, cards });
const folds = (...ps: string[]) => ps.map((p) => act(p, "fold"));

/** Chips are conserved at every replayer step and the pot ends empty. */
function expectChipsConserved(hand: ParsedHand) {
  const start = hand.players.reduce((a, p) => a + p.stack, 0);
  const steps = buildTimeline(hand);
  for (const step of steps) {
    const onTable = Object.values(step.stacks).reduce((a, b) => a + b, 0) + totalOnTable(step);
    expect(onTable).toBeCloseTo(start, 6);
  }
  expect(totalOnTable(steps.at(-1)!)).toBeCloseTo(0, 6);
}

// Example tournament hand 4, entered by hand: Hero opens 9♠4♦ UTG, the big
// blind calls down and wins with a pair of jacks.
const HAND4: ManualStep[] = [
  act(HERO, "raise", 2000),
  ...folds("UTG+1", "LJ", "HJ", "CO", "BTN", "SB"),
  act("BB", "call"),
  deal("flop", "9c", "6h", "2s"),
  act("BB", "check"),
  act(HERO, "bet", 2500),
  act("BB", "call"),
  deal("turn", "Jd"),
  act("BB", "check"),
  act(HERO, "bet", 6000),
  act("BB", "call"),
  deal("river", "3c"),
  act("BB", "check"),
  act(HERO, "check"),
];

describe("table and setup", () => {
  it("uses the importers' position names", () => {
    expect(positionsFor(8)).toEqual(["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"]);
    expect(positionsFor(2)).toEqual(["BTN", "BB"]);
    expect(positionsFor(10)).toContain("UTG+3");
  });

  it("explains what is missing", () => {
    expect(validateSetup(setup())).toEqual([]);
    expect(validateSetup(setup({ heroCards: ["As"] }))).toContain("Pick Hero's two cards.");
    expect(validateSetup(setup({ heroCards: ["As", "As"] }))).toContain("Hero's two cards must be different.");
    expect(validateSetup(setup({ heroStack: 0 }))).toContain("Enter Hero's stack.");
    expect(validateSetup(setup({ smallBlind: 2000 }))).toContain("The small blind can't be bigger than the big blind.");
  });
});

describe("a full hand, preflop to river with a showdown", () => {
  const s = setup();
  const state = replay(s, HAND4);

  it("follows the action order and ends at showdown", () => {
    expect(state.finished).toBe(true);
    expect(state.showdown).toBe(true);
    expect(streetsEntered(state)).toBe(4);
  });

  it("needs the opponent's cards or a pick to decide the pot", () => {
    expect(resolveShowdown(s, state, { shown: {}, potWinners: {} }).undecided).toEqual([0]);
    expect(() => buildManualHand(s, state, { shown: {}, potWinners: {} }, "M1")).toThrow(ManualHandError);
    const r = resolveShowdown(s, state, { shown: { BB: ["Jc", "Td"] }, potWinners: {} });
    expect(r.winners).toEqual([["BB"]]); // decided by the cards
  });

  it("builds a hand whose chips add up", () => {
    const hand = buildManualHand(s, state, { shown: { BB: ["Jc", "Td"] }, potWinners: {} }, "M1");
    expect(hand.totalPot).toBe(22500);
    expect(hand.winners).toEqual([{ player: "BB", amount: 22500 }]);
    expect(hand.board).toEqual({ flop: ["9c", "6h", "2s"], turn: "Jd", river: "3c" });
    expect(hand.tournamentId).toBe("example-tournament-10");
    expectChipsConserved(hand);
  });

  it("gives exactly the same analysis as the same hand imported from a file", () => {
    const manual = buildManualHand(s, state, { shown: { BB: ["Jc", "Td"] }, potWinners: {} }, "M1");
    const imported = exampleHands().find((h) => h.hand.heroCards?.join(" ") === "9s 4d")!.hand;

    const pick = (d: ReturnType<typeof deriveHand>) => ({ ...d });
    expect(pick(deriveHand(manual))).toEqual(pick(deriveHand(imported)));

    const pm = checkPreflop(manual)!;
    const pi = checkPreflop(imported)!;
    expect(pm.verdict).toBe("too_loose");
    expect(pm).toEqual(pi);

    const vm = villainRange(manual, findVillain(manual)!)!;
    const vi = villainRange(imported, findVillain(imported)!)!;
    expect({ ...vm, villain: "x" }).toEqual({ ...vi, villain: "x" });

    const strip = (ds: ReturnType<typeof potOddsDecisions>) => ds.map(({ street, toCall, pot, required, stillToAct, action }) => ({ street, toCall, pot, required, stillToAct, action }));
    expect(strip(potOddsDecisions(manual))).toEqual(strip(potOddsDecisions(imported)));
    expect(buildTimeline(manual)).toHaveLength(buildTimeline(imported).length);
  });
});

describe("preflop all-in", () => {
  const s = setup({ playerCount: 9, heroPosition: "BTN", heroStack: 15000, heroCards: ["Ah", "5h"] });
  const steps: ManualStep[] = [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act(HERO, "allin"), act("SB", "fold"), act("BB", "call")];

  it("deals the rest of the board without asking for actions", () => {
    let st = replay(s, steps);
    expect(st.toAct).toBeNull();
    expect(st.needsDeal).toBe("flop");
    st = replay(s, [...steps, deal("flop", "Kd", "7c", "2h")]);
    expect(st.toAct).toBeNull();
    expect(st.needsDeal).toBe("turn");
    st = replay(s, [...steps, deal("flop", "Kd", "7c", "2h"), deal("turn", "5c"), deal("river", "9s")]);
    expect(st.finished).toBe(true);
    expect(st.showdown).toBe(true);
  });

  it("returns the uncalled part, shows the cards before the runout, and adds up", () => {
    const st = replay(s, [...steps, deal("flop", "Kd", "7c", "2h"), deal("turn", "5c"), deal("river", "9s")]);
    const hand = buildManualHand(s, st, { shown: { BB: ["Qs", "Qd"] }, potWinners: {} }, "M2");
    // Hero had 15,000; BB covers: no uncalled bet. Pair of fives loses to queens.
    expect(hand.winners.map((w) => w.player)).toEqual(["BB"]);
    const kinds = hand.events.map((e) => e.kind);
    expect(kinds.indexOf("show")).toBeLessThan(kinds.indexOf("deal"));
    expectChipsConserved(hand);
  });
});

describe("everyone else folds", () => {
  const s = setup({ playerCount: 9, heroPosition: "CO", heroCards: ["Ks", "Qs"] });

  it("skips to Hero's turn", () => {
    const st0 = replay(s, []);
    const skip = foldToHeroSteps(s, st0);
    expect(skip.map((x) => (x.kind === "action" ? x.player : ""))).toEqual(["UTG", "UTG+1", "UTG+2", "LJ", "HJ"]);
    expect(replay(s, skip).toAct).toBe(HERO);
  });

  it("after Hero acts it folds the rest and returns the uncalled raise", () => {
    let steps = foldToHeroSteps(s, replay(s, []));
    steps = [...steps, act(HERO, "raise", 2200)];
    steps = [...steps, ...foldToHeroSteps(s, replay(s, steps))];
    const st = replay(s, steps);
    expect(st.finished).toBe(true);
    expect(st.showdown).toBe(false);
    const hand = buildManualHand(s, st, { shown: {}, potWinners: {} }, "M3");
    const unc = hand.events.find((e) => e.kind === "uncalled");
    expect(unc).toMatchObject({ player: HERO, amount: 1200 });
    expect(hand.winners).toEqual([{ player: HERO, amount: 9 * 125 + 500 + 1000 + 1000 }]);
    expectChipsConserved(hand);
  });
});

describe("undo", () => {
  it("is replaying without the last step", () => {
    const s = setup();
    const before = replay(s, HAND4.slice(0, 8));
    const after = replay(s, HAND4.slice(0, 9));
    expect(after.toAct).not.toBe(before.toAct);
    expect(replay(s, HAND4.slice(0, 9).slice(0, -1))).toEqual(before);
  });
});

describe("validation", () => {
  const s = setup();
  const toFlop = HAND4.slice(0, 8);

  it("blocks a card that is already in use", () => {
    expect(() => replay(s, [...toFlop, deal("flop", "9s", "6h", "2s")])).toThrow(/9s is already in use/);
    expect(() => replay(s, [...toFlop, deal("flop", "6h", "6h", "2s")])).toThrow(/already in use/);
    expect(() => replay(s, [...toFlop, deal("flop", "6h", "2s")])).toThrow(/three cards/);
  });

  it("refuses bets bigger than the stack and raises below the minimum", () => {
    expect(() => replay(s, [act(HERO, "raise", 30000)])).toThrow(/only has 24875/);
    expect(() => replay(s, [act(HERO, "raise", 1500)])).toThrow(/minimum raise is to 2000/);
    expect(() => replay(s, [act(HERO, "bet", 2000)])).toThrow(/raise instead/);
    expect(() => replay(s, [act(HERO, "check")])).toThrow(/can't check/);
  });

  it("refuses acting out of turn and actions after the street ended", () => {
    expect(() => replay(s, [act("BB", "fold")])).toThrow(/It's Hero's turn/);
    expect(() => replay(s, [...toFlop, act("BB", "check")])).toThrow(/Deal the flop first/);
  });

  it("re-raises must be at least the last raise", () => {
    const st = replay(s, [act(HERO, "raise", 2500)]);
    expect(legalActions(st, 1000)!.minTo).toBe(4000);
  });

  it("an all-in smaller than a full raise does not reopen the betting", () => {
    const t3 = setup({ playerCount: 3, heroPosition: "BTN", anteType: "none", ante: 0, stacks: { SB: 2900 } });
    // Hero opens to 2,000; the SB shoves 2,900 (a raise of only 900).
    let st = replay(t3, [act(HERO, "raise", 2000), act("SB", "allin")]);
    expect(st.toAct).toBe("BB");
    expect(legalActions(st, 1000)!.canRaise).toBe(true); // BB has not acted yet
    st = replay(t3, [act(HERO, "raise", 2000), act("SB", "allin"), act("BB", "call")]);
    expect(st.toAct).toBe(HERO);
    const legal = legalActions(st, 1000)!;
    expect(legal.canRaise).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(() => replay(t3, [act(HERO, "raise", 2000), act("SB", "allin"), act("BB", "call"), act(HERO, "raise", 8000)])).toThrow(/not reopened/);
  });

  it("heads-up: the button acts first preflop, the big blind first after the flop", () => {
    const hu = setup({ playerCount: 2, heroPosition: "BTN", anteType: "none", ante: 0 });
    expect(replay(hu, []).toAct).toBe(HERO);
    expect(replay(hu, [act(HERO, "call"), act("BB", "check"), deal("flop", "2c", "3d", "8h")]).toAct).toBe("BB");
  });
});

describe("side pots", () => {
  it("splits the money by what each player could win", () => {
    const s = setup({ playerCount: 3, heroPosition: "BTN", anteType: "none", ante: 0, heroStack: 10000, stacks: { SB: 3000, BB: 6000 }, heroCards: ["Ac", "Ad"] });
    const st = replay(s, [act(HERO, "allin"), act("SB", "allin"), act("BB", "allin"), deal("flop", "2c", "7d", "9h"), deal("turn", "Js"), deal("river", "4c")]);
    const pots = computePots(st);
    expect(pots).toEqual([
      { amount: 9000, eligible: ["SB", "BB", HERO] },
      { amount: 6000, eligible: ["BB", HERO] },
    ]);
    const hand = buildManualHand(s, st, { shown: { SB: ["Kc", "Kd"], BB: ["Qc", "Qd"] }, potWinners: {} }, "M4");
    expect(hand.winners).toEqual([{ player: HERO, amount: 15000 }]);
    // Hero's extra 4,000 nobody could call comes back.
    expect(hand.events.find((e) => e.kind === "uncalled")).toMatchObject({ player: HERO, amount: 4000 });
    expectChipsConserved(hand);
  });

  it("asks per pot when the cards are unknown, and splits a chopped pot", () => {
    const s = setup({ playerCount: 2, heroPosition: "BTN", anteType: "none", ante: 0 });
    const st = replay(s, [act(HERO, "call"), act("BB", "check"), deal("flop", "2c", "3d", "8h"), act("BB", "check"), act(HERO, "check"), deal("turn", "Ts"), act("BB", "check"), act(HERO, "check"), deal("river", "Kc"), act("BB", "check"), act(HERO, "check")]);
    const hand = buildManualHand(s, st, { shown: {}, potWinners: { 0: [HERO, "BB"] } }, "M5");
    expect(hand.winners).toEqual([
      { player: HERO, amount: 1000 },
      { player: "BB", amount: 1000 },
    ]);
  });
});

describe("big blind ante", () => {
  it("is dead money in the main pot: the winner gets the whole pot", () => {
    // The walkthrough hand: BB ante, Hero CO raises, the BB (bigger stack) calls down.
    const s = setup({ playerCount: 9, heroPosition: "CO", anteType: "bb_ante", ante: 1000, heroCards: ["As", "Kh"], stacks: { BB: 40000 } });
    const steps: ManualStep[] = [
      ...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ"),
      act(HERO, "raise", 2500),
      ...folds("BTN", "SB"),
      act("BB", "call"),
      deal("flop", "Kc", "7d", "2s"),
      act("BB", "check"),
      act(HERO, "bet", 4333),
      act("BB", "call"),
      deal("turn", "4h"),
      act("BB", "check"),
      act(HERO, "check"),
      deal("river", "9c"),
      act("BB", "bet", 7583),
      act(HERO, "call"),
    ];
    const st = replay(s, steps);
    expect(computePots(st)).toEqual([{ amount: 30332, eligible: ["BB", HERO] }]);
    const hand = buildManualHand(s, st, { shown: { BB: ["Qc", "Qd"] }, potWinners: {} }, "M7");
    expect(hand.winners).toEqual([{ player: HERO, amount: 30332 }]);
    expect(hand.totalPot).toBe(30332);
    expectChipsConserved(hand);
  });
});

describe("cash hands", () => {
  it("get the replayer data but no tournament range analysis", () => {
    const s = setup({ format: "cash", tournamentName: "", level: null, playerCount: 6, heroPosition: "CO", anteType: "none", ante: 0, heroStack: 100000, heroCards: ["9s", "4d"] });
    const steps: ManualStep[] = [...folds("UTG", "HJ"), act(HERO, "raise", 2500), ...folds("BTN", "SB", "BB")];
    const hand = buildManualHand(s, replay(s, steps), { shown: {}, potWinners: {} }, "M6");
    expect(hand.format).toBe("cash");
    expect(hand.tournamentId).toBeNull();
    expect(checkPreflop(hand)).toBeNull();
    expect(villainRange(hand, "BB")).toBeNull();
    expectChipsConserved(hand);
  });
});

describe("tournament ids", () => {
  it("are stable slugs of the name", () => {
    expect(manualTournamentId("Holland Casino Main Event!")).toBe("holland-casino-main-event");
    expect(manualTournamentId("   ")).toBeNull();
  });
});

describe("drafts", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("come back after a refresh, per user, and are cleared after saving", () => {
    const entry = { setup: setup(), steps: HAND4.slice(0, 5), shown: {}, potWinners: {} };
    saveDraft("u1", { editId: null, phase: "actions", entry, note: "thinking", starred: true });
    const back = loadDraft("u1")!;
    expect(back.entry).toEqual(entry);
    expect(back.note).toBe("thinking");
    expect(replay(back.entry.setup, back.entry.steps).toAct).toBe("BTN");
    expect(loadDraft("u2")).toBeNull();
    clearDraft("u1");
    expect(loadDraft("u1")).toBeNull();
  });

  it("a broken draft is ignored", () => {
    store["sp_manual_hand_draft:u1"] = "{not json";
    expect(loadDraft("u1")).toBeNull();
  });
});
