"""Single-raised-pot spots derived from the book's preflop charts (app/flop_equity/derive.py)."""
import json

import pytest

from app.flop_equity import derive
from app.flop_equity.compute import DATA

DERIVED = {e["spot_id"]: (e, b) for e, b in derive.derived_spots()}


@pytest.mark.parametrize("spot_id", ["srp_bb_vs_bn_40", "srp_bb_vs_utg_40"])
def test_derivation_reproduces_the_books_own_srp_ranges_exactly(spot_id):
    # The postflop chapters print these two spots; deriving them from the preflop
    # charts must give the very same ranges (validates the method).
    book = json.loads((DATA / "ranges" / f"{spot_id}.json").read_text(encoding="utf-8"))
    _, body = DERIVED[spot_id]
    for side in ("ip", "oop"):
        a, b = book[side]["range"], body[side]["range"]
        assert book[side]["player"] == body[side]["player"]
        assert max(abs(a.get(h, 0) - b.get(h, 0)) for h in set(a) | set(b)) < 1e-9


def test_range_files_spots_and_catalog_are_up_to_date():
    assert derive.main(check=True) == 0


def test_no_spot_without_both_charts():
    # The book has no BB defence chart against an HJ open, and the SB has no
    # raise-to-play option at 15bb: those spots must not exist.
    assert not any(s.startswith("srp_bb_vs_hj_") for s in DERIVED)
    assert "srp_bb_vs_sb_15" not in DERIVED


def test_positions_and_pfr_in_the_catalog():
    cat = {r["spot_id"]: r for r in json.loads(derive.CATALOG.read_text(encoding="utf-8"))}
    assert cat["srp_bb_vs_sb_25"] | {} == {**cat["srp_bb_vs_sb_25"], "ip": "BB", "oop": "SB", "pfr": "SB", "pot": "srp"}
    assert cat["cc_co_vs_bn_40"]["pfr"] == "CO" and cat["cc_co_vs_bn_40"]["ip"] == "BN"
    assert cat["3bp_bb_vs_bn_40"]["pfr"] == "BB" and cat["3bp_bb_vs_bn_40"]["pot"] == "3bp"
    assert cat["srp_bb_vs_bn_40"]["derived"] is False and cat["srp_bb_vs_co_25"]["derived"] is True


def test_every_derived_range_cites_its_charts():
    for entry, body in DERIVED.values():
        for side in ("ip", "oop"):
            src = body[side]["derived_from"][0]
            assert src["page"] > 0 and src["hand_range"] > 0
        assert len(entry["range_pages"]) == 2
