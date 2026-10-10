import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveHand } from "../derive";
import { parseTexts, readFiles } from "../importer";
import { parseChips, parseGGHand } from "../parsers/ggpoker";
import { splitHands } from "../split";
import { buildTimeline, describeStep, totalOnTable } from "../timeline";
import { fmtChips } from "../format";
import type { ParsedHand } from "../types";
import { NO_FLOP_HAND, SIDE_POT_HAND, SPLIT_POT_HAND, TOP_HAND } from "./reconstructed";

function parse(text: string): ParsedHand {
  const r = parseGGHand(text);
  if (!r.ok) throw new Error(r.failure.error);
  return r.hand;
}

/** Stacks + bets + pot must equal the starting stacks at every single step. */
function expectChipsConserved(hand: ParsedHand) {
  const start = hand.players.reduce((a, p) => a + p.stack, 0);
  for (const step of buildTimeline(hand)) {
    const onTable = Object.values(step.stacks).reduce((a, b) => a + b, 0) + totalOnTable(step);
    expect(onTable).toBeCloseTo(start, 6);
    for (const s of Object.values(step.stacks)) expect(s).toBeGreaterThanOrEqual(0);
  }
  const last = buildTimeline(hand).at(-1)!;
  expect(totalOnTable(last)).toBeCloseTo(0, 6);
}

describe("parseChips", () => {
  it("strips thousands separators", () => {
    expect(parseChips("64,676")).toBe(64676);
    expect(parseChips("1,500")).toBe(1500);
    expect(parseChips("350")).toBe(350);
  });
});

describe("GG parser — top hand (reconstructed from the spec)", () => {
  const hand = parse(TOP_HAND);
  const d = deriveHand(hand);

  it("reads the header", () => {
    expect(hand.handId).toBe("TM6510945691");
    expect(hand.tournamentId).toBe("316999261");
    expect(hand.tournamentName).toBe("Daily Special $10");
    expect(hand.game).toBe("Hold'em No Limit");
    expect(hand.level).toBe(19);
    expect([hand.smallBlind, hand.bigBlind, hand.ante]).toEqual([1500, 3000, 350]);
    expect(hand.playedAt).toBe("2026-10-08T21:40:24");
  });

  it("reads table, seats, hero and positions", () => {
    expect(hand.tableName).toBe("132");
    expect(hand.maxSeats).toBe(8);
    expect(hand.buttonSeat).toBe(2);
    expect(hand.players).toHaveLength(8);
    expect(hand.heroName).toBe("Hero");
    expect(hand.heroCards).toEqual(["Qd", "Ah"]);
    const pos = Object.fromEntries(hand.players.map((p) => [p.name, p.position]));
    expect(pos).toMatchObject({ "7b1c90fe": "BTN", "4070ed9d": "SB", Hero: "BB", a596eadd: "UTG", "922e16a4": "CO" });
  });

  it("keeps the raise total and computes the chips added", () => {
    const shove = hand.events.find((e) => e.kind === "action" && e.player === "922e16a4" && e.action === "raise");
    expect(shove).toMatchObject({ toAmount: 47892, amount: 47892, allIn: true });
    const call = hand.events.find((e) => e.kind === "action" && e.player === "Hero" && e.action === "call");
    expect(call).toMatchObject({ amount: 24188, allIn: true });
  });

  it("keeps the shows before the board, as printed", () => {
    const kinds = hand.events.filter((e) => e.kind === "show" || e.kind === "deal").map((e) => e.kind);
    expect(kinds).toEqual(["show", "show", "deal", "deal", "deal"]);
    expect(hand.shown).toEqual({ Hero: ["Qd", "Ah"], "922e16a4": ["Js", "Jd"] });
    expect(hand.board).toEqual({ flop: ["6c", "8s", "7c"], turn: "Ks", river: "4s" });
  });

  it("derives pot in BB and Hero's loss, net of nothing returned to Hero", () => {
    expect(hand.totalPot).toBe(64676);
    expect(d.potBb).toBe(21.56); // shown as 21,6 BB
    expect(d.heroNetChips).toBe(-27538);
    expect(d.heroNetBb).toBe(-9.18);
    expect(d.heroWon).toBe(false);
    expect(d.heroAllIn).toBe(true);
    expect(d.wentToShowdown).toBe(true);
    expect(d.heroPosition).toBe("BB");
    expect(hand.winners).toEqual([{ player: "922e16a4", amount: 64676 }]);
    expect(hand.warnings).toEqual([]);
  });

  it("replays with correct stacks and pot at every step", () => {
    expectChipsConserved(hand);
    const steps = buildTimeline(hand);
    const shove = steps.find((s) => s.player === "922e16a4" && s.kind === "action")!;
    expect(describeStep(shove, fmtChips)).toBe("922e16a4 raises naar 47.892, all-in");
    const afterReturn = steps.find((s) => s.kind === "uncalled")!;
    expect(afterReturn.stacks["922e16a4"]).toBe(48242 - 350 - 47892 + 20704);
    expect(totalOnTable(afterReturn)).toBe(64676);
    // Cards are shown before any board card is dealt.
    const firstShow = steps.findIndex((s) => s.kind === "show");
    expect(steps[firstShow].board).toEqual([]);
    expect(steps.at(-1)!.stacks.Hero).toBe(0);
    expect(steps.at(-1)!.stacks["922e16a4"]).toBe(48242 - 350 - 27188 + 64676);
  });
});

describe("GG parser — edge cases (constructed hands)", () => {
  it("hand without flop: uncalled bet returned, no showdown", () => {
    const hand = parse(NO_FLOP_HAND);
    const d = deriveHand(hand);
    expect(hand.events.some((e) => e.kind === "deal")).toBe(false);
    expect(d.lastStreet).toBe("preflop");
    expect(d.wentToShowdown).toBe(false); // even though *** SHOWDOWN *** is printed
    expect(d.heroInvested).toBe(40 + 300);
    expect(d.heroNetChips).toBe(950 - 340);
    expect(d.heroWon).toBe(true);
    expect(d.heroPosition).toBe("BTN");
    expect(hand.warnings).toEqual([]);
    expectChipsConserved(hand);
  });

  it("side pot: two collected lines, Hero wins only the main pot", () => {
    const hand = parse(SIDE_POT_HAND);
    const d = deriveHand(hand);
    expect(hand.winners).toEqual([
      { player: "11111111", amount: 43750 },
      { player: "Hero", amount: 24375 },
    ]);
    expect(d.heroNetChips).toBe(24375 - 8125);
    expect(d.potBb).toBe(68.13);
    expect(Object.keys(hand.shown)).toHaveLength(3);
    expect(hand.warnings).toEqual([]);
    expectChipsConserved(hand);
  });

  it("split pot: Hero gets half back and counts as having won", () => {
    const hand = parse(SPLIT_POT_HAND);
    const d = deriveHand(hand);
    expect(d.heroInvested).toBe(50 + 1400);
    expect(d.heroNetChips).toBe(1575 - 1450);
    expect(d.heroWon).toBe(true);
    expect(d.wentToShowdown).toBe(true);
    expect(d.lastStreet).toBe("river");
    expect(hand.warnings).toEqual([]);
    expectChipsConserved(hand);
  });

  it("never throws on garbage — it reports a failure", () => {
    expect(parseGGHand("hello").ok).toBe(false);
    expect(parseGGHand(TOP_HAND.split("*** SUMMARY ***")[0]).ok).toBe(false);
    const cash = parseGGHand("Poker Hand #RC0199283746: Hold'em No Limit ($0.50/$1.00) - 2024/01/15 14:22:33");
    expect(cash.ok).toBe(false);
  });
});

describe("splitting and importing", () => {
  const file = [SPLIT_POT_HAND, TOP_HAND, NO_FLOP_HAND].join("\n\n\n");

  it("splits on hand headers", () => {
    expect(splitHands(file).hands).toHaveLength(3);
    expect(splitHands(`﻿${file.replace(/\n/g, "\r\n")}`).hands).toHaveLength(3);
  });

  it("parses a file, sorts oldest first and skips duplicates within the upload", () => {
    const out = parseTexts([
      { fileName: "a.txt", text: file },
      { fileName: "b.txt", text: TOP_HAND },
      { fileName: "c.txt", text: "not a hand history" },
    ]);
    expect(out.entries.map((e) => e.hand.handId)).toEqual(["TM0000000002", "TM0000000004", "TM6510945691"]);
    expect(out.duplicatesInUpload).toBe(1);
    expect(out.fileErrors).toHaveLength(1);
  });

  it("keeps going when one hand in a file is broken", () => {
    const broken = TOP_HAND.replace("Table '132' 8-max Seat #2 is the button", "Table garbage");
    const out = parseTexts([{ fileName: "x.txt", text: [broken, NO_FLOP_HAND].join("\n\n") }]);
    expect(out.entries).toHaveLength(1);
    expect(out.failures).toHaveLength(1);
    expect(out.failures[0].handId).toBe("TM6510945691");
  });

  it("rejects unsupported file types with a Dutch message", async () => {
    const res = await readFiles([{ name: "x.pdf", arrayBuffer: async () => new ArrayBuffer(4) }]);
    expect(res.fileErrors[0].error).toMatch(/niet ondersteund/);
  });
});

// ── The real PokerCraft export ───────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "GG20261008-1802 - Daily Special 10.txt");
const hasFixture = existsSync(FIXTURE);

describe.skipIf(!hasFixture)("real export: GG20261008-1802 - Daily Special 10.txt", () => {
  const text = hasFixture ? readFileSync(FIXTURE, "utf8") : "";
  const out = parseTexts([{ fileName: "fixture.txt", text }]);
  const byId = new Map(out.entries.map((e) => [e.hand.handId, e.hand]));

  it("parses all 107 hands without failures or unknown lines", () => {
    expect(splitHands(text).hands).toHaveLength(107);
    expect(out.failures).toEqual([]);
    expect(out.entries).toHaveLength(107);
    for (const e of out.entries) expect(e.hand.warnings, e.hand.handId).toEqual([]);
  });

  it("the top hand matches the spec exactly", () => {
    const top = splitHands(text).hands[0];
    const hand = parse(top);
    const d = deriveHand(hand);
    expect(hand.handId).toBe("TM6510945691");
    expect(hand.heroCards?.slice().sort()).toEqual(["Ah", "Qd"]);
    expect(hand.shown).toMatchObject({ "922e16a4": ["Js", "Jd"] });
    expect(hand.totalPot).toBe(64676);
    expect(d.potBb).toBe(21.56);
    expect(d.heroWon).toBe(false);
  });

  it("is sorted oldest first", () => {
    const times = out.entries.map((e) => e.hand.playedAt);
    expect([...times].sort()).toEqual(times);
  });

  it("every hand replays with stacks and pot conserved", () => {
    for (const hand of byId.values()) expectChipsConserved(hand);
  });

  it("contains preflop all-ins with a showdown, hands without a flop, and uncalled bets", () => {
    const hands = [...byId.values()];
    const preflopAllInShowdown = hands.filter((h) => {
      const firstDeal = h.events.findIndex((e) => e.kind === "deal");
      const firstShow = h.events.findIndex((e) => e.kind === "show");
      return firstShow >= 0 && (firstDeal < 0 || firstShow < firstDeal);
    });
    expect(preflopAllInShowdown.length).toBeGreaterThan(0);
    expect(hands.some((h) => deriveHand(h).lastStreet === "preflop")).toBe(true);
    expect(hands.some((h) => h.events.some((e) => e.kind === "uncalled"))).toBe(true);
  });

  it("side pots: two collected lines for one player are summed (TM6510606538)", () => {
    const h = byId.get("TM6510606538")!;
    expect(h.events.filter((e) => e.kind === "collect").map((e) => (e as { amount: number }).amount)).toEqual([37430, 27490]);
    expect(h.winners).toEqual([{ player: "2e454936", amount: 64920 }]);
    expect(h.totalPot).toBe(64920);
    const d = deriveHand(h);
    expect(d.potBb).toBe(32.46);
    expect(d.heroNetChips).toBe(-250); // Hero folded preflop after the ante
    expect(d.wentToShowdown).toBe(true);
  });

  it("split pot: two winners with 10,300 each (TM6510603048)", () => {
    const h = byId.get("TM6510603048")!;
    expect(h.winners).toEqual([
      { player: "f2474a80", amount: 10300 },
      { player: "eff73720", amount: 10300 },
    ]);
    expect(deriveHand(h).heroNetChips).toBe(-375); // ante + small blind, then fold
  });

  it("the real PokerCraft zip imports the same 107 hands", async () => {
    const zipPath = join(__dirname, "fixtures", "000001a1-25c6-0eec-0000-00000c69c8e0.zip");
    if (!existsSync(zipPath)) return;
    const bytes = readFileSync(zipPath);
    const { texts, fileErrors } = await readFiles([{ name: "export.zip", arrayBuffer: async () => new Uint8Array(bytes).buffer }]);
    expect(fileErrors).toEqual([]);
    expect(texts).toHaveLength(1);
    expect(texts[0].fileName).toBe("export.zip › GG20261008-1802 - Daily Special 10.txt");
    expect(parseTexts(texts).entries).toHaveLength(107);
  });

  it("collected amounts always add up to the total pot", () => {
    for (const h of byId.values()) {
      expect(h.winners.reduce((a, w) => a + w.amount, 0) + h.rake, h.handId).toBe(h.totalPot);
    }
  });
});
