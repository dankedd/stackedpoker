"""Precompute every flop for the given spots.

usage (from backend/):
  python -m app.flop_equity.precompute --spots srp_bb_vs_bn_40,srp_bb_vs_utg_40 --workers 12

Writes one JSON line per flop to data/mpt/precomputed/<spot_id>.jsonl (git-
ignored). Re-running resumes: flops already in the file are skipped.
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from .cards import all_flops
from .compute import DATA, Spot, analyse

OUT = DATA / "precomputed"


def _work(args: tuple[str, str, int]) -> dict:
    spot_id, flop, weight = args
    t = time.time()
    row = analyse(Spot.load(spot_id), flop)
    row["flop_weight"] = weight
    row["seconds"] = round(time.time() - t, 2)
    return row


def run(spot_ids: list[str], workers: int, limit: int | None = None) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    flops = all_flops()
    for spot_id in spot_ids:
        path = OUT / f"{spot_id}.jsonl"
        done = set()
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    done.add(json.loads(line)["flop"])
        todo = [(spot_id, f, w) for f, w in flops if f not in done][:limit]
        print(f"{spot_id}: {len(done)} done, {len(todo)} to go", flush=True)
        t0 = time.time()
        with ProcessPoolExecutor(max_workers=workers) as pool, path.open("a", encoding="utf-8") as out:
            futures = [pool.submit(_work, a) for a in todo]
            for n, fut in enumerate(as_completed(futures), 1):
                out.write(json.dumps(fut.result(), separators=(",", ":")) + "\n")
                out.flush()
                if n % 100 == 0 or n == len(todo):
                    el = time.time() - t0
                    print(f"  {n}/{len(todo)}  {el / 60:.1f} min  (~{el / n * (len(todo) - n) / 60:.0f} min left)", flush=True)
        print(f"{spot_id}: finished in {(time.time() - t0) / 60:.1f} min", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--spots", required=True)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    run(a.spots.split(","), a.workers, a.limit)
