# Frame packet: 07-brand

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 7 — Brand

- type: cta
- status: outline
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
