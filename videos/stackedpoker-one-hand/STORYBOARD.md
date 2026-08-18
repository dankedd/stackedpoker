---
format: 1920x1080
duration: 30s
message: "One hand becomes a complete learning journey"
arc: Hand → Theory → Decision → Range → Explanation → Close (one lesson, six states)
audience: "Poker players evaluating how a platform actually teaches — not what features it has"
mode: autonomous
music: minimal-piano-synth-pad-ambient-calm-no-drums
---

## Video direction

### What this film is, structurally

**One lesson surface that changes state six times.** Not six scenes. The camera
never travels, never zooms, never cuts to another page. The brief's rules 3 and 5
are the whole architecture:

> *"The camera should almost never leave the lesson. The lesson itself transforms."*
> *"Every transition should be a smooth morph."*

Therefore: **no crossfades, no wipes, no camera moves, and no injected transitions.**
Every frame's `transition_in` is `cut`, and every cut falls between two **numerically
identical frozen states** declared in the handoffs below. A cut between two identical
frames is invisible. All morphing happens *inside* a frame, on its own timeline.

**Do not run `transitions.mjs inject` on this project.** A crossfade would dissolve
one state into another and break the illusion of a single continuous surface.

### The shared geometry contract — identical in every frame

Every worker uses these exact numbers. They are what makes six files read as one
surface. Canvas is 1920×1080; y=0 is the top.

**The lesson card** (the constant — one glass surface, `card-bg` 4% violet fill,
1.5px `border` 20% violet hairline, radius 14px, **no shadow**):

| State | x | y | w | h | notes |
| ----- | - | - | - | - | ----- |
| S1 | 660 | 280 | 600 | 420 | the smallest it ever is |
| S2 | 580 | 280 | 760 | 600 | **top edge stays at 280**; it grows down and out |
| S3 | 580 | 280 | 760 | 560 | theory collapses; height shrinks, top still 280 |
| S4 | 530 | 230 | 860 | 660 | widens for the grid |
| S5 | 300 | 230 | 860 | 660 | **same size as S4**, slid left only |
| S6 | — | — | — | — | the card itself fades; only the two poker cards remain |

**The two poker cards — A♠5♠ — are the spine of the film.** They are present in
every state and are never re-dealt, never flipped, never re-entered:

| State | card size | pair x-range | y-range |
| ----- | --------- | ------------ | ------- |
| S1 | 132×186 | 818–1102 (gap 20, centred on 960) | 470–656 |
| S2 | 132×186 | 818–1102 | 470–656 — **identical to S1, they do not move** |
| S3 | 132×186 | 818–1102 | 470–656 — **identical again** |
| S4 | 88×124 | 574–702 (gap 16, left-anchored) | 310–434 |
| S5 | 88×124 | 344–472 | 310–434 — moves left with the card, same size |
| S6 | 132×186 | 818–1102 | 250–436 — returns to its original size, centred |

**Type**, from `frame.md` by role — large, minimal, Apple-style, never cluttered,
**maximum one headline per state and never more than two lines**:

- eyebrow: 13px, weight 600, tracking 0.08em, uppercase, `primary-soft #A78BFA`
- lesson title: 56px, weight 700, tracking −0.02em, `text #E6EAF0`
- theory / coach body: 20px, weight 400, line-height 1.6, `text-muted #728297`
- question: 32px, weight 600, `text #E6EAF0`
- closing headline: 64px, weight 700, tracking −0.02em, `text #E6EAF0`

**Colour** — `bg #0C101D` ground on every frame. **One violet spotlight** only, a
soft radial centred behind the card, and a soft blue ambient glow beneath it. A
subtle blueprint grid may sit on the ground at very low opacity. Violet is scarce:
the spotlight, the eyebrow, the lit range cells, the one CTA. Small violet text uses
`primary-soft #A78BFA` — `#8B5CF6` fails contrast at small sizes.

### Motion law

- **Everything gently transforms.** Long-tail `power3`, no `back.out` / `bounce.out`
  / `elastic.out` anywhere. Nothing spins. Nothing explodes. Nothing flashes.
- **Silence is good.** Long holds are written in and must not be filled. Do not
  animate continuously; a state that has arrived simply reads.
- **One idea per state.** Never introduce a second concept inside a scene.
- Entrances use `fromTo`; initial hidden states use `gsap.set` **outside** the
  timeline, never `tl.set(...)` at position 0.
- Deterministic only: no `Math.random`, no `Date.now`, no `repeat`/`yoyo`, no CSS
  transitions or keyframes for motion.

### Absolutely forbidden in this film

The brief's exclusion list is a hard constraint, not a preference:

**dashboard · XP · achievements · leaderboard · bankroll · modules · pricing ·
settings · statistics · progress bars · notifications · popups · badges · confetti ·
fireworks · particles · complex camera moves · feature lists · marketing buzzwords.**

Also: casino aesthetics, poker chips, money, players, casino tables, any gambling
imagery. **Only product UI.**

And, specific to this project's history — the two previous StackedPoker films both
contained a dashboard state and an achievement beat. **Neither may reappear here.**

**A second hand may never be introduced.** Every card shown anywhere in this film is
A♠ or 5♠. There is no flop, no board, no villain hand, no other combo shown as cards.

### Poker theory

Checked against `docs/Modern Poker Theory.pdf` (via `docs/mpt_fulltext.txt`), preflop
3-bet/4-bet/5-bet chapter, pp. ~231–234 incl. Hand Range 73. The book supports A5s as
a blocker-bluff and uses the phrase *"while retaining good post-flop playability"*.
The on-screen sentences are the user's own copy and are **source reconstruction**, not
transcription. **No frequency, percentage, EV figure or solver output may be printed
anywhere.** The 13×13 grid is a visual model of a range, not a transcribed solution.

### Captions

None. The bottom ~17% (below y≈897) still carries nothing important, so a vertical cut
can add them later without re-layout.

---

## Frame 1 — The Hand

- type: hook
- status: animated
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: Darkness. A lesson card fades in — Suited Aces, and A♠5♠ beneath it. Nothing else, nothing moves.
- voiceover: "Every great decision starts with understanding."
- blueprint: compose
- persuasion: Stillness as confidence
- beat: the hand
- focal: the two cards
- roles: assets/logo-8f556ecf.svg = supporting (spade pip inside the ace card)
- sfx: one soft paper swipe as each card settles, two total, very quiet; a low ambient pad swell under the spotlight. Nothing else.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/01-the-hand.html
- handoff_out: card at x660 y280 w600 h420, opacity 1, no transform. Cards A♠5♠ at 818–1102 × 470–656, opacity 1, no transform. Eyebrow "LESSON" and title "Suited Aces" at full opacity. Spotlight at its settled intensity. Everything static from 4.0s.

Compose: no blueprint fits a state whose payload is stillness. The brief asks for
elegance and reading time, not a reveal shape.

Scene 1 (0.0–1.0s): pure `bg #0C101D`. The violet spotlight blooms very slowly from
zero behind where the card will be, plus a soft blue ambient glow low in the frame.
A blueprint grid sits at ~3% opacity. Nothing else. No VO.

Scene 2 (1.0–2.2s): the lesson card **fades in** — opacity and a 12px rise, nothing
more. It does not scale up, it does not slide in from an edge. The eyebrow **LESSON**
and the title **Suited Aces** fade with it, one beat apart.

Scene 3 (2.2–3.2s): the two cards **A♠** and **5♠** settle in beneath the title, one
then the other, each on a long-tail settle with a soft paper swipe. They barely
rotate — a degree at most. VO line 1 runs across this.

Scene 4 (3.2–5.0s): **held.** Nothing enters, nothing moves, no drift, no jitter.
Almost two full seconds of a still frame so the viewer can read it. This stillness is
the film's opening argument and must not be filled.

## Frame 2 — Theory

- type: feature_showcase
- status: animated
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: Without cutting, the same card grows and a theory block expands beneath the cards; the ace pips glow faintly
- voiceover: "First, understand the concept."
- blueprint: compose
- persuasion: The platform explains before it tests
- beat: theory
- focal: the theory sentence
- roles: assets/logo-8f556ecf.svg = supporting (spade pip, receives the glow)
- sfx: one gentle airy whoosh as the card grows, very soft; a faint shimmer as the pips glow. Nothing else.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/02-theory.html
- handoff_in: opens on Frame 1's exact end state — card x660 y280 w600 h420, cards at 818–1102 × 470–656, title and eyebrow lit. **Nothing re-enters or re-fades at t=0.**
- handoff_out: card at x580 y280 w760 h600, opacity 1. Cards unchanged at 818–1102 × 470–656. Theory paragraph fully visible at full opacity. Ace pips at their settled glow. Static from 4.2s.

Scene 1 (0.0–0.4s): the inherited state, completely static. It must look identical to
the previous frame's final image — this is the seam and it has to be invisible.

Scene 2 (0.4–1.6s): the card **grows**: width 600→760 (so x 660→580) and height
420→600, on one long-tail ease. The top edge stays at y=280 and **the two cards do
not move** — the container grows around them. A soft airy whoosh rides the growth.
VO line 2 lands here.

Scene 3 (1.6–3.0s): a hairline divider fades in below the cards, then the theory
sentence appears beneath it — a per-word staggered reveal
(`dynamic-content-sequencing`), 20px `text-muted`, unhurried:

> Suited aces are powerful bluffing candidates because they block premium hands while
> retaining excellent playability.

Scene 4 (3.0–4.2s): as the sentence completes, the **ace pips inside the cards
receive a subtle glow** (`asr-keyword-glow`, violet, low amplitude). **Nothing else
animates** — this is the only movement in the window.

Scene 5 (4.2–5.0s): **held.** The viewer reads. No motion at all.

## Frame 3 — Decision

- type: feature_showcase
- status: animated
- duration: 6s
- transition_in: cut
- poster: 4.5s
- scene: The theory collapses upward and the same card becomes a decision exercise — BTN opens, A♠5♠, what would you do
- voiceover: "Then make the decision."
- blueprint: compose
- persuasion: You are asked to commit before you are told
- beat: decision
- focal: the unanswered question
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: a gentle airy whoosh as the theory collapses; one tiny synth tick as each button resolves, three total, barely audible. No click — nothing is selected.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/03-decision.html
- handoff_in: opens on Frame 2's exact end state — card x580 y280 w760 h600, theory paragraph visible, pips glowing, cards at 818–1102 × 470–656. **Nothing re-enters at t=0.**
- handoff_out: card at x580 y280 w760 h560. Cards unchanged at 818–1102 × 470–656. "BTN opens.", the question, and three unpressed buttons Fold / Call / 3-Bet all at full opacity. Nothing selected, nothing highlighted. Static from 2.0s onward — a four-second hold.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.2s): the theory sentence **collapses upward** — it fades as it rises
~16px, and the card's height eases 600→560. The title **Suited Aces** fades out with
it. The two cards still do not move. VO line 3 lands here.

Scene 3 (1.2–2.0s): the decision content resolves into the space the theory left:
the context line **BTN opens.** above the cards, the question **What would you do?**
below them, and the three pill buttons **Fold · Call · 3-Bet**, each with a tiny synth
tick as it settles.

Scene 4 (2.0–6.0s): **held for four full seconds.** No answer is selected. No hover,
no highlight, no cursor, no countdown, no hint. Absolutely nothing moves. The brief
requires at least four seconds here and this is the longest still frame in the film —
the viewer is meant to actually decide.

## Frame 4 — Range

- type: feature_showcase
- status: animated
- duration: 6s
- transition_in: cut
- poster: 5s
- scene: The buttons fade and a 13×13 range grid resolves in the same card; A5s glows alone, then the surrounding bluffs illuminate
- voiceover: "Learn the range, not just the hand."
- blueprint: compose
- persuasion: The hand was never the point — the strategy is
- beat: range
- focal: the single lit A5s cell, then the bluff cluster around it
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3, range chrome)
- sfx: a gentle airy whoosh as the grid resolves; one soft shimmer when A5s lights; a second, quieter shimmer as the bluff combinations illuminate.
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/04-range.html
- handoff_in: opens on Frame 3's exact end state — card x580 y280 w760 h560, cards at 818–1102 × 470–656, buttons and question present. **Nothing re-enters at t=0.**
- handoff_out: card at x530 y230 w860 h660. Poker cards at 88×124, 574–702 × 310–434. Full 13×13 grid present; A5s cell and the surrounding bluff cluster lit; all other cells at their dim resting state. Static from 5.2s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.4s): the buttons and the question **fade out in place** — no slide, no
collapse. Simultaneously the card eases to x530 y230 w860 h660 and the two poker cards
shrink 132×186 → 88×124 and travel to 574–702 × 310–434, becoming an anchor in the
corner rather than the subject. One continuous transform, one ease. VO line 4 lands.

Scene 3 (1.4–2.6s): the **13×13 grid resolves** — 13 columns × 40px cells with 3px
gaps, occupying 700–1256 × 300–856. It fades up as a whole at a dim resting opacity;
cells do not cascade or stagger in one by one. Row/column labels sit in
`text-light`, very small.

Scene 4 (2.6–3.6s): **A5s alone lights.** One cell, violet, on a soft shimmer. Then
**pause** — a full held beat with nothing else happening. This single-cell moment is
the pivot of the whole film.

Scene 5 (3.6–5.2s): the **surrounding bluff combinations softly illuminate** — the
suited-ace cluster and the neighbouring suited bluffs, arriving gently and
index-staggered, at a lower intensity than A5s so the hand stays the brightest thing
on the grid. Nothing flashes.

Scene 6 (5.2–6.0s): **held.** The viewer sees the hand inside the strategy.

## Frame 5 — Explanation

- type: feature_showcase
- status: animated
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: The range slides slightly left and one compact AI Coach panel opens on the right with a single explanation
- voiceover: "Finally, understand why."
- blueprint: compose
- persuasion: The answer was never the product — the reasoning is
- beat: explanation
- focal: the one explanation sentence
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity)
- sfx: one glass slide as the panel opens; a faint synth tick under each emphasised phrase, three total, almost inaudible.
- asset_candidates: assets/svg-a146683f.svg — bot
- src: compositions/frames/05-explanation.html
- handoff_in: opens on Frame 4's exact end state — card x530 y230 w860 h660, poker cards at 574–702 × 310–434, grid lit as Frame 4 left it. **Nothing re-enters at t=0.**
- handoff_out: card at x300 y230 w860 h660 with the grid still lit. Coach panel at x1210 y330 w470 h460, fully open, its sentence complete with the three emphases lit. Static from 4.2s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.3s): the whole lesson card **slides left**, x530 → x300, same size,
one long-tail ease. The grid and the poker cards travel with it as one object. This is
a slide, not a camera move — the frame does not pan.

Scene 3 (1.3–2.3s): the **AI Coach panel opens** at x1210 y330 w470 h460 — a glass
surface arriving with a soft horizontal expansion and a glass-slide sound. A small
header identifies it. **It is not a chat.** There is no thread, no bubbles, no input
box, no avatar row, no typing indicator. VO line 5 lands as it settles.

Scene 4 (2.3–3.6s): **one** explanation appears inside it, per-word staggered:

> A5s blocks strong Ax combinations while maintaining excellent playability when
> called.

Scene 5 (3.6–4.2s): three phrases receive **subtle emphasis** — **blocks**,
**strong Ax**, **playability** — lifting to `text` weight 600 with a faint violet
underline, one after another. Nothing else moves.

Scene 6 (4.2–5.0s): **held.**

## Frame 6 — Close

- type: cta
- status: animated
- duration: 3s
- transition_in: cut
- poster: 2.4s
- scene: Everything fades but A♠5♠; the mark, the headline and Start Free resolve, and the film stops
- voiceover: "StackedPoker. Learn poker by playing."
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, made quietly
- beat: close
- focal: the two cards, then the lockup
- roles: assets/logo-8f556ecf.svg = cutout (the brand mark) · assets/favicon.ico = supporting
- sfx: one long gentle airy whoosh as everything clears; a single warm low resolve under the lockup. Nothing on the CTA.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/06-close.html
- handoff_in: opens on Frame 5's exact end state — lesson card at x300 y230 w860 h660 with the grid lit, coach panel open at x1210 y330 w470 h460. **Nothing re-enters at t=0.**

Adapt: keep the signature — the stage clears and the mark resolves into a centred
lockup extended to a CTA. Changed: nothing assembles from parts. The mark is a single
glyph plus a wordmark and faking a build would misrepresent the brand.

**There is no bespoke logo file.** `assets/logo-8f556ecf.svg` is the lucide spade in
`currentColor`; the mark is that glyph beside **StackedPoker** in Geist.

**This frame owns the film's only exit.**

Scene 1 (0.0–1.0s): everything fades — the lesson card, the grid, the coach panel,
the spotlight's edge — **except the two poker cards**, which simultaneously return to
132×186 and travel back to 818–1102, landing at y=250–436. They end the film at the
size and position they began it. One continuous move, no cut.

Scene 2 (1.0–1.7s): the **mark** fades in below them — spade glyph plus
**StackedPoker** in Geist, one object, centred. VO line 6 begins on the name.

Scene 3 (1.7–2.4s): the headline resolves in two lines — **Learn Poker** then
**By Playing.** — the second a beat after the first. No scale, no slide; opacity and
a few pixels of rise.

Scene 4 (2.4–2.8s): the **Start Free** pill fades up, solid `primary` — the only
solid element in the entire film — with *Free to start · No credit card* beneath it
in `text-muted`.

Scene 5 (2.8–3.0s): **completely still.** No jitter, no drift, no final flourish. The
brief's last words are "just confidence."
