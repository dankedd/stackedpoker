# Frame packet: 04-range

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 4 — Range

- type: feature_showcase
- status: outline
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
