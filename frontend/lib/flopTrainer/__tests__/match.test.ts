import { describe, expect, it } from "vitest";
import type { HandEvent, ParsedHand } from "@/lib/handHistory/types";
import { exampleHands } from "@/lib/onboarding/exampleTournament";
import { matchFlop, matchFlopSpot, spotTitle, STACK_TOLERANCE } from "../match";

// A 9-handed table, BB 100, 40bb stacks; seat 1 is the button.
const POS = ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"];
const players = POS.map((position, i) => ({ seat: i + 1, name: position, stack: 4000, isHero: position === "BTN", position }));
const act = (player: string, action: "fold" | "call" | "raise" | "check", amount = 0, toAmount?: number): HandEvent => ({
  kind: "action",
  street: "preflop",
  player,
  action,
  amount,
  ...(toAmount !== undefined ? { toAmount } : {}),
  allIn: false,
});
const posts: HandEvent[] = [
  { kind: "post", street: "preflop", player: "SB", post: "small_blind", amount: 50, allIn: false },
  { kind: "post", street: "preflop", player: "BB", post: "big_blind", amount: 100, allIn: false },
];
const folds = (...names: string[]) => names.map((n) => act(n, "fold"));

function hand(events: HandEvent[], over: Partial<ParsedHand> = {}): ParsedHand {
  return {
    site: "test",
    handId: "1",
    tournamentId: "t",
    tournamentName: "t",
    game: "Hold'em No Limit",
    level: 1,
    smallBlind: 50,
    bigBlind: 100,
    ante: 0,
    playedAt: "2026-10-20T12:00:00",
    tableName: "1",
    maxSeats: 9,
    buttonSeat: 1,
    players,
    heroName: "BTN",
    heroCards: ["Ah", "Kd"],
    events: [...posts, ...events],
    board: { flop: ["Qs", "7d", "2c"], turn: null, river: null },
    shown: {},
    winners: [],
    totalPot: 0,
    rake: 0,
    warnings: [],
    ...over,
  };
}

const btnOpen = [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "call", 130)];

const stacks = (bb: number) => players.map((p) => ({ ...p, stack: bb * 100 }));
const reason = (r: ReturnType<typeof matchFlop>) => (r.ok ? r.match.spotId : r.reason);

describe("matchFlop — single-raised pots", () => {
  it("BTN open, BB call, heads-up at 40bb: the book's own spot", () => {
    const m = matchFlopSpot(hand(btnOpen));
    expect(m).toMatchObject({ spotId: "srp_bb_vs_bn_40", openerPosition: "BN", heroSide: "ip", heroIsPfr: true, heroHand: "AKo", effBb: 40 });
    expect(m?.flop).toMatch(/^Q.7.2.$/);
    expect(spotTitle(m!.spot)).toBe("SRP · BTN vs BB · 40bb");
  });

  it("UTG open with Hero in the big blind: OOP caller", () => {
    const m = matchFlopSpot(hand([act("UTG", "raise", 230, 230), ...folds("UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB"), act("BB", "call", 130)], { heroName: "BB" }));
    expect(m).toMatchObject({ spotId: "srp_bb_vs_utg_40", heroSide: "oop", heroIsPfr: false });
  });

  it("CO open, BB call: a spot derived from the preflop charts", () => {
    const m = matchFlopSpot(hand([...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ"), act("CO", "raise", 230, 230), act("BTN", "fold"), act("SB", "fold"), act("BB", "call", 130)], { heroName: "CO" }));
    expect(m).toMatchObject({ spotId: "srp_bb_vs_co_40", heroSide: "ip", heroIsPfr: true });
    expect(m!.spot.derived).toBe(true);
  });

  it("SB open, BB call: the BB is in position", () => {
    const m = matchFlopSpot(hand([...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"), act("SB", "raise", 300, 350), act("BB", "call", 250)], { heroName: "SB" }));
    expect(m).toMatchObject({ spotId: "srp_bb_vs_sb_40", heroSide: "oop", heroIsPfr: true });
    expect(m!.spot).toMatchObject({ ip: "BB", oop: "SB" });
  });

  it("CO open, BTN calls, blinds fold: cold call, Hero the OOP raiser", () => {
    const m = matchFlopSpot(hand([...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ"), act("CO", "raise", 230, 230), act("BTN", "call", 230), act("SB", "fold"), act("BB", "fold")], { heroName: "CO" }));
    expect(m).toMatchObject({ spotId: "cc_co_vs_bn_40", heroSide: "oop", heroIsPfr: true });
  });

  it("has no hero side when Hero folded", () => {
    expect(matchFlopSpot(hand(btnOpen, { heroName: "CO" }))?.heroSide).toBeNull();
  });
});

describe("matchFlop — 3-bet pots", () => {
  const bbThreeBets = [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "raise", 700, 800), act("BTN", "call", 570)];
  it("BTN opens, BB 3-bets, BTN calls: Hero BTN is the IP caller", () => {
    const m = matchFlopSpot(hand(bbThreeBets));
    expect(m).toMatchObject({ spotId: "3bp_bb_vs_bn_40", heroSide: "ip", heroIsPfr: false });
    expect(spotTitle(m!.spot)).toBe("3-bet pot · BTN vs BB · 40bb");
  });
  it("…and Hero BB is the OOP 3-bettor", () => {
    expect(matchFlopSpot(hand(bbThreeBets, { heroName: "BB" }))).toMatchObject({ heroSide: "oop", heroIsPfr: true });
  });
  it("3-bet pots exist only at 40bb: 25bb is too short", () => {
    expect(reason(matchFlop(hand(bbThreeBets, { players: stacks(25) })))).toBe("stack_too_short");
  });
  it("a 4-bet pot is not a book spot", () => {
    const fourBet = [...bbThreeBets.slice(0, -1), act("BTN", "raise", 1200, 2000), act("BB", "call", 1200)];
    expect(reason(matchFlop(hand(fourBet)))).toBe("four_bet");
  });
});

describe("matchFlop — stack buckets (±30%)", () => {
  it("the tolerance is 30%", () => expect(STACK_TOLERANCE).toBe(0.3));
  it("edges on the 40bb-only 3-bet pot: 28–52bb match, outside doesn't", () => {
    const three = [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "raise", 700, 800), act("BTN", "call", 570)];
    expect(reason(matchFlop(hand(three, { players: stacks(52) })))).toBe("3bp_bb_vs_bn_40");
    expect(reason(matchFlop(hand(three, { players: stacks(28) })))).toBe("3bp_bb_vs_bn_40");
    expect(reason(matchFlop(hand(three, { players: stacks(53) })))).toBe("stack_too_deep");
    expect(reason(matchFlop(hand(three, { players: stacks(27) })))).toBe("stack_too_short");
  });
  it.each([
    [48, "srp_bb_vs_bn_40"],
    [53, "srp_bb_vs_bn_60"], // closer to 60 (7) than 40 (13)
    [11, "srp_bb_vs_bn_15"],
    [10, "stack_too_short"], // nearest 15, 5 > 4.5
    [80, "stack_too_deep"], // nearest 60, 20 > 18
    [25, "srp_bb_vs_bn_25"],
  ])("%sbb → %s", (bb, want) => {
    expect(reason(matchFlop(hand(btnOpen, { players: stacks(bb as number) })))).toBe(want);
  });
});

describe("matchFlop — no match, with a reason", () => {
  it.each([
    ["a limp before the open", [act("UTG", "call", 100), ...folds("UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "call", 130), act("UTG", "fold")], "limped"],
    ["a limped pot", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"), act("SB", "call", 50), act("BB", "check")], "limped"],
    ["a multiway pot", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "call", 180), act("BB", "call", 130)], "multiway"],
    ["an HJ open (no BB defense chart in the book)", [...folds("UTG", "UTG+1", "UTG+2", "LJ"), act("HJ", "raise", 230, 230), ...folds("CO", "BTN", "SB"), act("BB", "call", 130)], "no_book_range"],
    ["an oversized open", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 500, 500), act("SB", "fold"), act("BB", "call", 400)], "no_book_range"],
  ])("%s", (_, events, want) => {
    expect(reason(matchFlop(hand(events as HandEvent[])))).toBe(want);
    expect(matchFlopSpot(hand(events as HandEvent[]))).toBeNull();
  });

  it("an all-in preflop", () => {
    const shove = [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), { ...act("BTN", "raise", 4000, 4000), allIn: true } as HandEvent, act("SB", "fold"), act("BB", "call", 3900)];
    expect(reason(matchFlop(hand(shove)))).toBe("allin_preflop");
  });

  it("8-handed: the UTG seat plays the 9-max UTG+1 range, which has no BB defense chart", () => {
    const eight = players.filter((p) => p.position !== "UTG+2");
    const h = hand([act("UTG", "raise", 230, 230), ...folds("UTG+1", "LJ", "HJ", "CO", "BTN", "SB"), act("BB", "call", 130)], { players: eight, maxSeats: 8 });
    expect(reason(matchFlop(h))).toBe("no_book_range");
  });

  it("no flop / cash", () => {
    expect(reason(matchFlop(hand(btnOpen, { board: { flop: [], turn: null, river: null } })))).toBe("no_flop");
    expect(reason(matchFlop({ ...hand(btnOpen), format: "cash" } as ParsedHand))).toBe("cash");
  });

  it("runs over the example tournament without throwing", () => {
    for (const h of exampleHands()) expect(() => matchFlop(h.hand)).not.toThrow();
  });
});
