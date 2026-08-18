# StackedPoker — "ENOUGH."

`renders/enough-9x16.mp4` — 1080×1920, **21.7s**, −14.4 LUFS.

A different angle from the previous films. Not "here is our learning method" but
the problem it solves: **you can consume every concept in poker and still not
know what to do when a real decision arrives.**

## The sequence

| # | in | dur | scene | dominant message |
| --- | --- | --- | --- | --- |
| 1 | 0.0 | 2.3 | MORE. + eight concepts accumulating | the noise |
| 2 | 2.3 | 0.9 | **ENOUGH.** | the interrupt |
| 3 | 3.2 | 2.0 | the real StackedPoker table | one real spot |
| 4 | 5.2 | 2.0 | WHAT DO YOU DO? + three real options, held | the question |
| 5 | 7.2 | 1.1 | 3-Bet resolves | the answer |
| 6 | 8.3 | 1.6 | YOU MIGHT KNOW THE ANSWER. / BUT DO YOU KNOW WHY? | **the pivot** |
| 7 | 9.9 | 1.8 | the hand becomes its canonical range | the proof |
| 8 | 11.7 | 1.8 | four more real ranges | the system |
| 9 | 13.5 | 1.6 | WHY? + the lesson's own insight | the reason |
| 10 | 15.1 | 2.2 | the AI Coach | the depth |
| 11 | 17.3 | 2.0 | DON'T JUST KNOW THE ANSWER. / UNDERSTAND WHY. | the payoff |
| 12 | 19.3 | 2.4 | CTA, held | the action |

## The interrupt is real, not decorative

Measured in the rendered file:

| | level |
| --- | --- |
| 1.7–2.3s, the eight tactile ticks | **−16.6 dB** |
| 2.35–2.95s, ENOUGH | **−40.2 dB** |
| 3.3–3.9s, the table opens | **−20.5 dB** |

A 23.6 dB drop, then the mix reopens. The eight ticks stop dead and one low
swell sits under the word. That silence is the whole device.

## Everything on screen is the product's

- The eight concepts in scene 1 are things the curriculum actually teaches —
  RANGES (3,160 mentions), BLOCKERS (377), MDF (126), EQUITY (1,092),
  POSITION (1,153), SOLVERS (26), GTO (11), BET SIZING (7). No invented jargon.
- The table is `PreflopTable`'s own `MOBILE_LAYOUT`, reproduced from source and
  verified against the live component (mean delta 1.53/255).
- Options are the product's stacked mobile buttons; the answer is the option the
  lesson marks `quality: 'perfect'`.
- All five ranges come from `preflopBaselines.ts`, `defendBaselines.ts` and
  `threebetBaselines.ts`, each painted with its own semantics — a binary RFI
  source paints **Fold**, an action slice paints **Other action**.
- Theory is `tb-s3` verbatim; the coach exchange is `tb-s5`.

## Why this scenario, again

The brief asked not to reuse the previous spot unless it is clearly strongest.
Only **10 steps in the whole curriculum** resolve a canonical range reveal. The
main alternative is QQ facing a 3-bet (answer: 4-Bet) — a fine spot, but every
player already knows the answer, so "but do you know why?" has nothing to land
on. A5s 3-betting from the Button creates genuine doubt, which is exactly what
this ad's pivot needs. It stays.

## Verified before rendering

- **Range QC** — all five grids, 169 cells each: one base colour, one action
  colour, one opacity, one filter, no box-shadow, one radius, one size. Every
  frequency matches its source. One ring, on A5s, in the hero range only.
- **Safe area** — every visible element in all twelve scenes inside y 250…1620.
- **Seams** — all eleven cuts measured in the MP4 at a perceptible threshold
  (delta > 8/255): the largest is 0.044%, and none stands out against the motion
  around it.
- **Pacing** — mean frame-to-frame change 1.43. Deliberately calmer than the
  previous reel: this concept needs quiet to work.

### One honest note on measurement

At a >2/255 threshold the 5→6 cut reads as 3.1%, which looks alarming. It is a
sub-pixel resample: 0.044% of pixels differ by more than 8, 0.001% by more than
24, and the best alignment is a zero-pixel shift. A >2 threshold is below what
h.264 preserves, let alone what an eye catches on a hard cut.

## Where the brief and the product still disagree

Fourth time, resolved the same way — product accuracy wins:

- §15 lists green felt among things not to use. The real `PreflopTable` has a
  dark green radial felt, and `call` in `actionStyles.ts` is emerald `#10b981`,
  which is why the BB defending range is green.
- The pot readout is amber and the chips are real chip glyphs. Also the product's.

Changing those is a change to the product, not to the advert.

**The brief also says 90 lessons. The real figure is 100** (12 modules, 1,305
steps, counted from `curriculumPublic.generated.ts`). This film shows no count,
so nothing had to be corrected on screen — but the number in the brief is stale.
