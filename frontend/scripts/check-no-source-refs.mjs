#!/usr/bin/env node
/**
 * Fails when anything a visitor can download names the theory source: the
 * book, its author, chapters, diagrams, hand-range or page numbers.
 *
 * Runs after `next build` (npm "postbuild"), so a hit fails the deploy. Scans
 * every text file in .next/static and .next/server (JS chunks, prerendered
 * HTML, RSC payloads, JSON) and public/.
 *
 *   node scripts/check-no-source-refs.mjs            # scan the local build
 *   node scripts/check-no-source-refs.mjs --url URL  # scan a deployed site's HTML + JS chunks
 *
 * Backend, database and data/mpt keep their references; they never ship here.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");

export const PATTERNS = [
  // The numbered form is the book's figure label ("Hand Range 125"). A bare
  // "hand range" is ordinary poker language ("a made-hand range") and is fine.
  /hand ranges? ?#?\d/gi,
  /\bHR ?\d/gi,
  /\bp\. ?\d/gi,
  /\bpages? \d/gi,
  /modern poker theory/gi,
  /acevedo/gi,
  /\bchapter \d/gi,
  /\bdiagram \d/gi,
  /\bthe book\b/gi,
];

/**
 * Known false positives: [file regex, snippet regex, why]. Keep this short;
 * every entry needs a reason a reviewer can check.
 */
const ALLOW = [];

const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".html", ".json", ".rsc", ".body", ".txt", ".xml", ".css", ".map", ".md", ".svg", ".webmanifest", ".meta"]);
// Build bookkeeping and the webpack cache are never served.
const SKIP_DIRS = new Set(["cache", "trace", "types", "diagnostics"]);
// Source maps are not deployed to visitors (productionBrowserSourceMaps is off).
const SKIP_EXT = new Set([".map"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p);
    } else if (TEXT_EXT.has(extname(name)) && !SKIP_EXT.has(extname(name))) {
      yield p;
    }
  }
}

export function scanText(label, text) {
  const hits = [];
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      const snippet = text.slice(Math.max(0, at - 60), at + m[0].length + 60).replace(/\s+/g, " ");
      if (ALLOW.some(([f, s]) => f.test(label) && s.test(snippet))) continue;
      hits.push({ file: label, match: m[0], snippet });
    }
  }
  return hits;
}

function scanLocal() {
  const dist = join(ROOT, process.env.NEXT_DIST_DIR || ".next");
  const dirs = [join(dist, "static"), join(dist, "server"), join(ROOT, "public")].filter(existsSync);
  if (!existsSync(join(dist, "BUILD_ID"))) {
    console.error(`check-no-source-refs: no production build in ${dist} — run \`next build\` first.`);
    process.exit(2);
  }
  const hits = [];
  let files = 0;
  for (const d of dirs) {
    for (const f of walk(d)) {
      files++;
      const buf = readFileSync(f);
      // Binary files (OG images are written as `.body`) only match by accident.
      if (buf.subarray(0, 8000).includes(0)) continue;
      hits.push(...scanText(relative(ROOT, f).replaceAll("\\", "/"), buf.toString("utf8")));
    }
  }
  return { hits, files };
}

async function scanUrl(base) {
  const seen = new Set();
  const hits = [];
  const pages = ["/", "/hands/example", "/preflop-trainer", "/flop-trainer", "/ranges", "/llms.txt", "/ai-sitemap.json", "/sitemap.xml"];
  const queue = pages.map((p) => new URL(p, base).href);
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(url);
    if (!res.ok) continue;
    const text = await res.text();
    hits.push(...scanText(url, text));
    // Follow every same-origin JS chunk the HTML (or a chunk) references.
    for (const m of text.matchAll(/\/_next\/static\/[^"'\\\s)]+?\.js/g)) {
      const u = new URL(m[0], base).href;
      if (!seen.has(u)) queue.push(u);
    }
  }
  return { hits, files: seen.size };
}

// Imported by scripts/e2e-no-source-refs.mjs for its patterns: only scan when run.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const urlArg = process.argv.indexOf("--url");
  const { hits, files } = urlArg > -1 ? await scanUrl(process.argv[urlArg + 1]) : scanLocal();

  if (hits.length) {
    console.error(`check-no-source-refs: ${hits.length} source reference(s) in ${new Set(hits.map((h) => h.file)).size} file(s) (${files} scanned):\n`);
    for (const h of hits.slice(0, 200)) console.error(`  ${h.file}\n    "${h.match}" … ${h.snippet}\n`);
    if (hits.length > 200) console.error(`  … and ${hits.length - 200} more`);
    process.exit(1);
  }
  console.log(`check-no-source-refs: 0 hits in ${files} files.`);
}
