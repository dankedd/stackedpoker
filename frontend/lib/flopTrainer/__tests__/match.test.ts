import { describe, expect, it } from "vitest";
import type { HandEvent, ParsedHand } from "@/lib/handHistory/types";
import { exampleHands } from "@/lib/onboarding/exampleTournament";
import { matchFlopSpot } from "../match";

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

describe("matchFlopSpot", () => {
  it("matches BTN open, BB call, heads-up at 40bb", () => {
    const m = matchFlopSpot(hand(btnOpen));
    expect(m).toMatchObject({ spotId: "srp_bb_vs_bn_40", openerPosition: "BN", heroSide: "ip", heroHand: "AKo", effBb: 40 });
    expect(m?.flop).toMatch(/^Q.7.2.$/);
  });

  it("matches UTG open with Hero in the big blind", () => {
    const m = matchFlopSpot(
      hand([act("UTG", "raise", 230, 230), ...folds("UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB"), act("BB", "call", 130)], { heroName: "BB" }),
    );
    expect(m).toMatchObject({ spotId: "srp_bb_vs_utg_40", heroSide: "oop" });
  });

  it("has no hero side when Hero folded", () => {
    expect(matchFlopSpot(hand(btnOpen, { heroName: "CO" }))?.heroSide).toBeNull();
  });

  it.each([
    ["a limp before the open", [act("UTG", "call", 100), ...folds("UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "call", 130)]],
    ["a multiway pot", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "call", 180), act("BB", "call", 130)]],
    ["a 3-bet", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 230, 230), act("SB", "fold"), act("BB", "raise", 600, 700), act("BTN", "call", 470)]],
    ["a CO open", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ"), act("CO", "raise", 230, 230), act("BTN", "fold"), act("SB", "fold"), act("BB", "call", 130)]],
    ["an oversized open", [...folds("UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"), act("BTN", "raise", 500, 500), act("SB", "fold"), act("BB", "call", 400)]],
  ])("rejects %s", (_, events) => {
    expect(matchFlopSpot(hand(events as HandEvent[]))).toBeNull();
  });

  it("rejects stacks far from 40bb and hands without a flop", () => {
    expect(matchFlopSpot(hand(btnOpen, { players: players.map((p) => ({ ...p, stack: 10000 })) }))).toBeNull();
    expect(matchFlopSpot(hand(btnOpen, { board: { flop: [], turn: null, river: null } }))).toBeNull();
  });

  it("runs over the example tournament without throwing", () => {
    for (const h of exampleHands()) expect(() => matchFlopSpot(h.hand)).not.toThrow();
  });
});
