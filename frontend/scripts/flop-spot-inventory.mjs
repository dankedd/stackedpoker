/**
 * Which flop situations come up most in tournament hands? Aggregated counts
 * only — no hand, player or user is printed or written anywhere.
 *
 *   node scripts/flop-spot-inventory.mjs                 # example tournament + local exports
 *   node scripts/flop-spot-inventory.mjs --production    # + every imported hand (read-only,
 *                                                        #   SUPABASE_URL / SERVICE_ROLE_KEY from backend/.env)
 *
 * Classifies each hand that reaches the flop with lib/flopTrainer/match.ts
 * (flopSituation + spotFor): pot type, opener/caller positions (9-max), the
 * nearest book stack bucket, and whether the spot catalog has book ranges.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(FRONTEND, "package.json"));
const Module = require("node:module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return orig.call(this, r.startsWith("@/") ? path.join(FRONTEND, r.slice(2)) : r, ...rest);
};
const jiti = require("jiti")(path.join(FRONTEND, "index.ts"), { alias: { "@": FRONTEND }, interopDefault: true });
const { flopSituation, spotFor, SPOT_CATALOG } = jiti("@/lib/flopTrainer/match");
const { parseTexts } = jiti("@/lib/handHistory/importer");
const { EXAMPLE_HAND_TEXTS } = jiti("@/lib/onboarding/exampleTournament");

const BUCKETS = [15, 25, 40, 60];
const bucketOf = (bb) => BUCKETS.reduce((b, s) => (Math.abs(s - bb) < Math.abs(b - bb) ? s : b));

function tally(hands, label) {
  const combos = new Map();
  const reasons = new Map();
  let flops = 0;
  for (const h of hands) {
    if (h.board.flop.length !== 3) continue;
    flops++;
    const s = flopSituation(h);
    if (!s.ok) {
      reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
      continue;
    }
    const x = s.situation;
    const opener = x.opener;
    const caller = x.caller;
    const heroPos = h.heroName === x.openerName ? opener : h.heroName === x.callerName ? caller : "—";
    const villainPos = heroPos === opener ? caller : heroPos === caller ? opener : "—";
    const found = spotFor(x);
    const key = [x.pot.toUpperCase(), `${opener} open, ${caller} ${x.pot === "3bp" ? "3-bets" : "calls"}`, `Hero ${heroPos}`, `vs ${villainPos}`, `${bucketOf(x.effBb)}bb`, "spot" in found ? found.spot.spot_id : `(${found.reason})`].join(" | ");
    combos.set(key, (combos.get(key) ?? 0) + 1);
  }
  const top = [...combos].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n== ${label}: ${hands.length} hands, ${flops} reach the flop`);
  console.log("   not heads-up SRP/3-bet:", Object.fromEntries([...reasons].sort((a, b) => b[1] - a[1])));
  for (const [k, n] of top) console.log(`   ${String(n).padStart(4)}  ${k}`);
  return combos;
}

function localHands() {
  const out = [];
  const fx = path.join(FRONTEND, "lib/handHistory/__tests__/fixtures");
  if (fs.existsSync(fx)) {
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".txt") && files.push(path.join(d, e.name))));
    walk(fx);
    const r = parseTexts(files.map((f) => ({ fileName: path.basename(f), text: fs.readFileSync(f, "utf8") })));
    out.push(...r.entries.map((e) => e.hand));
  }
  return out;
}

async function productionHands() {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(FRONTEND, "../backend/.env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const hands = [];
  // Only hands with a flop; the parsed hand (data) is all the classifier needs. Kept in memory only.
  for (let from = 0; ; from += 500) {
    const r = await fetch(`${url}/rest/v1/hh_hands?select=data&board=not.eq.%7B%7D&order=id&limit=500&offset=${from}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`production read failed: HTTP ${r.status}`);
    const rows = await r.json();
    hands.push(...rows.map((x) => x.data).filter((d) => d?.board?.flop));
    if (rows.length < 500) break;
  }
  return hands;
}

const example = parseTexts([{ fileName: "example.txt", text: EXAMPLE_HAND_TEXTS.join("\n\n\n") }]).entries.map((e) => e.hand);
tally(example, "Example tournament");
const local = localHands();
if (local.length) tally(local, "Local test exports (private GG export + public PokerStars samples)");
if (process.argv.includes("--production")) {
  const prod = await productionHands();
  tally(prod, "Production: all imported hands (aggregated)");
}
console.log(`\nCatalog: ${SPOT_CATALOG.length} spots with book ranges.`);
