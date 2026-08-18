# StackedPoker — 9:16 mobile film

`renders/mobile-9x16.mp4` — 1080×1920, 30.0s, −16.4 LUFS.

Recomposed for portrait. Nothing here is a crop, a scale-down or a squeeze of
the 16:9 cut: every scene was laid out for the phone, and the product surfaces
are the ones the product itself uses on a phone.

## The table is the product's OWN mobile table

`PreflopTable` has a `MOBILE_LAYOUT` — `aspectRatio: '3 / 4.3'`, a superellipse
rail instead of the desktop capsule, seat pods riding *outside* the rail on
their own band, chips on an inner band, and the dealer button inline beside the
position label rather than placed on the table's geometry.

That is what a 9:16 film should show, so that is what it shows. It was captured
by rendering the real component at a 390px viewport (`reference/`), and
reproduced from the component source plus that measurement:

| | |
| --- | --- |
| `reference/product-mobile-table.png` | the real component at 390px |
| `reference/film-mobile-table.png` | this film's reproduction |
| `reference/product-mobile-geometry.json` | the measured seat/chip/pot bands |

Measured A/B against the live component: **mean absolute delta 1.53 / 255**,
the residue being text antialiasing.

The options are the product's real mobile layout too — a `grid gap-3` of three
full-width `rounded-xl` buttons stacked vertically (358×54 CSS each), not the
desktop's three-across row.

## Scenes

| # | in | scene | voice |
| --- | --- | --- | --- |
| 1 | 0.0 | the real hand, large, alone | "You have a decision to make." |
| 2 | 4.0 | the portrait table builds around it | — |
| 3 | 8.5 | the question, then the three real options; 3-Bet resolves | "What would you do?" |
| 4 | 13.0 | the real range, 870px wide, cells 61px | "See the range." |
| 5 | 19.0 | the lesson's own insight (`tb-s3`) | "Understand the theory." |
| 6 | 22.5 | the AI Coach (`tb-s5`) | "And if you still don't know why — ask your coach." |
| 7 | 26.0 | the close | "StackedPoker. Learn poker by playing." |

Scene 2 is deliberately silent — the table has to be read, not narrated.

## Verified before rendering

- **Range audit** — 169 cells: one base colour, one opacity, one filter, one
  box-shadow (none), one radius, one size, one 3-bet colour, one 3-bet opacity.
  All 14 frequencies match `resolveThreebetRangeReveal()` exactly. Exactly one
  ring, on A5s, whose fill is byte-identical to AA's.
- **Safe area** — every visible element in all seven frames sits inside
  y 250…1620.
- **Seams, in the rendered file** — measured against the neighbouring frame
  boundaries, which is the only test that matters (a cut is invisible when it is
  no different from an ordinary boundary):

| seam | at the cut | neighbours |
| --- | --- | --- |
| 1→2 @4.0s | 0.146% | 0.026 / 0.022 / 0.090 / 0.070% |
| 2→3 @8.5s | 0.012% | 0.002 / 0.002 / 0.008 / 0.003% |
| 3→4 @13.0s | 0.156% | 0.132 / 0.138 / 0.152 / 0.166% |
| 4→5 @19.0s | 0.085% | 0.002 / 0.002 / 0.024 / 0.014% |
| 5→6 @22.5s | 0.026% | 0.043 / 0.029 / 0.026 / 0.020% |
| 6→7 @26.0s | 0.000% | 0.000 / 0.000 / 0.032% |

## One thing worth knowing about the frozen-state probe

Diffing two compositions loaded in *separate* pages is not stable for this film:
the card's white gradient is sometimes rasterised in a promoted layer and
sometimes not, so the same two files measure 0.37% or 9.5% run to run. The
renderer mounts every composition in ONE page and seeks, so both sides of a cut
share one layer decision — which is why the numbers above, taken from the MP4,
are the ones to trust.

## Where the brief and the product disagree

Same three as the 16:9 cut, resolved the same way (product accuracy wins,
because the brief makes it the overriding rule) — see
`../stackedpoker-the-3bet/STORYBOARD.md` § "REVISION 3". In short: the real
table has a dark green felt, real chip glyphs and an amber pot readout, all of
which §16 lists as things not to introduce. They are the product's, not
inventions, so they are reproduced.
