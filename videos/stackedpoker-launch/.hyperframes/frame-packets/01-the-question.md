# Frame packet: 01-the-question

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 1 — The Question

- type: hook
- status: built
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

## Selected motion rule: ambient-glow-bloom

---
name: ambient-glow-bloom
description: Un-triggered soft radial glow that blooms in behind a hero element and holds with a bounded idle breathe, or a single-pass traveling sweep across a surface. No click, no word-sync — it just blooms. Finite, deterministic, seek-safe.
metadata:
  tags: glow, bloom, ambient, radial, sweep, hero, presence, finite, un-triggered
---

# Ambient Glow Bloom

A soft radial glow that **blooms in behind a hero element** (card, logo, metric) and holds, giving it presence. Unlike `press-release-spring`'s click-triggered burst or `asr-keyword-glow`'s word-timed envelope, this glow is **un-triggered** — it blooms on the hero's settle and stays lit. Two forms: a **hero bloom** that swells behind a settling element then breathes, and a **traveling sweep** that translates a soft highlight across a surface exactly once.

## How It Works

A radial-gradient layer sits **behind** the hero (glow `z-index: 1`, hero `z-index: 2` — a glow in front occludes it), starting at `opacity: 0`. Over the bloom-in window it ramps `opacity: 0 → peak` with a gentle `scale` swell, timed so `BLOOM_START + BLOOM_DUR` lands on the hero's settle — glow and hero resolve as ONE beat ("powering on"), never glow-then-card. After bloom-in:

1. **Hero bloom** — a **bounded idle breathe** during the hold: a finite `ease: "none"` tween advances a `phase` proxy and `onUpdate` nudges opacity + scale a hair around peak (never a `yoyo` loop). `sin(0) = 0` → the breathe starts exactly at the bloom's resting state.
2. **Traveling sweep** — a narrow highlight band at one edge translates **once** across to the other (`x` off-surface to off-surface), clipped to the surface (`overflow: hidden`). One pass, no return — a repeating sweep reads as a loading shimmer, not a reveal accent (the shimmer-sweep variation below is the sanctioned exception).

Peak opacity stays restrained (**≤ 0.45 hard ceiling**) so the glow gives presence without washing the frame; the glow color is **darker + more saturated** than the element it backs (a same-hue, same-lightness glow disappears into the surface).

## Recipe

```html
<!-- inside a standard scene clip -->
<div class="bloom-stage">
  <div class="bloom-glow" id="bloom-glow"></div>
  <!-- z-index: 1; inset: GLOW_INSET (negative); background: {glowGradient} -->
  <div class="hero-card" id="hero-card">{HeroLabel}</div>
  <!-- z-index: 2 -->
</div>
<!-- sweep form: <div class="sweep" id="sweep"> inside the overflow:hidden surface -->
```

```js
// ── Form A: HERO BLOOM ── bloom in soft, landing on the hero's settle.
tl.fromTo(
  "#bloom-glow",
  { opacity: 0, scale: GLOW_START_SCALE },
  { opacity: GLOW_PEAK_OPACITY, scale: 1, duration: BLOOM_DUR, ease: "power2.out" },
  BLOOM_START,
);
// Bounded breathe during the hold — finite phase tween, NOT a yoyo loop.
const glow = document.getElementById("bloom-glow");
const phase = { p: 0 };
tl.to(
  phase,
  {
    p: Math.PI * 2 * BREATHE_CYCLES,
    duration: BREATHE_DUR,
    ease: "none",
    onUpdate: () => {
      const s = Math.sin(phase.p);
      glow.style.opacity = String(GLOW_PEAK_OPACITY + s * OPACITY_AMP);
      glow.style.transform = `scale(${1 + s * SCALE_AMP})`;
    },
  },
  BLOOM_START + BLOOM_DUR,
);

// ── Form B: TRAVELING SWEEP ── one finite pass, constant glide.
tl.fromTo(
  "#sweep",
  { x: SWEEP_START_X, opacity: 0 },
  { x: SWEEP_END_X, opacity: SWEEP_PEAK_OPACITY, duration: SWEEP_DUR, ease: "none" },
  SWEEP_START,
);
tl.to("#sweep", { opacity: 0, duration: SWEEP_FADE_DUR, ease: "power1.in" }, SWEEP_FADE_START);
```

## Variations

- **Bloom-and-hold** — for scenes <3s or a hero with its own idle, skip the breathe: the single `fromTo` is the whole recipe.
- **Pulse-on-arrival** — bloom slightly PAST peak (`GLOW_OVERSHOOT_OPACITY`, `scale: 1.06`), then a second adjacent tween eases down to a steady hold — one breath punctuating the landing, no ongoing loop.
- **Multi-hero relay** — stagger per-glow `BLOOM_START` by ~0.15–0.3s across a row; shrink `OPACITY_AMP` / `SCALE_AMP` per the `/√N` rule below.
- **Diagonal raked sweep** — angle `{sweepGradient}` (~105°) across a wordmark: the classic one-pass logo sheen. Narrower `SWEEP_WIDTH`, higher `SWEEP_PEAK_OPACITY`.

### Shimmer sweep (text-clipped status-phrase working-state)

The sweep re-aimed **inside type**: a soft highlight gradient clipped into a status phrase ("Thinking…", "Analyzing dataset…") via `background-clip: text` travels left→right through the letterforms — the grey-on-grey shimmer that says _still working_. Unlike every other form here it legitimately **repeats while the status is live**: the repetition is diegetic working-state, not idle wobble (same defense as a blinking caret — the motion performs status). Two things keep it honest: it is **bounded** (one finite tween whose pass count is computed from the status window, never `repeat: -1`), and it is **killed at resolve** — the moment the status completes, the shimmer stops dead; a shimmer surviving into the answer beat turns a working indicator into decoration.

```js
// Status shimmer — N passes as ONE bounded tween. Killed at resolve.
const status = document.getElementById("status-phrase");
// CSS on #status-phrase: background: {shimmerGradient}; background-size: 300% 100%;
// -webkit-background-clip: text; background-clip: text; color: transparent;
const shimmer = { p: 0 };
const PASSES = Math.round(STATUS_DUR / PASS_PERIOD); // whole passes, computed up front
tl.to(
  shimmer,
  {
    p: PASSES,
    duration: STATUS_DUR,
    ease: "none",
    onUpdate: () => {
      const t = shimmer.p % 1; // 0→1 within each pass; percent axis inverted → left→right travel
      status.style.backgroundPosition = `${(1 - t) * 100}% 50%`;
    },
  },
  STATUS_START,
);
tl.set(status, { backgroundPosition: "100% 50%" }, STATUS_START + STATUS_DUR); // resolve: dead.
```

Keep it a whisper: `{shimmerGradient}` is the status text's own grey with one slightly-lighter band (highlight stop a step above the base, nothing near white); `background-size` ~300% keeps the band narrow in the glyphs; `PASS_PERIOD` 1.2–1.8s — slower reads as a sheen accent, faster as a spinner. Whole-number `PASSES` lands the band at its start position exactly at the kill frame, so the `tl.set` is visually a no-op. This is the working-state cousin of `gradient-text-sweep`: reach **here** when the sweep _means_ "in progress," **there** when the gradient is the typographic treatment itself.

## Values

| token                   | range / default                                        | notes                                                                      |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| GLOW_PEAK_OPACITY       | 0.15 (subtle) → 0.30 (default) → **0.45 hard ceiling** | higher washes the frame; a glow you consciously notice is too strong       |
| GLOW_INSET              | −200 to −450px (1920×1080)                             | negative so the halo extends past the hero; too small reads as a tight rim |
| GLOW_START_SCALE        | 0.80–1.0                                               | ≤1.0 — grow into place, never shrink                                       |
| BLOOM_DUR / BLOOM_START | 0.6–1.4s                                               | `BLOOM_START + BLOOM_DUR` ≈ the hero's settle frame                        |
| OPACITY_AMP / SCALE_AMP | 0.02–0.05 / 0.01–0.03 default                          | `PEAK + OPACITY_AMP ≤ 0.45`; push only when the glow is the sole motion    |
| BREATHE_CYCLES          | period 2.5–4s per breath                               | glow breathes slower than element breathing                                |
| SWEEP_WIDTH             | 15–35% of surface (grid) / 8–15% (wordmark)            |                                                                            |
| SWEEP_DUR               | 0.8–1.6s                                               | one deliberate pass — slow enough to read as light                         |
| SWEEP_PEAK_OPACITY      | 0.10 → 0.25 (default) → 0.40                           | same ≤ ~0.45 wash limit; tight sweeps tolerate the high end                |
| SWEEP_START_X / END_X   | fully off-surface both ends                            | no visible spawn/despawn mid-surface; fade reaches 0 as the band clears    |
| PASS_PERIOD (shimmer)   | 1.2–1.8s                                               | with whole-number PASSES                                                   |

## Critical Constraints

- **Glow peak opacity ≤ 0.45** — including breathe amplitude; default to the LOW end (0.15–0.30).
- **Glow behind, hero in front**; glow color darker + more saturated than the hero surface.
- **Land glow and hero as one beat** — before or after reads as two separate events.
- **Breathe is bounded, sweep is one pass** — the only sanctioned repetition is the shimmer sweep, bounded and killed at resolve.
- **Concurrent halos compound** — per-glow amps ≤ default `/√N`, stagger breathe periods (2.6s / 2.9s / 3.3s) so they don't pulse in lockstep.
- **Don't combine a `boxShadow` glow on the hero with this halo layer** — they compete and read muddy; the glow lives on the dedicated layer.

## See also

`sine-wave-loop` (hero breathes on scale/y while the glow breathes on opacity, out of phase) · `press-release-spring` (the click-triggered sibling — never both behind one element) · `counting-dynamic-scale` / `stat-bars-and-fills` (bloom behind a landing stat) · `center-outward-expansion` (sweep across the assembled grid) · `gradient-text-sweep` (the design-beat gradient counterpart).

## Selected motion rule: depth-of-field-blur

---
name: depth-of-field-blur
description: Selective-focus rack-focus — pull the eye to a focal element by GSAP-tweening filter blur (+ a small opacity dim) on the off-focus layers while the focal one stays sharp. Drive blur via a `--dof` CSS var; finite tweens, no CSS transition, deterministic. Covers single focal pull, rack-focus between two depth planes, and blur-the-cluster-while-pushing-in.
metadata:
  tags: blur, focus, depth-of-field, dof, rack-focus, filter, dim, spotlight, cinematic, push-in
---

# Depth-of-Field Blur (Selective Focus / Rack Focus)

Pulls the eye to one focal element by **blurring** (and slightly **dimming**) everything around it while the focal layer stays sharp — the camera's depth-of-field falling off the background, or a rack-focus shifting which plane is in focus. `filter` and `opacity` are paint-only, so both tween seek-safe. This is the backing rule for the focus-falloff beat the blueprints reach for: outer nodes blurring during a push-in (`constellation-hub`), rack-focus across a parallax card stack (`cursor-ui-demo`), non-highlighted cards dimming to spotlight a hero metric (`dataviz-countup`).

## How It Works

Every layer carries a `--dof` custom property (px of blur), read by `filter: blur(var(--dof))`, plus its own `opacity`. A GSAP tween advances each layer's `--dof` from `0` to its target blur and its opacity from `1` to a dim level over the focus-shift window. The focal layer's `--dof` stays `0`. Per-layer targets derive from `data-depth` / index, so the falloff is identical on every seek.

Three mechanics, same primitive:

1. **Focal pull** — one window: off-focus layers go sharp(0) → blurred while the focal layer holds at 0. The eye is pulled to the only thing still crisp.
2. **Rack focus** — two adjacent windows on the same property: plane A's blur ramps 0 → max at the same position plane B's ramps max → 0. State continuity matters exactly as in `press-release-spring`: A's resting blur after the rack must equal what B held before it — author both as tweens on the same `--dof` at the same position so the hand-off is seamless.
3. **Blur-the-cluster-while-pushing-in** — the DoF tween runs at the SAME timeline position as a camera push-in (`multi-phase-camera` / `coordinate-target-zoom`): "the world recedes" and "we push in" read as one move.

## Recipe

```html
<div class="world" id="world">
  <!-- Focal layer — stays sharp -->
  <div class="layer focal" id="focal">{FocalLabel}</div>
  <!-- Off-focus layers — blur + dim; data-depth orders near→far -->
  <div class="layer ctx" data-depth="1">{Context A}</div>
  <div class="layer ctx" data-depth="2">{Context B}</div>
  <div class="layer ctx" data-depth="3">{Context C}</div>
</div>
```

```css
.world {
  /* single wrapper so a concurrent camera push-in transforms everything
     together; DoF is independent of the camera */
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 50% 50%;
}
.layer {
  --dof: 0px; /* px of blur; filter reads it — starts sharp */
  filter: blur(var(--dof));
  will-change: filter; /* promotes the layer so per-frame re-rasterization is cheap */
}
.focal {
  z-index: 2; /* sharp layer must sit ABOVE the blurred ones, or its crisp
     edges read as bleeding into the haze */
}
.ctx {
  z-index: 1;
}
```

```js
// Mechanic 1 — FOCAL PULL. Blur scales with data-depth so far planes blur
// more than near ones; the focal layer (--dof: 0, opacity: 1) is untouched.
gsap.utils.toArray(".ctx").forEach((el) => {
  const depth = Number(el.dataset.depth) || 1;
  tl.to(
    el,
    {
      "--dof": `${BLUR_PER_DEPTH * depth}px`,
      opacity: DIM_LEVEL, // dim, not gone
      duration: FOCUS_DUR,
      ease: "power2.inOut",
    },
    FOCUS_START,
  );
});
```

## Variations

- **Rack focus between two depth planes** — `gsap.set` plane B pre-blurred BEFORE the rack (no pop), then two tweens sharing `RACK_START` + `RACK_DUR`: A → `MAX_BLUR` + `DIM_LEVEL`, B → `0px` + `1`. Shared window makes them cross at the midpoint.
- **Blur the cluster while pushing in** — run the focal-pull tweens at the same position + duration as a camera tween on `#world` (`scale/x/y`, `power2.inOut`). Camera transforms the world; DoF tweens the layers — independent property channels, no conflict.
- **Spotlight a hero metric in a card grid** — `gsap.utils.toArray(".card:not(.hero)")` all defocus (`GRID_BLUR` + `DIM_LEVEL`) on one shared window; heroes are skipped.
- **Refocus / settle** — if the beat resolves back to "everything visible" (or hands off to a crossfade needing a clean outgoing frame), ramp all `--dof` back to `0px` / opacity 1 over the tail (`REFOCUS_START + REFOCUS_DUR ≤ DURATION`).
- **Bounded focus-breathing on the focal layer (optional)** — a finite `ease:"none"` driver writes `Math.max(0, Math.sin(p)) * FOCAL_BREATH_PX` into the focal `--dof` during a hold. Keep it ≤ ~0.6px or it reads as "still focusing"; default to omitting it.

## Values

| token                 | range                                  | notes                                                                                                    |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| BLUR_PER_DEPTH        | 3–6 px per depth step                  | a 3-plane stack tops out ~9–18 px; low = gentle DoF, high = tilt-shift falloff                           |
| MAX_BLUR              | 8 soft → 16 default → 24 heavy px      | terminal blur for a fully-defocused plane; above ~24 px on a big surface, shrink/group the layer instead |
| GRID_BLUR             | 6–12 px                                | pushes cards back without losing the grid's shape                                                        |
| DIM_LEVEL             | 0.4 strong → 0.55 default → 0.7 subtle | rarely below 0.35 — fully dark reads as "removed," not "defocused"                                       |
| FOCUS_DUR             | 0.5–1.2 s                              | a rack/pull is a deliberate move, not a snap; shorter = snap focus, longer = languid                     |
| RACK_START / RACK_DUR | shared by both planes                  | `gsap.set` the pre-blurred plane BEFORE `RACK_START`                                                     |
| FOCAL_BREATH_PX       | ≤ 0.6 px, period 2–3 s                 | barely-there nicety                                                                                      |
| FOCAL vs CTX sizing   | context smaller / grouped              | small context layers let a modest radius still read as "out of focus" — and blur cheaply                 |

Tokens: dark `{bgGradient}` so the sharp focal layer reads as lit and forward; heavy display `{font}` weight — blurred copy needs it to stay shape-legible.

## Critical Constraints

- **Tween the `--dof` variable on the timeline** — reading `filter: blur(var(--dof))` keeps the blur on the HF seek clock.
- **Blur the SMALL / GROUPED layers, not the giant one.** Filter cost scales with radius × pixel area; a 20 px blur on a full-frame background is the worst case. Keep per-layer radius ≤ ~24 px on large surfaces and lean on the `opacity` **dim** to do the push-back work — dim + modest blur reads more like real DoF than blur cranked to the max.
- **`will-change: filter`** on every layer whose blur animates (drop it after settle if the layer also does heavy transform work).
- **Focal layer stays genuinely sharp** — `--dof: 0`, untouched (or breathing ≤ 0.6 px). Any visible blur on the focal element kills the "this is the thing" read.
- **State continuity on a rack** — the outgoing plane starts at the blur the incoming plane was holding, and vice-versa; adjacent tweens on the same `--dof` at the same position.
- **DoF is independent of the camera** — blur the layers, transform `.world` for the push-in; don't fake DoF with the camera transform or vice-versa.
- **Settle sharp before a hand-off** — refocus to `--dof: 0` in the tail if the next beat is a crossfade/push; handing off mid-defocus reads as "the render glitched."
- **Sharp focal layer above blurred layers** (`z-index`).

## See also

[multi-phase-camera.md](multi-phase-camera.md) (the push-in this rule's falloff accompanies) · [coordinate-target-zoom.md](coordinate-target-zoom.md) (zoom onto the focal core — the `constellation-hub` hook) · [viewport-change.md](viewport-change.md) (pan + rack across a tilted card plane) · [counting-dynamic-scale.md](counting-dynamic-scale.md) (hero metric counts up sharp — the `dataviz-countup` spotlight) · [3d-page-scroll.md](3d-page-scroll.md) (the parallax stack to rack between) · [sine-wave-loop.md](sine-wave-loop.md) (post-rack idle; keep both amplitudes tiny).

## Selected motion rule: dynamic-content-sequencing

---
name: dynamic-content-sequencing
description: Auto-calculate timeline start/end times from content length + per-item duration config — longer content gets more screen time without hardcoded numbers.
metadata:
  tags: timeline, sequencing, dynamic, duration, content-aware, utility
---

# Dynamic Content Sequencing

A utility pattern (not a motion rule in itself) for scenes that show a SEQUENCE of items (cards, phrases, stats): each item's duration is computed from its content length + per-item config, and the sequencer assigns absolute start/end times automatically — no hardcoded offsets per item. Distinct from [discrete-text-sequence](discrete-text-sequence.md) (one text element changing states) — this rule swaps between distinct content blocks.

## How It Works

A content array of `{ eyebrow, title, body, speedFactor, hold }` entries is reduced once at build time into a flat `TIMELINE` of `{ …entry, start, end }` — duration per entry is `BASE_DURATION + body.length × SEC_PER_CHAR + hold`, so longer text earns more reading time. A single linear driver's `onUpdate` reverse-searches the active entry and swaps the DOM **only on transitions** (a `lastTitle` guard — per-frame `textContent` writes flicker in render); an optional progress bar fills 0→100% across the whole run.

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="display">
  <div class="eyebrow" id="eyebrow"></div>
  <div class="title" id="title"></div>
  <div class="body" id="body"></div>
  <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
</div>
```

```css
.body {
  min-height: 160px; /* reserve space — content height varies; without this, layout jumps */
}
.progress-fill {
  height: 100%;
  width: 0%;
}
```

```js
// N entries, each with its own pacing (optionally a speedFactor multiplier);
// the final entry uses a larger hold (closing beat).
const CONTENT = [
  { eyebrow: "{eyebrow1}", title: "{title1}", body: "{body1}", hold: HOLD_MID },
  // …
  { eyebrow: "{eyebrowN}", title: "{titleN}", body: "{bodyN}", hold: HOLD_FINAL },
];

// Pre-compute absolute start/end ONCE — never in onUpdate.
let cumulative = 0;
const TIMELINE = CONTENT.map((entry) => {
  const dur = BASE_DURATION + entry.body.length * SEC_PER_CHAR + entry.hold;
  const start = cumulative;
  cumulative += dur;
  return { ...entry, start, end: cumulative };
});

function entryAt(time) {
  for (let i = TIMELINE.length - 1; i >= 0; i--) {
    if (time >= TIMELINE[i].start) return TIMELINE[i];
  }
  return TIMELINE[0];
}

const eyebrowEl = document.getElementById("eyebrow");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const progressEl = document.getElementById("progress-fill");

const TOTAL_DURATION = cumulative + TAIL_PAD;
const driver = { t: 0 };
let lastTitle = "";

tl.to(
  driver,
  {
    t: TOTAL_DURATION,
    duration: TOTAL_DURATION,
    ease: "none",
    onUpdate: () => {
      const entry = entryAt(driver.t);
      // Swap content only on transitions — no per-frame DOM thrash
      if (entry.title !== lastTitle) {
        eyebrowEl.textContent = entry.eyebrow;
        titleEl.textContent = entry.title;
        bodyEl.textContent = entry.body;
        lastTitle = entry.title;
      }
      progressEl.style.width = `${(driver.t / TOTAL_DURATION) * 100}%`;
    },
  },
  0,
);
```

## Variations

- **Crossfade between items** — return BOTH adjacent entries during an overlap window (`time ≥ e.start − overlap && time ≤ e.end + overlap`, overlap ≈ 0.3s) and render them with opacities computed from distance to the boundary.
- **Per-item motion variation** — map an `entry.style` key to an existing rule per chapter (e.g. `3d-text-depth-layers` → `hacker-flip-3d` → `counting-dynamic-scale`); the sequencer only orchestrates timing.
- **Auto-extend composition duration** — you can set `data-duration` from the computed `TOTAL_DURATION` in script, but HF reads `data-duration` at composition load and setting it after init may not take effect — author the duration manually from a rough total.

### Accelerating cadence (geometric hold decay)

For rhetorical escalation — "everyone says…", a roll-call, a praise flurry — the beat grid itself accelerates: early entries hold ~1s (read speed), then windows shrink geometrically into a ~0.15–0.3s flurry, braking on an emphasis state before the resolve. The acceleration is pre-computed into the same flat `TIMELINE` — still content-driven, still deterministic, no speed-up tween anywhere:

```js
// Geometric decay on the hold, clamped at a flurry floor; the brake state holds longest.
const HOLDS = CONTENT.map((entry, i) => Math.max(FLURRY_FLOOR, HOLD_START * Math.pow(DECAY, i)));
HOLDS[CONTENT.length - 1] = HOLD_FINAL;

let cumulative = 0;
const TIMELINE = CONTENT.map((entry, i) => {
  // Past ~0.5s states are glanced as motion texture, not read —
  // drop the per-char term or you never reach flurry speed.
  const readable = HOLDS[i] >= READ_THRESHOLD;
  const dur = HOLDS[i] + (readable ? entry.body.length * SEC_PER_CHAR : 0);
  const start = cumulative;
  cumulative += dur;
  return { ...entry, start, end: cumulative };
});
```

Worked example — **praise-chip flurry**: ~16 short quotes hard-cut through a chip beside a pinned wordmark. First 3 states at `HOLD_START = 1.0` (each reads fully); `DECAY = 0.8` shrinks every following window until `FLURRY_FLOOR = 0.2` catches it (≈12 states over ~2.5s — a churn of acclaim, individually glanced); the longest phrase takes `HOLD_FINAL ≈ 1.6` as the brake before the closing lockup.

Values: `HOLD_START` 0.8–1.2s; `DECAY` 0.75–0.88 (higher = longer runway before the flurry bites); `FLURRY_FLOOR` 0.15–0.3s (below ~0.15s swaps strobe); `READ_THRESHOLD` ~0.5s; brake ≥ 4× the floor or the stop doesn't register as a beat. The 3–6 entry guidance relaxes here — 12–18 states are legal precisely because flurry states aren't individually read. The hard-cut discipline (`lastTitle` guard, instant swaps) is what lets 0.2s states render clean.

## Values

| token         | range                 | notes                                                                                                                 |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| BASE_DURATION | 0.6–1.5s              | minimum per entry regardless of length — even one-word entries get read time                                          |
| SEC_PER_CHAR  | 0.03–0.06 s/char      | ≈17–33 chars/sec; uniform across the sequence so the pace reads as one engine; lean high for wide-character languages |
| HOLD_MID      | 0.5–1.0s              | dwell on a non-final entry; `< HOLD_FINAL`                                                                            |
| HOLD_FINAL    | 1.0–2.0s              | climax dwell — must exceed HOLD_MID by a clear margin so the close reads as a beat                                    |
| SPEED_FACTOR  | 0.5–2.0 (default 1.0) | per-entry only; if every entry shares a factor, fold it into SEC_PER_CHAR                                             |
| TAIL_PAD      | 0.0–1.0s              | quiet beat after the last entry; prefer 0 when the next composition owns the breath                                   |
| CONTENT N     | 3–6 entries           | <3 isn't a sequence; >6 drags (accelerating cadence relaxes this — see above)                                         |

Reference: `../../examples/messaging-multi-phrase.html`.

## Critical Constraints

- **Pre-compute the TIMELINE once at build** — never recompute in `onUpdate`; the reverse search over the flat array is the whole per-frame cost.
- **DOM swap only on entry transition** (`lastTitle`/key guard) — per-frame `textContent` assignment flickers in HF render.
- **`min-height` on the body element** — without reservation, downstream elements (progress bar, brand) jitter as content height varies.
- **Sequential only** — for parallel tracks use a different reduction.
- **Titles fit one line at the chosen size; bodies fit inside `min-height` after wrapping.**

## See also

`discrete-text-sequence` (per-entry typewriter on the body) · `context-sensitive-cursor` (cursor color per chapter) · `vertical-spring-ticker` (animated word swap instead of hard cut) · `scale-swap-transition` (visual morph between entries).

## Selected motion rule: sine-wave-loop

---
name: sine-wave-loop
description: Bounded sine-driven idle — subtle jitter or a single genuinely-needed bounded ambient breath on a held element. De-emphasized: circular breathing as "aliveness" is cheap; prefer sequential reveal timed to the VO, then subtle jitter, before reaching here.
metadata:
  tags: idle, jitter, bounded-ambient, sine, trigonometry, low-amplitude, post-entry
---

# Sine Wave Loop (subtle jitter / bounded ambient)

> **Reach for this last.** Per the motion doctrine (`references/motion-language.md`): circular breathing — scaling text/cards up and down to look "alive" — is cheap, the agent's reflexive cheat, and reads weak. "I'd rather have NO motion than BAD motion." First fill the back of a shot with **sequential reveal timed to the VO**; if a frame has genuinely settled and still needs life, the **sanctioned move is subtle jitter** — this rule at the LOW end of its amplitude range. A full breathing loop is the rare last resort on a single held hero, never stamped on every element.

Keeps a settled element from feeling dead using `Math.sin` on the timeline clock. Two forms:

- **Yoyo form** — one `sine.inOut` tween with `yoyo: true` and a **finite** `repeat` count. Preferred when the idle stands alone on a property nothing else touches.
- **onUpdate form** — one long `ease: "none"` tween drives a `phase` proxy `0 → 2π·CYCLES`; `onUpdate` maps `Math.sin(phase)` into the transform. Required when the offset multiplies/adds onto another live value (compound transforms, amplitude envelopes, multi-octave).

Either way, idle begins where the entry settled: at `phase = 0`, `sin(0) = 0` — the offset is zero, so there is no jump from the entry's resting state.

## Recipe

```js
// onUpdate form — phase-driven, composable.
const phase = { p: 0 };
tl.to(
  phase,
  {
    p: Math.PI * 2 * CYCLES,
    duration: IDLE_DUR,
    ease: "none", // sine provides the easing; a non-linear phase tween distorts the wave
    onUpdate: () => {
      const s = Math.sin(phase.p);
      hero.style.transform = `translateY(${s * Y_AMP_PX}px) scale(${1 + s * SCALE_AMP})`;
      // secondary elements: offset by Math.PI / 2 — synced motion looks mechanical
      dot.style.transform = `scale(${1 + Math.sin(phase.p + Math.PI / 2) * DOT_SCALE_AMP})`;
    },
  },
  IDLE_START_TIME,
);

// Yoyo form — standalone property, finite repeats.
tl.to(
  "#badge",
  { y: -Y_AMP_PX, duration: PERIOD / 2, ease: "sine.inOut", yoyo: true, repeat: REPEATS },
  IDLE_START_TIME,
);
```

## Variations

- **Multi-octave** (organic): stack a higher-frequency overlay — `1 + Math.sin(p) * AMP_PRIMARY + Math.sin(p * OCTAVE_RATIO) * AMP_SECONDARY`, with `AMP_SECONDARY < AMP_PRIMARY` and the combined max inside the normal SCALE_AMP range.
- **Settle and fade** (strongly recommended when `IDLE_DUR > 6s`): ramp amplitude to zero over the last ~20% of idle so the scene visibly settles before the inter-scene transition, instead of handing off mid-drift:

```js
const t = phase.p / (Math.PI * 2 * CYCLES); // 0 → 1 across idle
const env = t < 1 - FADE_FRAC ? 1 : (1 - t) / FADE_FRAC; // FADE_FRAC ≈ 0.2
const scale = 1 + Math.sin(phase.p) * SCALE_AMP * env;
```

This is the single biggest fix when finalize snapshots show "everything's still moving at the end"; it pairs naturally with break-boundary transitions (the outgoing visual is static when the crossfade/push begins).

## Values

| token           | range / default                      | notes                                                                      |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| SCALE_AMP       | **0.008–0.015 default**              | push to 0.02–0.04 only when isolated on canvas / scene <6s / kinetic brief |
| Y_AMP_PX        | **2–3px default**                    | 4–6px only under the same gating; rotation ±0.3–0.8° rarely needed at all  |
| period          | 1.5–3s (2.5–4s when idle is long)    | <1.5s frantic; >4s lifeless in a short window                              |
| CYCLES          | `IDLE_DUR/3 ≤ CYCLES ≤ IDLE_DUR/1.5` | derive from the period, not the other way round                            |
| IDLE_START_TIME | ≥ entry settle + ~0.1s               | `sin(0)=0` at this moment → no jump off the entry tail                     |
| IDLE_DUR        | `TOTAL_DURATION − IDLE_START_TIME`   | one long tween fills the hold — never restarted                            |
| DOT_SCALE_AMP   | 0.04–0.12                            | small accents tolerate more than the hero                                  |
| OCTAVE_RATIO    | 2.0–4.0                              | integer-ish reads musical; non-integer reads organic                       |

## Critical Constraints

- **Prefer reveal, then jitter, then breath** — the doctrine order above; default to the LOW end of every amplitude range. At the upper end across 5+ consecutive scenes the whole film reads as "shimmering".
- **Long idle window** (`IDLE_DUR > 6s` OR idle > 30% of composition): halve `SCALE_AMP` / `Y_AMP_PX`, slow the period to 3–4s, and add the settle-and-fade tail.
- **Concurrent idle on N elements** (columns, card grid, stat row): per-element amplitude ≤ default `/ √N`, AND stagger the periods (2.1s / 1.9s / 2.4s). Three columns at ±6px compound to ±18px of competing motion; three at ±2–3px read as one collective breath.
- **Compose, don't replace** — idle ADDS to the element's resting transform; never overwrite the entry's final translation.
- **Phase tween `ease: "none"`** — sine itself is the curve.
- **No CSS `@keyframes` for idle** — CSS animation runs on the browser's render clock, independent of the HF seek clock; a CSS-driven idle flickers/desyncs. Drive idle inside the timeline.

## See also

`ambient-glow-bloom` (the glow-layer counterpart, same bounded-breathe discipline) · `press-release-spring` / `counting-dynamic-scale` / `card-morph-anchor` / `orbit-3d-entry` (settled elements this can follow) · `spring-pop-entrance` (the arrival that precedes any idle).

## Selected motion rule: spring-pop-entrance

---
name: spring-pop-entrance
description: The canonical entrance pop — an element (or staggered group) arrives by scaling 0 → 1 on a smooth long-tail settle (power3 default); bouncy overshoot is a rare, explicitly-playful exception. fromTo so it's correct at t=0 under seek.
metadata:
  tags: spring, entrance, pop, scale, power3, settle, stagger, reveal, arrival
---

# Spring-Pop Entrance

> **Smooth beats bouncy.** This entrance defaults to a smooth long-tail settle — `power3.out` (or `expo.out` for a faster front) — that decelerates cleanly into the resting size with **no overshoot**. Bouncy `back.out` is the **#1 instant turn-off** in agent-made videos and is almost never executed well; it is a rare, explicitly-playful exception (consumer / fun brand), never the default. When unsure, settle smoothly.

THE entrance primitive: an element (or staggered group) arrives by springing from nothing — `scale: 0 → 1`, optional small `y` rise — and settles without bouncing. This is **arrival**, not reaction: distinct from [press-release-spring.md](press-release-spring.md) (a click/press → release feedback chain on an element that already rests on screen). Many blueprints used to borrow that rule to fake an entrance; reach for this instead.

## How It Works

One `fromTo` carries the whole arrival: from `{ scale: 0, opacity: 0 }` (explicit, so t=0 is correct under seek) to `{ scale: 1, opacity: 1, ease: "power3.out" }`. For a **group**, the same `fromTo` runs per element at `i * STAGGER`, capped so the group reads as one arriving beat. The `scale` grow is load-bearing; the `y` rise is garnish — drop everything else and it must still read as a clean entrance. Let the ease produce the settle: never hand-key a `scale: 1.1` mid-state (it double-bounces against the curve).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="pop-hero" id="hero">{heroLabel}</div>

<div class="pop-grid">
  <div class="pop-item">{itemA}</div>
  <div class="pop-item">{itemB}</div>
  <div class="pop-item">{itemC}</div>
</div>
```

```css
.pop-hero,
.pop-item {
  transform-origin: 50% 50%; /* in-place pop; move to the source point for the anchored variation */
  will-change: transform;
}
.pop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: GRID_GAP;
  place-items: center;
}
```

```js
// Single hero pop — smooth long-tail settle, no overshoot.
tl.fromTo(
  "#hero",
  { scale: 0, opacity: 0 },
  { scale: 1, opacity: 1, duration: POP_DUR, ease: "power3.out" },
  ENTRY_AT,
);

// Staggered group pop — one arriving beat.
gsap.utils.toArray(".pop-item").forEach((el, i) => {
  tl.fromTo(
    el,
    { scale: 0, opacity: 0, y: Y_RISE },
    { scale: 1, opacity: 1, y: 0, duration: POP_DUR, ease: "power3.out" },
    GROUP_ENTRY_AT + i * STAGGER,
  );
});
```

## Variations

- **Calm settle** (premium / enterprise): `power3.out`, no rotation, `Y_RISE` 0–12px — a weighted, confident landing for a hero wordmark or product shot.
- **Firm settle** (everyday default): `power3.out` or `expo.out` for a punchier front, `Y_RISE` ~24px — cards, icons, callouts.
- **Exact-physics settle**: when the settle IS the shot, swap the ease for `springEase({ response: 0.4 })` (critically damped) from `../adapters/gsap-easing-and-stagger.md` → Spring Eases; take `duration` from the helper.
- **Origin-anchored pop**: a callout growing out of a specific point (marker, pointer tip) sets `transform-origin` to that point (e.g. `0% 100%`) so `scale: 0 → 1` reads as "emerging from the source", not "inflating in place".
- **Pop into a held slot**: land the pop and hold still — no idle loop baked into the entrance. If the held frame genuinely needs life, hand off to [sine-wave-loop.md](sine-wave-loop.md) for subtle jitter on a separate later tween; prefer revealing the next element on its VO cue.
- **Bouncy pop (RARE — explicitly-playful only)**: swap the ease for `back.out(OVERSHOOT)` and optionally settle a small `rotation: ROT_FROM → 0` so elements look hand-placed. Only for a deliberately playful register — never product / enterprise / serious tone:

```js
tl.fromTo(
  el,
  { scale: 0, opacity: 0, rotation: ROT_FROM },
  { scale: 1, opacity: 1, rotation: 0, duration: POP_DUR, ease: `back.out(${OVERSHOOT})` },
  GROUP_ENTRY_AT + i * STAGGER,
);
```

Even here keep `OVERSHOOT ≤ ~2` — past that it reads as cartoon wobble. Better still: the baked spring at `dampingFraction: 0.6–0.7` (same adapters doc) gives ~5–10% overshoot that reads physical where `back.out` reads cartoon.

## Values

| token      | range                                     | notes                                                            |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| EASE       | `power3.out` default; `expo.out` punchier | `back.out(OVERSHOOT)` only in the playful variant                |
| POP_DUR    | 0.4–0.7s                                  | shorter = tight snap; hero must be visible by **t ≤ 0.5s**       |
| STAGGER    | 0.04–0.08s                                | `min(0.06, 0.5 / ITEM_COUNT)` — self-caps the window             |
| ITEM_COUNT | 3–9                                       | >9 makes the stagger vanish — switch to a wipe/sweep reveal      |
| Y_RISE     | 0–32px                                    | small; never large enough to read as a slide-up                  |
| ROT_FROM   | −10°–+10°                                 | playful variant only; alternate sign by index (`i % 2 ? 6 : -6`) |
| ENTRY_AT   | 0–0.4s                                    | a beat of quiet, but keep the subject landing by t ≤ 0.5s        |

## Critical Constraints

- Default ease `power3.out` (no overshoot); `back.out` only in the explicitly-playful variant, and there `OVERSHOOT ≤ ~2`.
- `ITEM_COUNT × STAGGER ≤ ~0.5s` — the group must land inside one beat.
- Entrances state the collapsed from-state in `fromTo` — never rely on a CSS-hidden start (it renders visible before the tween claims it under seek).
- `transform-origin: 50% 50%` for an in-place pop; the source point only for the anchored variation.
- This is a finite arrival — idle motion on a held element is a separate, later `sine-wave-loop` tween.

## See also

`center-outward-expansion` (pop while radiating to slots) · `press-release-spring` (the click-feedback counterpart) · `sine-wave-loop` (post-arrival jitter, sparingly).
