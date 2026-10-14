import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { detectFormat } from "../detect";
import { deriveHand } from "../derive";
import { logUnsupportedFiles, parseTexts, readFiles, rejectFile } from "../importer";
import { parserFor } from "../parsers";
import { easternToUtc, parsePSHand, playedAtUtc, romanToNumber, splitPSHands } from "../parsers/pokerstars";
import { t } from "../strings";

/*
 * The hands below are written for these tests in PokerStars' English export
 * format (checked line by line against real PokerStars tournament exports).
 * Player names are made up. Real exports are never committed — the repo is
 * public; see the fixture block at the end.
 */

// 6 players, antes from everyone, an all-in with a side pot and a showdown.
const SIDE_POT_HAND = `PokerStars Hand #250000000001: Tournament #3800000001, $10+$1 USD Hold'em No Limit - Level IV (50/100) - 2026/01/15 21:05:10 CET [2026/01/15 15:05:10 ET]
Table '3800000001 12' 6-max Seat #2 is the button
Seat 1: ShortStack (1200 in chips)
Seat 2: Hero (5000 in chips)
Seat 3: BigStack (9000 in chips)
Seat 4: Folder (4000 in chips) is sitting out
Seat 5: Middle (3000 in chips)
Seat 6: Quiet (6000 in chips)
ShortStack: posts the ante 10
Hero: posts the ante 10
BigStack: posts the ante 10
Folder: posts the ante 10
Middle: posts the ante 10
Quiet: posts the ante 10
BigStack: posts small blind 50
Folder: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Ad]
Middle: folds
Quiet: folds
ShortStack: raises 1090 to 1190 and is all-in
Hero: raises 1810 to 3000
BigStack: calls 2950
Folder: folds
Folder is disconnected
*** FLOP *** [Kd 7c 2h]
BigStack: checks
Hero: bets 1990 and is all-in
BigStack: calls 1990
*** TURN *** [Kd 7c 2h] [9s]
*** RIVER *** [Kd 7c 2h 9s] [3d]
*** SHOW DOWN ***
BigStack: shows [Kh Qh] (a pair of Kings)
Hero: shows [Ah Ad] (a pair of Aces)
Hero collected 7600 from side pot
ShortStack: shows [Jc Jd] (a pair of Jacks)
Hero collected 3730 from main pot
ShortStack finished the tournament in 87th place
*** SUMMARY ***
Total pot 11330 Main pot 3730. Side pot 7600. | Rake 0
Board [Kd 7c 2h 9s 3d]
Seat 1: ShortStack showed [Jc Jd] and lost with a pair of Jacks
Seat 2: Hero (button) showed [Ah Ad] and won (11330) with a pair of Aces
Seat 3: BigStack (small blind) showed [Kh Qh] and lost with a pair of Kings
Seat 4: Folder (big blind) folded before Flop
Seat 5: Middle folded before Flop (didn't bet)
Seat 6: Quiet folded before Flop (didn't bet)`;

// Big blind ante, a bounty tournament, and the time printed in ET only.
const BB_ANTE_HAND = `PokerStars Hand #250000000002: Tournament #3800000002, $4.40+$4.40+$1.20 USD Hold'em No Limit - Level XII (600/1200) - 2026/07/04 20:15:00 ET
Table '3800000002 3' 9-max Seat #5 is the button
Seat 2: Alpha (30000 in chips, $4.40 bounty)
Seat 5: Hero (24000 in chips, $6.60 bounty)
Seat 7: Bravo (18000 in chips, $4.40 bounty)
Bravo: posts the ante 1200
Alpha: posts small blind 600
Bravo: posts big blind 1200
*** HOLE CARDS ***
Dealt to Hero [7c 2d]
Hero: folds
Alpha: raises 1200 to 2400
Bravo: folds
Uncalled bet (1200) returned to Alpha
Alpha collected 3600 from pot
Alpha: doesn't show hand
*** SUMMARY ***
Total pot 3600 | Rake 0
Seat 2: Alpha (small blind) collected (3600)
Seat 5: Hero (button) folded before Flop (didn't bet)
Seat 7: Bravo (big blind) folded before Flop`;

const PS_CASH = `PokerStars Hand #250000000003: Hold'em No Limit ($0.05/$0.10 USD) - 2026/01/15 21:05:10 CET [2026/01/15 15:05:10 ET]
Table 'Halley III' 6-max Seat #1 is the button
Seat 1: Hero ($10 in chips)
Seat 2: Villain ($10 in chips)
Hero: posts small blind $0.05
Villain: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Hero: folds
*** SUMMARY ***
Total pot $0.10 | Rake $0`;

const PS_ZOOM_CASH = PS_CASH.replace("PokerStars Hand #250000000003", "PokerStars Zoom Hand #250000000004");

// A German client: same header shape, translated body.
const PS_GERMAN = `PokerStars Hand #250000000005: Turnier #3800000003, 10 $+1 $ USD Hold'em No Limit - Level IV (50/100) - 2026/01/15 21:05:10 MEZ [2026/01/15 15:05:10 ET]
Tisch '3800000003 1' 9-max Platz #2 ist der Button
Platz 1: Spieler (1500 in Chips)
Platz 2: Hero (1500 in Chips)
*** KARTEN ***
Ausgeteilt an Hero [Ah Kd]`;

// Format probes for detection only (enough of each format to recognise it).
const P888 = `#Game No : 1000000001
***** 888poker Hold'em No Limit 50/100 Blinds Tournament Table *****
Tournament #200000001 $5 + $0.50 - Table #1 9 Max (Real Money)
Seat 1 is the button
Total number of players : 6`;
const IPOKER = `<?xml version="1.0" encoding="utf-8"?>
<session sessioncode="12345">
  <general><tournamentcode>987654</tournamentcode><tournamentname>Daily 10</tournamentname></general>
  <game gamecode="1122334455"><general><startdate>2026-01-15 21:05:10</startdate></general></game>
</session>`;

describe("format detection (content, never the file name)", () => {
  it("recognises all four sites and their game type", () => {
    expect(detectFormat(SIDE_POT_HAND)).toEqual({ site: "pokerstars", gameType: "tournament", language: "en" });
    expect(detectFormat(PS_CASH)).toEqual({ site: "pokerstars", gameType: "cash", language: "en" });
    expect(detectFormat(PS_ZOOM_CASH)).toEqual({ site: "pokerstars", gameType: "cash", language: "en" });
    expect(detectFormat(PS_GERMAN)).toEqual({ site: "pokerstars", gameType: "unknown", language: "other" });
    expect(detectFormat("Poker Hand #TM1: Tournament #1, X Hold'em No Limit - Level1(10/20) - 2026/01/01 10:00:00")).toMatchObject({ site: "ggpoker", gameType: "tournament" });
    expect(detectFormat("Poker Hand #RC1: Hold'em No Limit ($0.05/$0.10) - 2026/01/01 10:00:00")).toMatchObject({ site: "ggpoker", gameType: "cash" });
    expect(detectFormat(P888)).toMatchObject({ site: "888poker", gameType: "tournament" });
    expect(detectFormat(IPOKER)).toMatchObject({ site: "ipoker", gameType: "tournament" });
  });

  it("does not recognise other text", () => {
    expect(detectFormat("just some notes about poker").site).toBeNull();
    expect(detectFormat("").site).toBeNull();
    expect(detectFormat("Winamax Poker - Tournament \"x\" buyIn: 1€").site).toBeNull();
  });

  it("a BOM at the start changes nothing", () => {
    expect(detectFormat(`﻿${SIDE_POT_HAND}`).site).toBe("pokerstars");
  });
});

describe("file-level messages", () => {
  const reject = (text: string, name = "x.txt") => rejectFile(name, text);

  it("supported tournament files go to their parser", () => {
    expect(reject(SIDE_POT_HAND)).toBeNull();
    expect(parserFor(SIDE_POT_HAND)?.site).toBe("pokerstars");
  });

  it("recognised but unsupported sites name the site", () => {
    expect(reject(P888)?.error).toBe("This looks like an 888poker file. 888poker isn't supported yet. We currently support GGPoker and PokerStars tournaments.");
    expect(reject(IPOKER, "session.xml")?.error).toBe("This looks like an iPoker file. iPoker isn't supported yet. We currently support GGPoker and PokerStars tournaments.");
  });

  it("cash games from a supported site, a translated client, and unknown files", () => {
    expect(reject(PS_CASH)?.error).toBe("Cash game hands aren't supported yet. Upload a tournament file.");
    expect(reject(PS_ZOOM_CASH)?.error).toBe(t.errors.cashNotSupported);
    expect(reject("Poker Hand #RC1: Hold'em No Limit ($0.05/$0.10) - 2026/01/01 10:00:00")?.error).toBe(t.errors.cashNotSupported);
    expect(reject(PS_GERMAN)?.error).toBe("Please set your PokerStars client to English and re-export.");
    expect(reject("hello")?.error).toBe("We couldn't recognise this file. Upload a tournament hand history from GGPoker (PokerCraft) or PokerStars.");
  });

  it("each rejected file carries what to log: site, game type, reason, extension — nothing else", () => {
    expect(reject(P888, "My 888 hands.txt")?.unsupported).toEqual({ site: "888poker", gameType: "tournament", reason: "unsupported_site", extension: "txt" });
    expect(reject(IPOKER, "s.XML")?.unsupported).toEqual({ site: "ipoker", gameType: "tournament", reason: "unsupported_site", extension: "xml" });
    expect(reject(PS_CASH)?.unsupported).toMatchObject({ site: "pokerstars", gameType: "cash", reason: "cash" });
    expect(reject(PS_GERMAN)?.unsupported).toMatchObject({ reason: "language" });
    expect(reject("hello")?.unsupported).toEqual({ site: null, gameType: "unknown", reason: "unrecognised", extension: "txt" });
  });

  it("logs rejected files without names or contents, and never throws", async () => {
    const inserted: unknown[] = [];
    const fake = { from: () => ({ insert: async (rows: unknown[]) => (inserted.push(...rows), { error: null }) }) };
    const out = parseTexts([
      { fileName: "secret name 888.txt", text: P888 },
      { fileName: "ok.txt", text: SIDE_POT_HAND },
    ]);
    await logUnsupportedFiles(fake as never, "user-1", out.fileErrors);
    expect(inserted).toEqual([{ user_id: "user-1", site: "888poker", game_type: "tournament", reason: "unsupported_site", extension: "txt" }]);
    expect(JSON.stringify(inserted)).not.toContain("secret");
    const broken = { from: () => ({ insert: async () => { throw new Error("offline"); } }) };
    await expect(logUnsupportedFiles(broken as never, "user-1", out.fileErrors)).resolves.toBeUndefined();
  });

  it(".xml files are accepted at upload (and then recognised), other types are not", async () => {
    const file = (name: string, text: string) => ({ name, arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer });
    const res = await readFiles([file("session.xml", IPOKER), file("notes.pdf", "x")]);
    expect(res.texts.map((x) => x.fileName)).toEqual(["session.xml"]);
    expect(res.fileErrors).toEqual([
      { fileName: "notes.pdf", error: t.errors.unsupportedType, unsupported: { site: null, gameType: "unknown", reason: "file_type", extension: "pdf" } },
    ]);
    expect(parseTexts(res.texts).fileErrors[0].unsupported?.reason).toBe("unsupported_site");
  });
});

describe("PokerStars tournament parser", () => {
  const parse = (text: string) => {
    const r = parsePSHand(text);
    if (!r.ok) throw new Error(r.failure.error);
    return r.hand;
  };

  it("reads the header: buy-in, Roman level, blinds, UTC time", () => {
    const h = parse(SIDE_POT_HAND);
    expect(h).toMatchObject({
      site: "pokerstars",
      handId: "250000000001",
      tournamentId: "3800000001",
      tournamentName: "$10+$1 USD",
      game: "Hold'em No Limit",
      level: 4,
      smallBlind: 50,
      bigBlind: 100,
      ante: 10,
      // 15:05:10 ET in January (EST, UTC−5).
      playedAt: "2026-01-15T20:05:10",
      tableName: "3800000001 12",
      maxSeats: 6,
      buttonSeat: 2,
      heroName: "Hero",
      heroCards: ["Ah", "Ad"],
    });
    expect(h.warnings).toEqual([]);
  });

  it("all-in with a side pot and a showdown: pot, winners, shown cards and hero result", () => {
    const h = parse(SIDE_POT_HAND);
    const d = deriveHand(h);
    expect(h.totalPot).toBe(11330);
    expect(h.winners).toEqual([{ player: "Hero", amount: 11330 }]);
    expect(h.shown).toEqual({ BigStack: ["Kh", "Qh"], Hero: ["Ah", "Ad"], ShortStack: ["Jc", "Jd"] });
    expect(h.board).toEqual({ flop: ["Kd", "7c", "2h"], turn: "9s", river: "3d" });
    expect(h.players.map((p) => [p.name, p.position])).toEqual([
      ["ShortStack", "CO"], ["Hero", "BTN"], ["BigStack", "SB"], ["Folder", "BB"], ["Middle", "UTG"], ["Quiet", "HJ"],
    ]);
    expect(d.wentToShowdown).toBe(true);
    expect(d.heroWon).toBe(true);
    expect(d.heroAllIn).toBe(true);
    expect(d.heroInvested).toBe(5000);
    expect(d.heroNetChips).toBe(6330);
    expect(d.potBb).toBe(113.3);
  });

  it("big blind ante: per-player ante is 0, the ante still counts in the pot; bounty seats and ET-only time", () => {
    const h = parse(BB_ANTE_HAND);
    expect(h.ante).toBe(0);
    expect(h.level).toBe(12);
    expect(h.tournamentName).toBe("$4.40+$4.40+$1.20 USD");
    expect(h.players.map((p) => p.stack)).toEqual([30000, 24000, 18000]);
    // 20:15 ET in July (EDT, UTC−4).
    expect(h.playedAt).toBe("2026-07-05T00:15:00");
    expect(h.totalPot).toBe(3600);
    expect(h.warnings).toEqual([]);
  });

  it("cash hands, translated hands and garbage are failures, never exceptions", () => {
    expect(parsePSHand(PS_CASH)).toMatchObject({ ok: false, failure: { error: t.errors.notTournament } });
    expect(parsePSHand("hello")).toMatchObject({ ok: false, failure: { error: t.errors.notPsHand } });
    expect(parsePSHand(SIDE_POT_HAND.split("*** SUMMARY ***")[0]).ok).toBe(false);
  });

  it("splits a file on hand headers, Zoom headers included", () => {
    const file = `﻿${SIDE_POT_HAND}\r\n\r\n\r\n${BB_ANTE_HAND}\n\n\n${PS_ZOOM_CASH}`;
    const { hands, leftover } = splitPSHands(file);
    expect(hands).toHaveLength(3);
    expect(hands[2].startsWith("PokerStars Zoom Hand #")).toBe(true);
    expect(leftover).toBe("");
  });

  it("imports a PokerStars file next to a GGPoker one", () => {
    const out = parseTexts([{ fileName: "ps.txt", text: `${SIDE_POT_HAND}\n\n\n${BB_ANTE_HAND}` }]);
    expect(out.failures).toEqual([]);
    expect(out.entries.map((e) => [e.hand.site, e.parser.id, e.hand.handId])).toEqual([
      ["pokerstars", "pokerstars", "250000000001"],
      ["pokerstars", "pokerstars", "250000000002"],
    ]);
  });
});

describe("time conversion", () => {
  it("Roman numerals", () => {
    expect([romanToNumber("I"), romanToNumber("IV"), romanToNumber("IX"), romanToNumber("XIV"), romanToNumber("XL"), romanToNumber("12")]).toEqual([1, 4, 9, 14, 40, 12]);
    expect(romanToNumber("Q")).toBeNull();
  });

  it("ET → UTC across daylight saving", () => {
    expect(easternToUtc(2026, 1, 15, 15, 5, 10)).toBe("2026-01-15T20:05:10");
    expect(easternToUtc(2026, 7, 4, 20, 15, 0)).toBe("2026-07-05T00:15:00");
    // US DST starts 8 March 2026 at 02:00: 03:30 that day is EDT.
    expect(easternToUtc(2026, 3, 8, 3, 30, 0)).toBe("2026-03-08T07:30:00");
  });

  it("prefers the bracketed ET time; falls back to a fixed zone label", () => {
    expect(playedAtUtc("Level I (10/20) - 2020/10/11 3:22:15 BRT [2020/10/11 2:22:15 ET]")).toBe("2020-10-11T06:22:15");
    expect(playedAtUtc("Level I (10/20) - 2026/01/15 21:05:10 CET")).toBe("2026-01-15T20:05:10");
    expect(playedAtUtc("Level I (10/20) - 2026/01/15 21:05:10 XYZ")).toBeNull();
  });
});

// ── Real PokerStars exports (local only) ─────────────────────────────────────
// Public tournament exports (MIT, github.com/murilogmamaral/pokerdf) in the
// fixtures folder, which is never committed.

const PS_FIXTURES = join(__dirname, "fixtures", "pokerstars");
const hasPsFixtures = existsSync(PS_FIXTURES) && readdirSync(PS_FIXTURES).some((f) => f.endsWith(".txt"));

describe.skipIf(!hasPsFixtures)("real PokerStars exports", () => {
  const texts = hasPsFixtures
    ? readdirSync(PS_FIXTURES).filter((f) => f.endsWith(".txt")).map((f) => ({ fileName: f, text: readFileSync(join(PS_FIXTURES, f), "utf8") }))
    : [];
  const out = parseTexts(texts);

  it("every hand parses, with no unknown lines and chips that add up", () => {
    expect(out.fileErrors).toEqual([]);
    expect(out.failures).toEqual([]);
    expect(out.entries.length).toBeGreaterThan(50);
    for (const e of out.entries) expect(e.hand.warnings, e.hand.handId).toEqual([]);
  });

  it("every hand is a tournament hand with positions and a hero", () => {
    for (const { hand } of out.entries) {
      expect(hand.tournamentId, hand.handId).toBeTruthy();
      expect(hand.heroCards?.length, hand.handId).toBe(2);
      expect(hand.players.every((p) => p.position), hand.handId).toBe(true);
    }
  });
});
