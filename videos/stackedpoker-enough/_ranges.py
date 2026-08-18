# -*- coding: utf-8 -*-
"""
Every range the film shows, straight out of the StackedPoker codebase.

  RFI_*             lib/learn/preflopBaselines.ts   RFI_SEMANTICS
                    { kind: 'binary', action: 'raise', complement: 'fold' }
  DEFEND_*          lib/learn/defendBaselines.ts    DEFEND_SEMANTICS
                    { kind: 'action_slice', action: 'call' }
  THREEBET_*        lib/learn/threebetBaselines.ts  THREEBET_SEMANTICS
                    { kind: 'action_slice', action: '3bet' }

Colours are actionStyles.ts's ACTION_CSS_COLOR — the same table the product's own
grid reads. A binary source paints its complement FOLD; an action slice paints it
OTHER, because an absent hand there proves 0% of the tracked action, never a fold.
"""
import io, json, os, sys

_HERE = os.path.dirname(os.path.abspath(__file__))
RAW = json.load(io.open(os.path.join(_HERE, "_ranges.json"), encoding="utf-8"))

# actionStyles.ts -> ACTION_CSS_COLOR
COLOR = {
    "raise": "rgb(139,92,246)",
    "3bet":  "rgb(139,92,246)",
    "call":  "rgb(16,185,129)",
    "fold":  "rgba(148,163,184,0.35)",
    "other": "rgba(100,116,139,0.7)",
}
LABEL = {"raise": "Raise", "3bet": "3-Bet", "call": "Call",
         "fold": "Fold", "other": "Other action"}

RANKS = "AKQJT98765432"


def parse(entries):
    """'TT:0.4' -> ('TT', 0.4); no suffix means 1.0 (threebetBaselines.ts)."""
    out = {}
    for e in entries:
        if ":" in e:
            h, f = e.split(":")
            out[h.strip()] = float(f)
        else:
            out[e.strip()] = 1.0
    return out


class Range:
    def __init__(self, key, action, complement, title, highlight=None):
        self.freq = parse(RAW[key])
        self.action, self.complement = action, complement
        self.title, self.highlight = title, highlight

    def cell(self, hand):
        """(action fraction, action colour, complement colour) for one hand."""
        return self.freq.get(hand, 0.0), COLOR[self.action], COLOR[self.complement]

    def legend(self):
        return [(COLOR[self.action], LABEL[self.action]),
                (COLOR[self.complement], LABEL[self.complement])]


# ── the film's ranges, in the order it shows them ──────────────────────────
HERO = Range("THREEBET_BTN_VS_CO", "3bet", "other",
             "BTN 3-BET RANGE vs CO OPEN", highlight="A5s")

# UTG -> CO -> BTN is not a slideshow: it IS the lesson's own argument, that the
# opener's position is evidence about their range strength. 22 hands, then 48,
# then 78, on one grid that never moves.
MONTAGE = [
    Range("RFI_UTG", "raise", "fold", "UTG OPENING RANGE"),
    Range("RFI_CO",  "raise", "fold", "CO OPENING RANGE"),
    Range("RFI_BTN", "raise", "fold", "BTN OPENING RANGE"),
    Range("DEFEND_BB_VS_BTN", "call", "other", "BB DEFENDING RANGE vs BTN"),
]

COUNTS = {k: len(v) for k, v in RAW.items()}


def hand_name(r, c):
    a, b = RANKS[r], RANKS[c]
    if r == c:
        return a + a
    return (a + b + "s") if c > r else (b + a + "o")


def grid_html(rng, idp, build):
    """One 13x13 grid. Every cell is built by the same rule: a solid block of the
    action colour exactly as wide as the hand's frequency, over the complement.
    No opacity, no glow, no per-cell lighting."""
    rows = []
    for r in range(13):
        cells = [f'<div class="sp-range-rowlabel">{RANKS[r]}</div>']
        for c in range(13):
            h = hand_name(r, c)
            f, ac, cc = rng.cell(h)
            layer = (f'<div class="sp-act" style="width:{f * 100:g}%;background:{ac}"></div>'
                     if f > 0 else "")
            cell = (f'<div class="sp-cell" data-hand="{h}" style="background:{cc}">'
                    f'{layer}<span>{h}</span></div>')
            if rng.highlight and h == rng.highlight:
                cell = (f'<div class="sp-cellwrap">{cell}'
                        f'<div class="sp-ring" id="{idp}-ring"></div></div>')
            cells.append(cell)
        rows.append('<div class="sp-range-row">' + "".join(cells) + "</div>")
    cols = "".join(f'<div class="sp-range-col">{r}</div>' for r in RANKS)
    legend = "".join(
        f'<div class="sp-legend-item"><div class="sp-legend-sw" style="background:{c}"></div>'
        f'<span class="sp-legend-tx">{l}</span></div>' for c, l in rng.legend())
    return (f'<div class="sp-range" id="{idp}">'
            f'<div class="sp-range-title" id="{idp}-title">{rng.title}</div>'
            f'<div class="sp-range-grid">'
            f'<div class="sp-range-cols">{cols}</div>' + "".join(rows) + "</div>"
            f'<div class="sp-range-legend" id="{idp}-legend">{legend}</div></div>')
