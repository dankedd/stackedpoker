---
format: 1920x1080
duration: 30s
message: "Every decision becomes a lesson — the answer isn't the point, understanding is"
arc: Question → Ask → Turn → Claim → Scope → Close (Demo Loop)
audience: "Poker players who already play but plateaued — they want to understand, not memorise"
mode: autonomous
music: minimal-piano-synth-pad-cinematic
---

## Video direction

Written once; every frame inherits it and its Scene lines carry only the delta.
This film shares its design system with `videos/stackedpoker-launch` — same
`frame.md`, same capture, same fonts — but it is a **quieter, slower cut** with a
third of the words.

**Palette system** — from `frame.md`, nothing invented. `bg #0C101D` is the ground on
every frame. `surface #121726` / `surface-raised #191F2E` are the only other fields.
Ink ladder `text #E6EAF0` → `text-muted #728297` → `text-light #64748B`.
**`primary #8B5CF6` is scarce voltage** — the spotlight, the one highlight bloom, the
one CTA. Glass is `card-bg` 4% violet with a 20% violet hairline and **no shadow
ever**. Small violet text uses `primary-soft #A78BFA`; `#8B5CF6` at small sizes
failed contrast on the previous film. **No green success state anywhere** — no
`positive`, no check marks. That absence is the film's argument.

**Type** — Geist by role from `frame.md`'s ramp. `h1` for the closing headline, `h2`
for surface headings, `h4-eyebrow` for uppercase chrome, `body` for explanation,
`stat-num` for figures. Never a raw family or px.

**Motion grammar + reveal model** — long-tail decel throughout; **`power3` default,
smooth always beats bouncy.** No `back.out` / `bounce.out` / `elastic.out` anywhere.
Entrances use `fromTo`. Everything floats; cards barely rotate; parallax under every
camera move. **Pace is the deliverable** — this is a 30-second film with 34 words, so
most of its running time is picture with no voice over it. Reveal each piece on its
spoken cue where a cue exists, and let the rest breathe.

**The widening motif** — the film pulls back twice, at 0:03 and at 0:18, and that
repetition is deliberate structure: one card → one decision → one environment. Both
pull-backs are single continuous decelerating moves. Neither may be cut in half, and
neither may be followed by a re-push.

**Rhythm / held-frame allocation**

- **Frame 1** opens on near-total stillness — three cards arriving into black — then
  becomes one unbroken pull-back. It holds again on the settled buttons.
- **Frame 2** is the slowest beat in the film. Almost nothing moves except the drawer
  and one range bloom.
- **Frame 3** is the only frame with sustained internal movement, and even there the
  handoffs are morphs, never cuts.
- **Frame 4** is one pull-back into a held spatial composition.
- **Frame 5** ends completely still. No jitter — the film has stopped.

**Negative list — never appears**

- Casino iconography: felt, chips, sunglasses, neon, card-room imagery.
- Stock photography or stock video. Every pixel is product or type.
- **Green check marks, "Correct!", success toasts, exclamation marks.** Explicitly
  forbidden by the brief — the whole point of Frame 2 is what does *not* appear.
- Shadows, decorative glows, floating bokeh, blue-purple "AI" gradients.
- Nav bars, footers, scrollbars, browser chrome, real OS cursors.
- Fast social-cut editing. This film is Apple / Linear / Nothing / Arc, not TikTok.
- **Slideshow failure** (dump in the first 25%, then freeze) and **screensaver
  failure** (many elements drifting to fake life). Both forbidden.
- `repeat` / `yoyo`, `Math.random`, `Date.now`. Every render must be identical.

**Captions: none.** Confirmed by the user — the style references never caption their
product films. The bottom ~17% keep-out band (below y≈897) is still honoured so a
vertical cut can add captions later without re-layout.

**Audio** — the music is a two-part arrangement, not a loop: restrained piano + deep
synth pad for 0:00–0:20, a subtle riser across the seam, rhythm only from 0:20. SFX
stay under the music: a soft card swipe per card, one dry click in Frame 2, quiet
morph swells in Frame 3, one warm resolve on the lockup. No casino sounds.

---

## Frame 1 — The Question

- type: hook
- status: animated
- duration: 7s
- transition_in: cut
- poster: 5s
- scene: Three cards arrive one at a time out of black, then one continuous pull-back reveals the whole decision card and its three buttons
- voiceover: "Every poker player faces the same question." → "What would you do?"
- blueprint: zoom-out-workspace-reveal (Reproduce)
- persuasion: Recognition before information
- beat: one card becomes one decision
- focal: the three board cards, then the decision card that contains them
- roles: assets/logo-8f556ecf.svg = supporting (spade, card chrome only)
- sfx: one soft card swipe per card, three total, each quieter than the last; a low sub-bass swell under the spotlight; nothing on the pull-back
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark
- src: compositions/frames/01-the-question.html

Reproduce: the blueprint's shape is exactly this beat — open TIGHT on one full-bleed
detail, let micro-action play in close-up, then **ONE continuous decelerating
zoom-out reveals the containing whole**, and the frame locks while element-level
payoff carries on. Its signature constraint is that **there is no zoom-in anywhere**.
Keep it.

This is where the user's beats 1 and 2 merge. The script's "de camera zoomt langzaam
uit" runs from the cards to the full card as one move; cutting it at 0:03 would
halve it.

Scene 1 (0.0–0.9s): pure `bg`, empty. An `ambient glow bloom` (`ambient-glow-bloom`)
opens a violet spotlight from zero, tight and small — the frame is close on a table
surface, not on a card yet. No VO.

Scene 2 (0.9–3.0s): the three cards arrive **one at a time**, Q♠ then 7♦ then 2♣,
each on a long-tail settle with a soft swipe, barely rotating. Extreme close-up —
the cards fill ~65% of canvas. VO line 1 runs underneath. No explanation appears; no
labels, no pot, no seat. Just cards.

Scene 3 (3.0–5.2s): **the one continuous decelerating pull-back**
(`multi-phase-camera`). The decision card assembles around the flop as the camera
retreats — pot, hero seat, stack, chrome — never entering, always being revealed.
Three parallax planes. This is the frame's signature move and there is exactly one
of it.

Scene 4 (5.2–6.2s): the camera **locks**. Only now do Fold / Call / Raise settle in
beneath, as one staggered set, as VO line 2 lands. Nothing is pressed.

Scene 5 (6.2–7.0s): held. A `depth-of-field blur` (`depth-of-field-blur`) settles
onto everything except the button row. `subtle jitter` (`sine-wave-loop`, low
amplitude) only. The unanswered question carries the cut.

## Frame 2 — Because the Answer Isn't Enough

- type: feature_showcase
- status: animated
- duration: 5s
- transition_in: cut
- poster: 3.5s
- scene: A click. No verdict, no green check — instead "Let's understand why." and the Coach opens as a range lights up
- voiceover: "Because the answer isn't enough."
- blueprint: panel-edit-live-sync (Adapt)
- persuasion: The differentiator, stated by omission
- beat: the refusal to score you
- focal: the line "Let's understand why." and the range that answers it
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity) · assets/svg-055d040d.svg = supporting (sparkles, coach chrome)
- sfx: one dry click, small; a soft drawer slide; one near-inaudible synth as the range blooms. Nothing celebratory — no chime, no shimmer.
- asset_candidates: assets/svg-a146683f.svg — bot; assets/svg-055d040d.svg — sparkles
- src: compositions/frames/02-understand-why.html

Adapt: keep the signature — **a panel bound to a target surface that reacts inside
the same beat**, camera holding the couple. Changed: the trigger is a committed
answer rather than a scrubbed control, and the panel *explains* instead of *edits*.

**The most important instruction in this frame is a negative one.** When the answer
is committed, there must be **no "Correct!", no green check, no score, no celebration
of any kind.** The screen stays completely neutral for a beat — long enough that the
absence registers — and only then does the quiet line appear. That absence is the
entire idea of the film.

Scene 1 (0.0–0.7s): the decision card from Frame 1, in the position it was left. A
cursor commits one button — `cursor click + ripple` (`cursor-click-ripple`) into a
`button press` (`press-release-spring`). The press is small and dry.

Scene 2 (0.7–1.4s): **nothing happens.** The frame holds neutral. No verdict state,
no colour change, no marker. This silence is written and must not be filled.

Scene 3 (1.4–2.4s): the line **Let's understand why.** fades up quietly beneath the
card — `h2` in `text`, low contrast against the ground, arriving on a long settle
rather than a pop. VO line 3 lands here.

Scene 4 (2.4–3.8s): the Coach drawer **slides in from the right** on a long-tail
settle, taking ~35%; the decision card eases left to make room rather than being
covered. Not a chat bubble — a titled explanation surface.

Scene 5 (3.8–5.0s): **one** range lights up inside the drawer's bound surface by
`keyword glow` (`asr-keyword-glow`), violet, attack-decay-rest — a single bloom, not
a sweep. Held. `depth-of-field-blur` settles everything except the lit range.

## Frame 3 — Understanding

- type: feature_showcase
- status: animated
- duration: 6s
- transition_in: crossfade
- poster: 3s
- scene: Six training surfaces flow through one held window, each handoff a morph rather than a cut
- voiceover: "Understanding is what makes you better."
- blueprint: device-surface-showcase (Adapt)
- persuasion: Breadth, shown without being listed
- focal: the held window itself — the constant through six changes
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3, range trainer) · assets/svg-773de514.svg = supporting (book-open, lesson) · assets/svg-cd31b306.svg = supporting (trophy, achievement) · assets/svg-6145cd5f.svg = supporting (graduation-cap, modules)
- sfx: one quiet morph swell per handoff, five total, each shorter than the last; no cut sounds, because there are no cuts
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3; assets/svg-773de514.svg — book-open; assets/svg-cd31b306.svg — trophy; assets/svg-6145cd5f.svg — graduation-cap
- src: compositions/frames/03-understanding.html

Adapt: keep the signature — **one surface held as hero while its screens cycle
through a real flow**, the camera holding rather than travelling. Changed: the cycle
is six surfaces rather than a device carousel, and every handoff is a
`card morph-anchor` (`card-morph-anchor`) so the container's size, radius and
contents transform between states instead of swapping. The brief's words are "de UI
vloeit in elkaar over" — that is a morph, not a cut.

Order is fixed: range trainer → board builder → decision spot → lesson →
achievement → dashboard. Roughly 1s per state, but the **morph is continuous**, so no
state ever fully stops. All six are real StackedPoker surfaces, not abstractions.

Scene 1 (0.0–1.0s): the window resolves out of the previous frame's drawer by
`scale-swap` (`scale-swap-transition`) — the drawer and the window share a centre, so
the crossfade reads as one object becoming another. **Range trainer**: a 13×13 grid
fills by index-driven sweep. VO line 4 lands across this window.

Scene 2 (1.0–2.0s): morph to **board builder** — the container's proportions shift
and a card lands into a flop slot on the settle.

Scene 3 (2.0–3.0s): morph to **decision spot** — pot, seats, three buttons; one is
already committed, so this reads as a memory of Frame 1 rather than a repeat of it.

Scene 4 (3.0–4.0s): morph to **lesson** — a question and its answer rows, mid-flow.

Scene 5 (4.0–5.0s): morph to **achievement** — a badge resolving. Restrained: no
shimmer, no burst. In this film the achievement is evidence, not a reward.

Scene 6 (5.0–6.0s): morph to **dashboard** — the widest of the six, already reading
as the environment Frame 4 will reveal. Settles and holds. This is the handoff
Frame 4 opens from.

## Frame 4 — One Place

- type: benefit_highlight
- status: animated
- duration: 6s
- transition_in: crossfade
- poster: 4.5s
- scene: The camera pulls further out and the whole learning environment resolves as one floating spatial composition
- voiceover: "One place to learn, train and improve."
- blueprint: grid-card-assemble (Adapt)
- persuasion: Scope, felt rather than counted
- focal: the composition as a whole — no single card wins
- roles: assets/svg-6145cd5f.svg = supporting (graduation-cap, modules) · assets/svg-cd31b306.svg = supporting (trophy, progress) · assets/svg-a146683f.svg = supporting (bot, coach) · assets/svg-8b90c9e1.svg = supporting (grid3x3, training)
- sfx: one long airy swell under the pull-back, resolving as the composition settles; nothing percussive — the rhythm section has not entered yet
- asset_candidates: assets/svg-6145cd5f.svg — graduation-cap; assets/svg-cd31b306.svg — trophy; assets/svg-a146683f.svg — bot; assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/04-one-place.html

Adapt: keep the signature — **glass cards revealed by a camera zoom-OUT that shows
the array inside a vaster whole.** Changed: the cards do not cascade in from nothing;
they are already there, on separate depth planes, and the pull-back is what makes
them legible. The brief says "alles zweeft in een ruimtelijke compositie" — a
composition being revealed, not a grid being built.

This is the film's **second widening**, and it must feel like the same camera as
Frame 1 — same ease, same unhurried rate.

Surfaces present, none labelled with a count: modules, progress, XP, coach, bankroll.
No number is called out. The film never says how many of anything there are.

Scene 1 (0.0–0.8s): open on the dashboard exactly as Frame 3 left it, still settling.
No re-entrance.

Scene 2 (0.8–3.6s): **the one continuous decelerating pull-back**
(`multi-phase-camera`). Surrounding surfaces resolve into view on three depth planes,
parallaxing at different rates — nearest slowest, furthest fastest — so the space
reads as depth rather than as a wall. VO line 5 runs across this window.

Scene 3 (3.6–4.8s): the camera **decelerates to a stop**. Cards settle into their
final float, each at a slightly different z-offset, held apart by `depth-of-field
blur` (`depth-of-field-blur`) — the nearest plane crisp, the furthest softened ~3px.

Scene 4 (4.8–6.0s): held. No further camera move, no re-push. `subtle jitter` only,
low amplitude, and only on the nearest plane. The composition reads as one place.

## Frame 5 — Learn Poker. By Playing.

- type: cta
- status: animated
- duration: 6s
- transition_in: crossfade
- poster: 4.5s
- scene: Everything fades but the MacBook; the mark forms, the headline lands in two beats, Start Free appears
- voiceover: "StackedPoker." → "Learn poker by playing."
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, after the argument is already won
- focal: the lockup, then the CTA
- roles: assets/logo-8f556ecf.svg = cutout (spade — the actual brand mark) · assets/favicon.ico = supporting
- sfx: a soft settle as the composition clears; one warm low resolve on the lockup; a single quiet tick as Start Free lands. The music's rhythm section is running underneath from 0:20 and resolves clean on the final frame.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/05-hero.html

Adapt: keep the signature — **the stage clears and the lockup resolves into a centred
mark**, extended to the CTA. Changed: there is no assembly-from-parts, because the
real mark is a single glyph and faking a build would misrepresent the brand.

**There is no bespoke logo file.** `assets/logo-8f556ecf.svg` is the lucide spade in
`currentColor`; the real mark is that glyph beside **StackedPoker** in Geist. Build
it that way.

**This frame owns the film's only real exit.**

Scene 1 (0.0–1.2s): the spatial composition fades — every plane except one MacBook,
which holds centre-left carrying the interface at rest. Midnight ground, a subtle
violet glow behind it (`ambient-glow-bloom`), nothing else.

Scene 2 (1.2–2.0s): the MacBook eases back and dims. The lockup resolves at centre by
`scale-swap` (`scale-swap-transition`) — spade glyph plus **StackedPoker** in Geist,
one object. VO line 6 lands on the name.

Scene 3 (2.0–3.0s): **"Learn Poker"** lands, `h1`, centred, long-tail settle — then
holds. The hold is written into the script and must not be shortened.

Scene 4 (3.0–4.0s): **"By Playing."** lands as the second beat
(`discrete-text-sequence`). Two beats, never one. VO line 7 resolves across this.

Scene 5 (4.0–4.8s): the **Start Free** pill arrives — solid `primary`, the only
non-glass element in the film. `Free to start · No credit card` fades up beneath it
in `text-muted`.

Scene 6 (4.8–6.0s): held and completely still. **No jitter** — the film has stopped.
Music resolves onto this window and ends clean, not on a fade.
