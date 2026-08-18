---
format: 1920x1080
duration: 30s
message: "One poker hand becomes a complete learning experience"
arc: Question → Decision → Why → Ranges → Coach → Method → Brand
audience: "Poker players deciding whether a platform actually teaches, or just tells them answers"
mode: autonomous
music: minimal-cinematic-ambient-pad-soft-piano-no-drums
---

## Video direction

### Structure — one continuous world

Seven frame files, **one environment.** No injected transitions: every boundary is a
hard cut between two numerically identical frozen states, so all morphing happens
inside a frame. **Do not run `transitions.mjs inject` on this project.**

The camera moves slowly or holds. It never cuts to an unrelated view, and the two
poker cards are on screen in every single state.

### THE COMPONENT CONTRACT — copy this CSS verbatim into every frame

The previous film failed because the contract carried coordinates but not component
design; six workers each invented their own card and their own lighting, and every
seam visibly changed. These blocks are **literal and non-negotiable.** Copy them
exactly, changing only the class prefix.

**Ground — identical in all seven frames, no exceptions:**

```css
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
```

That is **one** spotlight from above and **one** low ambient. Never add a third.

**Glass — every panel in the film:**

```css
.glass {
  background: rgba(14,24,44,0.62);
  border: 1px solid rgba(186,205,247,0.10);
  border-radius: 20px;
  box-shadow: inset 0 1px 0 rgba(186,205,247,0.14), 0 40px 120px rgba(0,0,0,0.45);
  backdrop-filter: blur(18px);
}
```

**The poker card — A♠5♠, the spine of the film:**

```css
.pcard { width:132px; height:186px; border-radius:12px;
         background: linear-gradient(168deg, #FFFFFF 0%, #E8EEFB 100%);
         display:flex; flex-direction:column; align-items:center; justify-content:center;
         gap:12px; color:#0D1526; }
.prank { font-size:52px; font-weight:700; line-height:1; letter-spacing:-0.02em; }
.ppip  { display:block; width:58px; height:58px; }
```

```html
<div class="pcard"><div class="prank">A</div>
  <svg class="ppip" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z" fill="currentColor"/>
    <path d="M12 17.4v4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
  </svg></div>
```

The second card is identical with rank `5`. **Both are ♠.** No corner indices, no
multi-pip layout, no border, no back face, no flip.

Where a state renders them smaller, use a **uniform `scale()` on this exact element**
so rank and pip scale together. Never rebuild a small variant.

**Type:**

```css
.display  { font-family:"Geist"; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; }
.headline { font-family:"Geist"; font-weight:800; letter-spacing:-0.025em; color:#FFFFFF; }
.body     { font-family:"Geist"; font-weight:400; line-height:1.65; color:rgba(186,205,247,0.62); }
.label    { font-family:"Geist Mono"; font-weight:500; letter-spacing:0.18em;
            text-transform:uppercase; color:rgba(186,205,247,0.38); font-size:12px; }
.grad     { background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
            -webkit-background-clip:text; background-clip:text; color:transparent; }
```

`@font-face` for Geist and Geist Mono must declare **`font-weight: 100 900`** — both
are variable fonts and closing the axis kills real bold:

```css
@font-face { font-family:"Geist"; src:url("capture/assets/fonts/Geist-Regular.woff2") format("woff2");
             font-weight:100 900; font-style:normal; font-display:block; }
@font-face { font-family:"Geist Mono"; src:url("capture/assets/fonts/GeistMono-Regular.woff2") format("woff2");
             font-weight:100 900; font-style:normal; font-display:block; }
```

**The gradient is scarce.** `.grad` appears on exactly four things in the whole film:
the word **RANGES**, the word **Poker** in the wordmark, the line **By Playing.**, and
the CTA + spade-icon fills. Nowhere else.

### The geometry contract

| State | lesson surface (x, y, w, h) | A♠5♠ |
| --- | --- | --- |
| S1 | *(none — cards alone in space)* | 132×186 · 816–1104 · 470–656 |
| S2 | 460, 250, 1000, 620 | 132×186 · 816–1104 · 470–656 **(identical to S1)** |
| S3 | 560, 300, 800, 460 | 88×124 · 600–792 · 340–464 |
| S4 | 460, 230, 1000, 660 | 88×124 · 500–692 · 270–394 |
| S5 | 260, 230, 1000, 660 | 88×124 · 300–492 · 270–394 |
| S6 | S5's composition, uniformly scaled 0.82 about the canvas centre | scales with it |
| S7 | *(cleared)* | *(cleared — the mark takes the centre)* |

The 13×13 grid: 40px cells, 3px gaps, 43px step, 556×556 overall.
S4 → 760–1316 × 270–826.  S5 → 560–1116 × 270–826 (it travels with the surface).

### Motion law

- Long-tail `power3` only. No `back.out` / `bounce.out` / `elastic.out` anywhere.
- Allowed camera: slow push-in, slow pull-back, subtle lateral drift, subtle parallax,
  small depth changes. **Forbidden:** whip pan, shake, rapid zoom, spin, glitch.
- Transitions inside a frame: morph, crossfade, depth, slow scale. **Forbidden:**
  wipes, flashes, particle bursts, camera spins.
- **Silence and stillness are written in.** Do not animate continuously; a state that
  has arrived simply reads. Longer holds beat more movement.
- `fromTo` entrances; hidden initial states via `gsap.set` **outside** the timeline.
- Deterministic: no `Math.random`, `Date.now`, `repeat`, `yoyo`, CSS animation.
- Never animate `left` / `top` / `width` on a moving element and never animate
  `fontSize` — they snap to integer pixels under the seek-by-frame render engine and
  the ease-out tail stutters. Position travels on `x`/`y`; size on `scale`.

### Absolutely forbidden

**No** XP, achievements, leaderboard, bankroll, modules, pricing, settings,
statistics, progress bars, notifications, popups, badges, confetti, particles,
gamification, timers, flashing buttons, correct-answer reveals, feature lists or
marketing buzzwords. **No** session analysis, replay, Analyze, Practice, study plans
or any roadmap feature — none of it may appear as if it were live.

**No** casino aesthetics: no chips, money, players, felt, tables in a casino, warm
casino light, Vegas imagery, stock photography.

**No** casino green, bright red, gold, orange, neon yellow or rainbow gradients.

**No second hand.** Every card rendered anywhere in this film is A♠ or 5♠.

### Poker theory

Verified against `docs/Modern Poker Theory.pdf` via `docs/mpt_fulltext.txt`, preflop
3-bet/4-bet/5-bet chapter pp. ~231–234 incl. Hand Range 73. The book supports A5s as
a blocker bluff that blocks premium holdings while retaining post-flop playability.
On-screen sentences are **source reconstruction** in plain language.

**No frequency, percentage, EV figure or solver output may be printed anywhere.**

**The spot is PREFLOP and shows no community cards.** The brief lists "board" in the
decision context, but A5s is a *preflop* blocker bluff in the cited chapter, and the
three actions are Fold / Call / Raise facing an open. Dealing a flop would contradict
the verified theory and would put three more cards on screen competing with the hero
hand. The table context is shown instead: 6-max, positions, blinds, pot, and a
`PREFLOP` marker where a board would later sit.

### Captions

None. Content still stays above y≈897 so a vertical cut can add them later.

---

## Frame 1 — The Question

- type: hook
- status: animated
- duration: 6.5s
- transition_in: cut
- poster: 4s
- scene: Darkness resolves into a blueprint grid under one violet-blue spotlight; A♠5♠ emerge as physical objects beneath a single headline
- voiceover: "Every poker decision starts with a question. What would you do?"
- blueprint: compose
- persuasion: A question, asked calmly, with room to answer it
- focal: the two cards
- roles: assets/logo-8f556ecf.svg = supporting (spade pip inside each card)
- sfx: one soft card movement per card, two total, very quiet; a low ambient swell under the spotlight. Nothing else.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/01-the-question.html
- handoff_out: cards at 816–1104 × 470–656, opacity 1, no transform. Headline WHAT WOULD YOU DO? fully lit at y356. Ground at full settled intensity. Everything static from 4.0s.

Scene 1 (0.0–1.3s): `bg` and `deep` only — near darkness. The **blueprint grid**
fades up to its 3% resting opacity, then the **spotlight** opens from above, slowly,
and the low ambient answers it. No VO yet. Nothing else exists.

Scene 2 (1.3–2.6s): **A♠** settles into place, then **5♠** a beat later — each on a
long-tail settle with a soft card movement, barely rotating (a degree at most). They
read as physical objects lit from above, not as graphics appearing. VO line 1 begins.

Scene 3 (2.6–3.4s): the headline **WHAT WOULD YOU DO?** fades in above them —
`.display`, 64px, opacity and a 10px rise, nothing more. Centred, well clear of the
cards.

Scene 4 (3.4–6.5s): **held.** A very slow push-in of at most 1.5% continues under
everything, and nothing else moves. The viewer is being given time to answer.

## Frame 2 — The Decision

- type: feature_showcase
- status: animated
- duration: 5.5s
- transition_in: cut
- poster: 4.5s
- scene: The lesson interface builds around the cards — 6-max, position, pot, preflop — and three unselected actions
- voiceover: "Don't just learn the answer."
- blueprint: compose
- persuasion: The product asks before it tells
- focal: the three unpressed actions
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: soft glass movement as the surface builds; three near-inaudible tactile ticks as the actions settle. No click — nothing is pressed.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/02-the-decision.html
- handoff_in: opens on Frame 1's exact end state — cards at 816–1104 × 470–656, headline lit, ground settled. **Nothing re-enters or re-fades at t=0.**
- handoff_out: glass surface at 460,250,1000,620. Cards unchanged at 816–1104 × 470–656. Context labels, seat ring, pot, hero label, question and three unpressed actions all at full opacity. Nothing selected. Static from 3.5s — a two-second hold.

**The cards must not move.** The interface assembles *around* them; that is the whole
point of this frame. If they shift, the film loses its spine.

Scene 1 (0.0–0.4s): the inherited state, completely static. This is the seam.

Scene 2 (0.4–1.6s): the headline **WHAT WOULD YOU DO?** fades out, and the glass
surface expands into existence behind the cards — from ~70% of its size to full,
centred on the cards, on one long ease. Soft glass movement. VO line 2 lands.

Scene 3 (1.6–2.6s): the lesson context resolves *around* the hand, quietly and all at
a low visual weight: a `.label` row reading **6-MAX · 100 BB EFFECTIVE** left and
**PREFLOP** right; a faint six-seat ellipse with the hero seat marked; **POT 6.5 BB**;
and **HERO · BB** beneath the cards. None of this competes with the hand.

Scene 4 (2.6–3.5s): the question **What would you do?** resolves below, then the three
actions — **FOLD · CALL · RAISE** — settle as one staggered set, each a glass pill.

Scene 5 (3.5–5.5s): **held for two full seconds.** Nothing is selected. No hover, no
highlight, no cursor, no timer, no hint, no correct answer. Nothing moves at all.

## Frame 3 — Start With Why

- type: feature_showcase
- status: animated
- duration: 4s
- transition_in: cut
- poster: 3.5s
- scene: The decision surface transforms into a compact theory card; the cards shrink to an anchor and the concept is stated
- voiceover: "Understand why."
- blueprint: compose
- persuasion: The concept comes before the answer
- focal: the headline START WITH WHY. and the sentence under it
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: one soft glass movement as the surface reshapes. Nothing else — this is the quietest frame in the film.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/03-start-with-why.html
- handoff_in: opens on Frame 2's exact end state — glass at 460,250,1000,620, cards at 816–1104 × 470–656, all decision content lit. **Nothing re-enters at t=0.**
- handoff_out: glass at 560,300,800,460. Cards at 88×124, 600–792 × 340–464. Headline and body sentence fully visible. Static from 3.4s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.5s): one continuous transform — the decision content fades **in place**
(no slide, no collapse), the glass surface eases to 560,300,800,460, and the two cards
scale to 88×124 and travel to 600–792 × 340–464, becoming an anchor rather than the
subject. One ease, one move.

Scene 3 (1.5–2.3s): the headline **START WITH WHY.** resolves beside the cards —
`.headline`, 48px. VO line 3 lands here, two words under a two-word headline.

Scene 4 (2.3–3.4s): the sentence appears beneath it, per-word staggered, `.body` 22px:

> Suited aces block the strongest hands your opponent can hold — and they still play
> well when called.

This is plain-language source reconstruction of the cited chapter. Print it exactly;
add no figure, no percentage, no "GTO" label.

Scene 5 (3.4–4.5s): **held.** The viewer reads.

## Frame 4 — Think In Ranges

- type: feature_showcase
- status: animated
- duration: 5s
- transition_in: cut
- poster: 4.5s
- scene: The theory card becomes a 13×13 range grid; A5s lights alone, then the surrounding bluffs join it
- voiceover: "Think in ranges."
- blueprint: compose
- persuasion: One hand is part of a whole strategy
- focal: the single lit A5s cell, then the cluster around it
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3, range chrome)
- sfx: soft glass movement as the grid resolves; one subtle shimmer when A5s lights; a second, quieter shimmer as the cluster joins.
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/04-think-in-ranges.html
- handoff_in: opens on Frame 3's exact end state — glass at 560,300,800,460, cards at 600–792 × 340–464, headline and sentence lit. **Nothing re-enters at t=0.**
- handoff_out: glass at 460,230,1000,660. Cards at 500–692 × 270–394. Full 13×13 grid at 760–1316 × 270–826 with A5s and its cluster lit, all other cells at their dim resting values. Headline THINK IN / RANGES. lit. Static from 4.8s.

This is a hero moment. It must not be busy.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.4s): one continuous transform — the theory sentence fades in place, the
glass eases to 460,230,1000,660, and the cards travel to 500–692 × 270–394 at the same
88×124 size.

Scene 3 (1.4–2.4s): the **grid resolves as a whole** at a dim resting opacity — it
fades up together. **Cells do not cascade or stagger in one by one**; the brief is
explicit that not every square may animate independently. Rank labels sit above and to
the right in `.label`.

Scene 4 (2.4–3.3s): **A5s lights alone.** One cell, on a soft shimmer, clearly
visible. Then a **held beat with nothing else happening.** VO line 4 has already
landed; this silence is the pivot of the film.

Scene 5 (3.3–4.4s): the surrounding bluff combinations illuminate softly and
index-staggered, at a **lower intensity than A5s** so the hand stays the brightest
thing on the grid. Nothing flashes, no cell scales up, no glow bloom beyond a soft
halo behind the hero cell.

Scene 6 (3.6–4.8s, overlapping): the headline resolves at the left, two lines:
**THINK IN** in `.headline` white, then **RANGES.** in `.headline .grad` — the brand
gradient's first appearance in the film.

Scene 7 (4.8–5.5s): **held.**

## Frame 5 — The Coach

- type: feature_showcase
- status: animated
- duration: 3.5s
- transition_in: cut
- poster: 3.2s
- scene: The surface slides left and one compact AI Coach panel opens beside the grid with a single explanation
- voiceover: "Build better decisions."
- blueprint: compose
- persuasion: Understanding is the hero, not the assistant
- focal: the one explanation
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity)
- sfx: one soft spatial slide as the panel opens; two faint ticks under the emphasised phrases.
- asset_candidates: assets/svg-a146683f.svg — bot
- src: compositions/frames/05-the-coach.html
- handoff_in: opens on Frame 4's exact end state — glass at 460,230,1000,660, cards at 500–692 × 270–394, grid at 760–1316 × 270–826 lit, headline lit. **Nothing re-enters at t=0.**
- handoff_out: glass at 260,230,1000,660 with grid at 560–1116 × 270–826 and cards at 300–492 × 270–394. Coach panel fully open at 1320,330,400,460 with its sentence and two emphases lit. Static from 3.2s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.3s): the whole lesson surface **slides left** as one object, 460 → 260.
The grid, the cards and the headline travel with it. This is the surface moving, not
the camera panning.

Scene 3 (1.3–2.2s): the **AI Coach panel opens** at 1320,330,400,460 with a soft
spatial slide — glass, same treatment as everything else. A small `.label` header
identifies it. **It is not a chat.** No thread, no bubbles, no input box, no send
button, no avatar row, no typing dots, no timestamps. VO line 5 lands.

Scene 4 (2.2–3.2s): **one** explanation appears, per-word staggered, `.body` 20px:

> It blocks the aces they need to continue — and it keeps enough equity to play on.

Then two phrases lift to white weight 600: **blocks the aces** and **keeps enough
equity**. Nothing else moves.

Scene 5 (3.2–4.0s): **held.**

## Frame 6 — The Method

- type: benefit_highlight
- status: animated
- duration: 2s
- transition_in: cut
- poster: 2s
- scene: The camera pulls back; the hand, the decision, the range and the coach coexist, under four restrained words
- voiceover: none — this frame is silent by design
- blueprint: compose
- persuasion: One decision became a complete learning experience
- focal: the composition as a whole
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3)
- sfx: one long soft ambient swell under the pull-back. Nothing percussive.
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/06-the-method.html
- handoff_in: opens on Frame 5's exact end state — surface at 260,230,1000,660 with the grid and cards, coach panel at 1320,330,400,460. **Nothing re-enters at t=0.**
- handoff_out: the whole composition uniformly scaled to 0.82 about the canvas centre and held; the four words at full opacity. Static from 2.0s.

Scene 1 (0.0–0.2s): the inherited state, static. The seam.

Scene 2 (0.2–1.4s): **one slow pull-back** — the entire composition scales uniformly
to 0.82 about the canvas centre on a long decelerating ease. Nothing rearranges;
nothing new appears yet. The elements simply become visible together.

Scene 3 (1.4–2.0s): four words fade up in a single restrained row along the lower
third, `.label` at 14px with 0.18em tracking, evenly spread and widely spaced:

> LEARN. · THINK. · UNDERSTAND. · IMPROVE.

No connecting lines, no numbered steps, no icons, no infographic. Four words and
nothing else.

Scene 4 (2.0–2.5s): **held, completely still.**

## Frame 7 — Brand

- type: cta
- status: animated
- duration: 3.5s
- transition_in: cut
- poster: 2.4s
- scene: Everything clears to the brand frame — spade mark, wordmark, Learn Poker. By Playing., Start Free
- voiceover: "StackedPoker. Learn poker by playing."
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, made quietly, after the argument is won
- focal: the lockup, then the CTA
- roles: assets/logo-8f556ecf.svg = cutout (the spade mark) · assets/favicon.ico = supporting
- sfx: one very subtle tonal accent under the mark. Nothing on the CTA.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/07-brand.html
- handoff_in: opens on Frame 6's exact end state — the 0.82-scaled composition with the four words. **Nothing re-enters at t=0.**

Adapt: keep the signature — the stage clears and the mark resolves into a centred
lockup extended to a CTA. Changed: nothing assembles from parts; the mark is a glyph
in a gradient container beside a wordmark.

**This frame owns the film's only exit.**

Scene 1 (0.0–0.9s): everything fades — the surface, the grid, the coach, the four
words — leaving the ground and its single spotlight. The spotlight stays exactly where
it has been all film; it does not move or brighten.

Scene 2 (0.9–1.5s): the **spade mark** resolves at centre: an 88×88 rounded square
(radius 22px) filled with the brand gradient, a white lucide spade inside it. VO line
6 begins on the name.

Scene 3 (1.5–1.9s): the **wordmark** fades in beneath it, 48px weight 800 — **Stacked**
in white, **Poker** in `.grad`.

Scene 4 (1.9–2.4s): **Learn Poker.** resolves, `.display` 72px, then **By Playing.**
a beat later in `.grad`. Two lines, never one. Opacity and a few pixels of rise only.

Scene 5 (2.4–2.8s): the **Start Free** pill fades up — 224×60, radius 100px, brand
gradient, white 17px weight 600. **No hover state, no pulse, no shine sweep.** It is
the only solid element in the film.

Scene 6 (2.8–3.0s): **completely still.** No jitter, no drift, no final flourish.
