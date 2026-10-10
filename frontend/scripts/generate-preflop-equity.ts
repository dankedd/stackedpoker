/**
 * Builds data/equity/preflop-matchups.json: the exact preflop equity of every
 * suit-isomorphic hand-vs-hand matchup (lib/equity/matchupKey.ts), each one a
 * full enumeration of all 1,712,304 boards with the site's own evaluator
 * (lib/tools/equity.ts). No sampling, no third-party numbers.
 *
 *   node scripts/run-ts.js scripts/generate-preflop-equity.ts            # all cores
 *   PREFLOP_EQ_WORKERS=4 node scripts/run-ts.js scripts/generate-preflop-equity.ts
 *
 * ~47,000 matchups × ~0.5 s ≈ 6.5 CPU-hours; split over worker processes.
 * A crashed run resumes: finished shards are kept in data/equity/.shards/.
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { cpus } from "os";
import { join, resolve } from "path";
import { matchupKey, keyHands } from "@/lib/equity/matchupKey";
import { FULL_DECK } from "@/lib/tools/cards";
import { calculateEquity } from "@/lib/tools/equity";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "equity");
const SHARD_DIR = join(OUT_DIR, ".shards");
const OUT_FILE = join(OUT_DIR, "preflop-matchups.json");
const BOARDS = 1_712_304;

export function allMatchupKeys(): string[] {
  const set = new Set<string>();
  const combos: [string, string][] = [];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) combos.push([FULL_DECK[i], FULL_DECK[j]]);
  for (let i = 0; i < combos.length; i++) {
    const h = combos[i];
    for (let j = i + 1; j < combos.length; j++) {
      const v = combos[j];
      if (h[0] === v[0] || h[0] === v[1] || h[1] === v[0] || h[1] === v[1]) continue;
      set.add(matchupKey(h, v).key);
    }
  }
  return [...set].sort();
}

function runShard(index: number, count: number): void {
  const keys = allMatchupKeys().filter((_, i) => i % count === index);
  const win: number[] = [];
  const tie: number[] = [];
  const started = Date.now();
  keys.forEach((key, n) => {
    const [h, v] = keyHands(key);
    const r = calculateEquity(h, v, []);
    if (r.boardsEvaluated !== BOARDS) throw new Error(`unexpected board count for ${key}`);
    win.push(Math.round((r.heroWinPct / 100) * BOARDS));
    tie.push(Math.round((r.tiePct / 100) * BOARDS));
    if (n % 500 === 0) {
      const rate = (Date.now() - started) / (n + 1);
      process.stdout.write(`[shard ${index}] ${n}/${keys.length} · ~${Math.round(((keys.length - n) * rate) / 60000)} min left\n`);
    }
  });
  writeFileSync(join(SHARD_DIR, `${index}-of-${count}.json`), JSON.stringify({ keys, win, tie }));
}

async function runAll(): Promise<void> {
  const count = Number(process.env.PREFLOP_EQ_WORKERS) || Math.max(1, cpus().length - 2);
  mkdirSync(SHARD_DIR, { recursive: true });
  const runner = join(ROOT, "scripts", "run-ts.js");
  const pending = Array.from({ length: count }, (_, i) => i).filter((i) => !existsSync(join(SHARD_DIR, `${i}-of-${count}.json`)));
  console.log(`${count} shards, ${pending.length} to compute`);
  await Promise.all(
    pending.map(
      (i) =>
        new Promise<void>((ok, fail) => {
          const child = spawn(process.execPath, [runner, __filename], {
            env: { ...process.env, PREFLOP_EQ_SHARD: `${i}/${count}` },
            stdio: "inherit",
          });
          child.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`shard ${i} exited with ${code}`))));
        }),
    ),
  );

  const merged = new Map<string, [number, number]>();
  for (let i = 0; i < count; i++) {
    const s = JSON.parse(readFileSync(join(SHARD_DIR, `${i}-of-${count}.json`), "utf8")) as { keys: string[]; win: number[]; tie: number[] };
    s.keys.forEach((k, n) => merged.set(k, [s.win[n], s.tie[n]]));
  }
  const keys = [...merged.keys()].sort();
  writeFileSync(
    OUT_FILE,
    JSON.stringify({
      boards: BOARDS,
      keys: keys.join(","),
      win: keys.map((k) => merged.get(k)![0]),
      tie: keys.map((k) => merged.get(k)![1]),
    }),
  );
  rmSync(SHARD_DIR, { recursive: true, force: true });
  console.log(`wrote ${keys.length} matchups to ${OUT_FILE}`);
}

export function main(): void {
  const shard = process.env.PREFLOP_EQ_SHARD;
  if (shard) {
    const [i, n] = shard.split("/").map(Number);
    runShard(i, n);
    return;
  }
  runAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
