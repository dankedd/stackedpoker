/**
 * Flop analysis coverage and verdicts — aggregated counts only.
 *
 *   node scripts/flop-analysis-report.mjs [--production]
 *
 * For every hand that reaches the flop: does it match a spot (before: the old
 * BN/UTG-vs-BB 30–50bb matcher; after: the spot catalog), is that spot's flop
 * data computed (data/mpt/precomputed/*.jsonl), and — where Hero made a flop
 * decision — the flop check's verdict, graded exactly like the app (Hero's
 * hand position from the precomputed per-hand equities, as the backend does).
 * --production adds every imported hand (read-only, in memory, never printed).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRE = path.resolve(FRONTEND, "../data/mpt/precomputed");
const require = createRequire(path.join(FRONTEND, "package.json"));
const Module = require("node:module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return orig.call(this, r.startsWith("@/") ? path.join(FRONTEND, r.slice(2)) : r, ...rest);
};
const jiti = require("jiti")(path.join(FRONTEND, "index.ts"), { alias: { "@": FRONTEND }, interopDefault: true });
const { matchFlop } = jiti("@/lib/flopTrainer/match");
const { handPositionFrom } = jiti("@/lib/flopTrainer/handPosition");
const { flopLine, gradeFlop } = jiti("@/lib/handHistory/flopCheck");
const { parseTexts } = jiti("@/lib/handHistory/importer");
const { EXAMPLE_HAND_TEXTS } = jiti("@/lib/onboarding/exampleTournament");
const { displayPos } = jiti("@/lib/flopTrainer/logic");

// Precomputed rows per spot (only complete spots count as analysed).
const rows = new Map();
for (const f of fs.existsSync(PRE) ? fs.readdirSync(PRE) : []) {
  if (!f.endsWith(".jsonl")) continue;
  const lines = fs.readFileSync(path.join(PRE, f), "utf8").split("\n").filter(Boolean);
  if (lines.length !== 1755) continue;
  rows.set(f.replace(".jsonl", ""), new Map(lines.map((l) => { const d = JSON.parse(l); return [d.flop, d]; })));
}

function report(hands, label) {
  const c = { flops: 0, before: 0, after: 0, analysed: 0, decisions: 0 };
  const verdicts = {};
  const spots = {};
  for (const h of hands) {
    if (h.board?.flop?.length !== 3) continue;
    c.flops++;
    const r = matchFlop(h);
    if (!r.ok) continue;
    const m = r.match;
    c.after++;
    if ((m.spotId === "srp_bb_vs_bn_40" || m.spotId === "srp_bb_vs_utg_40") && m.effBb >= 30 && m.effBb <= 50) c.before++;
    const row = rows.get(m.spotId)?.get(m.flop);
    if (!row) continue;
    c.analysed++;
    spots[m.spotId] = (spots[m.spotId] ?? 0) + 1;
    if (!m.heroSide) continue;
    const pos = m.heroHand ? handPositionFrom(row.hands[m.heroSide], m.heroHand, [m.flop.slice(0, 2), m.flop.slice(2, 4), m.flop.slice(4, 6)]) : null;
    const check = gradeFlop({ match: m, line: flopLine(h, m), row, hand: pos, names: { ip: displayPos(m.spot.ip), oop: displayPos(m.spot.oop) } });
    if (check.line.kind === "none") continue;
    c.decisions++;
    verdicts[check.verdict] = (verdicts[check.verdict] ?? 0) + 1;
  }
  const pct = (n) => (c.flops ? `${Math.round((100 * n) / c.flops)}%` : "–");
  console.log(`\n== ${label}: ${c.flops} hands reach the flop`);
  console.log(`   matched before: ${c.before} (${pct(c.before)}) → after: ${c.after} (${pct(c.after)}), of which analysed (data computed): ${c.analysed} (${pct(c.analysed)})`);
  console.log(`   Hero flop decisions graded: ${c.decisions}  verdicts:`, verdicts);
  console.log(`   analysed per spot:`, spots);
}

const example = parseTexts([{ fileName: "x.txt", text: EXAMPLE_HAND_TEXTS.join("\n\n\n") }]).entries.map((e) => e.hand);
report(example, "Example tournament");
const fx = path.join(FRONTEND, "lib/handHistory/__tests__/fixtures");
if (fs.existsSync(fx)) {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".txt") && files.push(path.join(d, e.name))));
  walk(fx);
  report(parseTexts(files.map((f) => ({ fileName: path.basename(f), text: fs.readFileSync(f, "utf8") }))).entries.map((e) => e.hand), "Local test exports");
}
if (process.argv.includes("--production")) {
  const env = Object.fromEntries(fs.readFileSync(path.join(FRONTEND, "../backend/.env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  const hands = [];
  for (let from = 0; ; from += 500) {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/hh_hands?select=data&board=not.eq.%7B%7D&order=id&limit=500&offset=${from}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const batch = await r.json();
    hands.push(...batch.map((x) => x.data).filter(Boolean));
    if (batch.length < 500) break;
  }
  report(hands, "Production (all imported hands, aggregated)");
}
console.log(`\nComputed spots: ${[...rows.keys()].join(", ")}`);
