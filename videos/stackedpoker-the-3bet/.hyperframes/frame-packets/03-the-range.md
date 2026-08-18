# Frame packet: 03-the-range

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 3 — The Range

- type: feature_showcase
- status: outline
- duration: 7s
- transition_in: cut
- poster: 5.5s
- scene: The table dissolves into the canonical BTN 3-bet range and A5s lights inside it
- voiceover: "See where it sits in the range."
- blueprint: compose
- persuasion: One decision is part of a whole strategy
- focal: the A5s cell, then the range around it
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3)
- sfx: u-glass at 0.5 (0.15); u-shimmer at 2.6 (0.17); u-shimmer at 4.0 (0.10)
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/03-the-range.html
- handoff_in: opens on Frame 2's exact end state. **Nothing re-enters at t=0.**
- handoff_out: cards at 88×124 · 864–1056 × 170–294; the full 13×13 grid at 682–1238 × 320–876 with A5s hero-lit, the full-frequency hands at `.cell-in` and the five partials at `.cell-part`; the label lit. Static from 6.2s.

**This is the hero moment, and it must not be busy.**

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.6s): the table **dissolves into** the grid — the seat ring, the
readouts and the pills fade in place while the glass reshapes; the two cards shrink to
88×124 and rise to 864–1056 × 170–294. One continuous move, no cut.

Scene 3 (1.6–2.6s): the **13×13 grid resolves as a whole** at its dim resting value.
Cells do **not** cascade in one by one. Rank labels above and to the right, `.label`.
The header reads **BTN 3-BET RANGE vs CO OPEN** — the resolver's own label, verbatim.

Scene 4 (2.6–3.6s): **A5s lights alone**, hero-weighted, with a soft halo. Then a
**held beat where nothing else moves.** This is the pivot of the film.

Scene 5 (3.6–5.4s): the rest of the range illuminates, index-staggered and gently:
**AA, KK, QQ, JJ, AKs, AKo, AQs, A4s** at full weight (`.cell-in`), and **TT, AQo,
KQs, 65s, 54s** visibly dimmer (`.cell-part`) because the lesson gives them partial
frequencies. Nothing flashes; no cell scales up.

Scene 6 (5.4–6.2s): one `.body` line settles beneath the grid, the resolver's own
subtitle, shortened only by removing its trailing clause: **See where A5s sits in
Hero's 3-betting frequency.**

Scene 7 (6.2–7.0s): **held.**
