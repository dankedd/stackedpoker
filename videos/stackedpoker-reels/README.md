# StackedPoker — high-density 9:16 performance film

`renders/reels-9x16.mp4` — 1080×1920, **21.6s**, −14.7 LUFS.

Eleven scenes. Not a faster cut of the previous film: re-timed, re-storied, and
carrying four more real product surfaces than it did.

## Rhythm, not speed

| # | in | dur | scene | beat |
| --- | --- | --- | --- | --- |
| 1 | 0.0 | 2.0 | the hand, alone | fast |
| 2 | 2.0 | 2.2 | the real portrait table builds around it | fast |
| 3 | 4.2 | 1.6 | the three real options, then it just holds | **the pause** |
| 4 | 5.8 | 1.4 | 3-Bet resolves | fast |
| 5 | 7.2 | 2.0 | the hand becomes its range | payoff |
| 6 | 9.2 | 2.6 | **four canonical ranges, 0.55s apart** | fastest |
| 7 | 11.8 | 2.4 | the lesson's own insight | medium |
| 8 | 14.2 | 1.8 | five real module titles, then 12 · 100 | fast |
| 9 | 16.0 | 2.0 | the AI Coach, answer in two beats | medium |
| 10 | 18.0 | 1.6 | the payoff | slow |
| 11 | 19.6 | 2.0 | CTA, held | slow |

## The montage is an argument, not a slideshow

Scene 6 shows **UTG open (22 hands) → CO open (48) → BTN open (78) → BB defend
(84)** on a grid that never moves. That is not "look how much content we have":
it is the visual proof of scene 7's line, which comes straight out of the lesson
— *the opener's position is evidence about their range strength*. The montage
shows the claim; the theory card then states it.

Every range is canonical, and each carries its own semantics:

| range | source | semantics | complement painted |
| --- | --- | --- | --- |
| BTN 3-bet vs CO | `threebetBaselines.ts` | `action_slice / 3bet` | **Other action** |
| UTG / CO / BTN open | `preflopBaselines.ts` | `binary raise/fold` | **Fold** |
| BB defend vs BTN | `defendBaselines.ts` | `action_slice / call` | **Other action** |

That distinction is real and the product enforces it: an absent hand in an action
slice proves 0% of the tracked action, never a fold. The film paints it correctly.

## Numbers on screen

`12 MODULES · 100 LESSONS` — counted from `curriculumPublic.generated.ts`
(1,305 steps across 100 lessons in 12 modules). **The brief said 90 lessons; the
real figure is 100**, and the brief itself says to use accurate current numbers.

Module titles are verbatim from `LEARNING_MODULES`.

## Verified before rendering

- **Range QC, all five grids** — 169 cells each: one base colour, one action
  colour, one opacity, one filter, no box-shadow, one radius, one size. Every
  frequency matches its source file. Exactly one ring, on A5s, in the hero range
  only — and its fill is identical to AA's.
- **Safe area** — every visible element in all eleven scenes inside y 250…1620.
- **Seams** — all ten cuts measured in the MP4 against the neighbouring frame
  boundaries; none stands out. The neighbours run 0.05–5.5%, the cuts 0.01–0.22%:
  the film moves more than its own cuts do.
- **Pacing** — sampled at 6fps; mean frame-to-frame change 1.85. One hold remains,
  1.67s inside the coach scene while a two-line answer is on screen. That is
  reading time; cutting further makes the answer unreadable.

## Scenario

Unchanged from the 16:9 and mobile cuts, and chosen rather than assumed: only
**10 steps in the whole curriculum** resolve a canonical range reveal (7
`facing_3bet`, 2 `3bet`, 1 `opener`). `tb-s6a` — A♠5♠, BTN vs CO, 100bb — is the
strongest of them for an advert: a weak-looking hand sitting in a premium range
is the most memorable thing the product teaches, and the same lesson supplies
both the theory (`tb-s3`) and the coach exchange (`tb-s5`).

See `../stackedpoker-the-3bet/CANONICAL-SPOT.md` for the full source pinning.

## Where the brief and the product still disagree

Third time, resolved the same way — product accuracy wins, because the brief
makes it the overriding rule:

- §16 lists green as something not to introduce. The real table has a dark green
  felt, and `call` in `actionStyles.ts` is emerald `#10b981` — which is why the
  BB defending range is green. Both are the product's own colours.
- The pot readout is amber and the chips are real chip glyphs, also the product's.

If those should change, that is a change to the product, not to the advert.
