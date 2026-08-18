# Frame packet: 03-traditional-learning

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-launch\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 3 — What Everybody Does Instead

- type: pain_point
- status: built
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

## Selected motion rule: depth-scatter-assemble

---
name: depth-scatter-assemble
description: N elements scatter into / reassemble from a rotating 3D depth-cloud, each starting at a deterministic index-derived 3D offset and settling to a clean flat layout.
metadata:
  tags: 3d, scatter, assemble, depth, cloud, tumble, kinetic, letter, fragment, logo, reassemble
---

# Depth Scatter ↔ Assemble

N elements (glyphs, cards, logo fragments) fly in from a rotating 3D depth-cloud and lock into a flat layout — or the reverse. Each element has its OWN index-derived point in the cloud (translateZ depth + rotateX/Y tumble + x/y scatter). Distinct from `orbit-3d-entry` (flip-in then continuous orbit) and `center-outward-expansion` (flat burst from one shared center): here the resolve is a flat assembled layout.

## How It Works

Each element's flat target lives in `data-target-x/y`; its scattered state is pure trig on its index — golden-angle spread, stepped depth — so the cloud is byte-identical every render with no `Math.random`:

```js
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.39943 rad — even spread, no clumping
const a = i * GOLDEN;
const scatterX = Math.cos(a) * RADIUS;
const scatterY = Math.sin(a) * RADIUS;
const scatterZ = Z_NEAR - (i / (n - 1)) * (Z_NEAR - Z_FAR); // stepped depth
const rotX = Math.sin(a) * TUMBLE;
const rotY = Math.cos(a) * TUMBLE;
```

Elements are PARKED at their scatter points (`gsap.set`, opacity 0) before any tween, then each tweens to its flat target while the whole stage slowly rotates so the scatter has life before it locks. Requires `perspective` on the scene root and `preserve-3d` on the stage AND each element, or depth + tumble flatten to a 2D scale.

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="cloud-stage">
  <div class="frag" data-target-x="-260" data-target-y="0">{glyph1}</div>
  <div class="frag" data-target-x="-130" data-target-y="0">{glyph2}</div>
  <!-- … one .frag per glyph / fragment … -->
</div>
```

```css
.scene-root {
  display: grid;
  place-items: center;
  perspective: 1400px; /* REQUIRED */
}
.cloud-stage {
  position: relative;
  display: grid;
  place-items: center;
  transform-style: preserve-3d;
  will-change: transform;
}
.frag {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-style: preserve-3d;
  backface-visibility: hidden; /* hides the mirrored face mid-tumble */
  will-change: transform, opacity;
}
```

```js
const frags = Array.from(document.querySelectorAll(".frag"));
const n = frags.length;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// 1) Park every fragment in the cloud BEFORE any tween fires
const scatter = frags.map((el, i) => {
  const a = i * GOLDEN;
  const depthT = n > 1 ? i / (n - 1) : 0;
  return {
    x: Math.cos(a) * RADIUS,
    y: Math.sin(a) * RADIUS,
    z: Z_NEAR - depthT * (Z_NEAR - Z_FAR),
    rotationX: Math.sin(a) * TUMBLE,
    rotationY: Math.cos(a) * TUMBLE,
  };
});
frags.forEach((el, i) => gsap.set(el, { xPercent: -50, yPercent: -50, ...scatter[i], opacity: 0 }));

// 2) The cloud rotates so the scatter has life during assembly
tl.to(
  ".cloud-stage",
  { rotationY: CLOUD_SPIN_DEG, duration: CLOUD_SPIN_DUR, ease: "power1.out" },
  0,
);

// 3) ASSEMBLE — cloud point → flat target, index stagger = cloud collapsing inward
frags.forEach((el, i) => {
  tl.to(
    el,
    {
      x: Number(el.dataset.targetX),
      y: Number(el.dataset.targetY),
      z: 0,
      rotationX: 0,
      rotationY: 0,
      opacity: 1,
      duration: ASSEMBLE_DUR,
      ease: ASSEMBLE_EASE,
    },
    i * STAGGER,
  );
});
```

## Variations

- **Tumble-swap** (the beat-change hand-off): two glyph sets share the cloud; ONE shared 0→1 progress tween drives both in its `onUpdate` — outgoing lerps layout→cloud with `opacity: 1−p`, incoming lerps cloud→layout with `opacity: p`. Two separate tweens drift out of phase under seek and the cross stops reading as one hand-off. Inject per-glyph spans per phrase at setup (measure advance widths after `document.fonts.ready` — single-scene only).
- **Radial letter-explode → resolve**: flat-plane special case — `Z_NEAR = Z_FAR = 0`, small `TUMBLE`; reverse the assemble for the explode. Pure in-plane.
- **Scatter-OUT**: reverse assemble (layout → cloud, opacity 1→0) ONLY as the composition's final beat — mid-shot it reads as the shot ending.
- **Parallax lockup**: back layers get deeper `|Z_FAR|` + longer `ASSEMBLE_DUR`, foreground shallower/shorter — depth-speeded slide-in that locks into the logo.

## Values

| token                  | range                 | notes                                                                         |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------- |
| n                      | 4–14 (fragments 4–9)  | above ~14 individual paths stop reading                                       |
| RADIUS                 | 250–700px             | keep the farthest scatter in frame or fragments pop in with no travel         |
| Z_NEAR / Z_FAR         | +150…+450 / −150…−500 | large `\|z\|` needs a wider `perspective` or fragments smear                  |
| TUMBLE                 | 40–110°               | past 90° glyphs show blank mid-tween (intended); cap ~80° for one-faced cards |
| ASSEMBLE_DUR           | 0.7–1.4s              |                                                                               |
| ASSEMBLE_EASE          | `power3.out` default  | `expo.out` snaps, `back.out(1.4)` seats with overshoot; never `in`            |
| STAGGER                | 0.03–0.09s            | `n × STAGGER < ASSEMBLE_DUR` — one collapsing motion, not a queue             |
| CLOUD_SPIN_DEG / \_DUR | 15–60° over ≥ dur     | gentle life; too fast competes with the assembly                              |
| SWAP_DUR               | 0.5–1.0s              | on the beat boundary; shorter = hard cross                                    |

## Critical Constraints

- **Every scattered value is index-derived** — `cos/sin(i × GOLDEN)` + stepped `z`. The golden angle spreads points evenly with no clumps and no `Math.random`.
- **`gsap.set` the cloud BEFORE adding tweens** — skipping it leaves frame 0 showing the assembled layout, then a teleport when the first tween starts.
- **`perspective` + `preserve-3d` on stage AND each fragment** — missing any one flattens the depth.
- **Resolve flat** — settled state is `z: 0`, rotations 0; a still-tilted resolve reads unfinished.
- **Tumble-swap: one shared progress for both glyph sets.**
- **Depth ordering is automatic** inside `preserve-3d` (paint order follows actual Z) — no manual z-index, unlike the orbit case's capped band.

## See also

`orbit-3d-entry` (settles into a continuous orbit instead) · `hacker-flip-3d` (glyphs decode on arrival) · `3d-text-depth-layers` (extrude the locked wordmark) · `center-outward-expansion` (flat 2D cousin) · `sine-wave-loop` (idle breathe on the resolved layout).

## Selected motion rule: motion-blur-streak

---
name: motion-blur-streak
description: Fake directional velocity blur on a fast entrance or camera push-through — blur peaks at max speed and resolves to 0 at the settle, so the element streaks in then snaps sharp. Two paths — SVG feGaussianBlur on the motion axis, or an echo/ghost trail that collapses into the lead.
metadata:
  tags: motion-blur, velocity, streak, entrance, fly-in, ghost, echo, svg-filter, kinetic, camera, snap
---

# Motion-Blur Streak

Real motion blur isn't available to a seeked renderer (it integrates over shutter time), so this rule **fakes** it for a fast fly-in or hard camera push-through. The whole point is the _coupling_: the blur envelope rides the **same ease and window** as the position tween, so peak blur lands exactly on peak speed and the element is razor-sharp the instant it stops. Two paths:

- **(A) Directional SVG blur** — inline `<feGaussianBlur stdDeviation="X 0">` (X on the motion axis, 0 across it), tweened via a proxy. Cleanest; a true directional smear.
- **(B) Echo / ghost trail** — 2–4 duplicates at decreasing opacity, offset backward along the motion vector, collapsing into the lead as it settles. No filter cost; a stylized "speed-line" trail.

**Entrances and mid-shot moves only — never a mid-composition exit.** A blurred element fleeing off-frame mid-composition reads as a glitch; a hard exit between scenes is the transition's job (`../../transitions/overview.md`). One sanctioned scope extension: the envelope may ride the **camera wrapper** during a travel leg — see the Camera-Travel Carve-Out.

## How It Works

A fast `out`-eased move front-loads velocity — fastest off the start, bleeding to zero at the settle. Map the blur/echo envelope onto that same curve: position travels from an off-frame / pushed-back start to rest over `MOVE_DUR`; in lockstep on the same window and ease the smear goes `PEAK_BLUR → 0` (A) or the ghosts collapse onto the lead (B). By the settle the element is fully crisp and dwells ≥1 s — the contrast between violent streak and still, sharp settle IS the effect. GSAP can't tween an SVG attribute directly: tween a plain `{ v }` proxy and write `setAttribute("stdDeviation", …)` in `onUpdate`, seeding it once at setup so a seek to t=0 shows the streaked start.

## Recipe

```html
<!-- inside a standard scene clip; overflow: hidden on the scene (the smear extends past rest) -->
<svg width="0" height="0" aria-hidden="true" style="position: absolute">
  <filter id="streak" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur id="streak-blur" in="SourceGraphic" stdDeviation="0 0" />
  </filter>
</svg>
<div class="streak-el" id="streak-el" style="filter: url(#streak)">{phrase}</div>
<!-- Path B instead: N-1 aria-hidden .streak-ghost duplicates BEHIND the lead, no filter -->
```

```js
// Path A — proxy-tweened directional blur.
const blurNode = document.getElementById("streak-blur");
const blurProxy = { v: PEAK_BLUR };
const writeBlur = () => blurNode.setAttribute("stdDeviation", `${blurProxy.v} 0`); // X axis only
writeBlur(); // seed frame 0 — a seek to t=0 must show the streaked start, not a sharp pre-frame

tl.fromTo(
  "#streak-el",
  { x: ENTER_FROM_X, opacity: 0 },
  { x: 0, opacity: 1, duration: MOVE_DUR, ease: MOVE_EASE },
  MOVE_START,
);
tl.to(blurProxy, { v: 0, duration: MOVE_DUR, ease: MOVE_EASE, onUpdate: writeBlur }, MOVE_START);

// Path B — ghosts on the SAME window/ease; per-ghost variation by index.
gsap.utils.toArray(".streak-ghost").forEach((g) => {
  const i = Number(g.dataset.i); // 1..N-1, set in HTML
  tl.fromTo(
    g,
    { x: ENTER_FROM_X - i * ECHO_STEP_PX, opacity: GHOST_BASE_OPACITY / i },
    { x: 0, opacity: 0, duration: MOVE_DUR, ease: MOVE_EASE },
    MOVE_START,
  );
});
```

## Variations

- **Vertical streak** — swap axes: `y`, `stdDeviation="0 Y"`, vertical echo offsets.
- **Camera push-through** — `scale: SCALE_FROM → 1` with a symmetric `"B B"` envelope (depth-wise smear, not directional): the wordmark punches out of soft focus and snaps crisp at the lock.
- **Staggered grid streak-in** — each card streaks into its slot at `MOVE_START + i * CARD_STAGGER` with its own blur proxy / ghosts; sharp the instant it lands.
- **Hold-the-streak** — blur on a marginally slower curve than position (position `expo.out`, blur `power3.out`) so the last wisp resolves just after arrival. Sparingly; default is locked envelopes.

## Camera-Travel Carve-Out

The envelope is also sanctioned at **wrapper level**: on the `.world` / camera wrapper of a virtual-camera scene ([viewport-change.md](viewport-change.md), [multi-phase-camera.md](multi-phase-camera.md), [3d-camera-flight.md](3d-camera-flight.md)) during a **travel leg** — a dive, a whip sweep, a violent final push. This does **not** violate "never a mid-composition exit": the world never leaves frame — the camera travels _through_ it, and every leg ends with the world at rest, sharp, inside the frame. Each leg is an **arrival** at the next pose, so the entrance doctrine applies leg by leg. Three deltas from the element-level recipe:

- **Envelope follows the leg's ease.** An `out` leg (dive, final push) uses the base recipe unchanged. An `inOut` repositioning leg peaks mid-leg: split the envelope at the velocity peak — `0 → PEAK` on the in-half ease over the first half, `PEAK → 0` on the out-half over the second. Seed the proxy at **0** for these (the streaked state lives mid-leg, not at t=0; seed-at-`PEAK_BLUR` belongs to the entrance shape, where the first frame IS the fastest).
- **Filter placement.** 2D camera: `filter: url(#streak)` on the `.world` wrapper. 3D flight: on the **perspective stage** above the 3D context — a `filter` on a `preserve-3d` element flattens it and collapses every `translateZ`. Never per-element inside the world: one frame-wide envelope, not N desynced ones.
- **Full-frame blur is heavy** — cap `PEAK_BLUR` ~18–20 at wrapper level (vs 30 for one element); a brief whip may touch ~24. Axis rule as usual: `"X 0"` for a lateral whip/pan, `"B B"` for a dive/push.

### Whip sweep (named composition)

The heavily-blurred lateral whip that resolves into the next region — two rules on one window:

1. **Position** — [nudge-curve.md](nudge-curve.md)'s three-phase chain on the camera state, tuned burst-dominant (tail still ≥3× ramp-in in time).
2. **Blur** — `0 → PEAK` across the ramp-in, held at `PEAK` through the linear burst (constant velocity = constant smear), `PEAK → 0` across the tail.

Swap or reveal the next region's content DURING the burst — the smear masks the change; the `power4.out` tail lands it sharp. Reveal during the burst, read after the tail.

```js
tl.to(cam, { x: WHIP_X * 0.1, duration: 0.12, ease: "power3.in", onUpdate: applyCamera }, WHIP_AT);
tl.to(
  cam,
  { x: WHIP_X * 0.75, duration: 0.1, ease: "none", onUpdate: applyCamera },
  WHIP_AT + 0.12,
);
tl.to(
  cam,
  { x: WHIP_X, duration: 0.35, ease: "power4.out", onUpdate: applyCamera },
  WHIP_AT + 0.22,
);

tl.to(blurProxy, { v: PEAK_BLUR, duration: 0.12, ease: "power3.in", onUpdate: writeBlur }, WHIP_AT);
// blur holds at PEAK through the linear burst (no tween needed — value rests at PEAK)
tl.to(blurProxy, { v: 0, duration: 0.35, ease: "power4.out", onUpdate: writeBlur }, WHIP_AT + 0.22);
```

## Values

| token              | range                                              | notes                                                                                           |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| MOVE_EASE          | `expo.out` / `power4.out` (default) / `power3.out` | `out`-family ONLY — `in`/`inOut` puts peak speed in the wrong place; position and blur share it |
| MOVE_DUR           | 0.25–0.6s                                          | over ~0.7s reads as a focus pull, not velocity                                                  |
| ENTER_FROM_X/Y     | 40–120% of the element's own dimension             | enough runway for the streak to read                                                            |
| PEAK_BLUR          | 8–30 (default 18)                                  | >30 erases the glyph at the start; ~18–20 cap at wrapper level                                  |
| SCALE_FROM         | 1.3–2.5                                            | push-through variation                                                                          |
| N (ghosts)         | 2–4                                                | >4 reads as strobe, not streak                                                                  |
| ECHO_STEP_PX       | 12–40px                                            | `N × step ≲ ENTER_FROM` so the furthest ghost starts inside the runway                          |
| GHOST_BASE_OPACITY | 0.3–0.6                                            | opaque ghosts read as duplicate elements                                                        |
| CARD_STAGGER       | 0.05–0.12s                                         | one assembling wave, not separate arrivals                                                      |

## Critical Constraints

- Blur peaks at peak speed and resolves to 0 at the settle — share the ease and window between position and envelope. A blur that lingers after the stop reads as a focus pull.
- Entrances / mid-shot arrivals only — never a mid-composition exit; wrapper-level use only per the carve-out.
- Seed `stdDeviation` at setup: at `PEAK_BLUR` for the entrance shape, at 0 for a whip / `inOut` leg.
- Generous filter region (`x="-50%" y="-50%" width="200%" height="200%"`) or the smear clips at the element's box edge.
- Directional axis: `"X 0"` horizontal, `"0 Y"` vertical, `"B B"` only for a depth/scale move — symmetric blur on a sideways move looks like defocus.
- Dwell ≥1 s sharp after the snap; a streak landing at the last beat reads as "flashed and gone".
- Heavy element on a solid field — thin type (< ~120px / 800 weight) or a busy backdrop swallows the smear.
- `overflow: hidden` on the scene — the smear / furthest ghost extends past the resting position during travel.

## See also

`kinetic-beat-slam` (streak as one beat's entrance) · `center-outward-expansion` (grid streak-in) · `scale-swap-transition` (same-footprint morph — not an arrival) · `nudge-curve` (the whip sweep's position half) · `3d-camera-flight` / `viewport-change` (the carve-out's wrappers).
