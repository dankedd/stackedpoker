"""Load precomputed flop data into Supabase (after supabase_flop_equity.sql ran).

usage (from backend/, uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env):
  python -m app.flop_equity.load --spots srp_bb_vs_bn_40,srp_bb_vs_utg_40
  python -m app.flop_equity.load --check-catalog [--fix]

Idempotent: upserts on the primary keys. A loaded spot is marked
`precomputed: true` in frontend/lib/flopTrainer/spotCatalog.json, so Hand
Review knows which matched spots have data ("coming soon" for the rest).
--check-catalog compares those flags with the spots actually in Supabase.
"""

from __future__ import annotations

import argparse
import json
import time

import httpx

from app.config import get_settings

from .compute import DATA
from .derive import CATALOG

BATCH = 150


def _headers(key: str) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"}


# flop_equity_hands rows carry every hand class's equity for both sides (~15 KB
# each): smaller batches, or the API drops the connection on big requests.
HANDS_BATCH = 20
RETRIES = 5


def _upsert(client: httpx.Client, url: str, key: str, table: str, rows: list[dict], conflict: str, batch: int = BATCH) -> None:
    # on_conflict is a query parameter (not part of Prefer) — see skill_assessment.py.
    for i in range(0, len(rows), batch):
        for attempt in range(RETRIES):
            try:
                r = client.post(f"{url}/rest/v1/{table}?on_conflict={conflict}", headers=_headers(key), json=rows[i : i + batch])
            except httpx.TransportError as e:  # dropped connection, timeout: an upsert is safe to repeat
                if attempt == RETRIES - 1:
                    raise SystemExit(f"{table}: rows {i}-{i + batch}: {type(e).__name__} after {RETRIES} tries")
                time.sleep(2**attempt)
                continue
            if r.status_code >= 500 and attempt < RETRIES - 1:
                time.sleep(2**attempt)
                continue
            if r.status_code >= 300:
                raise SystemExit(f"{table}: HTTP {r.status_code} {r.text[:300]}")
            break


def load(spot_ids: list[str]) -> None:
    s = get_settings()
    spots = {x["spot_id"]: x for x in json.loads((DATA / "spots.json").read_text(encoding="utf-8"))["spots"]}
    with httpx.Client(timeout=120) as client:
        for sid in spot_ids:
            sp = spots[sid]
            rng = json.loads((DATA / "ranges" / f"{sid}.json").read_text(encoding="utf-8"))
            # The spot row first: flop_equity and flop_equity_hands reference it (foreign key).
            # Hand Review only trusts a spot once _set_flags marks it precomputed, after all its flops.
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
            _upsert(client, s.supabase_url, s.supabase_service_role_key, "flop_equity_hands", hands, "spot_id,flop", HANDS_BATCH)
            print(f"{sid}: {len(rows)} flops loaded")
            _set_flags({sid: True})


def _set_flags(flags: dict[str, bool]) -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    for row in cat:
        if row["spot_id"] in flags:
            row["precomputed"] = flags[row["spot_id"]]
    CATALOG.write_text(json.dumps(cat, indent=1) + "\n", encoding="utf-8")


def check_catalog(fix: bool) -> int:
    """Every catalog spot must be in Supabase (precomputed: true) or say precomputed: false."""
    s = get_settings()
    r = httpx.get(f"{s.supabase_url}/rest/v1/flop_spots?select=spot_id", headers=_headers(s.supabase_service_role_key), timeout=60)
    r.raise_for_status()
    loaded = {x["spot_id"] for x in r.json()}
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    ids = {row["spot_id"] for row in cat}
    wrong = {row["spot_id"]: row["spot_id"] in loaded for row in cat if bool(row.get("precomputed")) != (row["spot_id"] in loaded)}
    print(f"catalog: {len(cat)} spots, {len(loaded & ids)} in Supabase, {len(ids - loaded)} precomputed: false")
    extra = sorted(loaded - ids)
    if extra:
        print(f"in Supabase but not in the catalog: {', '.join(extra)}")
    if not wrong:
        print("every flag matches Supabase")
        return 0
    print(("fixed: " if fix else "flag differs from Supabase: ") + ", ".join(f"{k}->{v}" for k, v in sorted(wrong.items())))
    if fix:
        _set_flags(wrong)
        return 0
    return 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--spots")
    ap.add_argument("--check-catalog", action="store_true")
    ap.add_argument("--fix", action="store_true")
    a = ap.parse_args()
    if a.check_catalog:
        raise SystemExit(check_catalog(a.fix))
    if not a.spots:
        ap.error("give --spots or --check-catalog")
    load(a.spots.split(","))
