# StackedPoker — "The hand is only the start."

`renders/hand-start-9x16.mp4` — 1080×1920, **24.0s**, −15.4 LUFS.

## The scenario, and why this one

Ten steps in the whole curriculum resolve a canonical range reveal. Two have a
pocket pair. I took the second:

| | |
| --- | --- |
| lesson | **They Raised Back** (`they-raised-back`), Preflop Aggression |
| step | `trb-final-5`, `decision_spot` |
| table | 6-max, 100bb, Hero **HJ**, Villain **CO** |
| action | UTG folds · HJ raises to 2.3bb · CO raises to 7.5bb |
| hero hand | `['Th','Tc']` → **T♥ T♣** |
| options | **Call** (`quality: 'perfect'`) · 4-Bet · Fold |

The other candidate was `trb-final-1` — QQ in the same seat, answer 4-Bet. It is
a fine spot but a dead one for this brief: everybody 4-bets QQ, so "the hand is
only the start" has nothing to push against. **TT is the hand where the two
cards genuinely tell you nothing.** It looks like a monster and the correct play
is to flat-call, entirely because of position, opener range and 3-bet size. The
lesson tags it `pocket_pair` / "the medium pocket pair (TT)" for that reason, and
its own chart confirms the boundary: **JJ 4-bets, TT calls.**

## What the reference contributed

The Skedul.AI demo does not cut between screenshots — it moves product surfaces
through a 3D space. That is the one idea I took, and it is new here: every one of
the four previous films was flat.

Every surface in this film is a child of a single `perspective: 2200px` origin,
so "further away" means the same thing throughout. The table tilts back as the
decision comes forward; the grid tilts back as the reason comes forward. Nothing
about the reference's colour, type, layout or content is used.

## Everything on screen traces to the codebase

- **Table** — `PreflopTable`'s `MOBILE_LAYOUT`. Seat slots from
  `computeHeroRotatedSeats` (HJ to slot 0 → HJ·CO·BTN·SB·BB·UTG). Chip anchors
  computed with the component's own `bandPoint` + `pushOutOfZone`; the formula
  reproduces the independently-measured anchor (23.00, 64.47) exactly.
  Pot **11.3 BB** = 0.5 + 1 + 2.3 + 7.5. Stacks 97.7 / 92.5 behind.
  Status **"HJ OPEN · CO 3-BET"**, which is what `deriveCenterStatus` returns.
- **Cards** — `PlayingCardMini`, T♥ red and T♣ black.
- **Hero range** — `THREEBET_RESPONSE_CHARTS['HJ_vs_CO_3bet_response']`, a
  three-action chart: 4-Bet `#d946ef`, Call `#10b981`, Fold `rgba(148,163,184,.35)`,
  straight from `actionStyles.ts`. TT carries a plain white ring, nothing else.
- **Montage ranges** — UTG / CO / BTN opening (`preflopBaselines`) and BB
  defending (`defendBaselines`), each painted with its own semantics.
- **Theory** — "Which Hands Call Well", the lesson's own words.
- **Coach** — the Call option's authored feedback, verbatim.
- **Modules** — the 12 built `LEARNING_MODULES`. The 17 roadmap modules are
  absent because they are not live.

## Read this before using the range on screen

`threebetResponseBaselines.ts` states plainly that this chart's **hand-level
cells are an illustrative construction**, not solver-exact: no per-hand data
exists for the response side of a 3-bet, so the cells were built from Hero's real
opening range and calibrated to Modern Poker Theory's stated aggregate. The file
also says every lesson step using it discloses that on screen.

So the film does too — the grid carries `Illustrative — calibrated to the book's
stated 22.2 / 14.5 / 63.3`. My own count of the chart comes out at **22.9 / 14.6
/ 62.5**, within 0.8 points of the book, which is the calibration the file claims.

The aggregate percentages are real book figures. The per-hand colours are a
teaching construction. Showing the second without the first would be false
precision, which is why the marker is on screen and not just in this file.

## Verified before delivery

- **Range QC** — all five grids, 169 cells each: one opacity, one filter, no
  box-shadow, one radius, one size. Hero grid resolves exactly 3 action colours;
  the four canonical grids exactly 1 each. Every frequency matches its source.
  One ring, on TT, in the hero grid only.
- **Safe area** — every visible element in all 11 scenes inside y 250…1620.
- **Seams** — all ten cuts measured in the MP4 at delta > 8/255: largest 0.005%,
  none stands out against the motion around it.
- **Pacing** — mean frame-to-frame change 1.84, no still stretch over 1.5s. The
  per-second profile runs 3.5 · 1.7 · 4.6 · **0.3** · 0.8 · 2.3 · 2.9 · **0.2** ·
  3.7 · 2.7 · 2.3 · 2.8 · **5.3** · … — the two dips are the decision holds.

### Two things I fixed after watching the render

- The first render showed **T♠T♥**. The table renderer had the right suits but
  the standalone card mount still carried the default spade. Corrected to T♥T♣.
- The action beat measured as 2.17s of stillness. Chips at this scale are ~29px
  and cannot carry a shot on a phone, so the scene now pushes the camera toward
  the decision through the whole beat — which is also what the brief asked for.

## Still unresolved, fifth time

§15 lists green felt and casino colours among things not to use. The real
`PreflopTable` has a dark green radial felt, `call` is emerald in
`actionStyles.ts`, and the pot readout is amber. I have again resolved this in
favour of product accuracy, because §9/§19/§36 make the table's authenticity the
point of the whole brief. **If you actually want those colours gone, the change
belongs in the product, not in a sixth advert.**

Your brief also says 90 lessons. Counted from `LEARNING_MODULES`: **12 modules,
94 lessons**, and 94 is also the total number of `module_id` references, so the
two agree. The film shows 94.
