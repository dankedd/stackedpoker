#!/usr/bin/env node
/**
 * Builds the data files the browser bundles from their canonical copies,
 * leaving out every field that points at the printed source (page, hand-range
 * number, chart title, book name, notes that cite pages).
 *
 *   preflop charts  backend/app/engines/preflop_trainer/data/*.json
 *                   → frontend/data/ranges/*.json
 *   c-bet profiles  data/mpt/cbet_profiles.json
 *                   → frontend/lib/flopTrainer/cbetProfiles.json
 *
 * Each preflop chart also gets a stable `id` ("open_mtt_lj_25", "push_sb",
 * "def_mtt_bb_vs_bn_open_25"), written into the canonical files too, so the
 * backend resolves what the browser sends.
 *
 *   node scripts/build-client-data.mjs           # write
 *   node scripts/build-client-data.mjs --check   # fail if anything is stale
 *
 * Re-run after changing a canonical file. lib/ranges/__tests__/backendData.test.ts
 * and backend/tests/test_flop_trainer.py fail when the copies drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FRONTEND = join(import.meta.dirname, "..");
const REPO = join(FRONTEND, "..");
const CHARTS = join(REPO, "backend", "app", "engines", "preflop_trainer", "data");

/** Preflop chart fields that identify the printed source; kept server-side only. */
export const CHART_SOURCE_FIELDS = ["page", "hr", "n", "title"];
/** C-bet profile keys that cite the source, at any depth. */
export const CBET_SOURCE_KEYS = ["source", "note", "size_rules_note", "page", "pages", "book_flop"];

const slug = (s) => s.toLowerCase().replace(/\+/g, "").replace(/[^a-z0-9]+/g, "_");

export const chartId = {
  open: (c) => `open_${c.group}_${slug(c.pos)}_${c.stack}`,
  pushfold: (c) => `push_${slug(c.pos)}`,
  defense: (c) => `def_${c.group}_${slug(c.hero)}_vs_${slug(c.vil)}_${c.spot}_${c.stack}`,
};

function strip(value, keys) {
  if (Array.isArray(value)) return value.map((v) => strip(v, keys));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)).map(([k, v]) => [k, strip(v, keys)]));
  }
  return value;
}

const check = process.argv.includes("--check");
let stale = false;

function write(file, text) {
  if (readFileSync(file, "utf8") === text) return;
  if (check) {
    console.error(`stale: ${file}`);
    stale = true;
  } else {
    writeFileSync(file, text);
    console.log(`wrote ${file}`);
  }
}

for (const kind of ["open", "pushfold", "defense"]) {
  const canonical = JSON.parse(readFileSync(join(CHARTS, `${kind}.json`), "utf8"));
  const ids = new Set();
  const withId = canonical.map((c) => {
    const id = chartId[kind](c);
    if (ids.has(id)) throw new Error(`duplicate chart id ${id} in ${kind}.json`);
    ids.add(id);
    const { id: _old, ...rest } = c;
    return { id, ...rest };
  });
  write(join(CHARTS, `${kind}.json`), JSON.stringify(withId));
  write(join(FRONTEND, "data", "ranges", `${kind}.json`), JSON.stringify(strip(withId, CHART_SOURCE_FIELDS)));
}

const cbet = JSON.parse(readFileSync(join(REPO, "data", "mpt", "cbet_profiles.json"), "utf8"));
write(join(FRONTEND, "lib", "flopTrainer", "cbetProfiles.json"), JSON.stringify(strip(cbet, CBET_SOURCE_KEYS), null, 1) + "\n");

if (stale) process.exit(1);
