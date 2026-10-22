import { describe, expect, it } from "vitest";
import { matchFlop, matchFlopSpot } from "@/lib/flopTrainer/match";
import { flopColumns } from "../flopCheckApi";
import { flopLine, flopLineLabel, gradeFlop, sizeClass, type FlopRowLite, type HandPositionLite } from "../flopCheck";
import type { HandEvent, ParsedHand } from "../types";

// 9-handed, BB 100, 40bb; seat 1 is the button. BTN opens 2.3x, BB calls → pot 4.75bb… (no antes here: 510).
const POS = ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"];
const players = POS.map((position, i) => ({ seat: i + 1, name: position, stack: 4000, isHero: false, position }));
const act = (player: string, action: "fold" | "call" | "raise" | "check" | "bet", amount = 0, street: "preflop" | "flop" = "preflop", toAmount?: number): HandEvent => ({
  kind: "action",
  street,
  player,
  action,
  amount,
  ...(toAmount !== undefined ? { toAmount } : {}),
  allIn: false,
});
const pre: HandEvent[] = [
  { kind: "post", street: "preflop", player: "SB", post: "small_blind", amount: 50, allIn: false },
  { kind: "post", street: "preflop", player: "BB", post: "big_blind", amount: 100, allIn: false },
  ...["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"].map((n) => act(n, "fold")),
  act("BTN", "raise", 230, "preflop", 230),
  act("SB", "fold"),
  act("BB", "call", 130),
  { kind: "deal", street: "flop", cards: ["Qs", "7d", "2c"] },
];
// Pot at the flop: 50 + 230 + 230 = 510.

function hand(flop: HandEvent[], hero: "BTN" | "BB"): ParsedHand {
  return {
    site: "test", handId: "1", tournamentId: "t", tournamentName: "t", game: "Hold'em No Limit", level: 1,
    smallBlind: 50, bigBlind: 100, ante: 0, playedAt: "2026-10-20T12:00:00", tableName: "1", maxSeats: 9, buttonSeat: 1,
    players: players.map((p) => ({ ...p, isHero: p.name === hero })), heroName: hero, heroCards: ["Ah", "Kd"],
    events: [...pre, ...flop], board: { flop: ["Qs", "7d", "2c"], turn: null, river: null },
    shown: {}, winners: [], totalPot: 0, rake: 0, warnings: [],
  };
}

/** A board where IP's range dominates (close to the book's high-frequency, big-size profile). */
const IP_BOARD: FlopRowLite = {
  equity_ip: 62,
  equity_oop: 38,
  buckets_ip: { strong: 37, good: 38, weak: 22, trash: 3 },
  buckets_oop: { strong: 4, good: 19, weak: 23, trash: 54 },
  nut_adv: { ip: 37, oop: 4, diff: 33, leader: "IP" },
  texture: ["rainbow", "rank:Q", "straights:0"],
};
/** A board that suits the caller (close to the low-frequency, small-size profile). */
const OOP_BOARD: FlopRowLite = {
  equity_ip: 52,
  equity_oop: 48,
  buckets_ip: { strong: 14, good: 47, weak: 34, trash: 5 },
  buckets_oop: { strong: 9, good: 27, weak: 22, trash: 42 },
  nut_adv: { ip: 14, oop: 9, diff: 5, leader: "IP" },
  texture: ["two-tone", "rank:9", "straights:2"],
};
const pos = (bucket: HandPositionLite["bucket"], equity: number, top = 30): HandPositionLite => ({ in_range: true, bucket, equity, top_pct: top });
const names = { ip: "BTN", oop: "BB" };

function check(flop: HandEvent[], hero: "BTN" | "BB", row: FlopRowLite | null, hp: HandPositionLite | null) {
  const h = hand(flop, hero);
  const m = matchFlopSpot(h)!;
  return gradeFlop({ match: m, line: flopLine(h, m), row, hand: hp, names });
}

describe("flop line", () => {
  it("bet sizes are a share of the pot; small ≤ 40%, big ≥ 60%", () => {
    expect([sizeClass(33), sizeClass(40), sizeClass(50), sizeClass(60), sizeClass(75)]).toEqual(["small", "small", "medium", "big", "big"]);
    const h = hand([act("BB", "check", 0, "flop"), act("BTN", "bet", 383, "flop")], "BTN");
    const l = flopLine(h, matchFlopSpot(h)!);
    expect(l).toMatchObject({ kind: "cbet", betPct: 75, size: "big" });
    expect(flopLineLabel(l)).toBe("c-bet 75% pot");
  });
  it("check-back, check-raise, call / fold vs a c-bet, lead", () => {
    const line = (flop: HandEvent[], hero: "BTN" | "BB") => {
      const h = hand(flop, hero);
      return flopLine(h, matchFlopSpot(h)!);
    };
    expect(line([act("BB", "check", 0, "flop"), act("BTN", "check", 0, "flop")], "BTN").kind).toBe("check");
    expect(line([act("BB", "check", 0, "flop"), act("BTN", "bet", 170, "flop"), act("BB", "raise", 500, "flop", 500)], "BB")).toMatchObject({ kind: "check_raise", facing: { pct: 33, byPfr: true } });
    const call = line([act("BB", "check", 0, "flop"), act("BTN", "bet", 170, "flop"), act("BB", "call", 170, "flop")], "BB");
    expect(call.kind).toBe("call");
    expect(call.facing!.required).toBeCloseTo(170 / (510 + 170 + 170), 3);
    expect(line([act("BB", "check", 0, "flop"), act("BTN", "bet", 383, "flop"), act("BB", "fold", 0, "flop")], "BB").kind).toBe("fold");
    expect(line([act("BB", "bet", 170, "flop")], "BB").kind).toBe("lead");
  });
});

describe("flop check — IP c-bets (book c-bet profiles, p.677–681)", () => {
  const cbetBig = [act("BB", "check", 0, "flop"), act("BTN", "bet", 383, "flop")];
  const cbetSmall = [act("BB", "check", 0, "flop"), act("BTN", "bet", 170, "flop")];
  const checkBack = [act("BB", "check", 0, "flop"), act("BTN", "check", 0, "flop")];

  it("high-frequency board: a c-bet of the preferred size is good", () => {
    const c = check(cbetBig, "BTN", IP_BOARD, pos("good", 60));
    expect(c.advice).toMatchObject({ band: "high", size: "big", source: "profile" });
    expect(c.verdict).toBe("good");
  });
  it("…the other size is ok, never wrong", () => {
    expect(check(cbetSmall, "BTN", IP_BOARD, pos("good", 60)).verdict).toBe("ok");
  });
  it("…checking back a Strong hand there is ok, with a remark", () => {
    const c = check(checkBack, "BTN", IP_BOARD, pos("strong", 85, 5));
    expect(c.verdict).toBe("ok");
    expect(c.explain).toMatch(/blocks/);
  });
  it("board that suits the caller: betting a Good hand is questionable (p.680)", () => {
    const c = check(cbetSmall, "BTN", OOP_BOARD, pos("good", 58, 40));
    expect(c.advice?.band).toBe("low");
    expect(c.verdict).toBe("questionable");
  });
  it("…checking it back is good", () => {
    expect(check(checkBack, "BTN", OOP_BOARD, pos("good", 58, 40)).verdict).toBe("good");
  });
  it("…a Strong hand bet with the preferred size is good", () => {
    expect(check(cbetSmall, "BTN", OOP_BOARD, pos("strong", 82, 8)).verdict).toBe("good");
  });
});

describe("flop check — facing a bet (equity vs pot odds, p.727)", () => {
  const vsBet = (size: number, reply: HandEvent) => [act("BB", "check", 0, "flop"), act("BTN", "bet", size, "flop"), reply];
  it("folding Trash is good; calling it below the price is questionable", () => {
    expect(check(vsBet(383, act("BB", "fold", 0, "flop")), "BB", IP_BOARD, pos("trash", 18, 80)).verdict).toBe("good");
    expect(check(vsBet(383, act("BB", "call", 383, "flop")), "BB", IP_BOARD, pos("trash", 18, 80)).verdict).toBe("questionable");
  });
  it("folding a Strong hand is questionable", () => {
    expect(check(vsBet(383, act("BB", "fold", 0, "flop")), "BB", IP_BOARD, pos("strong", 80, 3)).verdict).toBe("questionable");
  });
  it("folding a Good hand: questionable vs a small bet, ok vs a big one", () => {
    expect(check(vsBet(170, act("BB", "fold", 0, "flop")), "BB", IP_BOARD, pos("good", 55)).verdict).toBe("questionable");
    expect(check(vsBet(383, act("BB", "fold", 0, "flop")), "BB", IP_BOARD, pos("good", 55)).verdict).toBe("ok");
  });
  it("check-raising a Strong hand is good", () => {
    expect(check(vsBet(170, act("BB", "raise", 600, "flop", 600)), "BB", IP_BOARD, pos("strong", 88, 2)).verdict).toBe("good");
  });
});

describe("flop check — not evaluated", () => {
  it("no precomputed data for the spot", () => {
    expect(check([act("BB", "check", 0, "flop"), act("BTN", "check", 0, "flop")], "BTN", null, null)).toMatchObject({ verdict: "not_evaluated", reason: "not_analysed" });
  });
  it("leads", () => {
    expect(check([act("BB", "bet", 170, "flop")], "BB", IP_BOARD, pos("good", 55))).toMatchObject({ verdict: "not_evaluated", reason: "lead" });
  });
  it("facing a bet without Hero's hand data (signed out)", () => {
    expect(check([act("BB", "check", 0, "flop"), act("BTN", "bet", 170, "flop"), act("BB", "call", 170, "flop")], "BB", IP_BOARD, null).reason).toBe("no_hand_data");
  });
});

// ── Blind vs blind: the SB opens 3.5x and is out of position as the raiser ──
const bvbPre: HandEvent[] = [
  { kind: "post", street: "preflop", player: "SB", post: "small_blind", amount: 50, allIn: false },
  { kind: "post", street: "preflop", player: "BB", post: "big_blind", amount: 100, allIn: false },
  ...["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"].map((n) => act(n, "fold")),
  act("SB", "raise", 300, "preflop", 350),
  act("BB", "call", 250),
  { kind: "deal", street: "flop", cards: ["Qs", "7d", "2c"] },
];
// Pot at the flop: 350 + 350 = 700.

function bvbHand(flop: HandEvent[], hero: "SB" | "BB"): ParsedHand {
  const h = hand([], "BTN");
  return { ...h, players: players.map((p) => ({ ...p, isHero: p.name === hero })), heroName: hero, events: [...bvbPre, ...flop] };
}
const bvbNames = { ip: "BB", oop: "SB" };
function checkBvb(flop: HandEvent[], row: FlopRowLite | null, hp: HandPositionLite | null) {
  const h = bvbHand(flop, "SB");
  const m = matchFlopSpot(h)!;
  return { m, g: gradeFlop({ match: m, line: flopLine(h, m), row, hand: hp, names: bvbNames }) };
}

describe("flop check — OOP raiser (blind vs blind)", () => {
  it("matches the SB as the out-of-position raiser", () => {
    const { m } = checkBvb([act("SB", "check", 0, "flop")], OOP_BOARD, pos("good", 55));
    expect(m.heroSide).toBe("oop");
    expect(m.heroIsPfr).toBe(true);
  });

  it("c-betting a Good hand out of position is good", () => {
    const { g } = checkBvb([act("SB", "bet", 400, "flop")], OOP_BOARD, pos("good", 62));
    expect(g.verdict).toBe("good");
    expect(g.explain).toContain("c-bets often and bigger");
    expect(g.explain).not.toMatch(/p\.\d+|book/i);
  });

  it("c-betting a Weak hand out of position is ok, not wrong", () => {
    expect(checkBvb([act("SB", "bet", 400, "flop")], OOP_BOARD, pos("weak", 38)).g.verdict).toBe("ok");
  });

  it("checking a Good hand is good; checking a Strong hand is only ok", () => {
    expect(checkBvb([act("SB", "check", 0, "flop")], OOP_BOARD, pos("good", 60)).g.verdict).toBe("good");
    expect(checkBvb([act("SB", "check", 0, "flop")], OOP_BOARD, pos("strong", 85)).g.verdict).toBe("ok");
  });

  it("without Hero's hand data it isn't graded", () => {
    const { g } = checkBvb([act("SB", "bet", 400, "flop")], OOP_BOARD, null);
    expect(g.verdict).toBe("not_evaluated");
    expect(g.reason).toBe("no_hand_data");
  });
});

describe("flop check — multiway pots", () => {
  it("are not a flop spot: no verdict, the reason is stored", () => {
    const multi: HandEvent[] = [
      { kind: "post", street: "preflop", player: "SB", post: "small_blind", amount: 50, allIn: false },
      { kind: "post", street: "preflop", player: "BB", post: "big_blind", amount: 100, allIn: false },
      ...["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"].map((n) => act(n, "fold")),
      act("BTN", "raise", 230, "preflop", 230),
      act("SB", "call", 180),
      act("BB", "call", 130),
      { kind: "deal", street: "flop", cards: ["Qs", "7d", "2c"] },
    ];
    const h = { ...hand([], "BTN"), events: multi };
    const r = matchFlop(h);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("multiway");
    expect(flopColumns({ match: r, row: null, hand: null, check: null })).toMatchObject({
      flop_check: null,
      flop_detail: { reason: "multiway" },
    });
  });
});

describe("flop check — explanation text", () => {
  it("mentions Hero's hand once when a c-bet is questionable", () => {
    const g = check([act("BB", "check", 0, "flop"), act("BTN", "bet", 360, "flop")], "BTN", OOP_BOARD, pos("good", 59, 31));
    expect(g.verdict).toBe("questionable");
    expect(g.explain.match(/Your hand is Good/g)).toHaveLength(1);
  });
});
