---
format: 1920x1080
duration: 30s
message: "One real decision from a real lesson becomes a whole strategy"
arc: Spot → Decision → Range → Theory → Coach → Brand
audience: "Poker players deciding whether a platform actually teaches, or just tells them answers"
mode: autonomous
music: minimal-cinematic-ambient-pad-soft-piano-no-drums
---

## Video direction

### The one rule that outranks every other

**Every poker fact on screen comes from `CANONICAL-SPOT.md`.** Nothing may be
invented, adapted, rounded or "cleaned up for marketing". If a value is not in that
file, it does not appear. It was verified with the project's own audit —
`validate-scenarios.ts`: 100 lessons, 274 scenarios, **0 issues**.

The spot is lesson **The 3-Bet** (`the-3-bet`, module `preflop-aggression-module`),
step **`tb-s6a`**. Hero is BTN with **A♠5♠**, 6-max, 100bb effective; UTG folds, HJ
folds, **CO raises to 2.3bb**; only the blinds are left behind. The correct answer is
**3-Bet** — the option the lesson marks `quality: 'perfect'`.

**There is no board.** `scenarioValidator.ts` states a `board` means postflop framing
and a different visualization path; `decision_spot` steps have none. Dealing a flop
would contradict the product's own data model.

**No percentage, EV figure or range-width number may be printed anywhere.** The
range's partial frequencies are rendered as relative cell weight only.

### Structure — one continuous world

Six frames, one environment, **no injected transitions**. Every boundary is a hard cut
between numerically identical frozen states; all morphing happens inside a frame.
**Do not run `transitions.mjs inject` on this project.**

The table does not cut to the range — it *becomes* it. The range does not cut to the
theory — the theory opens beside it. The coach does not replace the theory panel —
it grows out of it, in the same rect.

### THE COMPONENT CONTRACT — copy this CSS verbatim into every frame

```css
@font-face { font-family:"Geist"; src:url("capture/assets/fonts/Geist-Regular.woff2") format("woff2");
             font-weight:100 900; font-style:normal; font-display:block; }
@font-face { font-family:"Geist Mono"; src:url("capture/assets/fonts/GeistMono-Regular.woff2") format("woff2");
             font-weight:100 900; font-style:normal; font-display:block; }

.bg      { position:absolute; inset:0; background:#0D1526; }
.deep    { position:absolute; inset:0;
           background: radial-gradient(1600px 900px at 50% 118%, #080D1A 0%, rgba(8,13,26,0) 70%); }
.grid    { position:absolute; inset:0;
           background-image:
             linear-gradient(rgba(186,205,247,0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(186,205,247,0.03) 1px, transparent 1px);
           background-size:80px 80px; }
.spot    { position:absolute; inset:0;
           background: radial-gradient(1200px 820px at 50% 8%,
             rgba(124,92,255,0.20) 0%, rgba(94,168,255,0.09) 40%, rgba(94,168,255,0) 70%); }
.ambient { position:absolute; inset:0;
           background: radial-gradient(1500px 700px at 50% 104%,
             rgba(94,168,255,0.10) 0%, rgba(94,168,255,0) 72%); }

.glass { background: rgba(14,24,44,0.62);
         border: 1px solid rgba(186,205,247,0.10);
         border-radius: 20px;
         box-shadow: inset 0 1px 0 rgba(186,205,247,0.14), 0 40px 120px rgba(0,0,0,0.45);
         backdrop-filter: blur(18px); }

.pcard { width:132px; height:186px; border-radius:12px;
         background: linear-gradient(168deg, #FFFFFF 0%, #E8EEFB 100%);
         display:flex; flex-direction:column; align-items:center; justify-content:center;
         gap:12px; color:#0D1526; }
.prank { font-family:"Geist"; font-size:52px; font-weight:700; line-height:1; letter-spacing:-0.02em; }
.ppip  { display:block; width:58px; height:58px; }

.seat  { width:96px; height:52px; border-radius:12px;
         background: rgba(186,205,247,0.05); border:1px solid rgba(186,205,247,0.10);
         display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.seat-name { font-family:"Geist Mono"; font-size:11px; font-weight:500; letter-spacing:0.14em;
             text-transform:uppercase; color:rgba(186,205,247,0.62); }
.seat-stack{ font-family:"Geist Mono"; font-size:11px; color:rgba(186,205,247,0.38); }
.seat.folded { opacity:0.32; }
.seat.hero   { border-color:rgba(124,92,255,0.55); background:rgba(124,92,255,0.10); }
.seat.raiser { border-color:rgba(94,168,255,0.45); }

.cell     { width:40px; height:40px; border-radius:5px; background:rgba(186,205,247,0.055); }
.cell-in  { background:rgba(124,92,255,0.26); }   /* frequency 1.0 */
.cell-part{ background:rgba(124,92,255,0.13); }   /* a partial frequency */
.cell-hero{ background:rgba(124,92,255,0.88); box-shadow:0 0 26px rgba(124,92,255,0.45); }

.display  { font-family:"Geist"; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; }
.headline { font-family:"Geist"; font-weight:800; letter-spacing:-0.025em; color:#FFFFFF; }
.body     { font-family:"Geist"; font-weight:400; line-height:1.65; color:rgba(186,205,247,0.62); }
.label    { font-family:"Geist Mono"; font-weight:500; letter-spacing:0.18em;
            text-transform:uppercase; color:rgba(186,205,247,0.38); font-size:12px; }
.grad     { background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
            -webkit-background-clip:text; background-clip:text; color:transparent; }
```

Card markup — second card identical with rank `5`; **both ♠, and no other card exists
in this film**:

```html
<div class="pcard"><div class="prank">A</div>
  <svg class="ppip" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z" fill="currentColor"/>
    <path d="M12 17.4v4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
  </svg></div>
```

### The geometry contract

| State | table / range | A♠5♠ |
| --- | --- | --- |
| S1 | *(none — the cards alone under two lines of type)* | 132×186 · **816–1104** · **700–886** |
| S2 · S3 | table glass **360, 170, 1200, 540**; seat ring ellipse cx 960 cy 420 rx 400 ry 170 | 132×186 · **816–1104** · **700–886** — **unchanged from S1** |
| S4 | range **682–1238 × 320–876** (13×13, 40px cells, 3px gaps, 43px step) | 88×124 · **864–1056** · **170–294** |
| S5 · S6 | the cards+range group translated **−380px in x**: range **302–858 × 320–876** | 88×124 · **484–676** · 170–294 |
| S5 · S6 | side panel **1000, 300, 580, 460** — theory in S5, coach in S6, same rect | — |
| S7 | cleared | cleared; the mark takes centre |

**The cards never move from S1 to S3.** The hook, the table and the decision all share
one card position, so the first two cuts have nothing to drift. Option pills sit at
**250×72, y 916**, x **559 / 835 / 1111**; the answer label at **559, 1006, 250 wide**.

Six seats on the ring, clockwise from the top: **UTG · HJ · CO · BTN · SB · BB**.
UTG and HJ carry `.folded`. CO carries `.raiser` and shows **2.3 BB**. BTN carries
`.hero`. Every seat shows **100 BB** — the effective stack.

### Motion law

`power3` only; no `back.out`/`bounce.out`/`elastic.out`. `fromTo` entrances; hidden
initial states via `gsap.set` **outside** the timeline. No `Math.random`, `Date.now`,
`repeat`, `yoyo`, CSS animation. Never animate `left`/`top`/`fontSize`; position on
`x`/`y`, size on `scale`, and never `scale()` a glass panel — it thickens the 1px
hairline and the 20px radius.

Camera: slow push, slow pull-back, subtle parallax only. Transitions inside a frame:
morph, crossfade, depth, slow scale. **Silence and stillness are written in.**

### Absolutely forbidden

No XP, achievements, leaderboard, bankroll, modules, progress bars, badges, timers,
flashing buttons, gamification, notifications, feature lists, marketing buzzwords. No
casino aesthetics: no chips, money, players, felt, casino tables, warm casino light.
No casino green, red, gold, orange, neon yellow, rainbow gradients.

**No second hand. No board. No numbers beyond those in `CANONICAL-SPOT.md`.**

---

---

## Frame 1 — The Hook

- type: hook
- status: outline
- duration: 4.5s
- transition_in: cut
- poster: 3.5s
- scene: Two cards in midnight. You have A♠5♠. What do you do?
- voiceover: "You have a decision to make."
- blueprint: compose
- persuasion: Curiosity before information
- focal: the two cards
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: u-swell-long at 0.0 (0.16); u-card at 1.15 (0.22); u-card at 1.80 (0.20)
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/01-the-hook.html
- handoff_out: cards at 816–1104 × 700–886, opacity 1, no transform; both lines fully lit; ground settled. Static from 3.2s.

Scene 1 (0.0–1.0s): near darkness — ground, blueprint grid, the one spotlight opening.

Scene 2 (1.0–2.2s): **A♠** then **5♠** settle at **816–1104 × 700–886**, long-tail,
≤1° rotation. **This is where they stay until the range scene** — the next two frames
build around them and never move them.

Scene 3 (2.2–3.2s): two lines resolve above the cards, one after the other:
**YOU HAVE A♠5♠.** in `.display` 56px white at y≈300, then **WHAT DO YOU DO?** in
`.display .grad` 56px at y≈420. Opacity and a 10px rise only.

Scene 4 (3.2–4.5s): **held.** Nothing moves. No table yet — the viewer sits with the
hand and the question alone.

## Frame 2 — The Spot

- type: feature_showcase
- status: outline
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: The real StackedPoker table builds around the cards — positions, stacks, the action, the pot
- voiceover: none — the spot is read, not narrated
- blueprint: compose
- persuasion: This is the product, not an illustration of it
- focal: the table context
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: u-glass at 0.55 (0.15); u-tick at 2.30 (0.09); u-tick at 2.62 (0.09); u-tick at 2.94 (0.10)
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/02-the-spot.html
- handoff_in: opens on Frame 1's exact end state. **Nothing re-enters at t=0.**
- handoff_out: table glass at 360,170,1200,540, six seats, UTG/HJ folded, CO raiser at 2.3 BB, BTN hero, POT 3.8 BB, label row lit; cards unchanged. Static from 3.8s.

Scene 1 (0.0–0.4s): the inherited state, static. The seam.

Scene 2 (0.4–1.5s): both hook lines fade **in place** and the table glass expands into
existence behind the cards. **The cards do not move.**

Scene 3 (1.5–2.3s): the context resolves at low visual weight — `.label` row
**THE 3-BET · CASH 6-MAX · 100 BB EFFECTIVE** left, **PREFLOP** right; the six-seat
ellipse; every seat at **100 BB**; **BTN** marked hero.

Scene 4 (2.3–3.8s): the action plays in the lesson's own order — **UTG folds**,
**HJ folds** (both dim), then **CO raises to 2.3 BB**. **POT 3.8 BB** resolves last.
One tick per action, nothing louder.

Scene 5 (3.8–5.0s): **held.** The viewer reads the spot. Hierarchy: the hand first,
then position and action, then the pot.

## Frame 3 — The Decision

- type: feature_showcase
- status: outline
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: The three real actions appear, hold unselected, and the lesson's own answer resolves
- voiceover: "StackedPoker doesn't just show you the answer."
- blueprint: compose
- persuasion: You are asked to commit before you are told
- focal: the 3-Bet option
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: u-tick at 0.62 (0.11); u-tick at 0.84 (0.11); u-tick at 1.06 (0.11); u-glass at 2.45 (0.13)
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/03-the-decision.html
- handoff_in: opens on Frame 2's exact end state. **Nothing re-enters at t=0.**
- handoff_out: table and cards unchanged; three pills present with **3-Bet** resolved as the answer and the other two at rest. Static from 3.7s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.4s): three glass pills settle beneath the cards, in the lesson's order
and wording: **3-Bet · Call · Fold**. Nothing selected.

Scene 3 (1.4–2.4s): **held, unselected.** A real second for the viewer to answer. No
timer, no hover, no cursor, no hint.

Scene 4 (2.4–3.7s): **3-Bet** resolves — a brand-gradient ring and a white label; the
other two recede. **No tick, no green, no score, no celebration.** Beneath it one
`.label` line: **THE LESSON'S ANSWER**.

Scene 5 (3.7–5.0s): held.

## Frame 4 — The Range

- type: feature_showcase
- status: outline
- duration: 6s
- transition_in: cut
- poster: 4.5s
- scene: The table becomes the canonical BTN 3-bet range; A5s lights inside it
- voiceover: "It shows you the range."
- blueprint: compose
- persuasion: One hand is part of a whole strategy
- focal: the A5s cell, then the range around it
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3)
- sfx: u-glass at 0.45 (0.15); u-shimmer at 2.35 (0.17); u-shimmer at 3.50 (0.10)
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/04-the-range.html
- handoff_in: opens on Frame 3's exact end state. **Nothing re-enters at t=0.**
- handoff_out: cards at 88×124 · 864–1056 × 170–294; grid at 682–1238 × 320–876 with A5s hero-lit, nine hands at full weight, five partials dimmer; header, legend and the marketing line lit. Static from 5.2s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.5s): the table **becomes** the grid — seats, readouts and pills fade in
place while the glass reshapes; the cards shrink and rise to 864–1056 × 170–294. One
continuous move, no cut.

Scene 3 (1.5–2.3s): the grid **resolves as a whole** at its dim resting value. Cells do
not cascade in. Header, verbatim: **BTN 3-BET RANGE vs CO OPEN**.

Scene 4 (2.3–3.3s): **A5s lights alone**, hero-weighted. Then a **held beat with
nothing else moving** — the pivot of the film.

Scene 5 (3.3–4.6s): the rest illuminates, index-staggered: **AA KK QQ JJ AKs AKo AQs
A4s** at full weight, **TT AQo KQs 65s 54s** visibly dimmer. Nothing flashes.

Scene 6 (4.0–5.2s, overlapping): a small `.label` **legend** appears beside the grid —
two swatches reading **ALWAYS** and **PART OF THE TIME**. It names only what the data
says; the chart is Hero's 3-bet frequency, so it is never called a strategy and never
carries a number. Then the line beneath the grid, `.headline` 26px:
**DON'T MEMORISE THE HAND. UNDERSTAND THE RANGE.**

Scene 7 (5.2–6.0s): held.

## Frame 5 — The Theory

- type: feature_showcase
- status: outline
- duration: 3.5s
- transition_in: cut
- poster: 2.8s
- scene: The range slides left and one real insight from the lesson opens beside it
- voiceover: "And why it works."
- blueprint: compose
- persuasion: The reasoning is the product
- focal: the single insight
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3)
- sfx: u-glass at 1.25 (0.15)
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/05-the-theory.html
- handoff_in: opens on Frame 4's exact end state. **Nothing re-enters at t=0.**
- handoff_out: cards+range translated −380px in x; the panel open at 1000,300,580,460 with WHY?, the insight and the explanation lit. Static from 3.0s.

**One insight, not three bullets.** The revision brief is explicit, and the lesson has a
sharper line than the three-question model — step `tb-s3`, which runs this same A♠5♠
against two different openers.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.2s): the cards-and-grid group slides left by **380px** as one object.
The frame does not pan.

Scene 3 (1.2–2.2s): the panel opens at **1000, 300, 580, 460**. `.label` header
**WHY?**, then the insight, `.headline` 30px, verbatim from the lesson:

> The opener's position is evidence about their range strength.

Scene 4 (2.2–3.0s): one explanatory line beneath it, `.body` 19px, condensed from the
same step:

> A5s gains far more attacking a wide CO open than a tight, premium-heavy one.

Scene 5 (3.0–3.5s): held.

## Frame 6 — The AI Coach

- type: feature_showcase
- status: outline
- duration: 3s
- transition_in: cut
- poster: 2.4s
- scene: The same panel becomes the AI Coach — one question, one answer, the same decision
- voiceover: "Still wondering? Ask your coach."
- blueprint: compose
- persuasion: You do not just get the answer — you can ask why
- focal: the question and its answer
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity)
- sfx: u-glass at 0.20 (0.14); u-tick at 1.35 (0.09)
- asset_candidates: assets/svg-a146683f.svg — bot
- src: compositions/frames/06-the-coach.html
- handoff_in: opens on Frame 5's exact end state. **Nothing re-enters at t=0.**
- handoff_out: range unchanged; the panel showing the coach header, the question and its answer. Static from 2.5s.

Scene 1 (0.0–0.2s): the inherited state, static. The seam.

Scene 2 (0.2–0.9s): **the same panel becomes the coach** — `WHY?` crossfades to a small
bot mark plus **AI COACH**; the insight and explanation fade out in place. The panel
does not move, resize or re-enter. **Not a chat:** no thread, no bubbles, no input box,
no send button, no typing dots.

Scene 3 (0.9–1.5s): the question resolves, `.body` 19px in white, as a learner would ask
it: **Why from the Button?**

Scene 4 (1.5–2.5s): the answer resolves beneath it, `.body` 19px, condensed from the
lesson's own step `tb-s5`:

> Only the SB and BB are left to act. Fewer players behind is part of why the Button is
> such a strong 3-betting seat.

**only the SB and BB** lifts to white weight 600.

Scene 5 (2.5–3.0s): held.

## Frame 7 — Brand

- type: cta
- status: outline
- duration: 3s
- transition_in: cut
- poster: 2.4s
- scene: Everything clears to the brand frame
- voiceover: "Learn poker by playing."
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, after the proof
- focal: the lockup, then the CTA
- roles: assets/logo-8f556ecf.svg = cutout (the mark) · assets/favicon.ico = supporting
- sfx: u-accent at 0.70 (0.16)
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/07-brand.html
- handoff_in: opens on Frame 6's exact end state. **Nothing re-enters at t=0.**

**This frame owns the film's only exit.**

Scene 1 (0.0–0.8s): everything fades — range, cards, panel — leaving the ground and its
one spotlight, which does not move or brighten.

Scene 2 (0.8–1.3s): the **spade mark** resolves at centre: an 88×88 rounded square,
radius 22px, brand gradient, a white spade inside at ~46px, centred on x=960, top y≈300.

Scene 3 (1.3–1.7s): the **wordmark** beneath, 48px weight 800, centred — **Stacked** in
white, **Poker** in `.grad`.

Scene 4 (1.7–2.2s): **LEARN POKER.** resolves, `.display` 72px centred, then
**BY PLAYING.** a beat later in `.grad`. Two lines, never one.

Scene 5 (2.2–2.6s): the CTA pill — **START LEARNING FREE**, 300×60, radius 100px, brand
gradient, white 17px weight 600. No hover, no pulse, no shine sweep.

Scene 6 (2.6–3.0s): **completely still.**

---

# BUILD RECORD — what changed during the build, and why

The storyboard below is the intent. Three things were decided at the bench, after
measuring, and the built frames are the authority on them:

1. **The card construction is canonical across all seven frames.** A full-frame
   layer (`z-index:3; transform:translateZ(0)`) holds ONE 288x186 `.cardwrap` at
   816,700, holding two `.pcard`s at left 0 and 156. Frames 01-03 leave the wrapper
   at identity, frame 04 scales it to 2/3 and lifts it -561px, frames 05-07 carry
   that landed matrix - written through GSAP, not hand-typed, so the value and the
   code path both match. This was NOT cosmetic: while frames 01-03 positioned the
   cards as two loose absolute elements and 04-07 used a wrapper, the two
   constructions rasterised the white card gradient differently and left ~1/255
   dither noise across the 3->4 cut. One construction closed it to zero.

2. **The range legend sits under the grid, not out in the left margin.** As first
   built it landed at x=50 after the -380px slide - 250px from the grid it
   explains and 50px from the frame edge, reading as a stray element. It is now a
   single row at the grid's left edge just beneath it (682,898 pre-slide), and the
   marketing line moved 936 -> 966 to clear it.

3. **The three swell-shaped SFX are mounted EARLY, not on the beat.** `u-accent`
   peaks 1.15s in, `u-swell-long` 2.10s in, `u-shimmer` 0.70s in. Mounted on the
   beat, the accent for CO's raise peaked a full second after the raise and added
   +0.3 dB over the bed - inaudible. Started at 6.27 it peaks on 7.42 and lifts
   +16.5 dB. `u-glass`, `u-tick` and `u-card` are transients and do sit on the beat.

**Measured seams in the finished render** (consecutive frames at the cut vs. the
frames either side of it - a cut is invisible when it is no different from an
ordinary frame boundary):

| seam | at the cut | neighbours |
| --- | --- | --- |
| 1->2 @4.5s  | 0.537% | 0.495 / 0.493 / 0.575 / 0.552% |
| 2->3 @9.5s  | 0.006% | 0.006 / 0.006 / 0.006 / 0.006% |
| 3->4 @14.5s | 0.174% | 0.181 / 0.188 / 0.227 / 0.232% |
| 4->5 @20.5s | 0.014% | 0.025 / 0.018 / 0.011 / 0.011% |
| 5->6 @24.0s | 0.052% | 0.031 / 0.045 / 0.039 / 0.029% |
| 6->7 @27.0s | 0.005% | 0.005 / 0.009 / 0.164 / 0.691% |

Frozen-state diffs (composition against composition, off the timeline) were
0.0000% on five of the six seams; 4->5 retains 170 pixels at max delta 3, on the
rounded corners of the 14 lit cells, where GSAP's colour tween lands a hair off a
directly-set value. Below h.264's quantiser.

---

# REVISION 3 — product accuracy

The table, the cards and the range are no longer a recreation. They are the real
StackedPoker components, reproduced from source and verified against the running
product.

## How they were captured

A temporary page (`frontend/app/zz-video-ref/page.tsx`, since deleted) rendered
the REAL components with the exact `tb-s6a` step object:

- `PreflopTable` (DESKTOP_LAYOUT)  ->  the oval rail + felt, seats, chips, pot,
  dealer button, status bar
- `PlayingCardMini` (SIZE_CONFIG.lg) -> the cards
- `PokerRangeGrid` (`mode="strategy"`) fed by `resolveThreebetRangeReveal(step)`
  -> the range

Every geometry and colour in `_product.py` was then read off that render or out
of the component source. `reference/` holds the captures: `product-table.png`,
`product-range.png`, the film's own `film-table.png` / `film-range.png`, plus
`product-geometry.json` and `canonical-range-data.json`.

Measured A/B against the live component: mean absolute delta **1.32 / 255** over
the whole table, with the residue in text antialiasing.

## The range

The film no longer paints the range. It renders what
`resolveThreebetRangeReveal()` returns, through the product's own visual rule:

- each cell is `rgba(100,116,139,0.7)` ("Other action", `actionStyles.ts`)
- a hand's 3-bet frequency is a solid `rgb(139,92,246)` block of exactly that
  width — never opacity, never brightness, never glow
- A5s carries `ring-2 ring-white ring-offset-1` and NOTHING else: its fill is
  byte-identical to AA's

Audited cell by cell in the rendered frame (169 cells): one base colour, one
opacity, one filter, one box-shadow, one radius, one size, one 3-bet colour, one
3-bet opacity, all 14 frequencies matching the canonical data, exactly one ring.

## Three places the brief and the product disagree

Flagged rather than silently resolved. Product accuracy won each time, because
the brief makes it the overriding rule:

1. The brief says no green felt, no realistic casino chips, no gold accents. The
   real `PreflopTable` has a dark green radial felt, `PokerChip` glyphs with
   conic edge wedges, and an amber `PotDisplay`. All three are reproduced.
2. The brief gives the background as `#0D1526`. The product's own token is
   `#0C101D` (`--background: 224 43% 8%`). The film's ENVIRONMENT keeps the
   mandated `#0D1526`; the product surfaces use the product's values.
3. The theory and AI-Coach panels remain film chrome (glass), not reproduced
   components. Their TEXT is verbatim lesson content (tb-s3, tb-s5).

## Seams, in the rendered file

| seam | at the cut | neighbouring frame boundaries |
| --- | --- | --- |
| 1->2 @4.5s  | 0.081% | 0.046 / 0.044 / 0.054 / 0.054% |
| 2->3 @9.5s  | 0.061% | 0.052 / 0.052 / 0.054 / 0.052% |
| 3->4 @14.5s | 0.105% | 0.097 / 0.106 / 0.088 / 0.102% |
| 4->5 @20.5s | 0.041% | 0.029 / 0.028 / 0.018 / 0.016% |
| 5->6 @24.0s | 0.007% | 0.029 / 0.001 / 0.004% |
| 6->7 @27.0s | 0.003% | 0.013 / 0.013 / 0.011% |

Two real defects were found by measuring rather than looking: frame 2 used the
prefix `sp-`, which collided with the product's own `sp-*` classes and silently
restyled its wrappers; and frame 2's seat fade tweened every seat to opacity 1,
quietly un-folding UTG and HJ, whose product state is 0.35.
