# Frame packet: 04-think-in-ranges

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 4 — Think In Ranges

- type: feature_showcase
- status: outline
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
