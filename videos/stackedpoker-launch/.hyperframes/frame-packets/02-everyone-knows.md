# Frame packet: 02-everyone-knows

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 2 — Everyone Knows This Feeling

- type: pain_point
- status: built
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

## Selected motion rule: cursor-click-ripple

---
name: cursor-click-ripple
description: Animated mouse cursor moves to target, clicks with scale depression and expanding ripple rings.
metadata:
  tags: cursor, click, ripple, interaction, mouse, button
---

# Cursor Click Ripple

An animated cursor moves to a target element, performs a click with visual depression, and emits expanding ripple rings from the click point. Three sequential phases on one timeline: **move** (eased translation to the target's center) → **click** (scale depression on cursor + target together, yoyo back) → **ripple** (1–3 staggered rings expand and fade from the click point). This is a _point event at one location_ — a sustained hold across space is [cursor-drag.md](cursor-drag.md).

## Recipe

```html
<button class="target-button">{ctaLabel}</button>
<div class="cursor"><!-- arrow SVG, positioned at the entry corner --></div>
<!-- Rings live in DOM from t=0 at the click-target CENTER, scale 0 + opacity 0 -->
<div class="ripple ripple-1"></div>
<div class="ripple ripple-2"></div>
<div class="ripple ripple-3"></div>
```

```css
.ripple {
  position: absolute;
  left: 50%;
  top: 50%; /* click-target center */
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px solid {rippleColor};
  transform: translate(-50%, -50%) scale(0);
  opacity: 0;
  pointer-events: none;
}
```

```js
// Phase 1 — Move: eased, not linear
tl.to(".cursor", { x: TARGET_X, y: TARGET_Y, duration: MOVE_DUR, ease: MOVE_EASE }, 0);

// Phase 2 — Click: cursor + target depress together, then return
tl.to(
  ".cursor",
  { scale: CURSOR_PRESS_SCALE, duration: PRESS_DUR, ease: "power2.in", yoyo: true, repeat: 1 },
  CLICK_AT,
);
tl.to(
  ".target-button",
  { scale: TARGET_PRESS_SCALE, duration: PRESS_DUR, ease: "power2.in", yoyo: true, repeat: 1 },
  CLICK_AT,
);

// Phase 3 — Ripple burst, N rings staggered from the click point
tl.set([".ripple-1", ".ripple-2", ".ripple-3"], { opacity: 1 }, RIPPLE_AT);
tl.to(
  [".ripple-1", ".ripple-2", ".ripple-3"],
  {
    scale: RIPPLE_SCALE,
    opacity: 0,
    duration: RIPPLE_DUR,
    ease: RIPPLE_EASE,
    stagger: RIPPLE_STAGGER,
    immediateRender: false, // holds scale 0 / opacity 0 until the click moment
  },
  RIPPLE_AT,
);
```

## Variations

- **Single ring** — one `.ripple`, no stagger; more elegant when the rest of the scene is busy.
- **Keyframed attack-decay** — a `keyframes` block ramps opacity 0 → peak → 0 across the duration; a clearer "energy radiates and dissipates" envelope.
- **Multi-ring expanding pulse** — 3 rings at 0.08 s stagger when the click is the scene's climactic moment.

## Values

| token                       | range                       | notes                                                                                                                                  |
| --------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE_DUR                    | 0.4–1.0 s                   | short darts; long reads as a "considered click." Must end before CLICK_AT or it reads as a misclick                                    |
| MOVE_EASE                   | discrete choice             | `power2.inOut` calm · `power3.out` decisive · `back.out(1.2–1.4)` settles onto the button with a tiny recoil (higher reads cartoonish) |
| CLICK_AT                    | `MOVE_DUR + 0–0.3 s`        | zero pause reads as autopilot; >0.3 s reads as hesitation                                                                              |
| PRESS_DUR                   | 0.06–0.12 s (half; yoyo ×2) | short crisp, long mushy; must finish before the next phase needs normal scale                                                          |
| CURSOR / TARGET_PRESS_SCALE | 0.80–0.90 / 0.92–0.97       | cursor compresses MORE than the target — the cursor is the actor, the target the recipient                                             |
| RIPPLE_AT                   | `CLICK_AT + 0–0.08 s`       | simultaneous feels causal; slight delay feels acoustic                                                                                 |
| RIPPLE_DUR                  | 0.5–1.0 s                   | sharp ping vs soft sonar; must complete before anything that needs the ring gone                                                       |
| RIPPLE_SCALE                | 3–6                         | 3 stays near the click site; if the ring would exit the frame before fading, lower it                                                  |
| RIPPLE_STAGGER              | 0.06–0.12 s (or 0)          | below ~0.06 s reads as one thick ring; above ~0.12 s as separate events                                                                |
| RIPPLE_EASE                 | discrete choice             | `power2.out` standard ping · `power3.out` sharper attack · `expo.out` strong distant pulse                                             |
| TARGET_X / TARGET_Y         | layout-derived              | must match the target's visual centroid — a 4 px miss reads as missing the button                                                      |

Reference values: `../../examples/cta-orbit-collapse.html` — 0.5 s move on `back.out(1.3)`, click +0.2 s, press 0.08 s at 0.85/0.95, single ring to 5× over 0.7 s `power2.out`.

## Critical Constraints

- **Move before click** — trigger the click only after the move tween settles; clicking mid-motion reads as unintentional.
- **Rings live in DOM from t=0** at the click-target center with `scale: 0` + `opacity: 0` — never conditionally rendered; `immediateRender: false` on the expand so they hold invisible until the trigger.
- **Ripple from the click point** — the button's visual center, not any element's bounding-box origin.
- **Synchronized depression** — cursor + target depress at the same position with the same duration, and both yoyo back.
- **Cursor above all content** (high z-index) for the whole sequence; `pointer-events: none` on cursor + ripples.

## See also

`orbit-3d-entry` (click as the pivot that collapses orbiters) · `center-outward-expansion` (click triggers an outward burst) · `press-release-spring` (stronger physical feel on the target) · `scale-swap-transition` (the button's post-click state change).

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

## Selected motion rule: press-release-spring

---
name: press-release-spring
description: Tactile button press with linear compression, spring-based elastic recovery, and layered visual feedback (shadow shrink + release burst + background glow).
metadata:
  tags: spring, press, interaction, button, physics, glow, burst, ui
---

# Press-Release Spring Chain

Separates input (linear compression) from output (spring recovery) to create tactile feel: the overshoot is a natural byproduct of the spring config, not manually coded, with secondary motion (shadow shrink, release burst, background glow) layered on the same trigger frame. This is a **reaction on an element already resting on screen** — an arrival that springs in from nothing is [spring-pop-entrance.md](spring-pop-entrance.md); add a visible cursor actor and it becomes [physics-press-reaction.md](physics-press-reaction.md).

Two phases split at the **release**:

1. **Press**: linear ease → compression (`scale: 1 → PRESS_SCALE`, shadow shrinks). Linear, not spring — the dip must read as instant/tactile, not squishy.
2. **Release**: `back.out(BOUNCE_FACTOR)` spring back to 1.0. Optional burst glow ring expands behind the button; optional environmental glow fades in.

State continuity is critical: the release tween's start value MUST equal the press tween's end value, or the spring snaps to a different position. GSAP threads this automatically when both tweens target the same property at **adjacent positions** — `RELEASE_START = PRESS_START + PRESS_DUR`; a gap or overlap breaks it.

## Recipe

```html
<div class="press-stage">
  <div class="bg-glow" id="bg-glow"></div>
  <!-- Burst sits BEHIND the button (z-index 1 vs 2), same footprint, blurred
       radial gradient, opacity 0. bg-glow is a full-stage radial at negative
       inset so it extends past the stage edges. -->
  <div class="burst" id="burst"></div>
  <button class="btn" id="btn">{buttonLabel}</button>
</div>
```

```js
// Phase 1 — press (linear compression)
tl.to(
  "#btn",
  { scale: PRESS_SCALE, boxShadow: "{btnPressedShadow}", duration: PRESS_DUR, ease: "power1.in" },
  PRESS_START,
);

// Phase 2 — release (spring back; start scale == PRESS_SCALE by adjacency)
tl.to(
  "#btn",
  {
    scale: 1,
    boxShadow: "{btnRestShadow}",
    duration: RELEASE_DUR,
    ease: `back.out(${BOUNCE_FACTOR})`,
  },
  RELEASE_START,
);

// Phase 3 — burst glow pops behind the button, then fades
tl.fromTo(
  "#burst",
  { scale: 1, opacity: 0 },
  {
    scale: BURST_PEAK_SCALE,
    opacity: BURST_PEAK_OPACITY,
    duration: BURST_GROW_DUR,
    ease: "power2.out",
  },
  RELEASE_START,
);
tl.to("#burst", { opacity: 0, duration: BURST_FADE_DUR, ease: "power2.in" }, BURST_FADE_START);

// Phase 4 — environmental glow fades in after release
tl.to(
  "#bg-glow",
  { opacity: BG_GLOW_PEAK_OPACITY, duration: BG_GLOW_FADE_DUR, ease: "power2.out" },
  RELEASE_START,
);
```

## Variations

- **Subtle press** (status save / muted CTA): `PRESS_SCALE` ~0.96, `BOUNCE_FACTOR` ~1.4, burst scale/opacity reduced.
- **Dramatic press** (hero CTA / "ship it"): `PRESS_SCALE` ~0.88, `BOUNCE_FACTOR` ~2.5, burst maxed.
- **Color shift during press** — darken mid-press, return on release; interpolated `backgroundColor` at the same timeline positions as the scale tweens. Same state-continuity rule.
- **State change at release** (approve / confirm) — instead of returning to the rest color, swap to `{successColor}` at `RELEASE_START` and pop a checkmark via a separate `back.out(CHECK_BOUNCE)` tween (1.4–2.0, firmer than the button's bounce — a punctuating "stamp"; pop 0.3–0.6 s) at the same position. The button is now terminal — no further presses expected.

## Values

| token                | range                                      | notes                                                                                      |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| button footprint     | ≥ 3–5% of canvas area                      | a 320×68 button at 1080p is ~1% and the press reads as visually insignificant              |
| PRESS_SCALE          | 0.88 dramatic · 0.92 default · 0.96 subtle | never <0.85 (broken) or >0.98 (no perceptible dip)                                         |
| PRESS_DUR            | 0.10–0.30 s                                | shorter = snappier; must be shorter than `RELEASE_DUR` (input faster than spring recovery) |
| RELEASE_DUR          | 0.40–0.90 s                                | shorter = tight pop; longer = loose, wobbly settle                                         |
| BOUNCE_FACTOR        | 1.4 soft · 2.0 firm · 2.8 cartoony         | or `elastic.out(amplitude, period)` for a rubbery oscillation instead of one overshoot     |
| RELEASE_START        | `= PRESS_START + PRESS_DUR`                | adjacency = automatic state continuity                                                     |
| BURST_PEAK_SCALE     | 3 subtle · 6 default · 8 max               | beyond ~8 the radial gradient pixelates visibly                                            |
| BURST_PEAK_OPACITY   | 0.4–1.0                                    | grow ≈ fade, 0.4–0.7 s each; blur 40–100 px (hard ring → ambient haze)                     |
| BG_GLOW_PEAK_OPACITY | 0.1 subtle · 0.25 default · 0.45 max       | higher washes the whole composition; fade-in 0.6–1.0 s; inset −300…−500 px at 1080p        |

Color tokens: pressed surface darker than rest; rest shadow large + diffuse, pressed small + tight (the button "sinks toward the surface"); burst gradient darker + more saturated than `{btnBg}` — same-color glow looks washed out; bg glow a low-opacity tint of the button's hue family.

## Critical Constraints

- **State continuity** — release start value exactly equals press end value; enforced by same-property adjacency at `RELEASE_START = PRESS_START + PRESS_DUR`.
- **Linear press, spring release** — both spring → squishy; both linear → mechanical, no overshoot punch.
- **Anchor compression on center** (`transform-origin: 50% 50%`) or the button collapses asymmetrically.
- **Burst behind, not in front** — burst `z-index: 1`, button `z-index: 2`; in front it occludes the button at peak opacity.
- **Don't tween `boxShadow` and `filter` on the same element** — they compete in the layout pipeline; shadow on the button, blur on the separate burst layer.
- **Climax dwell** — after the burst peak + reveal, the composition must run ≥ 1 s more (≥ 2 s for dramatic variants); a reveal at `t = DURATION − 0.2 s` reads as "flashed and gone."

## See also

`spring-pop-entrance` (the ENTRANCE counterpart — arrival, not reaction) · `physics-press-reaction` (this press with a visible cursor actor) · `cursor-click-ripple` (the cursor click that triggers the press) · `sine-wave-loop` (idle micro-float BEFORE the press) · `center-outward-expansion` (badge burst synced to the release).
