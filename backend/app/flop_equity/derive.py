"""Single-raised-pot spots derived from the book's preflop charts.

The postflop chapters only print ranges for a few spots (data/mpt/spots.json,
Phase 0). Every other heads-up single-raised pot is still fully described by
the book's preflop charts — the same ones the Preflop Trainer shows
(frontend/data/ranges, extracted from Modern Poker Theory chapters 5 and 7):

  opener's range  = the "raise" share of the opener's open chart (all-in and
                    limp shares are other lines, not this spot)
  caller's range  = the "call" share of the caller's defense chart against
                    that opener at that stack

That is an exact derivation (no new numbers), the same method Phase 0 used for
the 3-bet-pot callers. Spots whose charts are missing in the book (e.g. BB vs
HJ, SB opens at 15bb) are simply not produced.

usage (from backend/):
  python -m app.flop_equity.derive            # writes the range files + catalog
  python -m app.flop_equity.derive --check    # fails if anything is out of date
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .compute import DATA

ROOT = DATA.parents[1]
CHARTS = ROOT / "frontend" / "data" / "ranges"
CATALOG = ROOT / "frontend" / "lib" / "flopTrainer" / "spotCatalog.json"

# Postflop order: who acts last on the flop is in position.
POSTFLOP_ORDER = ["SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN"]
SLUG = {"UTG+1": "utgp1", "UTG+2": "utgp2"}


def slug(pos: str) -> str:
    return SLUG.get(pos, pos.lower())


def _range(chart: dict, key: str) -> dict[str, float]:
    keys = [a["key"] for a in chart["actions"]]
    if key not in keys:
        return {}
    i = keys.index(key)
    out = {}
    for hand, row in chart["grid"].items():
        if row and row[i] > 0:
            out[hand] = round(row[i], 4)
    return out


def _pct(rng: dict[str, float]) -> float:
    def combos(h: str) -> int:
        return 6 if len(h) == 2 else 4 if h.endswith("s") else 12

    return round(100 * sum(f * combos(h) for h, f in rng.items()) / 1326, 1)


def derived_spots() -> list[tuple[dict, dict]]:
    """(spots.json entry, ranges/<id>.json body) for every derivable heads-up SRP."""
    opens = [c for c in json.loads((CHARTS / "open.json").read_text(encoding="utf-8")) if c["group"] == "mtt"]
    defs = [c for c in json.loads((CHARTS / "defense.json").read_text(encoding="utf-8")) if c["group"] == "mtt" and c["spot"] == "open"]
    out = []
    for d in defs:
        caller, opener, stack = d["hero"], d["vil"], d["stack"]
        o = next((c for c in opens if c["pos"] == opener and c["stack"] == stack), None)
        if not o:
            continue
        ip_pos = max(caller, opener, key=POSTFLOP_ORDER.index)
        opener_rng = _range(o, "raise")
        caller_rng = _range(d, "call")
        if not opener_rng or not caller_rng:
            continue
        blind = caller in ("BB", "SB")
        spot_id = f"srp_{slug(caller)}_vs_{slug(opener)}_{stack}" if blind else f"cc_{slug(opener)}_vs_{slug(caller)}_{stack}"
        side = lambda pos, rng, chart, action: {  # noqa: E731
            "player": pos,
            "range": rng,
            "derived_from": [{"hand_range": chart.get("n") or int(str(chart["hr"]).split()[-1]), "page": chart["page"], "action": action, "via": "preflop trainer chart"}],
            "pct_of_hands": _pct(rng),
        }
        opener_side = side(opener, opener_rng, o, "raise")
        caller_side = side(caller, caller_rng, d, "call")
        ip, oop = (opener_side, caller_side) if ip_pos == opener else (caller_side, opener_side)
        size = next((a["label"].replace("Raise ", "") for a in o["actions"] if a["key"] == "raise"), None)
        entry = {
            "spot_id": spot_id,
            "type": "srp" if blind else "cold_call",
            "game": "MTT",
            "table": "9-max, 12.5% ante",
            "stack_bb": stack,
            "ip": ip["player"],
            "oop": oop["player"],
            "preflop": f"{opener} opens {size or ''}, {caller} calls, heads-up".replace("  ", " "),
            "open_size": size,
            "status": "ready",
            "range_pages": [o["page"], d["page"]],
            "derived": True,
            "notes": ["Derived from the book's preflop charts: opener's raise share x caller's call share (exact derivation)."],
        }
        body = {
            "spot_id": spot_id,
            "notation": "hand class -> frequency (0-1): the share of that hand class's combos that are in the range",
            "ip": ip,
            "oop": oop,
        }
        out.append((entry, body))
    return out


def catalog(spots: list[dict], precomputed: dict[str, bool] | None = None) -> list[dict]:
    """What the frontend matcher needs: structure, positions, stack and who raised last preflop.

    `precomputed` carries each spot's flag over from the current catalog: it is
    set by load.py once a spot's flops are in Supabase, never guessed here.
    """
    precomputed = precomputed or {}
    rows = []
    for s in spots:
        if s.get("status") != "ready" or not s.get("ip") or not s.get("oop"):
            continue
        t = s["type"]
        # The preflop aggressor: the 3-bettor in 3-bet pots (3bp_<3-bettor>_vs_<opener>),
        # the opener otherwise (srp_<caller>_vs_<opener>, cc_<opener>_vs_<caller>).
        parts = s["spot_id"].split("_")
        pfr = parts[1] if t in ("3bet", "cold_call") else parts[3]
        pos_by_slug = {slug(p): p for p in POSTFLOP_ORDER}
        pfr_pos = pos_by_slug.get(pfr, pfr.upper())
        rows.append({
            "spot_id": s["spot_id"],
            "pot": "3bp" if t == "3bet" else "srp",
            "ip": s["ip"],
            "oop": s["oop"],
            "pfr": pfr_pos,
            "stack_bb": s["stack_bb"],
            "derived": bool(s.get("derived")),
            "precomputed": bool(precomputed.get(s["spot_id"], False)),
        })
    return sorted(rows, key=lambda r: r["spot_id"])


def main(check: bool) -> int:
    spots_path = DATA / "spots.json"
    doc = json.loads(spots_path.read_text(encoding="utf-8"))
    book = [s for s in doc["spots"] if not s.get("derived")]
    have = {s["spot_id"] for s in book}
    changed = []
    derived = []
    for entry, body in derived_spots():
        if entry["spot_id"] in have:
            continue  # the postflop chapters' own spot wins (srp_bb_vs_bn_40, srp_bb_vs_utg_40, cc_*_40)
        derived.append(entry)
        path = DATA / "ranges" / f"{entry['spot_id']}.json"
        text = json.dumps(body, indent=1) + "\n"
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            changed.append(path.name)
            if not check:
                path.write_text(text, encoding="utf-8")
    new_doc = {**doc, "spots": book + sorted(derived, key=lambda s: s["spot_id"])}
    spots_text = json.dumps(new_doc, indent=1, ensure_ascii=False) + "\n"
    if spots_path.read_text(encoding="utf-8") != spots_text:
        changed.append("spots.json")
        if not check:
            spots_path.write_text(spots_text, encoding="utf-8")
    flags = {r["spot_id"]: bool(r.get("precomputed")) for r in json.loads(CATALOG.read_text(encoding="utf-8"))} if CATALOG.exists() else {}
    cat_text = json.dumps(catalog(new_doc["spots"], flags), indent=1) + "\n"
    if not CATALOG.exists() or CATALOG.read_text(encoding="utf-8") != cat_text:
        changed.append(str(CATALOG.relative_to(ROOT)))
        if not check:
            CATALOG.write_text(cat_text, encoding="utf-8")
    print(f"{len(derived)} derived spots; {'out of date: ' if check else 'written: '}{', '.join(changed) or 'nothing'}")
    return 1 if check and changed else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    sys.exit(main(ap.parse_args().check))
