---
format: 1920x1080
duration: 60s
message: "This is what learning poker should look like — you decide first, then you understand why"
arc: Hook → Pain → Agitation → Solution tease → Product → Proof → Scale → CTA (PAS)
audience: "Poker players who already play but plateaued — they've watched the training videos and still freeze on real decisions"
mode: collaborative
music: cinematic-ambient-electronic
---

## Video direction

Written once; every frame inherits it and its own Scene lines carry only the delta.

**Palette system** — from `frame.md`, nothing invented. `bg #0C101D` is the ground
on every single frame. `surface #121726` / `surface-raised #191F2E` are the only
other fields. Ink ladder: `text #E6EAF0` for headlines, `text-muted #728297` for
body, `text-light #64748B` for chrome. **`primary #8B5CF6` is scarce voltage** —
eyebrows, numerals, the one CTA, the highlight bloom, and nothing else. Glass is
`card-bg` (4% violet) with a `border` (20% violet) hairline and **no shadow ever**;
that restraint is the premium signal. `negative #B41C22` appears exactly twice, in
Frame 2. `positive #10B981` appears only on the AVAILABLE NOW chips in Frame 8.
Ratio target across the film: ~95% midnight, ~5% violet.

**Type** — Geist by role from `frame.md`'s ramp: `h1` for the closing headline,
`h2` for surface headings, `h4-eyebrow` for all uppercase chrome, `body` for
explanation text, `stat-num` / `metric-value` for every number. Never a raw family
or px.

**Motion grammar + reveal model** — long-tail decel throughout; **`power3` is the
default and smooth always beats bouncy.** No `back.out` / `bounce.out` /
`elastic.out` anywhere in this film — the brief's own motion law is "alles beweegt
alsof het zweeft, geen harde animaties, veel easing," which is the same instruction.
Every frame is **paced to the voiceover**: at t=0 only what the VO is saying enters,
and each further piece reveals on its spoken cue, weighted into the back ~50%.
Entrances use `fromTo` so a seek to t=0 lands correctly. Parallax is a first-class
citizen here — depth layers travel at different rates under every camera move.

**Rhythm / held-frame allocation** — the film breathes deliberately:

- **Held frames: 1, 4, 9.** Frame 1 holds an unanswered question — the hold *is*
  the hook. Frame 4 holds calm as the argument. Frame 9 holds the lockup. In all
  three, stillness is the payload; at most `subtle jitter` (`sine-wave-loop`, low
  amplitude) keeps them from reading dead.
- **Kinetic frames: 2, 3.** The only two allowed to feel uncomfortable. Frame 3 is
  the single busiest frame in the film and exists to make Frame 4 land.
- **Continuous-camera frames: 5, 7, 8.** One unbroken move each, never two.
- **Coupled frame: 6.** The lowest, slowest beat — panel and surface move together.

**Negative list — never appears:**

- Casino iconography of any kind: felt, chips, sunglasses, neon, card-room imagery.
  This is a product film, not a gambling ad.
- Stock photography or stock video. Every pixel is product or type.
- Shadows, glows-as-decoration, floating bokeh, generic blue-purple "AI" gradients.
- Nav bars, footers, scrollbars, browser chrome, real OS cursors.
- **Slideshow failure** — content dumped in the first 25% then frozen. Forbidden.
- **Screensaver failure** — many elements drifting independently to fake life.
- **Lazy breathing** — circular scale loops on cards or text. Forbidden.
- **Bad back-half pan/push** — no camera move in the later 50% of a frame that the
  frame did not start with (frames 5, 7 and 8 start with theirs and carry it).
- `repeat` / `yoyo`, `Math.random`, `Date.now`. Every render must be identical.

**Durations are deliberate, and `sync-durations` was deliberately NOT run.**
The pipeline's duration sync overwrites each frame's `duration:` with its raw voice
length. This film is ~16.3s of speech across 60s — the silence is the design, not a
gap. Running the sync would have set Frame 1 to 0.99s, Frame 5 to 2.14s and Frame 6
to 1.38s, collapsing the film to roughly 21s and destroying every hold, the one-take
station sweep, and the clause-keyed coupling.

The sync exists to guarantee a frame is long enough for its narration. That was
checked instead, line by line: **the longest VO line is 2.82s and the shortest frame
is 4s**, so every line already fits inside its frame with margin. The sync could only
ever shorten here, never lengthen — it solves nothing and breaks the approved plan.
Frame durations below are therefore the storyboard's own, and must stay that way.

**Caption-band keep-out** — the bottom ~17% (below y≈897) carries the caption pill.
All content plans into the top ~83%. The sketch board placed VO strings low as
annotation labels only; those are sketch furniture and do not survive the build.

---

## Frame 1 — The Question

- type: hook
- status: animated
- duration: 4s
- transition_in: cut
- poster: 3s
- scene: A decision card rises out of pure black under a violet spotlight; Fold / Call / Raise appear and nothing is clicked
- voiceover: "What would you do?"
- blueprint: compose
- persuasion: Tension before information
- beat: the unanswered question
- focal: the decision card (built surface, not a captured asset)
- roles: assets/logo-8f556ecf.svg = supporting (spade, small, card chrome only)
- sfx: soft card swipe on the card's arrival; one low sub-bass swell under the spotlight. No click — nothing is pressed.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark
- src: compositions/frames/01-the-question.html

Open cold on black. A soft violet pool blooms from nothing and a single glass
decision card lifts into it — the real StackedPoker spot layout: pot, board,
hero seat, stack. Flop **Q♠ 7♦ 2♣**, hero to act. Three buttons settle in
underneath: Fold, Call, Raise.

Then the frame simply holds. Nobody clicks. The silence is the hook — the viewer
answers the question in his own head before the film has told him anything.

No blueprint fits a shot whose payload is a **held, unanswered question**; the
Hook shapes all resolve into a payoff and this one deliberately refuses to.
Composed from the motion vocabulary.

Compose: the whole shot is one slow rise into a hold. Nothing resolves.

Scene 1 (0.0–1.1s): pure `bg` field, empty. An `ambient glow bloom`
(`ambient-glow-bloom`) opens the violet spotlight pool from zero at frame centre —
Centered, the pool reaching ~45% of canvas. Nothing else exists yet. No VO.

Scene 2 (1.1–2.0s): the glass decision card **rises** into the pool from below on a
smooth long-tail settle (`spring-pop-entrance`, smooth register — no overshoot),
barely rotating, as the brief's motion law demands. Layered-depth: pool behind,
card mid, board cards front. Card occupies ~40% of canvas, upper-centre.

Scene 3 (2.0–2.8s): as the VO lands **"What would you do?"**, the three board cards
reveal left-to-right by `per-word staggered reveal` cadence
(`dynamic-content-sequencing`) — Q♠, then 7♦, then 2♣, each on its own beat with a
soft card-swipe. The pot and hero readout fade up behind them.

Scene 4 (2.8–3.4s): the three buttons arrive as one staggered set — Fold, Call,
Raise — and stop. A `depth-of-field blur` (`depth-of-field-blur`) settles ~2px onto
everything except the button row, so the eye is parked exactly where the decision
lives.

Scene 5 (3.4–4.0s): **held.** Nothing enters, nothing moves, no camera drift. Only
`subtle jitter` (`sine-wave-loop`, low amplitude) on the card keeps the frame from
reading dead. The absence of a click is the content of this window.

## Frame 2 — Everyone Knows This Feeling

- type: pain_point
- status: animated
- duration: 5s
- transition_in: cut
- poster: 3s
- scene: The same card, pinned; three different players commit and each answer freezes into doubt
- voiceover: "Every poker session is a series of decisions."
- blueprint: fixed-anchor-cycle (Adapt)
- persuasion: Pain recognition — "that's me"
- beat: three commits, no confidence
- focal: the pinned decision card
- roles: assets/svg-0a3176ec.svg = supporting (user, player identity chip) · assets/svg-87120f11.svg = supporting (circle-check, state marker)
- sfx: one click tick per commit (three total), each dry and small; a short muted thud on each red freeze. No casino sounds.
- asset_candidates: assets/svg-0a3176ec.svg — user; assets/svg-87120f11.svg — circle-check
- src: compositions/frames/02-everyone-knows.html

The card from Frame 1 never moves — it is the pinned anchor. Only the *answer*
cycles. A cursor commits **Call**; the frame freezes and a red hairline
(`negative #B41C22`) snaps around the card. Hard cut: another player takes
**Raise** — the same freeze. Hard cut: **Fold** — and this time no verdict at
all, just the hesitation held a beat too long.

Role stretch, deliberate: `fixed-anchor-cycle` is menued under Hook / Benefits /
Brand_Outro, but its actual mechanic — one element pinned while the adjacent
region hard-cuts through discrete states — is precisely this beat. The menu is
soft and story truth comes first.

Adapt: keep the signature — one element **pinned and never moving** while the
adjacent region hard-cuts through discrete states. Changed: the cycling region is
a button row and its verdict, not a text carousel; and the cadence decelerates
instead of accelerating, because the third state has to land as doubt rather than
as a flourish.

Scene 1 (0.0–0.6s): the card is already there, in the exact position Frame 1 left
it — this is a hard cut, not a re-entrance, and it must not re-animate. Centered,
~40% of canvas. VO opens.

Scene 2 (0.6–1.7s): a cursor arrives on **Call** and presses — `cursor click +
ripple` (`cursor-click-ripple`) into a `button press` (`press-release-spring`).
The instant it lands, the card's hairline snaps to `negative` and everything stops:
a genuine freeze, one frame of full stillness.

Scene 3 (1.7–2.8s): **cut-the-curve** seam (`cut-catalog.md`) — matched direction
and velocity across the cut so it reads as one continuous move rather than a
slideshow jump. New player chip, cursor already travelling, commits **Raise**. Same
press, same red freeze. The repetition is the argument.

Scene 4 (2.8–4.0s): same seam again into **Fold** — but this time the press lands
and **no verdict arrives**. The hairline stays neutral. The frame simply waits.

Scene 5 (4.0–5.0s): as the VO closes on *"a series of decisions"*, the card holds
and a `depth-of-field blur` (`depth-of-field-blur`) creeps outward from the button
row. Held; `subtle jitter` only. The discomfort is the point.

## Frame 3 — What Everybody Does Instead

- type: pain_point
- status: animated
- duration: 7s
- transition_in: cut
- poster: 5s
- scene: Video thumbnails, PDFs, charts and notes accumulate until they crowd the frame from every edge
- voiceover: "Most players spend hours watching..."
- blueprint: overwhelm-surround (Reproduce)
- persuasion: Pain agitation
- beat: buried
- focal: the accumulating clutter field itself
- roles: assets/svg-773de514.svg = supporting (book-open, PDF markers) · assets/svg-6145cd5f.svg = supporting (graduation-cap, course markers) · assets/svg-8b90c9e1.svg = supporting (grid3x3, chart markers)
- sfx: a slow riser building across the whole frame; layered paper/card shuffles thickening as density grows. Deliberately the noisiest 7 seconds in the film.
- handoff_out: the accumulated clutter field — ~40 cards filling the frame edge-to-edge, opacity 1, centre of mass at frame centre, drifting inward at ~6px/s. Passes to Frame 4 unbroken.
- asset_candidates: assets/svg-773de514.svg — book-open; assets/svg-6145cd5f.svg — graduation-cap; assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/03-traditional-learning.html

Training videos, PDF chapters, preflop charts, handwritten notes — recognizable
surfaces, none of them readable, all of them *stuff*. They assemble in layers and
then close in from all four edges rather than being zoomed into. The frame gets
heavier and heavier until there is no air left in it.

This is the one beat allowed to break the film's calm. It has to earn Frame 4.

Reproduce: the blueprint's shape maps cleanly — accumulation, then closing in from
all sides rather than zooming into. The avatar-morph slot is the one thing dropped;
this audience is watching a screen, not being represented on it. The signature —
**surrounded, not zoomed-into** — is kept exactly.

Scene 1 (0.0–1.4s): `bg` field with the calm lesson surface still faintly present
from the previous beat, then the first ring of clutter assembles by `depth scatter
assemble` (`depth-scatter-assemble`) — six video cards tumbling in from 3D space,
staggered by index. Layered-depth, 3 layers. VO begins on *"Most players..."*.

Scene 2 (1.4–3.2s): as the VO reaches **"spend hours"**, the second and third rings
arrive — PDFs, charts, notes — each ring staggered outward from centre. Density
climbs past ~60% of canvas. Deterministic stagger from element index only, never
random.

Scene 3 (3.2–5.0s): the fourth ring fills the corners. A `motion blur streak`
(`motion-blur-streak`) rides the fastest incoming cards so the accumulation reads
as velocity, not as placement.

Scene 4 (5.0–6.2s): on **"watching..."** the whole field begins closing **inward
from all four edges** simultaneously — the blueprint's signature. Nothing zooms;
the frame is being crowded, not approached. The last sliver of `bg` shrinks toward
centre.

Scene 5 (6.2–7.0s): everything blurs off-focus together (`depth-of-field-blur`) as
the VO's ellipsis trails out. The field is now at full density, opacity 1, drifting
inward at ~6px/s — **exactly the state `handoff_out` promises Frame 4.** Do not
resolve it here; Frame 4 owns the release.

## Frame 4 — There Is a Better Way

- type: product_intro
- status: animated
- duration: 4s
- transition_in: cut
- poster: 3s
- scene: The clutter implodes to a point and flashes out; one calm StackedPoker surface is left in all that space
- voiceover: "We believe there's a better way."
- blueprint: titlecard-reveal (Adapt)
- persuasion: Relief — the turn
- beat: the release
- focal: the single lesson surface
- roles: assets/logo-8f556ecf.svg = supporting (spade, lesson chrome)
- sfx: one deep implosion whoosh collapsing to silence, then a single soft chime on the reveal. The music drops out entirely for ~0.4s at the flash — the silence is the effect.
- handoff_in: the clutter field arrives exactly as Frame 3 left it — ~40 cards, opacity 1, centred, drifting inward at ~6px/s. It collapses from that state; it does not re-enter.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/04-better-way.html

Targeted GSAP implosion, not a shader wipe (the user declined that on render
cost). Every card is pulled toward a single point on a steep ease, the point
overshoots into a short violet light flash, and the flash clears to reveal one
StackedPoker lesson surface sitting in a lot of empty midnight.

`titlecard-reveal`'s wipe-away-to-reveal, used at its calmest: low motion IS the
payload here. After Frame 3 the stillness does the arguing.

Adapt: keep the signature — a busy field **wiped away to reveal one clean card**,
then a still hold. Changed: the wipe is an inward implosion to a point rather than
a lateral wipe, because Frame 3 hands over a field that is already converging.

Scene 1 (0.0–0.5s): the inherited clutter field, live and still drifting inward.
**It must not re-enter or re-fade-in** — it is already on screen at opacity 1. This
is the seam the handoff exists to protect.

Scene 2 (0.5–1.1s): every card is pulled to a single centre point —
`cluster→outward expansion` (`center-outward-expansion`) run **in reverse**, all
elements collapsing inward in lockstep on a steep long-tail curve, with
`motion-blur-streak` on the travel. Density goes from ~95% of canvas to nothing.

Scene 3 (1.1–1.4s): the collapse point blooms into a short violet light flash
(`ambient-glow-bloom`) and clears. Music drops out here. This is the film's only
percussive moment.

Scene 4 (1.4–2.3s): the flash resolves into one glass lesson surface, centred,
deliberately small — ~30% of canvas — with a lot of empty `bg` around it. It
arrives by `scale-swap` (`scale-swap-transition`) out of the flash, so the flash and
the card share one centre and read as one continuous object.

Scene 5 (2.3–4.0s): **held.** As the VO says *"a better way"*, the three answer
pills fade up beneath the question — the only reveal in this window — and then
everything stops. No camera, no drift, `subtle jitter` at most. After Frame 3's
noise, four seconds of air is the entire argument.

## Frame 5 — Learn by Deciding

- type: feature_showcase
- status: animated
- duration: 12s
- transition_in: crossfade
- poster: 6s
- scene: Eight real training surfaces laid side by side on one plane; a single slow camera glides past them with parallax, never cutting
- voiceover: "Learn by making real decisions."
- blueprint: spatial-pan-stations (Adapt)
- persuasion: Proof by breadth, without a feature list
- beat: the sweep
- focal: the range grid station (station 02) — the visual signature of the product
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3, range station) · assets/svg-ce90c9b0.svg = supporting (gamepad2, drag & drop) · assets/svg-773de514.svg = supporting (book-open, board builder) · assets/svg-a146683f.svg = supporting (bot, hand reading) · assets/svg-cd31b306.svg = supporting (trophy, position trainer)
- sfx: one continuous low airy bed under the whole move; a small hover synth as the camera centres each station — eight in total, each quieter than a click. Never a cut sound, because there are no cuts.
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3; assets/svg-ce90c9b0.svg — gamepad2; assets/svg-773de514.svg — book-open; assets/svg-a146683f.svg — bot; assets/svg-cd31b306.svg — trophy
- src: compositions/frames/05-interactive-learning.html

**The scene the user re-cut.** The script asked for eight shots in twelve
seconds; at ~1.5s each that reads as a sizzle reel and contradicts the film's own
motion law. Instead the eight surfaces are pre-placed as labeled stations on one
oversized canvas and a single virtual camera travels the whole length in one
unbroken decelerating move, layers parallaxing at different rates.

Stations, in order: decision spot → range grid (13×13, the real
`PokerRangeGrid`) → board builder → drag & drop → multiple choice → hand reading
→ EV tree → position trainer. Each one *animates as the camera reaches it* — a
range cell lights, a card lands, a branch draws — so the plane is alive rather
than a row of screenshots.

Role stretch again: `spatial-pan-stations` is menued under Hook / Problem /
Product_Intro, but its signature move is literally "pre-placed labeled stations
on one oversized canvas traversed by a single virtual camera." It is the shape
the user chose.

Adapt: keep the signature — **pre-placed stations on one oversized canvas
traversed by a single virtual camera.** Changed: the blueprint's *repeated* pans
that centre-and-hold each station become **one continuous unbroken traverse** with
no stops, because the user explicitly chose flow over cuts. The per-station payoff
survives as element motion firing as the camera arrives, not as a pause.

The critical constraint for the worker: **there is exactly one camera move in this
frame.** Not eight. `pan / focus-lock` (`viewport-change`) on a single `.world`
wrapper, one tween, `power3`, running 0.4s → 11.2s. Everything else is element
motion on the plane underneath it.

Scene 1 (0.0–1.6s): crossfade in already moving — the camera is mid-travel when the
frame opens, which is what makes it read as one continuous film. Station 01
(decision spot) is centred; its Fold/Call/Raise row reveals as the VO says
**"Learn by making real decisions."** Layered-depth, 3 parallax planes: labels
fastest, cards mid, ground slowest.

Scene 2 (1.6–3.2s): camera reaches station 02, the **range grid** — the focal of the
whole frame. The 13×13 grid fills by `bars / progress` cadence
(`stat-bars-and-fills`), cells lighting in a deterministic index-driven sweep from
AA outward. Grid occupies ~45% of canvas as it passes. VO is already finished; from
here the picture carries it alone.

Scene 3 (3.2–4.8s): station 03, **board builder** — a card lifts off the tray and
lands in a flop slot on a long-tail settle, with a soft swipe. One action, complete,
as the camera passes.

Scene 4 (4.8–6.2s): station 04, **drag & drop** — two hands travel from the source
pool into the value and bluff buckets, `cursor-click-ripple` on each drop.

Scene 5 (6.2–7.6s): station 05, **multiple choice** — four answer rows reveal by
`per-word staggered reveal` cadence (`dynamic-content-sequencing`) and one commits.

Scene 6 (7.6–9.0s): station 06, **hand reading** — a villain range visibly narrows,
cells dimming out in sequence.

Scene 7 (9.0–10.4s): station 07, **EV tree** — branches draw themselves by
`SVG self-draw` (`svg-path-draw`), the one place in the film where a line literally
writes itself.

Scene 8 (10.4–12.0s): station 08, **position trainer** — the 6-max seat ring
completes and the camera **decelerates to a stop** on it. The move ends by settling,
never by cutting. Held on the last ~0.6s; `subtle jitter` only.

## Frame 6 — Understand Why

- type: feature_showcase
- status: animated
- duration: 7s
- transition_in: cut
- poster: 5s
- scene: An answer is committed, the AI Coach drawer slides open, and every claim it makes lights up the board and the range as it says it
- voiceover: "Understand why."
- blueprint: panel-edit-live-sync (Adapt)
- persuasion: The differentiator — this is the thing nobody else has
- beat: explanation and evidence as one gesture
- focal: the coupling itself — drawer text and the surface it lights
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity) · assets/svg-055d040d.svg = supporting (sparkles, coach chrome)
- sfx: one click tick on the commit; a soft drawer slide; then three near-inaudible hover synths, one per highlight fire. The quietest frame in the film apart from Frame 1.
- asset_candidates: assets/svg-a146683f.svg — bot; assets/svg-055d040d.svg — sparkles
- src: compositions/frames/06-ai-coach.html

The user commits an answer. The result resolves. Then the Coach drawer slides in
from the right — not a chat bubble, a coach: it writes

> "Your reasoning wasn't wrong..."

then, after a beat,

> "But villain's range changes everything."

and this is the point of the frame: **as each clause lands, the surface it refers
to lights up.** "Villain's range" → cells bloom across the range grid. "This
board" → the flop cards lift and rim-light. "At this depth" → the stack column
pulses. The explanation and the evidence are the same gesture.

`panel-edit-live-sync` is menued for live *editing*; the coupling mechanic —
a panel bound to a target surface that reacts inside the same beat — is exactly
what carries this shot.

Adapt: keep the signature — **a panel bound to a target surface that reacts inside
the same beat**, camera holding the couple and never losing it. Changed: the panel
*explains* rather than *edits*, so the trigger is a clause of text landing rather
than a control being scrubbed. The binding is identical; only the input differs.

**The worker must not let a highlight fire early.** Each highlight is keyed to its
clause. Firing them together collapses the entire point of the frame.

Scene 1 (0.0–0.8s): the lesson surface fills the frame, asymmetric — an answer is
committed via `button press` (`press-release-spring`) and the result resolves. No
drawer yet. VO has not started.

Scene 2 (0.8–1.8s): the coach drawer **slides in from the right** on a long-tail
settle, taking the right ~37%; the lesson surface eases left to make room rather
than being covered. Layout becomes asymmetric 63/37, held for the rest of the frame.
The VO lands **"Understand why."** here — early, then the picture takes over.

Scene 3 (1.8–3.0s): the first line types on by `type-on with caret`
(`discrete-text-sequence` + `context-sensitive-cursor`) — *"Your reasoning wasn't
wrong..."* Nothing on the left surface moves yet. That restraint is what makes
Scene 4 land.

Scene 4 (3.0–4.3s): the second line types — *"But villain's range changes
everything."* — and **on the words "villain's range"**, cells bloom across the range
grid by `keyword glow` (`asr-keyword-glow`), violet, attack-decay-rest. First
coupling fires.

Scene 5 (4.3–5.4s): the explanation body arrives clause by clause. On **"this
board"**, the three flop cards lift and rim-light (`asr-keyword-glow`). Second
coupling.

Scene 6 (5.4–6.3s): on **"at this depth"**, the stack column pulses. Third and last
coupling. All three highlights are now lit simultaneously for the first time — the
whole argument visible at once.

Scene 7 (6.3–7.0s): held. `depth-of-field-blur` settles everything except the three
lit regions. No camera move. This is the film's lowest, slowest moment and it should
feel like it.

## Frame 7 — Progress You Can See

- type: benefit_highlight
- status: animated
- duration: 8s
- transition_in: crossfade
- poster: 5s
- scene: The camera pulls back off the lesson to reveal the whole dashboard, and the progress numbers finish arriving after it locks
- voiceover: "Track every step of your journey."
- blueprint: zoom-out-workspace-reveal (Reproduce)
- persuasion: Momentum — effort compounds and is visible
- beat: the pull-back
- focal: the XP counter and level ring
- roles: assets/svg-cd31b306.svg = supporting (trophy, badges) · assets/svg-6145cd5f.svg = supporting (graduation-cap, modules) · assets/svg-055d040d.svg = supporting (sparkles, XP) · assets/svg-87120f11.svg = supporting (circle-check, completed)
- sfx: a rising airy swell under the pull-back; one subtle achievement shimmer on the badge flip — the only shimmer in the entire film, so it has to be earned; small ticks under the counter climb.
- asset_candidates: assets/svg-cd31b306.svg — trophy; assets/svg-6145cd5f.svg — graduation-cap; assets/svg-055d040d.svg — sparkles; assets/svg-87120f11.svg — circle-check
- src: compositions/frames/07-progress.html

One continuous decelerating pull-back — the script's own "camera zoomt uit" —
from the lesson surface out to the containing dashboard. The frame locks, and
*then* the payoff completes at element level: the XP bar fills and the counter
counts up, an achievement badge flips in with a shimmer, the streak counter ticks
over, the leaderboard rows settle, the bankroll curve draws.

**No flame or zap icon exists in the capture** — the site renders them inline and
they were not downloaded as files. The streak is therefore a `stat-num` plus its
label, with no icon. Do not substitute a lookalike from another set.

Figures are the site's own demo values, marked as such on the live site:
**Level 12 · 8.420 XP · 580 XP to Level 13 · 14 day streak · 11 badges ·
10 modules.** Do not invent different ones.

Reproduce: the blueprint maps exactly — open tight on one surface, **one continuous
decelerating zoom-out reveals the containing whole**, the frame locks, and
element-level payoff carries on after the lock. The signature is that there is
**no zoom-in anywhere** in this frame. Keep it.

This is the film's one dense frame, and `frame.md` sanctions it explicitly: *"the
dashboard is the one dense exception."*

Scene 1 (0.0–1.0s): open tight on the lesson surface, filling the frame — the same
surface Frame 6 ended on, so the crossfade reads as continuous. VO has not started.

Scene 2 (1.0–3.4s): **the one continuous pull-back** (`multi-phase-camera`,
decelerating, no re-push afterwards). The dashboard assembles into view around the
shrinking lesson card as the camera retreats. VO lands *"Track every step of your
journey."* across this window. Layered-depth, 3 planes, parallaxing.

Scene 3 (3.4–4.0s): the camera **locks**. From here the frame does not move again —
this is the blueprint's hinge, and any further camera work would break it.

Scene 4 (4.0–5.2s): payoff begins at element level. The XP bar fills and the counter
climbs to **8.420 XP** by `value-scaled counter` (`counting-dynamic-scale`) beside
the level ring, which sweeps to **12** by `bars / progress` (`stat-bars-and-fills`).
`stat-num` in `primary`.

Scene 5 (5.2–6.2s): the achievement badge **flips in** with the film's single
shimmer. The streak counter ticks to **14**, badges to **11**, modules to **10**,
staggered by index — never simultaneously.

Scene 6 (6.2–7.2s): the leaderboard rows settle in sequence and the bankroll curve
draws left-to-right by `SVG self-draw` (`svg-path-draw`).

Scene 7 (7.2–8.0s): held, locked, still. `subtle jitter` at most. Everything arrived
after the lock, which is exactly what the blueprint promises.

## Frame 8 — How Far It Goes

- type: benefit_highlight
- status: animated
- duration: 8s
- transition_in: crossfade
- poster: 5s
- scene: Module cards cascade into a roadmap, then the camera pulls back and the path keeps going past the ones that are live
- voiceover: "From your first hand to advanced strategy."
- blueprint: grid-card-assemble (Reproduce)
- persuasion: Scale, framed honestly
- beat: the road keeps going
- focal: the live module row
- roles: assets/svg-6145cd5f.svg = supporting (graduation-cap, module marks) · assets/svg-87120f11.svg = supporting (circle-check, AVAILABLE NOW) · assets/svg-24e61d31.svg = supporting (construction, mapped) · assets/svg-366ef28e.svg = supporting (arrow-right, path direction)
- sfx: a soft card swipe per module card as it lands, staggered; one low swell under the pull-back. Nothing triumphant — the scale should read as calm, not as a boast.
- asset_candidates: assets/svg-6145cd5f.svg — graduation-cap; assets/svg-87120f11.svg — circle-check; assets/svg-24e61d31.svg — construction; assets/svg-366ef28e.svg — arrow-right
- src: compositions/frames/08-scale.html

Module cards self-assemble in a staggered cascade along a path: Foundations →
Preflop Strategy → Postflop Foundations → Range Thinking → Game Theory → Bet
Sizing & Defense. Then the camera pulls back and the road carries on into the
mapped-but-not-yet-live stretch, the far cards dimming toward the horizon.

Real number from the captured site: **12 of 29 Poker Journey modules are live
today, with the full path already mapped out.** The honest framing — live now
versus mapped — is also the more impressive one.

Reproduce: N items **self-assemble in a staggered cascade** and hold, then an
optional **camera zoom-OUT reveals the array inside a vaster whole.** Both halves
of the blueprint are used, in that order. The signature cascade is kept intact.

Scene 1 (0.0–1.2s): `bg` field, empty. The headline **"12 of 29 modules live
today"** enters by `per-word staggered reveal` (`dynamic-content-sequencing`),
`h2` in `text`, upper third. Nothing else yet.

Scene 2 (1.2–3.6s): the six live module cards **cascade in staggered**, left to
right, each on a long-tail settle with a soft swipe — Foundations, Preflop Strategy,
Postflop Foundations, Range Thinking, Game Theory, Bet Sizing & Defense. `positive`
AVAILABLE NOW chips arrive with their cards. Full-width strip, ~40% of canvas. VO
opens *"From your first hand..."*.

Scene 3 (3.6–5.4s): as the VO reaches **"to advanced strategy"**, the camera begins
its **pull-back** (`multi-phase-camera`) and the mapped-not-live stretch resolves
behind the live row — Blockers & Card Removal, Game Theory Foundations, Poker
Fundamentals, then unlabelled cards receding at ~55%, ~30%, ~15% opacity.

Scene 4 (5.4–6.8s): the pull-back continues to its widest and the full path is
visible at once — live in front, mapped behind, horizon beyond. The dimming ladder
does the work; no text is needed to explain it.

Scene 5 (6.8–8.0s): camera **decelerates to a stop** and holds. `subtle jitter`
only. No re-push.

## Frame 9 — Learn Poker. By Playing.

- type: cta
- status: animated
- duration: 5s
- transition_in: crossfade
- poster: 4s
- scene: Three devices carrying the same interface clear the stage; the spade mark and wordmark form, the headline lands in two beats, Start Free appears
- voiceover: none — the film ends spoken-out; music and the lockup carry the close
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, after the argument is already won
- beat: the landing
- focal: the lockup, then the CTA
- roles: assets/logo-8f556ecf.svg = cutout (spade — the actual brand mark) · assets/favicon.ico = supporting
- sfx: a soft settle as the devices recede; one warm low resolve on the lockup; a single quiet tick as Start Free lands. Music resolves and ends clean — no fade-to-nothing.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/09-hero.html

A slow lateral drift across a MacBook, an iPad and a phone, all three showing the
same surface at different scales. They ease back and dim out, the violet spotlight
returns, and the lockup forms at centre: the spade glyph plus **StackedPoker** in
Geist.

**There is no bespoke logo file.** `logo-8f556ecf.svg` is the lucide spade in
`currentColor` — the real site's mark is that glyph beside a Geist wordmark. Build
it that way; do not compose a substitute.

The headline lands in two beats, exactly as scripted:

> **Learn Poker** — hold — **By Playing.**

Then the one solid element in the whole film: the violet `Start Free` pill.
Under it, the site's own reassurance — *Free to start · No credit card.*

Adapt: keep the signature — **feature/UI elements clear the stage and the lockup
resolves into a centred mark**, extended to the CTA. Changed: there is no
assembly-from-parts, because the real mark is a single glyph and faking a build
would misrepresent the brand. The stage-clearing and the centred resolve carry the
shape.

**This frame owns the film's only real exit.** Every other frame exits through its
injected transition; this one ends the video.

Scene 1 (0.0–1.2s): the three devices drift laterally, parallaxing at three
different rates — MacBook slowest and largest, phone fastest and smallest.
Layered-depth, ~55% of canvas. No text yet. No VO anywhere in this frame.

Scene 2 (1.2–2.0s): the devices **ease back and dim out** together as the violet
spotlight reopens at centre (`ambient-glow-bloom`). The stage clears — the
blueprint's signature.

Scene 3 (2.0–2.6s): the lockup resolves at centre by `scale-swap`
(`scale-swap-transition`) out of the spotlight — spade glyph plus **StackedPoker**
in Geist, `text`, one object.

Scene 4 (2.6–3.3s): **"Learn Poker"** lands, `h1`, centred, on a long-tail settle —
then holds. The hold is written into the script and must not be shortened.

Scene 5 (3.3–3.9s): **"By Playing."** lands as the second beat, same treatment
(`discrete-text-sequence`). Two beats, never one.

Scene 6 (3.9–4.4s): the **Start Free** pill arrives — solid `primary`, the only
non-glass element in sixty seconds. `Free to start · No credit card` fades up
beneath it in `text-muted`.

Scene 7 (4.4–5.0s): held and completely still. No jitter here — the film has
stopped. Music resolves onto this window and ends clean.
