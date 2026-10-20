"""Load precomputed flop data into Supabase (after supabase_flop_equity.sql ran).

usage (from backend/, uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env):
  python -m app.flop_equity.load --spots srp_bb_vs_bn_40,srp_bb_vs_utg_40

Idempotent: upserts on the primary keys.
"""

from __future__ import annotations

import argparse
import json

import httpx

from app.config import get_settings

from .compute import DATA

BATCH = 150


def _headers(key: str) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"}


def _upsert(client: httpx.Client, url: str, key: str, table: str, rows: list[dict], conflict: str) -> None:
    # on_conflict is a query parameter (not part of Prefer) — see skill_assessment.py.
    for i in range(0, len(rows), BATCH):
        r = client.post(f"{url}/rest/v1/{table}?on_conflict={conflict}", headers=_headers(key), json=rows[i : i + BATCH])
        if r.status_code >= 300:
            raise SystemExit(f"{table}: HTTP {r.status_code} {r.text[:300]}")


def load(spot_ids: list[str]) -> None:
    s = get_settings()
    spots = {x["spot_id"]: x for x in json.loads((DATA / "spots.json").read_text(encoding="utf-8"))["spots"]}
    with httpx.Client(timeout=120) as client:
        for sid in spot_ids:
            sp = spots[sid]
            rng = json.loads((DATA / "ranges" / f"{sid}.json").read_text(encoding="utf-8"))
            _upsert(client, s.supabase_url, s.supabase_service_role_key, "flop_spots", [{
                "spot_id": sid, "spot_type": sp["type"], "ip": sp["ip"], "oop": sp["oop"], "stack_bb": sp["stack_bb"],
                "action": sp["preflop"], "ip_range_pct": rng["ip"]["pct_of_hands"], "oop_range_pct": rng["oop"]["pct_of_hands"],
                "source_pages": sp.get("range_pages", []),
            }], "spot_id")
            rows, hands = [], []
            for line in (DATA / "precomputed" / f"{sid}.jsonl").read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                d = json.loads(line)
                rows.append({k: d[k] for k in ("spot_id", "flop", "equity_ip", "equity_oop", "buckets_ip", "buckets_oop",
                                                "nut_adv", "hand_classes", "texture")} | {"flop_weight": d["flop_weight"]})
                hands.append({"spot_id": sid, "flop": d["flop"], "hands": d["hands"]})
            if len(rows) != 1755:
                raise SystemExit(f"{sid}: {len(rows)} flops precomputed, expected 1755 — finish the precompute first")
            _upsert(client, s.supabase_url, s.supabase_service_role_key, "flop_equity", rows, "spot_id,flop")
            _upsert(client, s.supabase_url, s.supabase_service_role_key, "flop_equity_hands", hands, "spot_id,flop")
            print(f"{sid}: {len(rows)} flops loaded")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--spots", required=True)
    load(ap.parse_args().spots.split(","))
