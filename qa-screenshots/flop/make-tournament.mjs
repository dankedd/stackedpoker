/**
 * A made-up demo tournament for the flop-analysis screenshots (no real user
 * data): GG-format hands with fake player names, chosen with the app's own
 * code (parser → matchFlop → gradeFlop) so each one shows a known state:
 *
 *   good          BTN opens 2.3x at 40bb, BB calls, Hero c-bets small on a board
 *                 where the guideline grades it "good"
 *   questionable  same spot, Hero c-bets a Good hand on a board that suits the caller
 *   coming soon   CO opens at 60bb, BB calls: a catalog spot with precomputed: false
 *   + a few preflop folds so the overview isn't empty
 *
 * Hero's hand position comes from the precomputed per-hand equities with the
 * backend's formula (routes/flop_trainer.py: hand_position / live_combos).
 *
 *   node qa-screenshots/flop/make-tournament.mjs
 *   → qa-screenshots/flop/data/GG20261021-1500 - Demo Flop Cup.txt
 *   → qa-screenshots/flop/data/demo.json   (hands, flops, spot rows, hand positions)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const FRONTEND = path.join(ROOT, "frontend");
const require = createRequire(path.join(FRONTEND, "package.json"));
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return origResolve.call(this, request.startsWith("@/") ? path.join(FRONTEND, request.slice(2)) : request, ...rest);
};
const jiti = require("jiti")(path.join(FRONTEND, "index.ts"), { alias: { "@": FRONTEND }, interopDefault: true });
const { parseTexts } = jiti("@/lib/handHistory/importer");
const { matchFlop } = jiti("@/lib/flopTrainer/match");
const { flopLine, gradeFlop } = jiti("@/lib/handHistory/flopCheck");

const OUT = path.join(here, "data");
fs.mkdirSync(OUT, { recursive: true });
const SPOT = "srp_bb_vs_bn_40";
const rows = new Map(
  fs
    .readFileSync(path.join(ROOT, "data/mpt/precomputed", `${SPOT}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const r = JSON.parse(l);
      return [r.flop, r];
    }),
);

// ── backend formula (routes/flop_trainer.py) ────────────────────────────────
const SUITS = "cdhs";
const BUCKETS = [["strong", 75], ["good", 50], ["weak", 33], ["trash", -1]];
function liveCombos(hand, board) {
  const [a, b] = hand;
  const used = new Set(board);
  if (a === b) {
    const n = [...SUITS].filter((s) => !used.has(a + s)).length;
    return (n * (n - 1)) / 2;
  }
  let c = 0;
  for (const s1 of SUITS) for (const s2 of SUITS) if ((s1 === s2) === hand.endsWith("s") && !used.has(a + s1) && !used.has(b + s2)) c++;
  return c;
}
function handPosition(hands, hand, board) {
  const weights = Object.fromEntries(Object.entries(hands).filter(([, [f]]) => f > 0).map(([h, [f]]) => [h, f * liveCombos(h, board)]));
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const entry = hands[hand];
  if (!entry || total <= 0) return { in_range: false };
  const [freq, eq] = entry;
  const bucket = BUCKETS.find(([, lo]) => eq >= lo)[0];
  if (freq <= 0 || !(weights[hand] > 0)) return { in_range: false, equity: eq, bucket };
  const atLeast = Object.entries(weights).filter(([h]) => hands[h][1] >= eq).reduce((s, [, w]) => s + w, 0);
  return { in_range: true, equity: eq, bucket, frequency: freq, top_pct: Math.round((1000 * atLeast) / total) / 10 };
}

// ── hand text ───────────────────────────────────────────────────────────────
const NAMES = { 1: "f3a01b77", 2: "0c9e5d21", 3: "a7d4402e", 4: "5be18c90", 5: "e2f7a613", 6: "71c0d9b4", 7: "9d36e5aa" };
const fmt = (n) => n.toLocaleString("en-US");
let handNo = 0;
let minute = 0;
function header(heroSeat, cards, stack) {
  handNo++;
  minute += 3;
  const name = (s) => (s === heroSeat ? "Hero" : NAMES[s]);
  const seats = [1, 2, 3, 4, 5, 6, 7, 8];
  const t = `15:${String(minute).padStart(2, "0")}:00`;
  return {
    name,
    lines: [
      `Poker Hand #TM8800000${String(handNo).padStart(3, "0")}: Tournament #880000001, Demo Flop Cup Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/21 ${t}`,
      `Table '3' 8-max Seat #8 is the button`,
      ...seats.map((s) => `Seat ${s}: ${name(s)} (${fmt(stack)} in chips)`),
      ...seats.map((s) => `${name(s)}: posts the ante 125`),
      `${name(1)}: posts small blind 500`,
      `${name(2)}: posts big blind 1,000`,
      `*** HOLE CARDS ***`,
      `Dealt to Hero [${cards.join(" ")}]`,
    ],
  };
}
/** Seat 8 (BTN) or 7 (CO) opens 2.3x, the rest folds, BB calls; flop; BB checks; Hero bets `bet` (or checks), BB folds. */
function openCallFlop(heroSeat, cards, stack, board, bet) {
  const { name, lines } = header(heroSeat, cards, stack);
  const out = [...lines];
  for (const s of [3, 4, 5, 6, 7, 8]) {
    if (s === heroSeat) {
      out.push(`Hero: raises 1,300 to 2,300`);
      continue;
    }
    if (s < heroSeat) out.push(`${name(s)}: folds`);
  }
  for (const s of [7, 8]) if (s > heroSeat) out.push(`${name(s)}: folds`);
  out.push(`${name(1)}: folds`, `${name(2)}: calls 1,300`);
  const pre = 2 * 2300 + 500 + 8 * 125;
  out.push(`*** FLOP *** [${board.join(" ")}]`, `${name(2)}: checks`);
  if (bet) {
    out.push(`Hero: bets ${fmt(bet)}`, `${name(2)}: folds`, `Uncalled bet (${fmt(bet)}) returned to Hero`, "*** SHOWDOWN ***", `Hero collected ${fmt(pre)} from pot`);
  } else {
    out.push("Hero: checks", `*** TURN *** [${board.join(" ")}] [2s]`, `${name(2)}: checks`, "Hero: checks", `*** RIVER *** [${board.join(" ")} 2s] [3h]`, `${name(2)}: checks`, "Hero: checks", "*** SHOWDOWN ***", `Hero collected ${fmt(pre)} from pot`);
  }
  out.push("*** SUMMARY ***", `Total pot ${fmt(pre)} | Rake 0`);
  return { text: out.join("\n"), pot: pre };
}
function foldHand(cards) {
  const { name, lines } = header(4, cards, 40000);
  return [...lines, `${name(3)}: folds`, "Hero: folds", `${name(5)}: folds`, `${name(6)}: folds`, `${name(7)}: raises 1,300 to 2,300`, `${name(8)}: folds`, `${name(1)}: folds`, `${name(2)}: folds`, `Uncalled bet (1,300) returned to ${name(7)}`, "*** SHOWDOWN ***", `${name(7)} collected 4,500 from pot`, "*** SUMMARY ***", "Total pot 4,500 | Rake 0"].join("\n");
}
const parse = (text) => parseTexts([{ fileName: "demo.txt", text }]).entries[0]?.hand;
const NAMES_FOR = { ip: "BTN", oop: "BB" };

/** Concrete cards for a hand class that avoid the board. */
function cardsFor(cls, board) {
  const used = new Set(board);
  const [a, b] = cls;
  for (const s1 of SUITS)
    for (const s2 of SUITS) {
      if (a === b && s1 >= s2) continue;
      if (a !== b && (s1 === s2) !== cls.endsWith("s")) continue;
      const c = [a + s1, b + s2];
      if (!used.has(c[0]) && !used.has(c[1])) return c;
    }
  return null;
}

function tryHand(heroSeat, stack, board, cls, betFrac) {
  const cards = cardsFor(cls, board);
  if (!cards) return null;
  // betFrac is a share of the pot in percent; bets are rounded to 100 chips.
  const bet = betFrac ? Math.round(((betFrac / 100) * (2 * 2300 + 500 + 8 * 125)) / 100) * 100 : 0;
  const { text } = openCallFlop(heroSeat, cards, stack, board, bet);
  handNo--; // trial only
  minute -= 3;
  const h = parse(text);
  const m = h && matchFlop(h);
  if (!m?.ok) return { match: m };
  const row = rows.get(m.match.flop) ?? null;
  const pos = row ? handPosition(row.hands[m.match.heroSide], cls, [m.match.flop.slice(0, 2), m.match.flop.slice(2, 4), m.match.flop.slice(4, 6)]) : null;
  const g = gradeFlop({ match: m.match, line: flopLine(h, m.match), row, hand: pos, names: NAMES_FOR });
  return { cards, bet, match: m, row, pos, g };
}

// Look for the two states on readable boards (rainbow first) with common hands.
const BOARDS = [...rows.keys()];
const HANDS = ["AQo", "KQs", "AJs", "QJs", "KJo", "ATs", "A5s", "K9s", "T9s", "88", "77", "AKo"];
let good = null;
let questionable = null;
for (const flop of BOARDS) {
  const board = [flop.slice(0, 2), flop.slice(2, 4), flop.slice(4, 6)];
  for (const cls of HANDS) {
    if (!good) {
      const r = tryHand(8, 40000, board, cls, 33);
      if (r?.g && r.g.verdict === "good" && r.pos?.in_range && r.pos.bucket === "strong") good = { board, cls, ...r };
    }
    if (!questionable) {
      const r = tryHand(8, 40000, board, cls, 70);
      if (r?.g && r.g.verdict === "questionable" && r.pos?.in_range) questionable = { board, cls, ...r };
    }
  }
  if (good && questionable) break;
}
if (!good || !questionable) throw new Error(`not found: good=${!!good} questionable=${!!questionable}`);

// Real hand numbers, in order: two folds, good, questionable, coming soon, a fold.
handNo = 0;
minute = 0;
const texts = [foldHand(["7c", "2d"]), foldHand(["9h", "4s"])];
const gText = openCallFlop(8, good.cards, 40000, good.board, good.bet).text;
const goodId = `TM8800000${String(handNo).padStart(3, "0")}`;
texts.push(gText);
const qText = openCallFlop(8, questionable.cards, 40000, questionable.board, questionable.bet).text;
const qId = `TM8800000${String(handNo).padStart(3, "0")}`;
texts.push(qText);
// Coming soon: CO opens at 60bb (srp_bb_vs_co_60 has book ranges, no precomputed flops).
const csBoard = ["Kd", "8h", "4c"];
const csText = openCallFlop(7, ["Ah", "Kc"], 60000, csBoard, 1700).text;
const csId = `TM8800000${String(handNo).padStart(3, "0")}`;
texts.push(csText, foldHand(["Jc", "3s"]));
const cs = matchFlop(parse(csText));
if (!cs.ok) throw new Error(`coming-soon hand did not match: ${cs.reason}`);
if (cs.match.spot.precomputed) throw new Error(`${cs.match.spotId} is precomputed — pick another spot for "coming soon"`);

// Defense: BTN opens 2.3x, Hero defends the BB, then check-raises the c-bet with a
// Strong hand on the "good" hand's flop (its row is already seeded in the mock).
function defendHand(cards, board) {
  const { name, lines } = header(2, cards, 40000);
  const out = [...lines];
  for (const s of [3, 4, 5, 6, 7]) out.push(`${name(s)}: folds`);
  out.push(`${name(8)}: raises 1,300 to 2,300`, `${name(1)}: folds`, "Hero: calls 1,300");
  const pre = 2 * 2300 + 500 + 8 * 125;
  out.push(`*** FLOP *** [${board.join(" ")}]`, "Hero: checks", `${name(8)}: bets 2,000`, "Hero: raises 4,000 to 6,000", `${name(8)}: folds`);
  out.push("Uncalled bet (4,000) returned to Hero", "*** SHOWDOWN ***", `Hero collected ${fmt(pre + 4000)} from pot`, "*** SUMMARY ***", `Total pot ${fmt(pre + 4000)} | Rake 0`);
  return out.join("\n");
}
const dBoard = good.board;
const dRow = good.row;
const dBoardCards = [dRow.flop.slice(0, 2), dRow.flop.slice(2, 4), dRow.flop.slice(4, 6)];
const dCls = ["KK", "QQ", "JJ", "TT", "99", "A2s", "A3s", "33", "22", "A2o"].find((c) => {
  const p = handPosition(dRow.hands.oop, c, dBoardCards);
  return c !== good.cls && p.in_range && p.bucket === "strong" && cardsFor(c, dBoard);
});
if (!dCls) throw new Error("no Strong BB hand found for the defense demo");
const dText = defendHand(cardsFor(dCls, dBoard), dBoard);
const dId = `TM8800000${String(handNo).padStart(3, "0")}`;
texts.push(dText);
const dHand = parse(dText);
const dm = matchFlop(dHand);
if (!dm.ok) throw new Error(`defense hand did not match: ${dm.reason}`);
const dPos = handPosition(dRow.hands[dm.match.heroSide], dCls, dBoardCards);
const dCheck = gradeFlop({ match: dm.match, line: flopLine(dHand, dm.match), row: dRow, hand: dPos, names: NAMES_FOR });

const file = path.join(OUT, "GG20261021-1500 - Demo Flop Cup.txt");
fs.writeFileSync(file, texts.join("\n\n\n") + "\n");
const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !["hands", "texture_detail", "seconds"].includes(k)));
const demo = {
  spot: SPOT,
  good: { handId: goodId, flop: good.match.match.flop, cls: good.cls, side: good.match.match.heroSide, verdict: good.g.verdict, explain: good.g.explain, row: strip(good.row), position: good.pos },
  questionable: { handId: qId, flop: questionable.match.match.flop, cls: questionable.cls, side: questionable.match.match.heroSide, verdict: questionable.g.verdict, explain: questionable.g.explain, row: strip(questionable.row), position: questionable.pos },
  comingSoon: { handId: csId, spotId: cs.match.spotId, flop: cs.match.flop },
  defense: { handId: dId, flop: dm.match.flop, cls: dCls, side: dm.match.heroSide, verdict: dCheck.verdict, explain: dCheck.explain, row: strip(dRow), position: dPos },
};
fs.writeFileSync(path.join(OUT, "demo.json"), JSON.stringify(demo, null, 1));
console.log(file);
for (const k of ["good", "questionable", "defense"]) console.log(k, demo[k].handId, demo[k].cls, demo[k].flop, demo[k].verdict, "|", demo[k].explain);
console.log("coming soon", csId, cs.match.spotId, "precomputed:", cs.match.spot.precomputed);
