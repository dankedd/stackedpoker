# -*- coding: utf-8 -*-
"""The table state for lesson step `trb-final-5`, derived the way the real
component derives it.

  lesson  they-raised-back  (preflop-aggression-module)   curriculum.ts
  step    trb-final-5       decision_spot
  6-max · Hero HJ · Villain CO · 100bb
  UTG folds · HJ raises to 2.3bb · CO raises to 7.5bb
  hero_hand ['Th','Tc'] · options Call (perfect) / 4-Bet / Fold

Seat slots come from `computeHeroRotatedSeats`: positions [BTN,SB,BB,UTG,HJ,CO]
rotated so Hero lands on slot 0 (bottom-centre). heroIdx(HJ)=4, so
slot -> (4+slot)%6 gives HJ, CO, BTN, SB, BB, UTG.

Chip anchors are computed, not guessed: `bandPoint(i,6,rx=28,ry=26)` then
`pushOutOfZone(zone cx50 cy50 hw22 hh21, margin 5)`. Checked against the two
anchors already measured off the live component for the other scenario — slot 1
reproduces (23.00, 64.47) exactly.

The seat-pod offset is a flat 5.19% from the label, below for the bottom half and
above for the top half (`podAbove = railPoint.y < 50`), which is how the two
top-half pods here are placed.
"""
import math

POSITIONS = ["BTN", "SB", "BB", "UTG", "HJ", "CO"]
HERO_POS, VILLAIN_POS = "HJ", "CO"
N = 6

# label anchors per slot, measured off the live component at 390px
SLOT_LABEL = [(50.00, 88.00), (10.39, 75.57), (10.39, 24.43),
              (50.00, 12.00), (89.61, 24.43), (89.61, 75.57)]
POD_GAP = 5.19

ZONE = dict(cx=50.0, cy=50.0, hw=22.0, hh=21.0)
ZONE_MARGIN = 5.0
CHIP_RX, CHIP_RY = 28.0, 26.0


def band_point(i, rx, ry):
    a = 2 * math.pi * i / N
    return 50 - rx * math.sin(a), 50 + ry * math.cos(a)


def push_out(x, y):
    dx, dy = x - ZONE["cx"], y - ZONE["cy"]
    hw, hh = ZONE["hw"] + ZONE_MARGIN, ZONE["hh"] + ZONE_MARGIN
    reach = max(abs(dx) / hw, abs(dy) / hh)
    if reach >= 1 or reach == 0:
        return x, y
    k = 1 / reach
    return ZONE["cx"] + dx * k, ZONE["cy"] + dy * k


def chip_anchor(slot):
    return push_out(*band_point(slot, CHIP_RX, CHIP_RY))


hero_idx = POSITIONS.index(HERO_POS)
SLOT_POS = [POSITIONS[(hero_idx + s) % N] for s in range(N)]      # HJ CO BTN SB BB UTG

# committed this street, and the stack the pod shows
COMMITTED = {"SB": 0.5, "BB": 1.0, "HJ": 2.3, "CO": 7.5}
ACTED = {"HJ", "CO"}                       # a posted blind is not an action
FOLDED = {"UTG"}
STACK = 100.0
POT_BB = round(sum(COMMITTED.values()), 2)                        # 11.3


def _fmt(v):
    return f"{v:g}"


SEATS = []
for slot, pos in enumerate(SLOT_POS):
    lx, ly = SLOT_LABEL[slot]
    above = ly < 50
    my = ly - POD_GAP if above else ly + POD_GAP
    folded = pos in FOLDED
    behind = STACK - COMMITTED.get(pos, 0.0)
    shown = behind if pos in ACTED else STACK
    SEATS.append(dict(
        pos=pos, lx=lx, ly=ly,
        mx=None if folded else lx, my=None if folded else my,
        stack=f"{_fmt(shown)} BB", hero=(pos == HERO_POS),
        folded=folded, dealer=(pos == "BTN"), above=above))

CHIPS = []
for slot, pos in enumerate(SLOT_POS):
    if pos not in COMMITTED:
        continue
    cx, cy = chip_anchor(slot)
    tone = "bet" if pos in ACTED else "blind"
    CHIPS.append(dict(x=round(cx, 2), y=round(cy, 2), tone=tone,
                      amt=_fmt(COMMITTED[pos]),
                      verb="RAISE" if pos in ACTED else None))

# deriveCenterStatus: non-fold actions in order, first raise OPEN then 3-BET
CENTER_STATUS = "HJ OPEN &middot; CO 3-BET"
STATUS_LINE = "PREFLOP &middot; 100BB EFFECTIVE"

# the lesson's own option order; Call is the one marked quality:'perfect'
OPTIONS = ["Call", "4-Bet", "Fold"]
CORRECT_INDEX = 0

if __name__ == "__main__":
    print(f"slots: {SLOT_POS}")
    print(f"pot: {POT_BB} BB")
    for s in SEATS:
        print(f"  {s['pos']:4s} label({s['lx']:6.2f},{s['ly']:6.2f}) "
              f"pod({s['mx']},{s['my']}) {s['stack']:9s} "
              f"{'HERO ' if s['hero'] else ''}{'FOLDED' if s['folded'] else ''}")
    for c in CHIPS:
        print(f"  chip {c['amt']:>4s} at ({c['x']:6.2f},{c['y']:6.2f}) {c['tone']} {c['verb']}")
