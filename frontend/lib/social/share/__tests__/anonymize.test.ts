import { describe, expect, it } from "vitest";
import { parseGGHand } from "@/lib/handHistory/parsers/ggpoker";
import { SIDE_POT_HAND, TOP_HAND } from "@/lib/handHistory/__tests__/reconstructed";
import type { ParsedHand } from "@/lib/handHistory/types";
import { anonymizeHand, anonymousNames, decisionPoints, defaultDecision } from "../anonymize";

function parse(raw: string): ParsedHand {
  const r = parseGGHand(raw);
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

/** Hero renamed to a screen name, as on PokerStars. */
function withHeroName(hand: ParsedHand, name: string): ParsedHand {
  return JSON.parse(JSON.stringify(hand).replaceAll('"Hero"', JSON.stringify(name))) as ParsedHand;
}

describe("anonymizeHand", () => {
  for (const [label, raw] of [["top hand", TOP_HAND], ["side pot hand", SIDE_POT_HAND]] as const) {
    it(`${label}: no screen name, hand id, table or tournament survives`, () => {
      const hand = withHeroName(parse(raw), "dankedd_real");
      const anon = anonymizeHand(hand);
      const json = JSON.stringify(anon);
      for (const p of hand.players) expect(json).not.toContain(p.name);
      expect(json).not.toContain(hand.handId);
      expect(json).not.toContain(hand.tableName);
      expect(anon.tournamentId).toBeUndefined();
      expect(anon.tournamentName).toBeUndefined();
      expect(anon.playedAt).toBe(hand.playedAt.slice(0, 10));
    });

    it(`${label}: every name is a position or Hero, and the hand still adds up`, () => {
      const hand = parse(raw);
      const anon = anonymizeHand(hand);
      const names = anon.players.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
      for (const n of names) expect(n).toMatch(/^(Hero|BTN|SB|BB|UTG(\+[123])?|LJ|HJ|CO|S\d{1,2})$/);
      expect(anon.heroName).toBe("Hero");
      expect(anon.players.filter((p) => p.isHero).map((p) => p.name)).toEqual(["Hero"]);
      for (const e of anon.events) if ("player" in e) expect(names).toContain(e.player);
      for (const w of anon.winners) expect(names).toContain(w.player);
      for (const k of Object.keys(anon.shown)) expect(names).toContain(k);
      // Same actions and amounts, only names differ.
      expect(anon.events.map((e) => [e.kind, "amount" in e ? e.amount : null])).toEqual(hand.events.map((e) => [e.kind, "amount" in e ? e.amount : null]));
    });
  }

  it("falls back to the seat when two players would share a label", () => {
    const hand = parse(TOP_HAND);
    hand.players[0].position = hand.players[1].position;
    const names = [...anonymousNames(hand).values()];
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => /^S\d+$/.test(n))).toBe(true);
  });
});

describe("decisionPoints", () => {
  it("finds Hero's voluntary actions with the choices Hero had", () => {
    const hand = anonymizeHand(parse(TOP_HAND));
    const points = decisionPoints(hand);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      const e = hand.events[p.eventIndex];
      expect(e.kind).toBe("action");
      expect("player" in e && e.player).toBe("Hero");
      expect(p.options).toContain(p.actual);
      if (p.toCall > 0) expect(p.options.slice(0, 2)).toEqual(["fold", "call"]);
      else expect(p.options[0]).toBe("check");
    }
    expect(defaultDecision(points)).toBe(points[points.length - 1]);
  });

  it("offers check/bet with nothing to call after the flop, fold/call/raise facing a bet", () => {
    const hand = {
      heroName: "Hero",
      players: [
        { seat: 1, name: "Hero", stack: 5000, isHero: true, position: "BTN" },
        { seat: 2, name: "BB", stack: 5000, isHero: false, position: "BB" },
      ],
      events: [
        { kind: "post", street: "preflop", player: "Hero", post: "small_blind", amount: 100, allIn: false },
        { kind: "post", street: "preflop", player: "BB", post: "big_blind", amount: 200, allIn: false },
        { kind: "action", street: "preflop", player: "Hero", action: "raise", amount: 400, toAmount: 500, allIn: false },
        { kind: "action", street: "preflop", player: "BB", action: "call", amount: 300, allIn: false },
        { kind: "deal", street: "flop", cards: ["Kh", "7c", "2d"] },
        { kind: "action", street: "flop", player: "BB", action: "check", amount: 0, allIn: false },
        { kind: "action", street: "flop", player: "Hero", action: "bet", amount: 300, allIn: false },
        { kind: "action", street: "flop", player: "BB", action: "raise", amount: 900, toAmount: 900, allIn: false },
        { kind: "action", street: "flop", player: "Hero", action: "call", amount: 600, allIn: false },
      ],
    } as unknown as ParsedHand;
    const points = decisionPoints(hand);
    expect(points.map((p) => [p.eventIndex, p.options.join("/"), p.actual])).toEqual([
      [2, "fold/call/raise", "raise"],
      [6, "check/bet", "bet"],
      [8, "fold/call/raise", "call"],
    ]);
    expect(points[2].toCall).toBe(600);
    expect(points[2].pot).toBe(1000 + 300 + 900);
  });
});
